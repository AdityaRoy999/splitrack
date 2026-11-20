import { Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import type { AuthCredential } from 'firebase/auth';
import type { GoogleIdentity } from '../auth/googleLinking';
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuthConfig';
import { getFirebaseAuth } from './firebase';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: Promise<GoogleModule> | undefined;
let configured = false;
let signInPromise: Promise<boolean> | undefined;
let credentialPromise: Promise<GoogleIdentity<AuthCredential> | null> | undefined;
let pendingSignInCredential: GoogleIdentity<AuthCredential> | null = null;

function loadGoogleModule() {
  // Loading at button press keeps Expo Go and older builds able to use email
  // sign-in even when they do not contain this native module yet.
  if (!googleModule) {
    googleModule = import('@react-native-google-signin/google-signin').catch(() => {
      googleModule = undefined;
      throw new Error('Google sign-in needs the latest installed version of Splittrack.');
    });
  }
  return googleModule;
}

async function acquireGoogleCredential(): Promise<GoogleIdentity<AuthCredential> | null> {
  const auth = getFirebaseAuth();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || GOOGLE_AUTH_CONFIG.webClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || GOOGLE_AUTH_CONFIG.iosClientId;
  const projectNumber = auth.app.options.messagingSenderId;
  const validClient = (value: string) => /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value) &&
    (!projectNumber || value.startsWith(`${projectNumber}-`));
  if (!validClient(webClientId) ||
      (webClientId === GOOGLE_AUTH_CONFIG.webClientId && auth.app.options.projectId !== GOOGLE_AUTH_CONFIG.projectId) ||
      (Platform.OS === 'ios' && !validClient(iosClientId))) {
    throw new Error('This build has mismatched Google and Firebase configuration.');
  }
  if (Platform.OS === 'ios' && iosClientId.split('.').reverse().join('.') !== GOOGLE_AUTH_CONFIG.iosUrlScheme) {
    throw new Error('This iOS build has mismatched Google client and callback configuration. Update its native Google URL scheme together with the iOS client ID.');
  }
  const { GoogleSignin, isErrorWithCode, statusCodes } = await loadGoogleModule();
  if (!configured) {
    GoogleSignin.configure({
      webClientId,
      iosClientId,
      offlineAccess: false,
    });
    configured = true;
  }
  try {
    if (Platform.OS === 'android') {
      if (!await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })) {
        throw new Error('Update Google Play services to continue with Google.');
      }
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    if (!response.data.idToken) throw new Error('Google could not complete sign-in. Please try again.');
    return { credential: GoogleAuthProvider.credential(response.data.idToken), email: response.data.user?.email || '' };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Update Google Play services to continue with Google.');
      }
      if (error.code === '10' || error.code === 'DEVELOPER_ERROR') {
        throw new Error('Google sign-in is not configured for this version of the app yet.');
      }
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Google sign-in must be enabled for this app in Firebase Authentication.');
      }
    }
    throw error;
  }
}

export function getGoogleCredential(): Promise<GoogleIdentity<AuthCredential> | null> {
  if (!credentialPromise) credentialPromise = acquireGoogleCredential().finally(() => { credentialPromise = undefined; });
  return credentialPromise;
}

async function authenticateWithGoogle(): Promise<boolean> {
  const auth = getFirebaseAuth(), existingUid = auth.currentUser?.uid;
  if (existingUid) throw Object.assign(new Error('Sync Google with your current account instead of signing in again.'), { code: 'auth/session-changed' });
  const identity = await getGoogleCredential();
  if (!identity) return false;
  if (auth.currentUser) throw Object.assign(new Error('Your signed-in account changed. Please start again.'), { code: 'auth/session-changed' });
  try {
    await signInWithCredential(auth, identity.credential);
    return true;
  } catch (error) {
    const failure = error as { code?: string; customData?: { email?: string } };
    if (failure.code === 'auth/account-exists-with-different-credential') {
      const email = identity.email || failure.customData?.email || '';
      pendingSignInCredential = { ...identity, email };
      throw Object.assign(new Error('This email already has a password account. Sign in to it, then sync Google.'), { code: failure.code, email, customData: { email } });
    }
    if (failure.code === 'auth/operation-not-allowed') {
      throw Object.assign(new Error('Google sign-in must be enabled for this app in Firebase Authentication.'), { code: failure.code });
    }
    throw error;
  }
}

export function consumePendingGoogleCredential(): GoogleIdentity<AuthCredential> | null {
  const identity = pendingSignInCredential;
  pendingSignInCredential = null;
  return identity;
}

export async function prepareGoogleLink(): Promise<void> { /* Native Google is loaded on button press. */ }

export function signInWithGoogle(): Promise<boolean> {
  if (!signInPromise) signInPromise = authenticateWithGoogle().finally(() => { signInPromise = undefined; });
  return signInPromise;
}

export async function clearGoogleSession(): Promise<void> {
  pendingSignInCredential = null;
  const { GoogleSignin } = await loadGoogleModule();
  await GoogleSignin.signOut();
}
