import type { Transaction } from '../types';

interface LedgerPage {
  generation?: number;
  transactions: Transaction[];
  transactionCursor: string | null;
}

// Server JSON is immutable in the store. Keep unchanged branches so a periodic
// refresh does not rebuild charts, lists and native effects for identical data.
export function retainUnchanged<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next;
  if (Array.isArray(previous) || Array.isArray(next)) {
    if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) return next;
    let unchanged = true;
    const result = next.map((item, index) => {
      const value = retainUnchanged(previous[index], item);
      if (value !== previous[index]) unchanged = false;
      return value;
    });
    return (unchanged ? previous : result) as T;
  }
  const oldRecord = previous as Record<string, unknown>, newRecord = next as Record<string, unknown>;
  const keys = Object.keys(newRecord);
  let unchanged = keys.length === Object.keys(oldRecord).length;
  const result: Record<string, unknown> = { ...newRecord };
  for (const key of keys) {
    result[key] = retainUnchanged(oldRecord[key], newRecord[key]);
    if (!Object.prototype.hasOwnProperty.call(oldRecord, key) || result[key] !== oldRecord[key]) unchanged = false;
  }
  return (unchanged ? previous : result) as T;
}

// Apply new balances immediately while retaining opened older pages until they
// finish revalidation. Never carry entries across a fresh-ledger generation.
export function preserveOpenedHistory<T extends LedgerPage>(next: T, previous: T, openedCount: number): T {
  if ((next.generation ?? 0) !== (previous.generation ?? 0) || !next.transactionCursor || openedCount <= next.transactions.length) return next;
  const loadedIds = new Set(next.transactions.map(transaction => transaction.id));
  let previousBoundary = -1;
  previous.transactions.forEach((transaction, index) => { if (loadedIds.has(transaction.id)) previousBoundary = index; });
  if (previousBoundary < 0) return next;
  const older = previous.transactions.slice(previousBoundary + 1).filter(transaction => !loadedIds.has(transaction.id));
  if (!older.length) return next;
  return { ...next, transactions: [...next.transactions, ...older].slice(0, openedCount) };
}
