import * as XLSX from 'xlsx';
import { Transaction } from '../types';

export interface ImportIssue {
  location: string;
  reason: string;
}
export interface ImportReport {
  rowsRead: number;
  imported: number;
  skipped: number;
  ignored: number;
  incomeTotal: number;
  expenseTotal: number;
  issues: ImportIssue[];
  warnings: string[];
}
export interface ImportParseResult {
  success: boolean;
  sourceApp: string;
  fileName?: string;
  transactions: Omit<Transaction, 'id'>[];
  report?: ImportReport;
  error?: string;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MAX_ENTRIES = 5000;
const blank = (value: unknown) => value === undefined || value === null || String(value).trim() === '' || /^[-–—]$/.test(String(value).trim());

/** Strict INR amount parsing. Invalid text is not converted into a plausible amount. */
function signedNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e10 ? Math.round(value * 100) / 100 : null;
  if (blank(value)) return null;
  let text = String(value).trim().replace(/^(?:INR|Rs\.?|₹)\s*/i, '').replace(/\s*(?:INR|Rs\.?|₹)$/i, '').trim();
  const parentheses = /^\(.*\)$/.test(text);
  if (parentheses) text = text.slice(1, -1).trim();
  const direction = text.match(/\s*(CR|DR)$/i)?.[1]?.toUpperCase();
  text = text.replace(/\s*(?:CR|DR)$/i, '').trim();
  const valid = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(text);
  if (!valid) return null;
  const amount = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e10) return null;
  return Math.round((parentheses || direction === 'DR' ? -Math.abs(amount) : direction === 'CR' ? Math.abs(amount) : amount) * 100) / 100;
}
export const cleanNumber = (value: unknown): number => Math.abs(signedNumber(value) ?? 0);

