import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function loadUtility(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const { getDebtReceivingAccount, buildUpiPaymentUri, formatUpiAmount } = await loadUtility('src/utils/upi.ts');
const { preserveOpenedHistory } = await loadUtility('src/store/cloudSnapshot.ts');
const account = { id: 'upi-alice', kind: 'upi', title: 'Alice & Roy', upiId: 'alice.roy@okaxis', isReceivingDefault: true };
const ownDebt = { fromId: 'bob', toId: 'user', fromName: 'Bob', toName: 'You', amount: 35.15 };
const peerDebt = { ...ownDebt, fromId: 'user', toId: 'alice', fromName: 'You', toName: 'Alice' };
const creditorReceiver = getDebtReceivingAccount(ownDebt, [account], account.id, []);
const debtorReceiver = getDebtReceivingAccount(peerDebt, [], '', [{ id: 'alice', name: 'Nickname', paymentName: account.title, upiId: account.upiId }]);
const uri = buildUpiPaymentUri(creditorReceiver, { amount: 35.15, note: 'SplitTrack payment' });
assert.equal(uri, buildUpiPaymentUri(debtorReceiver, { amount: 35.15, note: 'SplitTrack payment' }));
const parameters = new URL(uri).searchParams;
assert.equal(parameters.get('pa'), account.upiId);
assert.equal(parameters.get('pn'), account.title);
assert.equal(parameters.get('am'), '35.15');
assert.equal(parameters.get('cu'), 'INR');
assert.equal(getDebtReceivingAccount(peerDebt, [], '', []), null);
for (const amount of [0, -1, Infinity, NaN, 0.001]) assert.throws(() => formatUpiAmount(amount), RangeError);
assert.equal(formatUpiAmount(0.01), '0.01');
assert.equal(formatUpiAmount(3515.1), '3515.10');
console.log('PASS: creditor and debtor QR use the same receiving profile and exact INR amount.');

const previous = { generation: 0, transactions: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id })), transactionCursor: 'older' };
const incoming = { generation: 0, transactions: ['new', 'a', 'b'].map(id => ({ id })), transactionCursor: 'page2' };
assert.deepEqual(preserveOpenedHistory(incoming, previous, 5).transactions.map(transaction => transaction.id), ['new', 'a', 'b', 'c', 'd']);
assert.equal(preserveOpenedHistory({ ...incoming, generation: 1 }, previous, 5).transactions.length, 3);
assert.equal(preserveOpenedHistory({ ...incoming, transactionCursor: null }, previous, 5).transactions.length, 3);
assert.equal(preserveOpenedHistory(incoming, previous, 3).transactions.length, 3);
const deleted = { ...incoming, transactions: ['a', 'c'].map(id => ({ id })) };
assert.deepEqual(preserveOpenedHistory(deleted, previous, 5).transactions.map(transaction => transaction.id), ['a', 'c', 'd', 'e']);
console.log('PASS: sync retains opened older pages, removes deleted boundary entries and clears old generations.');
