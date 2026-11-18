import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { getFirebaseAuth } from '../services/firebase';
import { api, errorMessage } from '../services/api';
import { uploadImage } from '../services/media';

export interface UserProfile { id: string; name: string; displayName: string; username: string; handle: string; email: string; avatar: string; avatarRef: string; upiId?: string }
export interface EmailCredentials { mode: 'signin' | 'signup'; name?: string; email: string; password: string }
type AuthValue = {
  user: User | null; profile: UserProfile | null; loading: boolean; profileError: string;
  authenticate(payload: EmailCredentials): Promise<void>;
  completeProfile(data: { displayName: string; username: string; avatar?: string }): Promise<void>;
  refreshProfile(): Promise<void>; logout(): Promise<void>; resetPassword(email: string): Promise<void>;
};
const Context = createContext<AuthValue | undefined>(undefined);
const legacyKeys = ['@splittrack_app_data_v4', '@splittrack_default_account_v1', '@splittrack_auth_session_v1', 'splittrack_user_avatar_uri'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true), [profileError, setProfileError] = useState('');
  const session = useRef(0);
  const refreshProfile = useCallback(async () => {
    const uid = getFirebaseAuth().currentUser?.uid, version = session.current;
    if (!uid) return;
    const next = await api<UserProfile>('/api/profile');
    if (version === session.current && uid === getFirebaseAuth().currentUser?.uid) { setProfile(next); setProfileError(''); }
  }, []);

  useEffect(() => {
    let active = true, unsubscribe = () => {};
    void (async () => {
      try {
        // Never upload the previous demo/session records into a real account.
        await AsyncStorage.multiRemove(legacyKeys);
        if (!active) return;
        unsubscribe = onAuthStateChanged(getFirebaseAuth(), next => {
          const version = ++session.current;
          setUser(next); setProfile(null); setProfileError(''); setLoading(Boolean(next));
          if (next) void refreshProfile().catch(error => {
            if (active && version === session.current) setProfileError(errorMessage(error));
          }).finally(() => { if (active && version === session.current) setLoading(false); });
        });
      } catch (error) { if (active) { setProfileError(errorMessage(error)); setLoading(false); } }
    })();
    return () => { active = false; unsubscribe(); };
  }, [refreshProfile]);

  const authenticate = useCallback(async ({ mode, name, email, password }: EmailCredentials) => {
    const auth = getFirebaseAuth();
    if (mode === 'signup') {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name?.trim()) await updateProfile(credential.user, { displayName: name.trim() });
    } else await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);
  const completeProfile = useCallback(async (data: { displayName: string; username: string; avatar?: string }) => {
    const avatarRef = await uploadImage(data.avatar ?? '');
    await api('/api/profile', { method: 'PUT', body: { displayName: data.displayName, username: data.username, avatarRef } });
    await refreshProfile();
  }, [refreshProfile]);
  const logout = useCallback(async () => { await signOut(getFirebaseAuth()); }, []);
  const resetPassword = useCallback(async (email: string) => { await sendPasswordResetEmail(getFirebaseAuth(), email.trim()); }, []);
  const value = useMemo(() => ({ user, profile, loading, profileError, authenticate, completeProfile, refreshProfile, logout, resetPassword }), [user, profile, loading, profileError, authenticate, completeProfile, refreshProfile, logout, resetPassword]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is missing.'); return value; }
