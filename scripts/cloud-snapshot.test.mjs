import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/store/cloudSnapshot.ts', import.meta.url), 'utf8');
const { retainUnchanged, preserveOpenedHistory } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`);
const copy = value => JSON.parse(JSON.stringify(value));
const ledger = () => ({
  userId: 'alice', revision: 1, generation: 0,
  accounts: [{ id: 'cash', balance: 90 }],
  friends: [{ id: 'bob', name: 'Bob', avatar: 'old-avatar', netBalance: 10 }],
  transactions: [{ id: 'one', amount: -10, splits: [{ friendId: 'bob', amount: 5 }] }],
  transactionCursor: null,
  summary: { totalExpenses: 5, categories: { Food: 5 }, months: { '2026-11': { expense: 5 } } },
});

test('identical server refreshes retain the full ledger and native-effect inputs', () => {
  const previous = ledger(), incoming = copy(previous);
  const result = retainUnchanged(previous, incoming);
  assert.equal(result, previous);
  assert.equal(result.transactions, previous.transactions);
  assert.equal(result.summary, previous.summary);
  assert.deepEqual(incoming, previous);
});

test('a real balance update publishes immediately while preserving unchanged history and chart inputs', () => {
  const previous = ledger(), incoming = copy(previous);
  incoming.revision = 2; incoming.accounts[0].balance = 80;
  const result = retainUnchanged(previous, incoming);
  assert.deepEqual(result, incoming);
  assert.notEqual(result, previous);
  assert.equal(result.friends, previous.friends);
  assert.equal(result.transactions, previous.transactions);
  assert.equal(result.summary, previous.summary);
  assert.equal(previous.accounts[0].balance, 90);
});

test('profile and media updates remain visible even when the ledger revision is unchanged', () => {
  const previous = ledger(), incoming = copy(previous);
  incoming.friends[0].avatar = 'new-signed-avatar';
  const result = retainUnchanged(previous, incoming);
  assert.equal(result.revision, previous.revision);
  assert.notEqual(result.friends, previous.friends);
  assert.equal(result.friends[0].avatar, 'new-signed-avatar');
  assert.equal(result.accounts, previous.accounts);
  assert.equal(result.transactions, previous.transactions);
});

test('deletion, order and optional-field changes are never hidden by structural sharing', () => {
  const previous = { rows: [{ id: 'one', note: 'old' }, { id: 'two' }], optional: 'old' };
  for (const incoming of [
    { rows: [{ id: 'two' }, { id: 'one' }] },
    { rows: [{ id: 'one' }] },
    { rows: [{ id: 'one', note: 'old' }, { id: 'two' }], optional: undefined },
  ]) assert.deepEqual(retainUnchanged(previous, incoming), incoming);
});

test('user-supplied record keys retain their JSON value without changing object prototypes', () => {
  const previous = JSON.parse('{"__proto__":{"amount":1},"constructor":1}');
  const incoming = JSON.parse('{"__proto__":{"amount":2},"constructor":2}');
  const result = retainUnchanged(previous, incoming);
  assert.deepEqual(result, incoming);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, '__proto__'), true);
});

test('opened older pages survive refreshes but never cross ledger resets', () => {
  const previous = ledger();
  previous.transactions.push({ id: 'older', amount: -1 });
  const next = { ...ledger(), transactionCursor: 'older-page' };
  assert.deepEqual(preserveOpenedHistory(next, previous, 2).transactions.map(tx => tx.id), ['one', 'older']);
  const reset = { ...next, generation: 1 };
  assert.equal(preserveOpenedHistory(reset, previous, 2), reset);
});
