import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const valid = {
  EXPO_PUBLIC_API_URL: 'https://splittrack.example.invalid', EXPO_PUBLIC_FIREBASE_API_KEY: 'public-test-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fintrack-b7e9d.firebaseapp.com', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'fintrack-b7e9d',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fintrack-b7e9d.firebasestorage.app', EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '828945864022',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:828945864022:web:8e9329bf0e0207d11ab2f7',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '', EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
};
const validate = overrides => spawnSync(process.execPath, [fileURLToPath(new URL('./validate-build-env.mjs', import.meta.url))], {
  env: { ...process.env, ...valid, ...overrides }, encoding: 'utf8',
});
test('both mobile builds accept the current Firebase project and source OAuth defaults', () => {
  const result = validate({});
  assert.equal(result.status, 0, result.stderr);
});
test('missing public build values and API credentials fail before native compilation', () => {
  assert.match(validate({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: '' }).stderr, /Missing mobile build configuration/);
  assert.match(validate({ EXPO_PUBLIC_API_URL: 'https://user:password@example.invalid' }).stderr, /without credentials/);
});
test('Firebase and Google clients cannot mix project identifiers in a build', () => {
  assert.match(validate({ EXPO_PUBLIC_FIREBASE_APP_ID: '1:99999:web:test' }).stderr, /app ID and messaging sender/);
  assert.match(validate({ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '99999-webclient.apps.googleusercontent.com' }).stderr, /must refer to the same project/);
  assert.match(validate({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'another-project' }).stderr, /must refer to the same project/);
});
test('iOS OAuth overrides require an updated matching native callback', () => {
  assert.match(validate({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '828945864022-otherclient.apps.googleusercontent.com' }).stderr, /native callback URL scheme must match/);
});
