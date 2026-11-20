import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type AuthCredential, type User } from 'firebase/auth';
import { getFirebaseAuth } from '../services/firebase';
import { api, errorMessage } from '../services/api';
import { uploadImage } from '../services/media';
import { clearGoogleSession, consumePendingGoogleCredential, getGoogleCredential, prepareGoogleLink, signInWithGoogle } from '../services/googleAuth';
import { profileCacheKey, readCachedProfile } from './profileCache';
import { authFlowError, GoogleAccountLinker, hasGoogleProvider, normalizedEmail, type PendingGoogleLink } from './googleLinking';
import { authenticationError } from './authErrors';

export interface UserProfile { id: string; name: string; displayName: string; username: string; handle: string; email: string; avatar: string; avatarRef: string; upiId?: string }
export interface EmailCredentials { mode: 'signin' | 'signup'; name?: string; email: string; password: string; syncGoogle?: boolean }
type AuthValue = {
  user: User | null; profile: UserProfile | null; loading: boolean; profileError: string;
  authenticate(payload: EmailCredentials): Promise<void>;
  authenticateWithGoogle(): Promise<boolean>;
  googleLinked: boolean; pendingGoogleLink: PendingGoogleLink | null; googleLinkError: string; googleLinkRecoveryRequired: boolean;
  linkGoogle(password?: string): Promise<boolean>; cancelGoogleLink(): void;
  completeProfile(data: { displayName: string; username: string; avatar?: string }): Promise<void>;
  refreshProfile(): Promise<void>; logout(): Promise<void>; resetPassword(email: string): Promise<void>;
};
const Context = createContext<AuthValue | undefined>(undefined);
const legacyKeys = ['@splittrack_app_data_v4', '@splittrack_default_account_v1', '@splittrack_auth_session_v1', 'splittrack_user_avatar_uri'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true), [profileError, setProfileError] = useState('');
  const [googleLinked, setGoogleLinked] = useState(false), [pendingGoogleLink, setPendingGoogleLink] = useState<PendingGoogleLink | null>(null);
  const [googleLinkError, setGoogleLinkError] = useState(''), [syncGoogleLoading, setSyncGoogleLoading] = useState(false);
  const [googleLinkRecoveryRequired, setGoogleLinkRecoveryRequired] = useState(false);
  const session = useRef(0);
  const linkSession = useRef(0), activeUid = useRef<string | null>(null);
  const invalidateLinkSession = useCallback(() => { linkSession.current++; }, []);
  const googleLinker = useRef<GoogleAccountLinker<AuthCredential, User> | null>(null);
  useEffect(() => {
    googleLinker.current = new GoogleAccountLinker({
      currentUser: () => getFirebaseAuth().currentUser,
      sessionVersion: () => linkSession.current,
      acquireCredential: getGoogleCredential,
      linkCredential: (signedIn, credential) => linkWithCredential(signedIn, credential),
      reauthenticate: (signedIn, email, password) => reauthenticateWithCredential(signedIn, EmailAuthProvider.credential(email, password)),
      changed: setPendingGoogleLink,
    });
    return () => { invalidateLinkSession(); googleLinker.current = null; };
  }, [invalidateLinkSession]);
  const cancelGoogleLink = useCallback(() => {
    googleLinker.current?.cancel();
    consumePendingGoogleCredential();
    setGoogleLinkError('');
    setGoogleLinkRecoveryRequired(false);
  }, []);
  const refreshProfile = useCallback(async () => {
    const uid = getFirebaseAuth().currentUser?.uid, version = session.current;
    if (!uid) return;
    const next = await api<UserProfile>('/api/profile', { expectedUid: uid, attempts: 1, timeoutMs: 8000 });
    if (version === session.current && uid === getFirebaseAuth().currentUser?.uid) {
      setProfile(next); setProfileError('');
      void AsyncStorage.setItem(profileCacheKey(uid), JSON.stringify(next)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let active = true, unsubscribe = () => {};
    void (async () => {
      try {
        // Never upload the previous demo/session records into a real account.
        await AsyncStorage.multiRemove(legacyKeys);
        if (!active) return;
        unsubscribe = onAuthStateChanged(getFirebaseAuth(), next => {
          const previousUid = activeUid.current;
          setGoogleLinked(hasGoogleProvider(next));
          if (next && previousUid === next.uid) {
            // Provider linking and reauthentication keep the same Firebase UID.
            // Preserve the loaded profile/ledger while refreshing auth metadata.
            setUser(next);
            return;
          }
          activeUid.current = next?.uid || null;
          if (previousUid && previousUid !== next?.uid) { linkSession.current++; cancelGoogleLink(); }
          const pending = googleLinker.current?.pendingLink;
          if (next && pending && normalizedEmail(next.email) !== pending.email) cancelGoogleLink();
          const version = ++session.current;
          setUser(next); setProfile(null); setProfileError(''); setLoading(Boolean(next));
          if (next) void (async () => {
            // A completed profile unlocks the cached ledger without waiting for AWS.
            const saved = readCachedProfile(await AsyncStorage.getItem(profileCacheKey(next.uid)).catch(() => null), next.uid);
            if (!active || version !== session.current) return;
            if (saved) { setProfile(saved); setLoading(false); }
            try { await refreshProfile(); }
            catch (error) { if (active && version === session.current && !saved) setProfileError(errorMessage(error)); }
            finally { if (active && version === session.current) setLoading(false); }
          })();
        });
      } catch (error) { if (active) { setProfileError(errorMessage(error)); setLoading(false); } }
    })();
    return () => { active = false; unsubscribe(); };
  }, [refreshProfile, cancelGoogleLink]);

  useEffect(() => {
    if (user && !googleLinked && user.providerData.some(provider => provider.providerId === 'password')) {
      void prepareGoogleLink().catch(() => {});
    }
  }, [user, googleLinked]);

  useEffect(() => {
    if (!user) return;
    const refreshPhoto = () => { void refreshProfile().catch(() => {}); };
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refreshPhoto(); });
    // AWS caches signed URLs for 45 minutes and they expire after an hour.
    // A short refresh interval renews the photo before that remaining window ends.
    const timer = setInterval(() => { if (AppState.currentState === 'active') refreshPhoto(); }, 10 * 60 * 1000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [user, refreshProfile]);

  const linkGoogle = useCallback(async (password?: string) => {
    const uid = getFirebaseAuth().currentUser?.uid, version = linkSession.current;
    setGoogleLinkError('');
    try {
      const linked = await googleLinker.current!.link(password);
      if (linked && version === linkSession.current && uid === getFirebaseAuth().currentUser?.uid) {
        setGoogleLinked(hasGoogleProvider(getFirebaseAuth().currentUser));
        setUser(getFirebaseAuth().currentUser);
        setGoogleLinkRecoveryRequired(false);
      }
      return linked;
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/google-email-mismatch') await clearGoogleSession().catch(() => {});
      if (version === linkSession.current && uid === getFirebaseAuth().currentUser?.uid) setGoogleLinkError(authenticationError(error));
      throw error;
    }
  }, []);
  const authenticate = useCallback(async ({ mode, name, email, password, syncGoogle = false }: EmailCredentials) => {
    const auth = getFirebaseAuth();
    const pending = googleLinker.current?.pendingLink;
    if (syncGoogle && (mode !== 'signin' || !pending)) {
      cancelGoogleLink();
      throw authFlowError('auth/google-link-expired', 'Choose Google again, then sign in to your existing password account.');
    }
    if (syncGoogle && pending?.email !== normalizedEmail(email)) {
      throw authFlowError('auth/google-email-mismatch', `Sign in to ${pending?.email} to sync the selected Google account.`, pending?.email);
    }
    const version = ++linkSession.current;
    setGoogleLinkRecoveryRequired(false);
    if (mode === 'signup') {
      cancelGoogleLink();
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name?.trim()) await updateProfile(credential.user, { displayName: name.trim() });
    } else {
      if (!syncGoogle) { cancelGoogleLink(); await signInWithEmailAndPassword(auth, email.trim(), password); return; }
      setSyncGoogleLoading(true); setGoogleLinkError('');
      let authenticatedUid: string | undefined;
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        authenticatedUid = credential.user.uid;
        if (version !== linkSession.current || auth.currentUser?.uid !== credential.user.uid || googleLinker.current?.pendingLink?.email !== pending?.email) {
          throw authFlowError('auth/session-changed', 'Your account or Google selection changed. Please start again.');
        }
        try { await linkGoogle(); }
        catch (error) {
          if ((error as { code?: string }).code !== 'auth/requires-recent-login') throw error;
          await linkGoogle(password);
        }
      } catch (error) {
        if (version === linkSession.current) {
          setGoogleLinkError(authenticationError(error));
          if (authenticatedUid && authenticatedUid === auth.currentUser?.uid) setGoogleLinkRecoveryRequired(true);
        }
        throw error;
      } finally { setSyncGoogleLoading(false); }
    }
  }, [cancelGoogleLink, linkGoogle]);
  const authenticateWithGoogle = useCallback(async () => {
    if (getFirebaseAuth().currentUser) return linkGoogle();
    cancelGoogleLink();
    const version = ++linkSession.current;
    try { return await signInWithGoogle(); }
    catch (error) {
      if ((error as { code?: string }).code === 'auth/account-exists-with-different-credential' && version === linkSession.current && !getFirebaseAuth().currentUser) {
        const identity = consumePendingGoogleCredential();
        if (identity) googleLinker.current?.retain(identity);
      }
      throw error;
    }
  }, [cancelGoogleLink, linkGoogle]);
  const completeProfile = useCallback(async (data: { displayName: string; username: string; avatar?: string }) => {
    const avatarRef = data.avatar !== undefined && data.avatar !== profile?.avatar
      ? await uploadImage(data.avatar) : profile?.avatarRef ?? '';
    await api('/api/profile', { method: 'PUT', body: { displayName: data.displayName, username: data.username, avatarRef } });
    await refreshProfile();
  }, [profile?.avatar, profile?.avatarRef, refreshProfile]);
  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    linkSession.current++; cancelGoogleLink();
    const usedGoogle = auth.currentUser?.providerData.some(provider => provider.providerId === 'google.com');
    await signOut(auth);
    if (usedGoogle) await clearGoogleSession().catch(() => {});
  }, [cancelGoogleLink]);
  const resetPassword = useCallback(async (email: string) => { await sendPasswordResetEmail(getFirebaseAuth(), email.trim()); }, []);
  const value = useMemo(() => ({ user, profile, loading: loading || syncGoogleLoading, profileError, authenticate, authenticateWithGoogle, googleLinked, pendingGoogleLink, googleLinkError, googleLinkRecoveryRequired, linkGoogle, cancelGoogleLink, completeProfile, refreshProfile, logout, resetPassword }), [user, profile, loading, syncGoogleLoading, profileError, authenticate, authenticateWithGoogle, googleLinked, pendingGoogleLink, googleLinkError, googleLinkRecoveryRequired, linkGoogle, cancelGoogleLink, completeProfile, refreshProfile, logout, resetPassword]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is missing.'); return value; }
