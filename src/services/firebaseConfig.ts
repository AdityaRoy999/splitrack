import { getApp, getApps, initializeApp } from 'firebase/app';

// Local .env and GitHub Actions Secrets supply the public Firebase client
// configuration. Auth persistence is initialized separately by each platform.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseApp() {
  if (Object.values(config).some(value => !value?.trim())) {
    throw new Error('This build has incomplete Firebase configuration. Set all six Firebase public variables together.');
  }
  if (!config.appId?.startsWith(`1:${config.messagingSenderId}:`)) {
    throw new Error('This build has mismatched Firebase app and project configuration.');
  }
  return getApps().length ? getApp() : initializeApp(config);
}
