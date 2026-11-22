export interface LedgerResetCounts { removedTransactions: number; retainedTransactions: number }

export async function clearSettledLedger(
  readPolicy: () => Promise<{ resetPolicy?: string }>,
  clear: (body: { mode: 'settled-only' }) => Promise<{ result: Partial<LedgerResetCounts> }>,
): Promise<LedgerResetCounts> {
  const latest = await readPolicy();
  if (latest.resetPolicy !== 'settled-only') throw new Error('Clearing settled history is not available yet. Please try again after refreshing.');
  const response = await clear({ mode: 'settled-only' });
  const { removedTransactions, retainedTransactions } = response.result;
  if (!Number.isSafeInteger(removedTransactions) || removedTransactions! < 0 || !Number.isSafeInteger(retainedTransactions) || retainedTransactions! < 0) {
    throw new Error('Your ledger was updated. Refresh it to see which entries were kept.');
  }
  return { removedTransactions: removedTransactions!, retainedTransactions: retainedTransactions! };
}
