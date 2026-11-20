import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/services/googleAuth.android.ts', import.meta.url), 'utf8');
const nativeSource = await readFile(new URL('../src/services/googleAuth.native.ts', import.meta.url), 'utf8');
const configSource = await readFile(new URL('../src/constants/googleAuthConfig.ts', import.meta.url), 'utf8');
const { GOOGLE_AUTH_CONFIG } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(configSource, { mode: 'transform' })).toString('base64')}`);
let moduleNumber = 0;
const defaults = { projectId: 'fintrack-b7e9d', messagingSenderId: '828945864022' };

async function service(options = {}) {
  const state = {
    configureCount: 0, signInCount: 0, exchangeCount: 0, signOutCount: 0, playServicesCount: 0,
    response: { type: 'success', data: { idToken: 'test-token' } },
    playServices: true, platform: 'android', ...options,
  };
  globalThis.__splittrackGoogleAuthTest = {
    config: { ...defaults, ...GOOGLE_AUTH_CONFIG },
    Platform: { OS: state.platform },
    auth: { app: { options: state.firebase || defaults } },
    GoogleAuthProvider: { credential: idToken => ({ idToken }) },
    async signInWithCredential(auth, credential) {
      state.exchangeCount++;
      assert.equal(credential.idToken, 'test-token');
      if (state.exchangeError) throw state.exchangeError;
      return { user: { uid: 'created-or-existing-user' } };
    },
    module: {
      GoogleSignin: {
        configure(value) { state.configureCount++; state.configuration = value; },
        async hasPlayServices() { state.playServicesCount++; return state.playServices; },
        async signIn() {
          state.signInCount++;
          if (state.gate) await state.gate;
          if (state.error) throw state.error;
          return state.response;
        },
        async signOut() { state.signOutCount++; },
      },
      isErrorWithCode: value => value && typeof value.code === 'string',
      statusCodes: { SIGN_IN_CANCELLED: '12501', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
    },
  };
  const isolated = (state.platform === 'ios' ? nativeSource : source)
    .replace("import { Platform } from 'react-native';", 'const { Platform } = globalThis.__splittrackGoogleAuthTest;')
    .replace("import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';", 'const { GoogleAuthProvider, signInWithCredential } = globalThis.__splittrackGoogleAuthTest;')
    .replace("import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuthConfig';", 'const GOOGLE_AUTH_CONFIG = globalThis.__splittrackGoogleAuthTest.config;')
    .replace("import { getFirebaseAuth } from './firebase';", 'const getFirebaseAuth = () => globalThis.__splittrackGoogleAuthTest.auth;')
    .replace("import('@react-native-google-signin/google-signin').catch", 'Promise.resolve(globalThis.__splittrackGoogleAuthTest.module).catch');
  const code = stripTypeScriptTypes(isolated, { mode: 'transform' }) + `\n// instance ${++moduleNumber}`;
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return { ...loaded, state };
}

