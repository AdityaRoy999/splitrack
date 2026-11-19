import type { Transaction } from '../types';

interface LedgerPage {
  generation?: number;
  transactions: Transaction[];
  transactionCursor: string | null;
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
