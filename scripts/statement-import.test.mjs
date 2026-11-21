import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), XLSX = require('xlsx'), ts = require('typescript');
const source = await readFile(new URL('../src/utils/importTransactions.ts', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  module, exports: module.exports, require: name => name === 'xlsx' ? XLSX : {}, Date,
});
const { parseSpreadsheetTransactions: spreadsheet, parseJsonTransactions: json, parseGooglePayPdfTransactions: pdf, normalizeDate, cleanNumber } = module.exports;
const workbook = sheets => {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(book, { bookType: 'xlsx', type: 'buffer' });
};

// All fixtures are synthetic. Their shape matches the providers' exports;
// no customer names, account numbers or transaction values are copied here.
test('Paytm scans past its Summary sheet and preserves signed credits and real times', () => {
  const file = workbook({ Summary: [['Paytm User'], ['Money Paid (Amount in Rs.)', '-100.00'], ['Money Received (Amount in Rs.)', '+75.50']], 'Passbook Payment History': [
    ['Date', 'Time', 'Transaction Details', 'Other Transaction Details (UPI ID or A/c No)', 'Your Account', 'Amount', 'UPI Ref No.'],
    ['12/05/2026', '20:05:04', 'Paid to Example Shop', 'example@bank', 'Example bank', '-100.00', 'SYNTHETIC-1'],
    ['12/05/2026', '21:12:40', 'Received from Example Person', 'person@bank', 'Example bank', '+75.50', 'SYNTHETIC-2'],
  ] });
  const result = spreadsheet(file, 'paytm.xlsx', 'profile-1');
  assert.equal(result.success, true);
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].amount, -100);
  assert.equal(result.transactions[1].amount, 75.5);
  assert.equal(result.transactions[0].time, '20:05:04');
  assert.equal(result.report.expenseTotal, 100);
  assert.equal(result.report.incomeTotal, 75.5);
  assert.equal(result.report.warnings.length, 0);
  assert.equal(result.transactions[1].upiAccountId, 'profile-1');
});

test('Slice exact debit/credit columns ignore balances and retain identical legitimate payments', () => {
  const result = spreadsheet(workbook({ Statement: [
    ['Customer ID', 'SYNTHETIC'], ['Account opening date', "01 Jan '26"],
    ['DATE', 'DETAILS', 'REF NO.', 'TRANSACTION TYPE', 'DEBIT', 'CREDIT', 'BALANCE'],
    ["01 Jan '26", 'Opening balance', '', '', '', '', 9000],
    ["02 Jan '26", 'UPI-Debit-123456789012-EXAMPLE SHOP-BANK0001', 'REF-A', 'DEBIT', 25, '', 8975],
    ["02 Jan '26", 'UPI-Debit-123456789013-EXAMPLE SHOP-BANK0001', 'REF-B', 'DEBIT', 25, '', 8950],
    ["03 Jan '26", 'Cashback', 'REF-C', 'CREDIT', '', 1.25, 8951.25],
  ] }), 'slice.xlsx');
  assert.equal(result.transactions.length, 3);
  assert.equal(result.report.expenseTotal, 50);
  assert.equal(result.report.incomeTotal, 1.25);
  assert.notEqual(result.transactions[0].notes, result.transactions[1].notes);
  assert.equal(result.transactions[0].date, '2026-01-02');
  assert.equal(result.transactions[0].time, '00:00');
  assert.match(result.report.warnings[0], /no time/);
});

test('invalid dates, ambiguous directions, failed status and foreign currency are reported, never guessed', () => {
  const result = spreadsheet('Date,Description,Amount,Type,Status,Currency\n31/02/2026,Bad date,25,DEBIT,Success,INR\n12/05/2026,Ambiguous,25,,Success,INR\n12/05/2026,Failed,25,DEBIT,Failed,INR\n12/05/2026,Foreign,25,DEBIT,Success,USD\n12/05/2026,Valid,12.50,DEBIT,Success,INR', 'statement.csv');
  assert.equal(result.transactions.length, 1);
  assert.equal(result.report.skipped, 4);
  assert.equal(result.report.issues.length, 4);
  assert.equal(result.transactions[0].amount, -12.5);
});

