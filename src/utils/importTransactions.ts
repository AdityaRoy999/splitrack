import * as XLSX from 'xlsx';
import { Transaction } from '../types';

export interface ImportParseResult {
  success: boolean;
  sourceApp: string;
  fileName?: string;
  transactions: Omit<Transaction, 'id'>[];
  error?: string;
}

const cleanNumber = (val: unknown): number => {
  if (typeof val === 'number') return Math.abs(val);
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
};

const normalizeDate = (raw: unknown): string => {
  if (!raw) {
    return new Date().toISOString().split('T')[0];
  }

  // Handle Excel Serial Date Number
  if (typeof raw === 'number') {
    const epoch = new Date((raw - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(epoch.getTime())) {
      return epoch.toISOString().split('T')[0];
    }
  }

  const str = String(raw).trim();
  // Check if standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Check MM/DD/YYYY
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
};

/**
 * Parses raw JSON string into SplitTrack transactions
 */
export const parseJsonTransactions = (
  jsonText: string,
  fileName = 'data.json',
  targetAccountId = 'acc-1'
): ImportParseResult => {
  try {
    const parsed = JSON.parse(jsonText);
    const rawList: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.transactions)
      ? parsed.transactions
      : Array.isArray(parsed.expenses)
      ? parsed.expenses
      : Array.isArray(parsed.items)
      ? parsed.items
      : [];

    if (rawList.length === 0) {
      return {
        success: false,
        sourceApp: 'JSON File',
        fileName,
        transactions: [],
        error: 'No transaction entries found in JSON file.',
      };
    }

    const isSplitwise = rawList.some((item) => item.cost || item.payer || item.split_equally !== undefined);
    const isSplitTrack = rawList.some((item) => item.upiAccountId || item.splitType);

    const transactions: Omit<Transaction, 'id'>[] = rawList
      .map((item): Omit<Transaction, 'id'> | null => {
        const title = item.title || item.description || item.narration || item.name || 'Imported Expense';
        const amount = cleanNumber(item.amount || item.cost || item.debit || item.price || item.total);
        if (amount <= 0) return null;

        const date = normalizeDate(item.date || item.created_at || item.timestamp);
        const category = item.category || 'Food & Drinks';
        const txType: 'expense' | 'income' = item.type === 'income' ? 'income' : 'expense';

        return {
          title: String(title).trim(),
          amount: txType === 'income' ? amount : -amount,
          type: txType,
          category,
          categoryIcon: item.categoryIcon || 'tag',
          date,
          time: item.time || '12:00 PM',
          upiAccountId: item.upiAccountId || targetAccountId,
          paidBy: item.paidBy || 'user',
          splitType: item.splitType || 'equal',
          splits: item.splits || [],
          settled: Boolean(item.settled),
          subtitle: item.subtitle || `Imported from ${fileName}`,
        };
      })
      .filter((t): t is Omit<Transaction, 'id'> => t !== null);

    return {
      success: transactions.length > 0,
      sourceApp: isSplitTrack ? 'SplitTrack Backup' : isSplitwise ? 'Splitwise' : 'JSON Export',
      fileName,
      transactions,
    };
  } catch (err: any) {
    return {
      success: false,
      sourceApp: 'JSON File',
      fileName,
      transactions: [],
      error: `JSON parse error: ${err.message || 'Invalid format'}`,
    };
  }
};

/**
 * Universal Excel (.xlsx, .xls) and CSV parser
 */
export const parseSpreadsheetTransactions = (
  fileData: ArrayBuffer | Uint8Array | string,
  fileName = 'transactions.xlsx',
  targetAccountId = 'acc-1'
): ImportParseResult => {
  try {
    let readType: 'array' | 'string' | 'binary' = 'array';
    if (typeof fileData === 'string') {
      readType = fileData.startsWith('PK') ? 'binary' : 'string';
    }
    const workbook = XLSX.read(fileData, {
      type: readType,
      cellDates: true,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        sourceApp: 'Spreadsheet',
        fileName,
        transactions: [],
        error: 'Empty workbook: no sheets found.',
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
    });

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        sourceApp: 'Spreadsheet',
        fileName,
        transactions: [],
        error: 'Spreadsheet contains no data rows.',
      };
    }

    // Inspect columns from first row
    const headers = Object.keys(rawRows[0] || {});
    const findHeader = (...keywords: string[]) => {
      for (const kw of keywords) {
        const found = headers.find((h) => h.toLowerCase().trim().includes(kw));
        if (found) return found;
      }
      return undefined;
    };

    const dateHeader = findHeader('date', 'time', 'timestamp', 'txn_date');
    const titleHeader = findHeader('description', 'title', 'particulars', 'narration', 'merchant', 'item', 'details');
    const amountHeader = findHeader('cost', 'amount', 'debit', 'withdrawal', 'total', 'spend', 'price');
    const categoryHeader = findHeader('category', 'type', 'tag', 'group');
    const paidByHeader = findHeader('paid by', 'payer', 'paid_by', 'who');

    // App detection
    const isSplitwise = headers.some((h) => /cost|currency|details|payer/i.test(h));
    const isTricount = headers.some((h) => /tricount|for whom/i.test(h));
    const isBank = headers.some((h) => /debit|credit|balance|narration|ref/i.test(h));

    let detectedSource = 'Spreadsheet';
    if (isSplitwise) detectedSource = 'Splitwise';
    else if (isTricount) detectedSource = 'Tricount';
    else if (isBank) detectedSource = 'Bank Statement';

    const transactions: Omit<Transaction, 'id'>[] = [];

    for (const row of rawRows) {
      const rawTitle = titleHeader ? row[titleHeader] : row[headers[1]] || 'Expense';
      const rawAmount = amountHeader ? row[amountHeader] : row[headers[2]] || row[headers[0]];
      const amount = cleanNumber(rawAmount);
      if (amount <= 0) continue;

      const rawDate = dateHeader ? row[dateHeader] : row[headers[0]];
      const date = normalizeDate(rawDate);
      const rawCat = categoryHeader ? row[categoryHeader] : '';
      const category = rawCat ? String(rawCat).trim() : 'Food & Drinks';
      const rawPaidBy = paidByHeader ? String(row[paidByHeader]).trim().toLowerCase() : 'user';

      transactions.push({
        title: String(rawTitle).trim() || 'Imported Expense',
        amount: -amount,
        type: 'expense',
        category,
        categoryIcon: 'tag',
        date,
        time: '12:00 PM',
        upiAccountId: targetAccountId,
        paidBy: rawPaidBy.includes('you') || rawPaidBy.includes('user') ? 'user' : rawPaidBy,
        splitType: 'equal',
        splits: [],
        settled: false,
        subtitle: `Imported via ${detectedSource}`,
      });
    }

    if (transactions.length === 0) {
      return {
        success: false,
        sourceApp: detectedSource,
        fileName,
        transactions: [],
        error: 'No valid transactions could be parsed from the file columns.',
      };
    }

    return {
      success: true,
      sourceApp: detectedSource,
      fileName,
      transactions,
    };
  } catch (err: any) {
    return {
      success: false,
      sourceApp: 'Spreadsheet',
      fileName,
      transactions: [],
      error: `Spreadsheet error: ${err.message || 'Failed to read spreadsheet file'}`,
    };
  }
};
