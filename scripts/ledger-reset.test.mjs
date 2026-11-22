import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../src/store/ledgerReset.ts', import.meta.url), 'utf8');
const { clearSettledLedger } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`);

test('old backend policies cannot receive a destructive reset request', async () => {
  for (const policy of [undefined, 'all', 'unknown']) {
    let mutations = 0;
    await assert.rejects(clearSettledLedger(async () => ({ resetPolicy: policy }), async () => { mutations++; return { result: {} }; }), /not available/);
    assert.equal(mutations, 0);
  }
});

test('offline preflight cannot clear history and a safe backend receives settled-only mode', async () => {
  let mutations = 0;
  await assert.rejects(clearSettledLedger(async () => { throw new Error('Offline'); }, async () => { mutations++; return { result: {} }; }), /Offline/);
  assert.equal(mutations, 0);
  const calls = [];
  const counts = await clearSettledLedger(async () => { calls.push('policy'); return { resetPolicy: 'settled-only' }; }, async body => {
    calls.push('clear'); assert.deepEqual(body, { mode: 'settled-only' });
    return { result: { removedTransactions: 12, retainedTransactions: 2 } };
  });
  assert.deepEqual(calls, ['policy', 'clear']);
  assert.deepEqual(counts, { removedTransactions: 12, retainedTransactions: 2 });
});

test('malformed cleanup counts cannot claim debts or history were removed', async () => {
  for (const result of [{}, { removedTransactions: -1, retainedTransactions: 2 }, { removedTransactions: 1, retainedTransactions: NaN }]) {
    await assert.rejects(clearSettledLedger(async () => ({ resetPolicy: 'settled-only' }), async () => ({ result })), /Refresh/);
  }
});