function dateParts(year: number, month: number, day: number): string {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
/** Missing/invalid dates stay invalid; an import must never substitute today. */
export const normalizeDate = (raw: unknown, date1904 = false): string => {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? '' : dateParts(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 1 || raw > 109575 || (!date1904 && Math.floor(raw) === 60)) return '';
    const parsed = XLSX.SSF.parse_date_code(raw, { date1904 });
    return parsed ? dateParts(parsed.y, parsed.m, parsed.d) : '';
  }
  if (blank(raw)) return '';
  const text = String(raw).trim().replace(/^['"]|['"]$/g, '');
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (iso) return dateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?$/i);
  if (dmy) return dateParts(Number(dmy[3]) + (dmy[3].length === 2 ? 2000 : 0), Number(dmy[2]), Number(dmy[1]));
  const named = text.match(/^(\d{1,2})[\s-]*([A-Za-z]{3,9})[\s,'’-]*(\d{2}|\d{4})$/);
  if (named) return dateParts(Number(named[3]) + (named[3].length === 2 ? 2000 : 0), MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1, Number(named[1]));
  return '';
};

function normalizeTime(raw: unknown): string {
  if (blank(raw)) return '';
  if (typeof raw === 'number' && raw >= 0 && raw < 1) {
    const seconds = Math.round(raw * 86400) % 86400;
    return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const match = String(raw).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) return '';
  let hour = Number(match[1]);
  if (match[4]) { if (hour < 1 || hour > 12) return ''; hour = hour % 12 + (match[4].toUpperCase() === 'PM' ? 12 : 0); }
  if (hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${match[2]}${match[3] ? `:${match[3]}` : ''}`;
}

function newReport(): ImportReport { return { rowsRead: 0, imported: 0, skipped: 0, ignored: 0, incomeTotal: 0, expenseTotal: 0, issues: [], warnings: [] }; }
function issue(report: ImportReport, location: string, reason: string) {
  report.skipped++;
  if (report.issues.length < 8) report.issues.push({ location, reason });
}
function finish(sourceApp: string, fileName: string, transactions: Omit<Transaction, 'id'>[], report: ImportReport, error?: string): ImportParseResult {
  report.imported = transactions.length;
  report.incomeTotal = Math.round(transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0)) / 100;
  report.expenseTotal = Math.round(transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + Math.round(Math.abs(tx.amount) * 100), 0)) / 100;
  return { success: transactions.length > 0 && !error, sourceApp, fileName, transactions: error ? [] : transactions, report, ...(error ? { error } : transactions.length ? {} : { error: 'No valid transactions found. Choose a statement table with Date, Description and Amount (or Debit/Credit) columns.' }) };
}
function transaction(title: string, amount: number, type: 'income' | 'expense', date: string, time: string, account: string, source: string, reference = ''): Omit<Transaction, 'id'> {
  const inferred = inferCategory(title);
  return { title: cleanMerchantTitle(title).slice(0, 120), amount: type === 'income' ? Math.abs(amount) : -Math.abs(amount), type, category: type === 'income' ? 'Income' : inferred.category, categoryIcon: type === 'income' ? 'wallet' : inferred.categoryIcon,
    date, time: time || '00:00', upiAccountId: account, paidBy: 'user', splitType: 'equal', splits: [], settled: false, subtitle: `Imported from ${source}`, ...(reference ? { notes: `Statement reference: ${reference.slice(0, 160)}` } : {}) };
}

/**
 * Cleans long bank/UPI narration strings into human-readable merchant names
 */
export const cleanMerchantTitle = (raw: unknown): string => {
  if (!raw) return 'Imported Expense';
  let str = String(raw).trim();

  // Pattern 1: UPI-Debit / UPI-Credit / IMPS / NEFT format with details
  const upiMatch = str.match(/^(?:UPI|IMPS|NEFT|RTGS|Account Transfer)-(?:Debit|Credit|Refund)(?:-[A-Za-z0-9]+)?-(.+)$/i);
  if (upiMatch && upiMatch[1]) {
    const segments = upiMatch[1].split('-');
    if (segments.length > 0 && segments[0].trim()) {
      let cand = segments[0].trim();
      // If segment is "REF 12345678", take the next segment if available
      if (/^REF\s*\d+/i.test(cand) && segments.length > 1) {
        cand = segments[1].trim();
      }
      cand = cand.replace(/^TO\s+/i, '');
      if (cand.length > 1) {
        return cand.replace(/\s+/g, ' ');
      }
    }
  }

  // Pattern 2: Leading transaction reference numbers like "622100169350-Invite & earn"
  str = str.replace(/^\d{8,18}-/g, '');

  // Pattern 3: Remove trailing VPA / IFSC or bank details if preceded by dash
  const dashParts = str.split('-');
  if (dashParts.length > 1 && dashParts[0].trim().length >= 3) {
    const firstPart = dashParts[0].trim();
    // If not just an ID
    if (!/^\d+$/.test(firstPart)) {
      str = firstPart;
    }
  }

  return str.replace(/\s+/g, ' ').trim() || 'Imported Transaction';
};

/**
 * Intelligent categorization based on title/narration keywords
 */
export const inferCategory = (title: string, rawNarration = ''): { category: string; categoryIcon: string } => {
  const text = `${title} ${rawNarration}`.toLowerCase();

  if (/zomato|swiggy|restaurant|cafe|canteen|food|dining|snack|mcdonald|starbucks|pizza|bakery|chinese|tea|coffee|catering|vendiman|mayuri|safal|soul tree/i.test(text)) {
    return { category: 'Food & Drinks', categoryIcon: 'cup' };
  }
  if (/grocery|supermarket|mart|zepto|blinkit|instamart|smart bazaar|spencer|bigbasket/i.test(text)) {
    return { category: 'Groceries', categoryIcon: 'cart' };
  }
  if (/amazon|flipkart|myntra|westside|zara|h&m|shopping|clothing|fashion|retail|store|mall/i.test(text)) {
    return { category: 'Shopping', categoryIcon: 'bag' };
  }
  if (/uber|ola|rapido|metro|irctc|flight|indigo|airtel|delhivery|transport|fuel|petrol|diesel|travel|stayflexi|hotel|airbnb|makemytrip/i.test(text)) {
    return { category: 'Travel', categoryIcon: 'bus' };
  }
  if (/pharmacy|hospital|doctor|clinic|medicare|medicine|morepen|apollo|1mg/i.test(text)) {
    return { category: 'Health', categoryIcon: 'heart' };
  }
  if (/openai|chatgpt|google|aws|amazon web|microsoft|github|apple|cloud|domain|hosting|subscription|playstore/i.test(text)) {
    return { category: 'Software & Tools', categoryIcon: 'laptop' };
  }
  if (/interest|salary|monies transfer|invite|earn|cashback|refund|dividend|bonus/i.test(text)) {
    return { category: 'Income', categoryIcon: 'wallet' };
  }

  return { category: 'General', categoryIcon: 'tag' };
};

/** JSON imports require a real date and an explicit direction or debit/credit columns. */
export const parseJsonTransactions = (text: string, fileName = 'transactions.json', targetAccountId = ''): ImportParseResult => {
  const report = newReport();
  try {
    const parsed = JSON.parse(text);
    const rows: unknown[] = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? parsed.transactions ?? parsed.expenses ?? parsed.items ?? [] : [];
    if (!Array.isArray(rows)) return finish('JSON Export', fileName, [], report, 'Expected a transaction array, or an object containing transactions, expenses or items.');
    if (rows.length > MAX_ENTRIES) return finish('JSON Export', fileName, [], report, `Import at most ${MAX_ENTRIES.toLocaleString()} transactions at a time.`);
    const transactions: Omit<Transaction, 'id'>[] = [];
    rows.forEach((value, index) => {
      report.rowsRead++;
      const location = `Entry ${index + 1}`;
      if (!value || typeof value !== 'object') { issue(report, location, 'Expected a transaction object.'); return; }
      const item = value as Record<string, any>;
      const date = normalizeDate(item.date ?? item.created_at ?? item.timestamp);
      if (!date) { issue(report, location, 'Missing or invalid date.'); return; }
      const title = String(item.title ?? item.description ?? item.narration ?? item.name ?? '').trim();
      if (!title) { issue(report, location, 'Missing description.'); return; }
      if (item.status && !/^(?:success(?:ful)?|completed|paid|settled|posted)$/i.test(String(item.status))) { issue(report, location, 'Transaction is not marked successful/completed.'); return; }
      if (item.currency && String(item.currency).toUpperCase() !== 'INR') { issue(report, location, 'Only INR statements are supported; no currency conversion is applied.'); return; }
      const debit = cleanNumber(item.debit), credit = cleanNumber(item.credit);
      const rawAmount = item.amount ?? item.cost ?? item.price ?? item.total;
      const numeric = signedNumber(rawAmount);
      const explicit = String(item.type ?? item.transaction_type ?? '').toLowerCase();
      let type: 'income' | 'expense' | null = null;
      let amount = 0;
      if (debit > 0 && credit > 0) { issue(report, location, 'Both debit and credit contain an amount.'); return; }
      if (debit || credit) { type = credit ? 'income' : 'expense'; amount = debit || credit; }
      else if (numeric !== null) {
        amount = Math.abs(numeric);
        type = /^(income|credit|received)$/.test(explicit) ? 'income' : /^(expense|debit|paid)$/.test(explicit) ? 'expense' : numeric < 0 ? 'expense' : typeof rawAmount === 'string' && /^\s*\+/.test(rawAmount) ? 'income' : item.cost !== undefined ? 'expense' : null;
      }
      if (!type || amount <= 0) { issue(report, location, 'Missing/invalid amount or ambiguous income/expense direction. Add type: expense or income.'); return; }
      const suppliedTime = item.time ?? String(item.timestamp ?? item.created_at ?? '').match(/[T ](\d{2}:\d{2}(?::\d{2})?)/)?.[1];
      const time = normalizeTime(suppliedTime);
      if (!blank(suppliedTime) && !time) { issue(report, location, 'Invalid time.'); return; }
      const tx = transaction(title, amount, type, date, time, targetAccountId, fileName, String(item.reference ?? item.transactionId ?? item.upiRefNo ?? ''));
      if (typeof item.category === 'string' && item.category.trim()) tx.category = item.category.trim().slice(0, 50);
      if (typeof item.categoryIcon === 'string') tx.categoryIcon = item.categoryIcon;
      if (typeof item.notes === 'string') tx.notes = [tx.notes, item.notes].filter(Boolean).join('\n').slice(0, 1000);
      transactions.push(tx);
    });
    return finish('JSON Export', fileName, transactions, report);
  } catch { return finish('JSON Export', fileName, [], report, 'This JSON file is invalid. Export a JSON transaction array or choose the original CSV/XLSX statement.'); }
};

type Columns = { date: number; time: number; title: number; debit: number; credit: number; amount: number; type: number; currency: number; status: number; reference: number };
const header = (value: unknown) => String(value ?? '').toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').replace(/[.]/g, '').trim();
function columns(row: unknown[]): Columns | null {
  const cells = row.map(header);
  const find = (...patterns: RegExp[]) => cells.findIndex(cell => patterns.some(pattern => pattern.test(cell)));
  const result = {
    date: find(/^(transaction |txn |value |posting |payment |settlement )?date(?: and time| & time| time)?$/, /^timestamp$/, /^created[_ ]?at$/),
    time: find(/^(?:transaction |txn )?time$/),
    title: find(/^(?:transaction )?details$/, /^narration$/, /^description$/, /^particulars?$/, /^merchant(?: name)?$/, /^title$/, /^item$/, /^name$/),
    debit: find(/^debit(?: amount)?(?: in (?:rs|inr))?$/, /^withdrawals?(?: amount)?$/, /^dr$/),
    credit: find(/^credit(?: amount)?(?: in (?:rs|inr))?$/, /^deposits?(?: amount)?$/, /^cr$/),
    amount: find(/^(?:transaction |net |total )?amount(?: in (?:rs|inr))?$/, /^cost$/, /^price$/, /^spend$/),
    type: find(/^(?:transaction |txn |payment )?type$/, /^direction$/, /^dr\/?cr$/, /^debit\/?credit$/),
    currency: find(/^currency(?: code)?$/), status: find(/^(?:transaction |payment )?status$/),
    reference: find(/^upi ref(?: no)?$/, /^(?:upi )?transaction id$/, /^ref(?:erence)?(?: no| number| id)?$/, /^utr(?: no| number)?$/),
  };
  return result.date >= 0 && result.title >= 0 && (result.amount >= 0 || result.debit >= 0 || result.credit >= 0) ? result : null;
}

function direction(raw: unknown): 'income' | 'expense' | null {
  const text = String(raw ?? '').trim();
  if (/^(?:income|credit|cr|received(?: ?from)?(?:\s|$)|money received)/i.test(text)) return 'income';
  if (/^(?:expense|debit|dr|paid(?: ?to)?(?:\s|$)|sent(?: ?to)?(?:\s|$)|money paid)/i.test(text)) return 'expense';
  return null;
}

/** Find actual transaction tables on every sheet, not the first summary tab. */
export const parseSpreadsheetTransactions = (fileData: ArrayBuffer | Uint8Array | string, fileName = 'transactions.xlsx', targetAccountId = ''): ImportParseResult => {
  const report = newReport();
  try {
    if (/\.pdf$/i.test(fileName)) return finish('PDF Statement', fileName, [], report, 'Choose this file using Import File so PDF text can be extracted securely.');
    const workbook = XLSX.read(fileData, { type: typeof fileData === 'string' ? (fileData.startsWith('PK') ? 'binary' : 'string') : 'array', cellDates: false, raw: true, dense: false });
    const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
    const sheetRows = workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', raw: true, blankrows: false }) }));
    const sourceHints = `${fileName} ${sheetRows.map(sheet => sheet.name).join(' ')}`.toLowerCase();
    const source = /paytm|passbook payment history/.test(sourceHints) ? 'Paytm UPI Statement' : /slice/.test(sourceHints) ? 'Slice Bank Statement' : 'Spreadsheet Statement';
    const transactions: Omit<Transaction, 'id'>[] = [];
    let foundTable = false, missingTime = false;
    for (const { name, rows } of sheetRows) {
      const firstHeader = rows.findIndex(row => columns(row));
      if (firstHeader < 0) { report.ignored += rows.filter(row => row.some(value => !blank(value))).length; continue; }
      foundTable = true;
      report.ignored += firstHeader;
      let cols = columns(rows[firstHeader])!;
      for (let index = firstHeader + 1; index < rows.length; index++) {
        const row = rows[index];
        if (!row.some(value => !blank(value))) continue;
        const repeatedHeader = columns(row);
        if (repeatedHeader) { cols = repeatedHeader; report.ignored++; continue; }
        const rawDate = row[cols.date], rawTitle = row[cols.title];
        const location = `${name}, row ${index + 1}`;
        const title = String(rawTitle ?? '').trim();
        if (/^(?:opening|closing|available|running) balance|^(?:grand )?total(?:s| amount| paid| received)?$|^summary$/i.test(title) || (!normalizeDate(rawDate, date1904) && row.some(value => /^(?:opening|closing) balance|^(?:grand )?total$/i.test(String(value).trim())))) { report.ignored++; continue; }
        // Metadata and notes after the transaction table are not candidate rows.
        if (blank(rawDate) && blank(row[cols.amount]) && blank(row[cols.debit]) && blank(row[cols.credit])) { report.ignored++; continue; }
        report.rowsRead++;
        if (report.rowsRead > MAX_ENTRIES) return finish(source, fileName, [], report, `Import at most ${MAX_ENTRIES.toLocaleString()} transaction rows at a time.`);
        const date = normalizeDate(rawDate, date1904);
        if (!date) { issue(report, location, 'Missing or invalid date.'); continue; }
        if (!title) { issue(report, location, 'Missing transaction description.'); continue; }
        const currency = cols.currency >= 0 ? String(row[cols.currency]).trim().toUpperCase() : '';
        if (currency && currency !== 'INR') { issue(report, location, 'Only INR statements are supported.'); continue; }
        const status = cols.status >= 0 ? String(row[cols.status]).trim() : '';
        if (status && !/^(?:success(?:ful)?|completed|paid|settled|posted)$/i.test(status)) { issue(report, location, 'Transaction is not marked successful/completed.'); continue; }
        const debit = cols.debit >= 0 ? signedNumber(row[cols.debit]) : null;
        const credit = cols.credit >= 0 ? signedNumber(row[cols.credit]) : null;
        const amountValue = cols.amount >= 0 ? signedNumber(row[cols.amount]) : null;
        if ((cols.debit >= 0 && !blank(row[cols.debit]) && debit === null) || (cols.credit >= 0 && !blank(row[cols.credit]) && credit === null)) { issue(report, location, 'Invalid debit or credit amount.'); continue; }
        if (debit && credit) { issue(report, location, 'Both debit and credit contain amounts.'); continue; }
        let type: 'income' | 'expense' | null = null, amount = 0;
        if (debit || credit) { type = credit ? 'income' : 'expense'; amount = Math.abs(credit || debit || 0); }
        else if (amountValue !== null) {
          amount = Math.abs(amountValue);
          type = direction(cols.type >= 0 ? row[cols.type] : '') ?? direction(title);
          const raw = String(row[cols.amount]).trim();
          if (!type) type = amountValue < 0 ? 'expense' : /^\+/.test(raw) || /CR$/i.test(raw) ? 'income' : /DR$/i.test(raw) ? 'expense' : null;
          if (!type && header(rows[firstHeader][cols.amount]) === 'cost') type = 'expense';
        }
        if (!type || amount <= 0) { issue(report, location, 'Invalid amount or ambiguous income/expense direction.'); continue; }
        const combinedTime = String(rawDate).match(/[T ](\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i)?.[1];
        const rawTime = cols.time >= 0 ? row[cols.time] : combinedTime;
        const time = normalizeTime(rawTime);
        if (!blank(rawTime) && !time) { issue(report, location, 'Invalid transaction time.'); continue; }
        missingTime ||= !time;
        const reference = cols.reference >= 0 ? String(row[cols.reference] ?? '').trim() : '';
        transactions.push(transaction(title, amount, type, date, time, targetAccountId, source, reference));
      }
    }
    if (!foundTable) return finish(source, fileName, [], report, 'No transaction table found. Export CSV/XLSX with Date, Description/Transaction Details and Amount or Debit/Credit columns. Summary-only sheets cannot be imported.');
    if (source === 'Paytm UPI Statement') {
      for (const { rows } of sheetRows) {
        for (const row of rows) {
          const label = String(row[0] ?? '').replace(/\s+/g, ' ').trim();
          if (!/^Money (Paid|Received) \(Amount in Rs\.\)$/i.test(label)) continue;
          const expected = cleanNumber(row[1]);
          const type = /^Money Received/i.test(label) ? 'income' : 'expense';
          const actual = transactions.filter(tx => tx.type === type).reduce((sum, tx) => sum + Math.round(Math.abs(tx.amount) * 100), 0) / 100;
          if (Math.abs(expected - actual) > 0.005) report.warnings.push(`The ${type === 'income' ? 'received' : 'paid'} total differs from the Paytm summary. Review skipped rows before confirming.`);
        }
      }
    }
    if (missingTime) report.warnings.push('Some statement rows have no time. They are recorded at 00:00; dates and amounts are unchanged.');
    return finish(source, fileName, transactions, report);
  } catch { return finish('Spreadsheet Statement', fileName, [], report, 'Could not read this spreadsheet. Choose an unencrypted XLSX, XLS or UTF-8 CSV export.'); }
};

/** Deterministic parser for the Google Pay transaction statement text layout. */
export const parseGooglePayPdfTransactions = (pages: string[], fileName = 'gpay_statement.pdf', targetAccountId = ''): ImportParseResult => {
  const report = newReport(), source = 'Google Pay Statement';
  if (!Array.isArray(pages) || !pages.length || pages.every(page => !page.trim())) return finish(source, fileName, [], report, 'This PDF has no selectable text. Scanned/image PDFs are unsupported; export the original Google Pay statement.');
  const text = pages.join('\n').replace(/\u00a0/g, ' ');
  if (!/Google\s*Pay/i.test(text) || !/Date\s*&\s*time\s*Transaction\s*details\s*Amount/i.test(text)) return finish(source, fileName, [], report, 'This PDF layout is unsupported. Use the Google Pay transaction statement, or export another provider as CSV/XLSX.');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const dateLine = /^(\d{1,2}\s*[A-Za-z]{3}\s*,?\s*\d{4})(?:$|\s+(?:Paid\s*to|Received\s*from))/i;
  const starts: number[] = [];
  lines.forEach((line, index) => { if (dateLine.test(line)) starts.push(index); });
  if (starts.length > MAX_ENTRIES) return finish(source, fileName, [], report, `Import at most ${MAX_ENTRIES.toLocaleString()} transactions at a time.`);
  const transactions: Omit<Transaction, 'id'>[] = [];
  starts.forEach((start, index) => {
    report.rowsRead++;
    const block = lines.slice(start, starts[index + 1] ?? lines.length);
    const location = `PDF entry ${index + 1}`;
    const dateMatch = block[0].match(dateLine)!;
    const date = normalizeDate(dateMatch[1]);
    const inline = block[0].slice(dateMatch[1].length).trim();
    const clock = block[1]?.match(/^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)(?:\s+UPI|$)/i)?.[1];
    const time = normalizeTime(clock);
    const details = inline ? [inline, ...block.slice(1)].join(' ') : block.slice(2).join(' ');
    // A complete transaction must have a UPI reference, direction and currency
    // amount. Summary totals, branding, notes and pagination cannot match.
    const ref = details.match(/UPI\s*Transaction\s*ID\s*:\s*([A-Za-z0-9-]+)/i);
    const payee = inline
      ? inline.match(/^(Paid\s*to|Received\s*from)\s*(.+?)\s*₹[\d,]+(?:\.\d{1,2})?$/i)
      : details.match(/^(Paid\s*to|Received\s*from)\s*(.+?)\s*UPI\s*Transaction\s*ID/i);
    const currency = inline ? inline.match(/₹\s*[\d,]+(?:\.\d{1,2})?$/)?.[0] : block.find(line => /^₹\s*[\d,]+(?:\.\d{1,2})?$/.test(line));
    const amount = currency ? signedNumber(currency) : null;
    if (!date || !time || !ref || !payee || !amount) { issue(report, location, 'Incomplete Google Pay record: date, time, payee, UPI reference or amount is missing.'); return; }
    const type = /^Received/i.test(payee[1]) ? 'income' : 'expense';
    transactions.push(transaction(payee[2].trim(), amount, type, date, time, targetAccountId, source, ref[1]));
  });
  for (const label of ['Sent', 'Received']) {
    const summary = text.match(new RegExp(`(?:^|\\n)${label}\\s*\\n\\s*(₹[\\d,]+(?:\\.\\d{1,2})?)`, 'i'));
    // Position-based PDF extraction places Sent and Received on one line and
    // their amounts in the next row. These are still summary controls only.
    const inlineSummary = text.match(/Sent\s+Received\s*\n[^\n]*?(₹[\d,]+(?:\.\d{1,2})?)\s+(₹[\d,]+(?:\.\d{1,2})?)/i);
    const expectedText = summary?.[1] ?? inlineSummary?.[label === 'Sent' ? 1 : 2];
    if (!expectedText) continue;
    const expected = cleanNumber(expectedText);
    const actual = transactions.filter(tx => tx.type === (label === 'Sent' ? 'expense' : 'income')).reduce((sum, tx) => sum + Math.round(Math.abs(tx.amount) * 100), 0) / 100;
    if (Math.abs(expected - actual) > 0.005) report.warnings.push(`The ${label.toLowerCase()} total differs from the Google Pay summary. Review skipped entries before confirming.`);
  }
  report.ignored = Math.max(0, lines.length - starts.length * (lines[starts[0]]?.match(dateLine)?.[0] === lines[starts[0]] ? 6 : 3));
  return finish(source, fileName, transactions, report);
};

export const parseAnyTextTransactions = (text: string, fileName = 'pasted_statement.csv', targetAccountId = ''): ImportParseResult => {
  const trimmed = text.trim();
  if (!trimmed) return finish('Text Input', fileName, [], newReport(), 'Paste a CSV or JSON transaction export first.');
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseJsonTransactions(trimmed, fileName, targetAccountId);
  return parseSpreadsheetTransactions(trimmed, fileName, targetAccountId);
};
