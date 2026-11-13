import * as XLSX from 'xlsx';
import { Transaction } from '../types';

export interface ImportParseResult {
  success: boolean;
  sourceApp: string;
  fileName?: string;
  transactions: Omit<Transaction, 'id'>[];
  error?: string;
}

export const cleanNumber = (val: unknown): number => {
  if (typeof val === 'number') return Math.abs(val);
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
};

export const normalizeDate = (raw: unknown): string => {
  if (!raw) {
    return new Date().toISOString().split('T')[0];
  }

  // Handle Excel Serial Date Number
  if (typeof raw === 'number') {
    // 25569 is Jan 1 1970 in Excel epoch
    const epoch = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(epoch.getTime())) {
      const y = epoch.getUTCFullYear();
      const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      const d = String(epoch.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  let str = String(raw).trim().replace(/^['"]|['"]$/g, '');

  // Check if standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    const [, d, m, rawYear] = dmyMatch;
    const y = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Check formats like "09 Aug '26" or "09 Aug 2026" or "09-Aug-2026"
  const formattedStr = str.replace(/'(\d{2})$/, '20$1');
  const parsed = new Date(formattedStr);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().split('T')[0];
};

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
        const rawTitle = item.title || item.description || item.narration || item.name || 'Imported Expense';
        const title = cleanMerchantTitle(rawTitle);
        const amount = cleanNumber(item.amount || item.cost || item.debit || item.price || item.total);
        if (amount <= 0) return null;

        const date = normalizeDate(item.date || item.created_at || item.timestamp);
        const inferred = inferCategory(title, String(rawTitle));
        const category = item.category || inferred.category;
        const txType: 'expense' | 'income' = item.type === 'income' ? 'income' : 'expense';

        return {
          title: String(title).trim(),
          amount: txType === 'income' ? amount : -amount,
          type: txType,
          category,
          categoryIcon: item.categoryIcon || inferred.categoryIcon,
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
 * Handles statements with header metadata rows (Slice, HDFC, SBI, ICICI, etc.)
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
      cellDates: false,
      raw: false,
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
    const raw2DRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    });

    if (!raw2DRows || raw2DRows.length === 0) {
      return {
        success: false,
        sourceApp: 'Spreadsheet',
        fileName,
        transactions: [],
        error: 'Spreadsheet contains no data rows.',
      };
    }

    // Step 1: Scan for the true transaction table header row
    // (Bypasses top account/customer metadata rows like Customer ID, A/C Number, etc.)
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(raw2DRows.length, 35); i++) {
      const row = raw2DRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((cell) => String(cell).toLowerCase().trim()).join(' ');

      const hasDate = /date|txn.?date|value.?date/.test(rowStr);
      const hasTitle = /detail|narration|desc|particular|merchant|title|item/.test(rowStr);
      const hasAmount = /debit|credit|amount|cost|spend|withdrawal|deposit|balance/.test(rowStr);

      if (hasDate && (hasTitle || hasAmount)) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      // Fallback: look for row with multiple standard finance terms
      for (let i = 0; i < Math.min(raw2DRows.length, 15); i++) {
        const rowStr = raw2DRows[i].map((cell) => String(cell).toLowerCase()).join(' ');
        if (/amount|cost|price|debit|credit/.test(rowStr)) {
          headerRowIdx = i;
          break;
        }
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const headerCells = (raw2DRows[headerRowIdx] || []).map((c: any) =>
      String(c).toLowerCase().trim()
    );

    const findCol = (...keywords: string[]): number => {
      for (const kw of keywords) {
        const idx = headerCells.findIndex((h: string) => h.includes(kw));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const dateCol = findCol('date', 'time', 'timestamp');
    const titleCol = findCol('detail', 'narration', 'desc', 'particular', 'merchant', 'title', 'item');
    const debitCol = findCol('debit', 'withdrawal', 'dr');
    const creditCol = findCol('credit', 'deposit', 'cr');
    const amountCol = findCol('cost', 'amount', 'total', 'spend', 'price', 'net amount');
    const typeCol = findCol('transaction type', 'txn type', 'type');
    const categoryCol = findCol('category', 'tag', 'group');
    const paidByCol = findCol('paid by', 'payer', 'who');

    // App detection
    const allHeadersStr = headerCells.join(' ');
    const isSlice = /slice|ref no|transaction type|nesf/.test(
      raw2DRows.slice(0, 10).map((r) => r.join(' ')).join(' ').toLowerCase()
    );
    const isSplitwise = /payer|cost|currency|split_equally/.test(allHeadersStr);
    const isTricount = /tricount|for whom/.test(allHeadersStr);
    const isBank = debitCol !== -1 && creditCol !== -1;

    let detectedSource = 'Spreadsheet';
    if (isSlice) detectedSource = 'Slice Bank Statement';
    else if (isSplitwise) detectedSource = 'Splitwise';
    else if (isTricount) detectedSource = 'Tricount';
    else if (isBank) detectedSource = 'Bank Statement';

    const transactions: Omit<Transaction, 'id'>[] = [];

    for (let i = headerRowIdx + 1; i < raw2DRows.length; i++) {
      const row = raw2DRows[i];
      if (!row || row.length === 0) continue;

      const rawDate = dateCol !== -1 ? row[dateCol] : undefined;
      const rawTitle = titleCol !== -1 ? row[titleCol] : row[1] || row[0];

      // Skip row if completely empty
      if (!rawDate && !rawTitle && !row.some((c) => Boolean(c))) {
        continue;
      }

      // Determine amount and debit/credit
      let amount = 0;
      let txType: 'expense' | 'income' = 'expense';

      if (debitCol !== -1 || creditCol !== -1) {
        const debitVal = debitCol !== -1 ? cleanNumber(row[debitCol]) : 0;
        const creditVal = creditCol !== -1 ? cleanNumber(row[creditCol]) : 0;

        if (creditVal > 0) {
          amount = creditVal;
          txType = 'income';
        } else if (debitVal > 0) {
          amount = debitVal;
          txType = 'expense';
        } else if (amountCol !== -1) {
          amount = cleanNumber(row[amountCol]);
          const rawTypeStr = typeCol !== -1 ? String(row[typeCol]).toUpperCase() : '';
          txType = rawTypeStr.includes('CREDIT') || rawTypeStr.includes('CR') ? 'income' : 'expense';
        }
      } else if (amountCol !== -1) {
        amount = cleanNumber(row[amountCol]);
        const rawTypeStr = typeCol !== -1 ? String(row[typeCol]).toUpperCase() : '';
        txType = rawTypeStr.includes('CREDIT') || rawTypeStr.includes('CR') ? 'income' : 'expense';
      }

      if (amount <= 0) continue;

      const date = normalizeDate(rawDate);
      const cleanTitle = cleanMerchantTitle(rawTitle);
      const inferred = inferCategory(cleanTitle, String(rawTitle || ''));
      const rawCat = categoryCol !== -1 ? String(row[categoryCol]).trim() : '';
      const category = rawCat || (txType === 'income' ? 'Income' : inferred.category);
      const rawPaidBy = paidByCol !== -1 ? String(row[paidByCol]).trim().toLowerCase() : 'user';

      transactions.push({
        title: cleanTitle,
        amount: txType === 'income' ? amount : -amount,
        type: txType,
        category,
        categoryIcon: txType === 'income' ? 'wallet' : inferred.categoryIcon,
        date,
        time: '12:00 PM',
        upiAccountId: targetAccountId,
        paidBy: rawPaidBy.includes('you') || rawPaidBy.includes('user') ? 'user' : rawPaidBy,
        splitType: 'equal',
        splits: [],
        settled: false,
        subtitle: `${detectedSource} • ${date}`,
      });
    }

    if (transactions.length === 0) {
      return {
        success: false,
        sourceApp: detectedSource,
        fileName,
        transactions: [],
        error: 'No valid transaction records could be parsed from the file.',
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

/**
 * Universal text parser that accepts either JSON or CSV text seamlessly
 */
export const parseAnyTextTransactions = (
  text: string,
  fileName = 'pasted_data.txt',
  targetAccountId = 'acc-1'
): ImportParseResult => {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      sourceApp: 'Text Input',
      fileName,
      transactions: [],
      error: 'Empty text input.',
    };
  }

  // Try JSON first if starts with [ or {
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const jsonResult = parseJsonTransactions(trimmed, fileName, targetAccountId);
    if (jsonResult.success && jsonResult.transactions.length > 0) {
      return jsonResult;
    }
  }

  // Fallback to spreadsheet/CSV parser
  return parseSpreadsheetTransactions(trimmed, fileName.endsWith('.csv') ? fileName : 'pasted_data.csv', targetAccountId);
};
