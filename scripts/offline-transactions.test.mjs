import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/store/transactionOutbox.ts', import.meta.url), 'utf8');
const { TransactionOutbox, encodeOfflineCheckpoint, optimisticSnapshot, validateOfflineTransaction } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`);
const request = n => `offline_request_${n}`;
function storage() {
  const values = new Map();
  return { values, fail: false, async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { if (this.fail) throw new Error('Disk full'); values.set(key, value); } };
}
function snapshot() {
  return { userId: 'alice', generation: 0, accounts: [{ id: 'account', balance: 100, totalSpent: 0 }, { id: 'savings', balance: 0, totalSpent: 0 }], friends: [{ id: 'bob', netBalance: 0 }, { id: 'charlie', netBalance: 0 }], trips: [{ id: 'trip', totalSpend: 0, members: ['user', 'bob', 'charlie'] }], transactions: [], settings: { selectedAccountId: 'account' }, summary: { totalIncome: 0, totalExpenses: 0, categories: {}, months: {} } };
}
const draft = { title: 'Dinner', amount: -70.3, type: 'expense', category: 'Food', categoryIcon: 'cup', date: '2026-11-20', time: '18:00', upiAccountId: 'account', paidBy: 'user', splitType: 'equal', splits: [{ friendId: 'user', amount: 0, paidAmount: 70.3 }, { friendId: 'bob', amount: 0, paidAmount: 0 }], settled: false };
async function saved(tx = draft, uid = 'alice') {
  const disk = storage(), box = new TransactionOutbox(uid, disk);
  await box.enqueue(tx, request(1), 0);
  return { box, disk };
}
test('durable retry retains exact submitted payload/key after relaunch and isolates accounts', async () => {
  const { box, disk } = await saved();
  const restored = new TransactionOutbox('alice', disk); await restored.ready;
  assert.deepEqual(restored.entries, box.entries);
  assert.equal(restored.entries[0].bodyJson, JSON.stringify({ ...draft, duplicateCheck: true, ledgerGeneration: 0 }));
  const other = new TransactionOutbox('bob', disk); await other.ready;
  assert.deepEqual(other.entries, []);
});
test('a failed durable save is never acknowledged or published, then can be retried', async () => {
  const disk = storage(), box = new TransactionOutbox('alice', disk); await box.ready;
  disk.fail = true;
  await assert.rejects(box.enqueue(draft, request(1), 0), /Disk full/);
  assert.equal(box.entries.length, 0);
  disk.fail = false; await box.enqueue(draft, request(1), 0);
  assert.equal(box.entries.length, 1);
});
test('concurrent device writes serialize and an intent cannot change payload', async () => {
  const { box } = await saved();
  await Promise.all([box.enqueue({ ...draft, title: 'Taxi' }, request(2), 0), box.enqueue({ ...draft, title: 'Stay' }, request(3), 0)]);
  assert.deepEqual(box.entries.map(entry => entry.requestId), [request(1), request(2), request(3)]);
  await box.enqueue(draft, request(1), 0); assert.equal(box.entries.length, 3);
  await assert.rejects(box.enqueue({ ...draft, amount: -80 }, request(1), 0), /different transaction/);
});
test('a provider remount waits for old writes and merges against the latest durable queue', async () => {
  const disk = storage(), first = new TransactionOutbox('alice', disk); await first.ready;
  const write = disk.setItem.bind(disk);
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  let delayed = true;
  disk.setItem = async (key, value) => {
    if (delayed) { delayed = false; began(); await new Promise(resolve => { release = resolve; }); }
    await write(key, value);
  };
  const oldSave = first.enqueue(draft, request(1), 0);
  await started;
  const second = new TransactionOutbox('alice', disk);
  const newSave = second.enqueue({ ...draft, title: 'Taxi' }, request(2), 0);
  release(); await Promise.all([oldSave, newSave]);
  const restored = new TransactionOutbox('alice', disk); await restored.ready;
  assert.deepEqual(restored.entries.map(entry => entry.requestId), [request(1), request(2)]);
});
test('malformed or mismatched outbox data is retained and blocks overwriting', async () => {
  const disk = storage(), key = '@splittrack_outbox_v1_alice';
  disk.values.set(key, JSON.stringify({ uid: 'bob', version: 1, entries: [] }));
  const before = disk.values.get(key), box = new TransactionOutbox('alice', disk);
  await assert.rejects(box.ready, /retained/);
  await assert.rejects(box.enqueue(draft, request(1), 0), /retained/);
  assert.equal(disk.values.get(key), before);
});
test('offline expense rebases exact own expense, cash, group and friend totals without mutating base', async () => {
  const { box } = await saved({ ...draft, tripId: 'trip' }), base = snapshot();
  validateOfflineTransaction(JSON.parse(box.entries[0].bodyJson), base);
  const next = optimisticSnapshot(base, box.entries);
  assert.equal(next.accounts[0].balance, 29.7);
  assert.equal(next.accounts[0].totalSpent, 70.3);
  assert.equal(next.friends[0].netBalance, 35.15);
  assert.equal(next.summary.totalExpenses, 35.15);
  assert.equal(next.trips[0].totalSpend, 70.3);
  assert.equal(next.transactions[0].id, `offline-${request(1)}`);
  assert.deepEqual(base, snapshot());
  assert.deepEqual(optimisticSnapshot(base, box.entries), next);
});
test('split rounding and multiple payers preserve whole paise and caller debt direction', async () => {
  const tx = { ...draft, amount: -35.15, paidBy: 'bob', splits: [{ friendId: 'user', paidAmount: 0 }, { friendId: 'bob', paidAmount: 35.15 }, { friendId: 'charlie', paidAmount: 0 }] };
  const { box } = await saved(tx), next = optimisticSnapshot(snapshot(), box.entries);
  assert.deepEqual(next.transactions[0].splits.map(s => s.amount), [11.72, 11.72, 11.71]);
  assert.equal(next.accounts[0].balance, 100);
  assert.equal(next.summary.totalExpenses, 11.72);
  assert.equal(next.friends[0].netBalance, -11.72);
  assert.equal(next.friends[1].netBalance, 0);
});
test('an uncertain server commit, including older transactions absent from history, is not applied twice', async () => {
  const { box } = await saved();
  const committedBase = optimisticSnapshot(snapshot(), box.entries);
  committedBase.transactions = [];
  const next = optimisticSnapshot(committedBase, box.entries, [request(1)]);
  assert.equal(next.accounts[0].balance, 29.7);
  assert.equal(next.summary.totalExpenses, 35.15);
  const visible = snapshot(); visible.transactions = [{ id: 'tx-server', clientRequestId: request(1) }];
  assert.equal(optimisticSnapshot(visible, box.entries).transactions.length, 1);
});
test('oversized opened history does not prevent durable transaction ACK checkpoints', () => {
  const base = { ...snapshot(), transactionCursor: 'older-page', transactions: Array.from({ length: 500 }, (_, i) => ({ ...draft, id: `existing-${i}`, notes: 'x'.repeat(5000) })) };
  const encoded = encodeOfflineCheckpoint(base, [request(1)]), cached = JSON.parse(encoded);
  assert.ok(encoded.length <= 450000);
  assert.ok(cached.snapshot.transactions.length < 500);
  assert.equal(cached.snapshot.transactionCursor, null);
  assert.deepEqual(cached.committedRequests, [request(1)]);
  assert.equal(cached.snapshot.accounts[0].balance, base.accounts[0].balance);
  assert.equal(base.transactions.length, 500);
  assert.equal(base.transactionCursor, 'older-page');
});
test('a new ledger generation and rejected duplicates do not acquire optimistic effects', async () => {
  const { box } = await saved();
  const reset = { ...snapshot(), generation: 1 };
  assert.equal(optimisticSnapshot(reset, box.entries).transactions.length, 0);
  for (const status of ['duplicate', 'failed']) {
    assert.deepEqual(optimisticSnapshot(snapshot(), [{ ...box.entries[0], status }]), snapshot());
  }
});
test('income and internal transfer reconcile independently without expense or debt effects', async () => {
  const { box } = await saved({ ...draft, amount: 10, type: 'income', splits: [] });
  await box.enqueue({ ...draft, amount: -25, type: 'transfer', splits: [], toAccountId: 'savings' }, request(2), 0);
  const next = optimisticSnapshot(snapshot(), box.entries);
  assert.equal(next.accounts[0].balance, 85);
  assert.equal(next.accounts[1].balance, 25);
  assert.equal(next.summary.totalIncome, 10);
  assert.equal(next.summary.totalExpenses, 0);
  assert.equal(next.friends[0].netBalance, 0);
});
test('offline receipts retain explicit amount and source while leaving claim effects for AWS validation', async () => {
  const receipt = { ...draft, title: 'Settlement', type: 'settlement', amount: 5, paidBy: 'bob', targetFriendId: 'bob', sourceTransactionId: 'existing-expense', splits: [] };
  const base = snapshot(); base.friends[0].netBalance = 20;
  validateOfflineTransaction(receipt, base);
  const { box, disk } = await saved(receipt);
  const next = optimisticSnapshot(base, box.entries);
  assert.equal(next.transactions[0].type, 'settlement');
  assert.equal(next.transactions[0].amount, 5);
  assert.equal(next.transactions[0].sourceTransactionId, 'existing-expense');
  assert.deepEqual(next.accounts, base.accounts);
  assert.deepEqual(next.friends, base.friends);
  assert.deepEqual(next.summary, base.summary);
  const restored = new TransactionOutbox('alice', disk); await restored.ready;
  assert.equal(restored.entries[0].bodyJson, box.entries[0].bodyJson);
});
test('invalid arithmetic, calendar dates and unauthorized payments fail before persistence', () => {
  for (const bad of [
    { ...draft, amount: -70.301 }, { ...draft, date: '2026-02-30' }, { ...draft, date: 'nonsense' },
    { ...draft, splits: [{ friendId: 'user', paidAmount: NaN }] },
    { ...draft, splits: [{ friendId: 'user', paidAmount: 70.301 }] },
    { ...draft, splitType: 'exact', splits: [{ friendId: 'user', amount: 70.29, paidAmount: 70.3 }] },
    { ...draft, splitType: 'percentage', splits: [{ friendId: 'user', percentage: 90, paidAmount: 70.3 }] },
    { ...draft, type: 'settlement' }, { ...draft, tripId: 'missing' },
  ]) assert.throws(() => validateOfflineTransaction(bad, snapshot()));
});
