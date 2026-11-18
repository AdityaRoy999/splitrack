import { Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuthConfig';
import { getFirebaseAuth } from './firebase';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: Promise<GoogleModule> | undefined;
let configured = false;

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

export async function signInWithGoogle(): Promise<boolean> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = await loadGoogleModule();
  if (!configured) {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || GOOGLE_AUTH_CONFIG.webClientId,
      // This must match app.json's URL scheme. Override both together for a
      // different registration, otherwise Google's callback cannot reopen iOS.
      iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
      offlineAccess: false,
    });
    configured = true;
  }
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return false;
    if (!response.data.idToken) throw new Error('Google could not complete sign-in. Please try again.');
    await signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(response.data.idToken));
    return true;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return false;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Update Google Play services to continue with Google.');
      }
      if (error.code === '10' || error.code === 'DEVELOPER_ERROR') {
        throw new Error('Google sign-in is not configured for this version of the app yet.');
      }
    }
    throw error;
  }
}

export async function clearGoogleSession(): Promise<void> {
  const { GoogleSignin } = await loadGoogleModule();
  await GoogleSignin.signOut();
}