test('first and subsequent Google sign-ins exchange a Firebase credential, configuring Android once', async () => {
  const previous = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  try {
    const app = await service();
    assert.equal(await app.signInWithGoogle(), true);
    assert.equal(await app.signInWithGoogle(), true);
    assert.equal(app.state.exchangeCount, 2);
    assert.equal(app.state.configureCount, 1);
    assert.equal(app.state.configuration.offlineAccess, false);
    assert.equal('iosClientId' in app.state.configuration, false);
    await app.clearGoogleSession(); assert.equal(app.state.signOutCount, 1);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previous;
  }
});
test('repeated button presses share one native sign-in and credential exchange', async () => {
  let finish;
  const app = await service({ gate: new Promise(resolve => { finish = resolve; }) });
  const first = app.signInWithGoogle(), second = app.signInWithGoogle();
  assert.equal(first, second);
  finish();
  await Promise.all([first, second]);
  assert.equal(app.state.signInCount, 1);
  assert.equal(app.state.exchangeCount, 1);
});
test('cancellation saves no Firebase user and a later attempt can succeed', async () => {
  const app = await service({ response: { type: 'cancelled', data: null } });
  assert.equal(await app.signInWithGoogle(), false);
  assert.equal(app.state.exchangeCount, 0);
  app.state.response = { type: 'success', data: { idToken: 'test-token' } };
  assert.equal(await app.signInWithGoogle(), true);
});
test('missing Play services and missing token fail before Firebase signup', async () => {
  const unavailable = await service({ playServices: false });
  await assert.rejects(unavailable.signInWithGoogle(), /Update Google Play services/);
  assert.equal(unavailable.state.signInCount, 0);
  const noToken = await service({ response: { type: 'success', data: {} } });
  await assert.rejects(noToken.signInWithGoogle(), /could not complete/);
  assert.equal(noToken.state.exchangeCount, 0);
});
test('unregistered certificate and disabled Firebase provider errors identify actionable setup', async () => {
  const registration = await service({ error: { code: '10' } });
  await assert.rejects(registration.signInWithGoogle(), /signing certificate must be registered/);
  const provider = await service({ exchangeError: { code: 'auth/operation-not-allowed' } });
  await assert.rejects(provider.signInWithGoogle(), /enabled.*Firebase Authentication/);
});
test('a Google web client from another Firebase project fails before opening native account UI', async () => {
  const previous = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '999999-webclient.apps.googleusercontent.com';
  try {
    const app = await service();
    await assert.rejects(app.signInWithGoogle(), /mismatched Google and Firebase/);
    assert.equal(app.state.signInCount, 0);
    assert.equal(app.state.configureCount, 0);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previous;
  }
});

test('Firebase configuration requires complete environment values and rejects mixed projects', async () => {
  const names = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'].map(name => `EXPO_PUBLIC_FIREBASE_${name}`);
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const firebaseSource = await readFile(new URL('../src/services/firebaseConfig.ts', import.meta.url), 'utf8');
  globalThis.__splittrackFirebaseConfigTest = { getApps: () => [], getApp: () => {}, initializeApp: config => ({ options: config }) };
  const load = async () => {
    const isolated = firebaseSource.replace("import { getApp, getApps, initializeApp } from 'firebase/app';", 'const { getApp, getApps, initializeApp } = globalThis.__splittrackFirebaseConfigTest;');
    const code = stripTypeScriptTypes(isolated, { mode: 'transform' }) + `\n// config instance ${++moduleNumber}`;
    return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  };
  try {
    names.forEach(name => { delete process.env[name]; });
    const missing = await load();
    assert.throws(() => missing.firebaseApp(), /incomplete Firebase configuration/);
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'another-project';
    const partial = await load();
    assert.throws(() => partial.firebaseApp(), /incomplete Firebase configuration/);
    const values = ['public-api-key', 'another-project.firebaseapp.com', 'another-project', 'another-project.firebasestorage.app', '12345', '1:12345:web:otherapp'];
    names.forEach((name, index) => { process.env[name] = values[index]; });
    const complete = await load();
    assert.equal(complete.firebaseApp().options.projectId, 'another-project');
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:99999:web:otherapp';
    const mismatch = await load();
    assert.throws(() => mismatch.firebaseApp(), /mismatched Firebase/);
  } finally {
    names.forEach(name => { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; });
  }
});

