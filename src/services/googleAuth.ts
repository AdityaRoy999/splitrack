import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import type { AuthCredential } from 'firebase/auth';
import type { GoogleIdentity } from '../auth/googleLinking';
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuthConfig';
import { getFirebaseAuth } from './firebase';

let pendingSignInCredential: GoogleIdentity<AuthCredential> | null = null;
let signInPromise: Promise<boolean> | undefined;
type TokenResponse = { access_token?: string; error?: string };
type GoogleOAuth = { initTokenClient(options: {
  client_id: string; scope: string; prompt: string;
  callback(response: TokenResponse): void;
  error_callback(error: { type?: string }): void;
}): { requestAccessToken(): void } };
const googleOAuth = () => (window as Window & { google?: { accounts?: { oauth2?: GoogleOAuth } } }).google?.accounts?.oauth2;
let googleIdentityScript: Promise<GoogleOAuth> | undefined;

export function prepareGoogleLink(): Promise<unknown> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  const available = googleOAuth();
  if (available) return Promise.resolve(available);
  if (!googleIdentityScript) googleIdentityScript = new Promise<GoogleOAuth>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Google could not load. Check your connection and try again.')); }, 8000);
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      const oauth = googleOAuth();
      if (oauth) resolve(oauth);
      else reject(new Error('Google could not load. Check your connection and try again.'));
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Google could not load. Check your connection and try again.')); };
    document.head.appendChild(script);
  }).catch(error => { googleIdentityScript = undefined; throw error; });
  return googleIdentityScript;
}

export async function getGoogleCredential(): Promise<GoogleIdentity<AuthCredential> | null> {
  if (typeof window === 'undefined') throw new Error('Google linking is available in a browser or the installed mobile app.');
  await prepareGoogleLink();
  const oauth = googleOAuth();
  if (!oauth) throw new Error('Google linking is available in a browser or the installed mobile app.');
  const auth = getFirebaseAuth();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || GOOGLE_AUTH_CONFIG.webClientId;
  if (auth.app.options.messagingSenderId && !webClientId.startsWith(`${auth.app.options.messagingSenderId}-`)) {
    throw new Error('This build has mismatched Google and Firebase configuration.');
  }
  // Obtain Google authorization independently of Firebase sign-in. This avoids
  // creating or switching Firebase users just to obtain a linking credential.
  const accessToken = await new Promise<string | null>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: webClientId, scope: 'openid email profile', prompt: 'select_account',
      callback(response) {
        if (response.error === 'access_denied') resolve(null);
        else if (response.error || !response.access_token) reject(new Error('Google could not authorize this account. Please try again.'));
        else resolve(response.access_token);
      },
      error_callback(error) {
        if (error.type === 'popup_closed') resolve(null);
        else reject(Object.assign(new Error('Allow the Google popup and try syncing again.'), { code: 'auth/popup-blocked' }));
      },
    });
    client.requestAccessToken();
  });
  if (!accessToken) return null;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try { response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }); }
  catch { throw Object.assign(new Error('Check your internet connection and try syncing Google again.'), { code: 'auth/network-request-failed' }); }
  finally { clearTimeout(timer); }
  if (!response.ok) throw new Error('Google could not verify this account. Please try again.');
  const identity = await response.json() as { email?: string; email_verified?: boolean };
  if (!identity.email || !identity.email_verified) throw new Error('Choose a Google account with a verified email address.');
  return { credential: GoogleAuthProvider.credential(null, accessToken), email: identity.email };
}

async function authenticateWithGoogle(): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) throw Object.assign(new Error('Your signed-in account changed. Please start again.'), { code: 'auth/session-changed' });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    return true;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    if (code === 'auth/account-exists-with-different-credential') {
      const credential = GoogleAuthProvider.credentialFromError(error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]);
      const email = (error as { customData?: { email?: string } }).customData?.email || '';
      if (credential && email) pendingSignInCredential = { credential, email };
      throw Object.assign(new Error('This email already has a password account. Sign in to it, then sync Google.'), { code, email, customData: { email } });
    }
    throw error;
  }
}

export function signInWithGoogle(): Promise<boolean> {
  if (!signInPromise) signInPromise = authenticateWithGoogle().finally(() => { signInPromise = undefined; });
  return signInPromise;
}

export function consumePendingGoogleCredential(): GoogleIdentity<AuthCredential> | null {
  const identity = pendingSignInCredential;
  pendingSignInCredential = null;
  return identity;
}

export async function clearGoogleSession(): Promise<void> {
  pendingSignInCredential = null;
  // Firebase signOut clears the web app session. Google's browser session is shared.
}
