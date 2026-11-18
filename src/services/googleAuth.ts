import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export async function signInWithGoogle(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(getFirebaseAuth(), provider);
    return true;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    throw error;
  }
}

export async function clearGoogleSession(): Promise<void> {
  // Firebase signOut clears the web app session. Google's browser session is shared.
}
