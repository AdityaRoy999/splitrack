import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

process.env.EXPO_PUBLIC_API_URL = 'https://splittrack.example.invalid';
let source = await readFile(new URL('../src/services/api.ts', import.meta.url), 'utf8');
source = source.replace("import { randomUUID } from 'expo-crypto';", "const randomUUID = () => 'generated_request_id';")
  .replace("import * as Application from 'expo-application';", "const Application = { nativeBuildVersion: '4201', nativeApplicationVersion: '2.5.0' };")
  .replace("import { Platform } from 'react-native';", "const Platform = { OS: 'android' };")
  .replace("import { getFirebaseAuth } from './firebase';", 'const getFirebaseAuth = () => globalThis.__androidApiAuth;');
const { api, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`);
function user(getIdToken = async () => 'token') { const next = { uid: 'alice', getIdToken }; globalThis.__androidApiAuth = { currentUser: next }; return next; }
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, async json() { return body; } });
test('the outbox sends exact durable JSON/key and surfaces duplicate metadata', async () => {
  user();
  let called = 0;
  const rawBody = '{"title":"Dinner","amount":-70.30,"duplicateCheck":true}';
  globalThis.fetch = async (_, options) => {
    called++; assert.equal(options.body, rawBody);
    assert.equal(options.headers['X-App-Version'], 'android/4201/2.5.0');
    assert.equal(options.headers['idempotency-key'], 'offline_request_1');
    return reply(409, { code: 'DUPLICATE_TRANSACTION', message: 'Already recorded', details: { existingTransaction: { id: 'existing', amount: -70.3 } } });
  };
  await assert.rejects(api('/transactions', { method: 'POST', rawBody, id: 'offline_request_1', attempts: 1 }), error => error instanceof ApiError && error.code === 'DUPLICATE_TRANSACTION' && error.details.existingTransaction.id === 'existing');
  assert.equal(called, 1);
});
test('timeout bounds an offline token refresh without issuing a network mutation', async () => {
  user(() => new Promise(() => {}));
  globalThis.fetch = () => { throw new Error('fetch must not start'); };
  const start = Date.now();
  await assert.rejects(api('/transactions', { method: 'POST', body: {}, id: 'offline_request_1', timeoutMs: 15, attempts: 1 }), error => error.code === 'NETWORK_ERROR');
  assert.ok(Date.now() - start < 500);
});
test('account switches before a token returns cannot send a queued transaction as the new account', async () => {
  let resolveToken;
  user(() => new Promise(resolve => { resolveToken = resolve; }));
  let calls = 0; globalThis.fetch = async () => { calls++; return reply(201, {}); };
  const pending = api('/transactions', { method: 'POST', body: {}, id: 'offline_request_1', expectedUid: 'alice', attempts: 1 });
  globalThis.__androidApiAuth.currentUser = { uid: 'bob', getIdToken: async () => 'bob-token' };
  resolveToken('alice-token');
  await assert.rejects(pending, error => error.status === 401);
  assert.equal(calls, 0);
  await assert.rejects(api('/transactions', { method: 'POST', expectedUid: 'alice', attempts: 1 }), error => error.status === 401);
});
test('single-attempt outbox 401 refreshes the token for the next durable retry', async () => {
  const refreshes = [];
  user(async force => { refreshes.push(force); return force ? 'fresh-token' : refreshes.includes(true) ? 'fresh-token' : 'old-token'; });
  globalThis.fetch = async (_, options) => options.headers.authorization === 'Bearer old-token' ? reply(401, { code: 'UNAUTHENTICATED' }) : reply(201, { result: { id: 'canonical' } });
  await assert.rejects(api('/transactions', { method: 'POST', body: {}, id: 'offline_request_1', attempts: 1 }), error => error.status === 401);
  const saved = await api('/transactions', { method: 'POST', body: {}, id: 'offline_request_1', attempts: 1 });
  assert.equal(saved.result.id, 'canonical');
  assert.deepEqual(refreshes, [false, true, false]);
});