test('iOS Google client, native bundle and callback match the supplied registration', async () => {
  const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  const plugin = appConfig.expo.plugins.find(value => Array.isArray(value) && value[0] === '@react-native-google-signin/google-signin');
  assert.equal(appConfig.expo.ios.bundleIdentifier, GOOGLE_AUTH_CONFIG.appIdentifier);
  assert.equal(plugin[1].iosUrlScheme, GOOGLE_AUTH_CONFIG.iosClientId.split('.').reverse().join('.'));
  assert.equal(plugin[1].iosUrlScheme, GOOGLE_AUTH_CONFIG.iosUrlScheme);
});
test('iOS creates or restores a Firebase user using its native Google credential without Android Play services', async () => {
  const app = await service({ platform: 'ios' });
  const first = app.signInWithGoogle(), repeat = app.signInWithGoogle();
  assert.equal(first, repeat);
  assert.equal(await first, true);
  assert.equal(app.state.signInCount, 1);
  assert.equal(app.state.exchangeCount, 1);
  assert.equal(app.state.playServicesCount, 0);
  assert.equal(app.state.configuration.iosClientId, GOOGLE_AUTH_CONFIG.iosClientId);
  await app.clearGoogleSession();
  assert.equal(app.state.signOutCount, 1);
});
test('iOS cancellation and disabled Firebase Google provider do not masquerade as signup success', async () => {
  const cancelled = await service({ platform: 'ios', response: { type: 'cancelled', data: null } });
  assert.equal(await cancelled.signInWithGoogle(), false);
  assert.equal(cancelled.state.exchangeCount, 0);
  const disabled = await service({ platform: 'ios', exchangeError: { code: 'auth/operation-not-allowed' } });
  await assert.rejects(disabled.signInWithGoogle(), /enabled.*Firebase Authentication/);
});
test('iOS client environment overrides must keep the native callback in sync', async () => {
  const previous = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = `${defaults.messagingSenderId}-anotheriosclient.apps.googleusercontent.com`;
  try {
    const app = await service({ platform: 'ios' });
    await assert.rejects(app.signInWithGoogle(), /mismatched Google client and callback/);
    assert.equal(app.state.configureCount, 0);
    assert.equal(app.state.signInCount, 0);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = previous;
  }
});

test('both native platforms acquire a linking credential without signing in or switching Firebase accounts', async () => {
  for (const platform of ['android', 'ios']) {
    const app = await service({ platform, response: { type: 'success', data: { idToken: 'test-token', user: { email: 'alice@example.com' } } } });
    globalThis.__splittrackGoogleAuthTest.auth.currentUser = { uid: 'password-account-uid' };
    const credential = await app.getGoogleCredential();
    assert.equal(credential.email, 'alice@example.com');
    assert.equal(credential.credential.idToken, 'test-token');
    assert.equal(app.state.exchangeCount, 0);
    assert.equal(globalThis.__splittrackGoogleAuthTest.auth.currentUser.uid, 'password-account-uid');
    await assert.rejects(app.signInWithGoogle(), { code: 'auth/session-changed' });
    assert.equal(app.state.exchangeCount, 0);
  }
});
test('both native Google collisions retain a consumable credential in memory and expose only email in the error', async () => {
  for (const platform of ['android', 'ios']) {
    const app = await service({ platform, response: { type: 'success', data: { idToken: 'test-token', user: { email: 'alice@example.com' } } }, exchangeError: { code: 'auth/account-exists-with-different-credential' } });
    await assert.rejects(app.signInWithGoogle(), failure => {
      assert.equal(failure.code, 'auth/account-exists-with-different-credential');
      assert.equal(failure.customData.email, 'alice@example.com');
      assert.equal(JSON.stringify(failure).includes('test-token'), false);
      return true;
    });
    const pending = app.consumePendingGoogleCredential();
    assert.equal(pending.email, 'alice@example.com'); assert.equal(pending.credential.idToken, 'test-token');
    assert.equal(app.consumePendingGoogleCredential(), null);
    assert.equal(app.state.exchangeCount, 1);
  }
});
test('native Google sign-in cannot replace a password session established while Google was open', async () => {
  let finish;
  const app = await service({ gate: new Promise(resolve => { finish = resolve; }) });
  const started = app.signInWithGoogle();
  globalThis.__splittrackGoogleAuthTest.auth.currentUser = { uid: 'password-account-uid' };
  finish();
  await assert.rejects(started, { code: 'auth/session-changed' });
  assert.equal(app.state.exchangeCount, 0);
});
