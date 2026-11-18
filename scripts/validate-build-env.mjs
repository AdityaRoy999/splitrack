const required = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing mobile build configuration: ${missing.join(', ')}`);
}

const apiUrl = new URL(process.env.EXPO_PUBLIC_API_URL);
if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password) {
  throw new Error('EXPO_PUBLIC_API_URL must be an HTTPS API address without credentials.');
}

console.log('AWS and Firebase mobile build configuration is present.');
