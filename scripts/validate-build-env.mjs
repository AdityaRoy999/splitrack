import { readFileSync } from 'node:fs';

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

const projectNumber = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID.trim();
if (!/^\d+$/.test(projectNumber) || !process.env.EXPO_PUBLIC_FIREBASE_APP_ID.trim().startsWith(`1:${projectNumber}:`)) {
  throw new Error('Firebase app ID and messaging sender ID must belong to the same project.');
}
const source = readFileSync(new URL('../src/constants/googleAuthConfig.ts', import.meta.url), 'utf8');
const configured = name => source.match(new RegExp(`${name}:\\s*['"]([^'"]+)['"]`))?.[1];
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || configured('webClientId');
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || configured('iosClientId');
const validClient = value => /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value || '') && value.startsWith(`${projectNumber}-`);
if (!validClient(webClientId) || !validClient(iosClientId) ||
    webClientId === configured('webClientId') && process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID.trim() !== configured('projectId')) {
  throw new Error('Google web/iOS OAuth clients and Firebase build variables must refer to the same project.');
}
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const callback = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin')?.[1]?.iosUrlScheme;
if (iosClientId.split('.').reverse().join('.') !== callback) {
  throw new Error('Google iOS client ID and the native callback URL scheme must match before building.');
}

console.log('AWS and Firebase mobile build configuration is present.');