test('Excel date epoch and strict INR amounts preserve calendar and paise', () => {
  assert.equal(normalizeDate('2026-02-29'), '');
  assert.equal(normalizeDate('29/02/2024'), '2024-02-29');
  assert.equal(normalizeDate(60), '');
  assert.equal(normalizeDate(1, true), '1904-01-02');
  assert.equal(normalizeDate(''), '');
  assert.equal(cleanNumber('₹1,23,456.78'), 123456.78);
  assert.equal(cleanNumber('reference123 amount45'), 0);
  assert.equal(cleanNumber('1,2,3'), 0);
});

test('JSON requires valid dates/directions and cannot import untrusted split participants', () => {
  const result = json(JSON.stringify([
    { date: '2026-01-05', title: 'Expense', amount: 12.35, type: 'expense', paidBy: 'someone-else', splits: [{ friendId: 'unknown', amount: 12.35 }] },
    { date: '2026-01-05', title: 'Income', amount: 25, type: 'income' },
    { date: '', title: 'Missing date', amount: -5 },
    { date: '2026-01-05', title: 'Ambiguous positive', amount: 10 },
  ]), 'backup.json', 'chosen-profile');
  assert.equal(result.transactions.length, 2);
  assert.equal(result.report.skipped, 2);
  assert.equal(result.transactions[0].paidBy, 'user');
  assert.equal(result.transactions[0].splits.length, 0);
  assert.equal(result.transactions[0].upiAccountId, 'chosen-profile');
});

test('Google Pay text PDF anchors complete records and ignores page headers and summary amounts', () => {
  const result = pdf([
    'Google Pay\nSent\n₹50\nReceived\n₹5.25\nDate&time Transactiondetails Amount\n01May,2026\n01:54PM\nPaidtoExample Shop\nUPITransactionID:SYNTHETIC-A\nPaidbyExampleBank0000\n₹25\nPage1of2',
    'Google Pay\nDate & time Transaction details Amount\n01 May, 2026\n02:54 PM\nPaid to Example Shop\nUPI Transaction ID: SYNTHETIC-B\nPaid by Example Bank\n₹25\n02May,2026\n12:01AM\nReceivedfromExample Person\nUPITransactionID:SYNTHETIC-C\nPaidtoExampleBank\n₹5.25',
  ]);
  assert.equal(result.transactions.length, 3);
  assert.equal(result.report.skipped, 0);
  assert.equal(result.report.expenseTotal, 50);
  assert.equal(result.report.incomeTotal, 5.25);
  assert.equal(result.transactions[0].time, '13:54');
  assert.equal(result.transactions[2].time, '00:01');
  assert.equal(result.report.warnings.length, 0);
});

test('Google Pay incomplete rows warn; scanned and other PDF layouts fail explicitly', () => {
  assert.match(pdf(['']).error, /Scanned\/image PDFs/);
  assert.match(pdf(['Other bank 2026 ₹100']).error, /unsupported/);
  const result = pdf(['Google Pay\nDate&time Transactiondetails Amount\n01May,2026\n01:00PM\nPaidtoExample\n₹10']);
  assert.equal(result.success, false);
  assert.equal(result.report.skipped, 1);
  assert.equal(result.transactions.length, 0);
});

test('Google Pay positioned PDF extraction keeps date/payee/amount rows and time/reference rows aligned', () => {
  const result = pdf(['Transaction statement\nTransaction statement for Sent Received\n01 May 2026 - 31 May 2026 ₹25 ₹5.25\nDate & time Transaction details Amount\n01 May, 2026 Paid to Example Shop ₹25\n01:54 PM UPI Transaction ID: SYNTHETIC-A\nPaid by Example Bank 0000\n02 May, 2026 Received from Example Person ₹5.25\n12:01 AM UPI Transaction ID: SYNTHETIC-B\nPaid to Example Bank 0000\nGoogle Pay']);
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].title, 'Example Shop');
  assert.equal(result.transactions[1].title, 'Example Person');
  assert.equal(result.report.expenseTotal, 25);
  assert.equal(result.report.incomeTotal, 5.25);
  assert.equal(result.report.skipped, 0);
  assert.equal(result.report.warnings.length, 0);
});
