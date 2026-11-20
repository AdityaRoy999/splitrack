import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

async function utilityUrl(path) {
  const source = await readFile(path, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  let output = result.outputText;
  for (const match of [...output.matchAll(/((?:from|import)\s*['"])(\.[^'"]+)(['"])/g)]) {
    const dependency = resolve(dirname(path), `${match[2]}.ts`);
    output = output.replace(match[0], `${match[1]}${await utilityUrl(dependency)}${match[3]}`);
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
}
const loadUtility = async path => import(await utilityUrl(path));

const { getDebtReceivingAccount, buildUpiPaymentUri, formatUpiAmount } = await loadUtility('src/utils/upi.ts');
const { preserveOpenedHistory } = await loadUtility('src/store/cloudSnapshot.ts');
const { resolveReceivingUpiBrand } = await loadUtility('src/utils/upiBrand.ts');
const { getUpiBrandMeta } = await loadUtility('src/components/upi/upiBrandLogo.ts');
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

const ownBrand = resolveReceivingUpiBrand(account);
const peerBrand = resolveReceivingUpiBrand(debtorReceiver);
assert.deepEqual(ownBrand, { provider: 'gpay' });
assert.deepEqual(peerBrand, ownBrand);
assert.deepEqual(getUpiBrandMeta(peerBrand.provider, peerBrand.bankBrand), getUpiBrandMeta(ownBrand.provider, ownBrand.bankBrand));
for (const [handle, provider] of [['@okhdfcbank', 'gpay'], ['@ybl', 'phonepe'], ['@ptyes', 'paytm'], ['@slc', 'slice']]) {
  assert.equal(resolveReceivingUpiBrand({ provider: 'bank', upiId: `alice${handle}` }).provider, provider);
}
assert.deepEqual(resolveReceivingUpiBrand({ provider: 'bank', bankBrand: 'icici', upiId: 'alice@icici' }), { provider: 'bank', bankBrand: 'icici' });
assert.deepEqual(resolveReceivingUpiBrand({ upiId: 'alice@unverified' }), { provider: 'bank' });
assert.equal(resolveReceivingUpiBrand({ provider: 'phonepe', upiId: 'alice@okaxis' }).provider, 'phonepe');
const metadataReceiver = getDebtReceivingAccount(peerDebt, [], '', [{ id: 'alice', name: 'Nickname', paymentName: account.title, upiId: account.upiId, receivingProvider: 'phonepe' }]);
assert.equal(metadataReceiver.provider, 'phonepe');
assert.equal(buildUpiPaymentUri(metadataReceiver, { amount: 35.15, note: 'SplitTrack payment' }), uri);
console.log('PASS: own and peer QR branding matches; metadata wins and ambiguous handles stay unguessed.');

const previous = { generation: 0, transactions: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id })), transactionCursor: 'older' };
const incoming = { generation: 0, transactions: ['new', 'a', 'b'].map(id => ({ id })), transactionCursor: 'page2' };
assert.deepEqual(preserveOpenedHistory(incoming, previous, 5).transactions.map(transaction => transaction.id), ['new', 'a', 'b', 'c', 'd']);
assert.equal(preserveOpenedHistory({ ...incoming, generation: 1 }, previous, 5).transactions.length, 3);
assert.equal(preserveOpenedHistory({ ...incoming, transactionCursor: null }, previous, 5).transactions.length, 3);
assert.equal(preserveOpenedHistory(incoming, previous, 3).transactions.length, 3);
const deleted = { ...incoming, transactions: ['a', 'c'].map(id => ({ id })) };
assert.deepEqual(preserveOpenedHistory(deleted, previous, 5).transactions.map(transaction => transaction.id), ['a', 'c', 'd', 'e']);
console.log('PASS: sync retains opened older pages, removes deleted boundary entries and clears old generations.');
