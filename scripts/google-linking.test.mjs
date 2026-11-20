import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/auth/googleLinking.ts', import.meta.url), 'utf8');
const { GoogleAccountLinker } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`);
const passwordUser = (uid = 'existing-uid', email = 'alice@example.com') => ({ uid, email, providerData: [{ providerId: 'password' }], ledger: { balance: 125, transactionIds: ['saved-expense'] } });
const identity = email => ({ email, credential: { providerId: 'google.com', idToken: 'private-google-token' } });
function setup(options = {}) {
  const state = { user: passwordUser(), session: 0, now: 100, acquireCount: 0, linkCount: 0, reauthCount: 0, notices: [], ...options };
  const linker = new GoogleAccountLinker({
    currentUser: () => state.user, sessionVersion: () => state.session, now: () => state.now,
    async acquireCredential() { state.acquireCount++; if (state.acquireGate) await state.acquireGate; return state.identity === undefined ? identity('alice@example.com') : state.identity; },
    async linkCredential(user, credential) {
      state.linkCount++; state.linkedUid = user.uid;
      assert.equal(credential.idToken, 'private-google-token');
      if (state.linkGate) await state.linkGate;
      if (state.linkError) throw state.linkError;
      user.providerData.push({ providerId: 'google.com' });
      return { user: state.resultUser || user };
    },
    async reauthenticate(user, email, password) {
      state.reauthCount++; state.reauthenticatedUid = user.uid;
      assert.equal(email, user.email.trim());
      if (state.reauthError) throw state.reauthError;
      assert.equal(password, 'correct-password');
      if (state.reauthGate) await state.reauthGate;
    },
    changed: pending => { state.notices.push(pending); },
  });
  return { linker, state };
}

test('password account links Google on the same UID without changing ledger or acquiring another Firebase user', async () => {
  const { linker, state } = setup(), before = structuredClone(state.user.ledger);
  assert.equal(await linker.link(), true);
  assert.equal(state.linkedUid, 'existing-uid');
  assert.equal(state.user.uid, 'existing-uid');
  assert.deepEqual(state.user.ledger, before);
  assert.equal(state.acquireCount, 1); assert.equal(state.linkCount, 1);
  assert.equal(linker.pendingLink, null);
});
test('email matching is case-insensitive but a different Google account never reaches Firebase linking', async () => {
  const matching = setup({ identity: identity(' ALICE@EXAMPLE.COM ') });
  assert.equal(await matching.linker.link(), true);
  const mismatch = setup({ identity: identity('bob@example.com') });
  await assert.rejects(mismatch.linker.link(), { code: 'auth/google-email-mismatch' });
  assert.equal(mismatch.state.linkCount, 0); assert.equal(mismatch.state.user.uid, 'existing-uid');
  assert.equal(mismatch.linker.pendingLink, null);
});
test('cancelling Google selection makes no link, and repeated presses share one pending native flow', async () => {
  const cancelled = setup({ identity: null });
  assert.equal(await cancelled.linker.link(), false); assert.equal(cancelled.state.linkCount, 0);
  let finish;
  const concurrent = setup({ acquireGate: new Promise(resolve => { finish = resolve; }) });
  const first = concurrent.linker.link(), second = concurrent.linker.link();
  assert.equal(first, second); finish();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(concurrent.state.acquireCount, 1); assert.equal(concurrent.state.linkCount, 1);
});
test('a credential already linked to another UID is rejected without merging or changing the current account', async () => {
  const { linker, state } = setup({ linkError: { code: 'auth/credential-already-in-use' } });
  const before = structuredClone(state.user);
  await assert.rejects(linker.link(), { code: 'auth/credential-already-in-use' });
  assert.deepEqual(state.user, before);
  assert.equal(linker.pendingLink, null);
});
test('recent-login failure retains only public pending state and retries with password reauthentication on the same UID', async () => {
  const { linker, state } = setup({ linkError: { code: 'auth/requires-recent-login' } });
  await assert.rejects(linker.link(), { code: 'auth/requires-recent-login' });
  assert.deepEqual(linker.pendingLink, { email: 'alice@example.com', status: 'reauthentication-required' });
  assert.equal(JSON.stringify(linker.pendingLink).includes('private-google-token'), false);
  state.linkError = null;
  assert.equal(await linker.link('correct-password'), true);
  assert.equal(state.acquireCount, 1); assert.equal(state.linkCount, 2); assert.equal(state.reauthCount, 1);
  assert.equal(state.reauthenticatedUid, 'existing-uid'); assert.equal(state.user.uid, 'existing-uid');
});
test('wrong password keeps the selected Google credential available for an explicit corrected retry', async () => {
  const { linker, state } = setup({ reauthError: { code: 'auth/wrong-password' } });
  linker.retain(identity('alice@example.com'), 'reauthentication-required');
  await assert.rejects(linker.link('wrong-password'), { code: 'auth/wrong-password' });
  assert.equal(state.linkCount, 0);
  state.reauthError = null;
  assert.equal(await linker.link('correct-password'), true);
  assert.equal(state.acquireCount, 0); assert.equal(state.reauthCount, 2); assert.equal(state.user.uid, 'existing-uid');
});
test('a Google collision requires password proof and an explicit link, retaining the original token without a second signup', async () => {
  const { linker, state } = setup({ user: null });
  linker.retain(identity('alice@example.com'));
  assert.deepEqual(linker.pendingLink, { email: 'alice@example.com', status: 'password-required' });
  await assert.rejects(linker.link(), { code: 'auth/requires-login' });
  assert.equal(state.linkCount, 0);
  state.user = passwordUser('password-account-uid');
  assert.equal(await linker.link(), true);
  assert.equal(state.user.uid, 'password-account-uid'); assert.equal(state.acquireCount, 0);
});
test('collision credential cannot link after signing in to a different password account', async () => {
  const { linker, state } = setup({ user: passwordUser('bobs-uid', 'bob@example.com') });
  linker.retain(identity('alice@example.com'));
  await assert.rejects(linker.link(), { code: 'auth/google-email-mismatch' });
  assert.equal(state.linkCount, 0); assert.equal(state.user.uid, 'bobs-uid');
});
test('signout or signout-and-signin to the same UID while choosing Google invalidates the link', async () => {
  for (const sameUid of [false, true]) {
    let finish;
    const { linker, state } = setup({ acquireGate: new Promise(resolve => { finish = resolve; }) });
    const started = linker.link();
    state.session++; state.user = sameUid ? passwordUser() : null;
    finish();
    await assert.rejects(started, { code: 'auth/session-changed' });
    assert.equal(state.linkCount, 0);
  }
});
test('explicit cancellation while Google is open prevents applying its later credential', async () => {
  let finish;
  const { linker, state } = setup({ acquireGate: new Promise(resolve => { finish = resolve; }) });
  const started = linker.link(); linker.cancel(); finish();
  await assert.rejects(started, { code: 'auth/session-changed' });
  assert.equal(state.linkCount, 0); assert.equal(linker.pendingLink, null);
});
test('a late Firebase response never publishes linked status to a switched account', async () => {
  let finish;
  const { linker, state } = setup({ linkGate: new Promise(resolve => { finish = resolve; }) });
  const started = linker.link(); await Promise.resolve();
  state.session++; state.user = passwordUser('another-uid', 'bob@example.com');
  finish();
  await assert.rejects(started, { code: 'auth/session-changed' });
  assert.equal(state.user.uid, 'another-uid');
  assert.deepEqual(state.user.providerData, [{ providerId: 'password' }]);
});
test('expired pending credentials prompt a new Google selection, and linked accounts need no duplicate mutation', async () => {
  const expired = setup(); expired.linker.retain(identity('alice@example.com'));
  expired.state.now += 10 * 60 * 1000;
  assert.equal(expired.linker.pendingLink, null);
  assert.equal(await expired.linker.link(), true); assert.equal(expired.state.acquireCount, 1);
  const linked = setup({ user: { ...passwordUser(), providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] } });
  assert.equal(await linked.linker.link(), true); assert.equal(linked.state.acquireCount, 0); assert.equal(linked.state.linkCount, 0);
});
