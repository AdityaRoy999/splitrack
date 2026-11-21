import type { Transaction, UpiAccount, Friend, Trip } from '../types';

export type TransactionDraft = Omit<Transaction, 'id'> & { targetFriendId?: string };
export type DuplicateTransaction = Pick<Transaction, 'id' | 'title' | 'amount' | 'date' | 'paidBy' | 'tripId'> & { splits?: Transaction['splits'] };
export interface OutboxEntry {
  requestId: string; localId: string; bodyJson: string; generation: number;
  status: 'pending' | 'duplicate' | 'failed'; existingTransaction?: DuplicateTransaction; error?: string;
  errorCode?: string;
}
export interface OfflineSnapshot {
  userId: string; generation?: number; accounts: UpiAccount[]; friends: Friend[]; trips: Trip[]; transactions: Transaction[];
  settings: { selectedAccountId: string };
  summary: { totalIncome: number; totalExpenses: number; categories: Record<string, number>; months: Record<string, { income: number; expense: number }> };
}
/** Bound history checkpoints while keeping ledger metadata and durable ACK IDs. */
export function encodeOfflineCheckpoint<T extends OfflineSnapshot & { transactionCursor: string | null }>(snapshot: T, committedRequests: Iterable<string>) {
  let cached = snapshot;
  const ids = [...committedRequests];
  let encoded = JSON.stringify({ snapshot: cached, committedRequests: ids });
  while (encoded.length > 450_000 && cached.transactions.length > 1) {
    cached = { ...cached, transactions: cached.transactions.slice(0, Math.ceil(cached.transactions.length / 2)), transactionCursor: null };
    encoded = JSON.stringify({ snapshot: cached, committedRequests: ids });
  }
  if (encoded.length > 450_000) throw new Error('Saved records are too large to cache on this device. Your transaction remains queued safely.');
  return encoded;
}
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
const key = (uid: string) => `@splittrack_outbox_v1_${uid}`;
const paise = (n: number) => Math.round(n * 100);
const money = (n: number) => n / 100;
const add = (a: number, b: number) => money(paise(a) + paise(b));
const member = (id: string, uid: string) => id === uid || id === 'me' ? 'user' : id;
const requestPattern = /^[A-Za-z0-9_-]{12,100}$/;
const durableWrites = new Map<string, Promise<unknown>>();

/** One durable write publishes each state transition; a failed write never changes memory. */
export class TransactionOutbox {
  entries: OutboxEntry[] = [];
  readonly ready: Promise<void>;
  private writes: Promise<unknown> = Promise.resolve();
  private lastEncoded: string | null = null;
  constructor(readonly uid: string, private storage: Storage, private changed: () => void = () => {}) {
    this.ready = this.restore();
  }
  private async restore(waitForWrites = true) {
    if (waitForWrites) await durableWrites.get(this.uid)?.catch(() => {});
    const raw = await this.storage.getItem(key(this.uid));
    if (!raw || raw === this.lastEncoded) return;
    const envelope = JSON.parse(raw);
    if (envelope.version !== 1 || envelope.uid !== this.uid || !Array.isArray(envelope.entries)) throw new Error('Saved offline transactions could not be read. Your data has been retained.');
    const ids = new Set();
    for (const entry of envelope.entries) {
      if (!requestPattern.test(entry.requestId) || entry.localId !== `offline-${entry.requestId}` || ids.has(entry.requestId)
        || typeof entry.bodyJson !== 'string' || !['pending', 'duplicate', 'failed'].includes(entry.status)
        || !Number.isInteger(entry.generation) || entry.generation < 0) throw new Error('Saved offline transactions could not be read. Your data has been retained.');
      const body = JSON.parse(entry.bodyJson);
      const date = new Date(`${body.date}T00:00:00Z`);
      if (!(body.durableRetry === true || body.duplicateCheck === true) || body.ledgerGeneration !== entry.generation || !Number.isFinite(body.amount)
        || !['expense', 'income', 'transfer', 'settlement'].includes(body.type) || typeof body.title !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(date.getTime())
        || date.toISOString().slice(0, 10) !== body.date || !Array.isArray(body.splits)
        || !body.splits.every((split: unknown) => split !== null && typeof split === 'object' && typeof (split as { friendId?: unknown }).friendId === 'string')
        || ['time', 'category', 'categoryIcon', 'paidBy', 'upiAccountId', 'splitType'].some(field => typeof body[field] !== 'string')) throw new Error('Saved offline transactions could not be read. Your data has been retained.');
      try {
        // Validate the saved arithmetic independently of memberships/accounts
        // that may since have changed. AWS checks those against current data.
        const ids = [...new Set(['user', body.paidBy, ...body.splits.map((split: { friendId: string }) => split.friendId)])] as string[];
        const accountIds = [...new Set([body.upiAccountId, body.toAccountId].filter(Boolean))] as string[];
        validateOfflineTransaction(body, {
          userId: this.uid, accounts: accountIds.map(id => ({ id })) as UpiAccount[], friends: ids.map(id => ({ id, netBalance: Math.abs(body.amount) })) as Friend[],
          trips: body.tripId ? [{ id: body.tripId, members: ids }] as Trip[] : [], transactions: [], settings: { selectedAccountId: body.upiAccountId },
          summary: { totalIncome: 0, totalExpenses: 0, categories: {}, months: {} },
        });
      } catch { throw new Error('Saved offline transactions could not be read. Your data has been retained.'); }
      if (entry.status === 'duplicate' && (!entry.existingTransaction || typeof entry.existingTransaction.id !== 'string'
        || typeof entry.existingTransaction.title !== 'string' || !Number.isFinite(entry.existingTransaction.amount)
        || typeof entry.existingTransaction.date !== 'string' || typeof entry.existingTransaction.paidBy !== 'string')) throw new Error('Saved offline transactions could not be read. Your data has been retained.');
      ids.add(entry.requestId);
    }
    this.entries = envelope.entries;
    this.lastEncoded = raw;
    this.changed();
  }
  update(change: (entries: OutboxEntry[]) => OutboxEntry[]): Promise<void> {
    const previous = Promise.all([this.writes.catch(() => {}), durableWrites.get(this.uid)?.catch(() => {})]);
    const work = previous.then(async () => {
      await this.ready;
      // A previous provider may finish a disk write during an account remount.
      // Merge against that latest envelope, never a stale in-memory copy.
      await this.restore(false);
      const next = change(this.entries);
      if (next === this.entries) return;
      const encoded = JSON.stringify({ version: 1, uid: this.uid, entries: next });
      // Keep even multibyte titles below Android's per-value storage window.
      if (encoded.length > 500_000) throw new Error('Please sync your saved offline transactions before adding more.');
      await this.storage.setItem(key(this.uid), encoded);
      this.entries = next;
      this.lastEncoded = encoded;
      this.changed();
    });
    this.writes = work;
    durableWrites.set(this.uid, work);
    return work;
  }
  async enqueue(draft: TransactionDraft, requestId: string, generation: number) {
    if (!requestPattern.test(requestId)) throw new Error('This transaction has an invalid save ID. Please reopen the form.');
    const bodyJson = JSON.stringify({ ...draft, durableRetry: true, ledgerGeneration: generation });
    await this.update(entries => {
      const previous = entries.find(entry => entry.requestId === requestId);
      if (previous) {
        if (previous.bodyJson !== bodyJson) throw new Error('This save ID belongs to a different transaction.');
        return entries;
      }
      return [...entries, { requestId, localId: `offline-${requestId}`, bodyJson, generation, status: 'pending' }];
    });
  }
  async resumeRejectedDuplicates(createId: () => string) {
    await this.ready;
    if (!this.entries.some(entry => entry.status === 'duplicate')) return;
    await this.update(entries => entries.map(entry => {
      if (entry.status !== 'duplicate') return entry;
      // A definitive old duplicate rejection never committed. Give that draft
      // a fresh request key; never alter the bytes of an uncertain pending save.
      const body = JSON.parse(entry.bodyJson);
      delete body.duplicateCheck; delete body.confirmDuplicate;
      const requestId = createId();
      if (!requestPattern.test(requestId)) throw new Error('This transaction has an invalid save ID.');
      return { ...entry, requestId, localId: `offline-${requestId}`, bodyJson: JSON.stringify({ ...body, durableRetry: true }), status: 'pending', existingTransaction: undefined, error: undefined, errorCode: undefined };
    }));
  }
  async retireBeforeGeneration(generation: number) {
    await this.ready;
    if (!Number.isInteger(generation) || generation < 0 || !this.entries.some(entry => entry.generation < generation)) return;
    // A newer authoritative ledger proves the user already erased these drafts.
    // Keep current/future generations intact and never repopulate erased data.
    await this.update(entries => entries.filter(entry => entry.generation >= generation));
  }
}

function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((n, w) => n + w, 0), exact = weights.map(w => total * w / sum), amounts = exact.map(Math.floor);
  const order = exact.map((n, i) => ({ i, remainder: n - amounts[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let left = total - amounts.reduce((n, a) => n + a, 0), i = 0; left > 0; left--, i++) amounts[order[i].i]++;
  return amounts;
}
function expenseParticipants(tx: TransactionDraft, uid: string) {
  const total = Math.abs(paise(tx.amount)), payer = member(tx.paidBy || 'user', uid);
  const raw = tx.splits?.length ? tx.splits : [{ friendId: 'user', amount: money(total), paidAmount: 0 }];
  const weights = raw.map(s => tx.splitType === 'shares' ? Number(s.share) : tx.splitType === 'percentage' ? Number(s.percentage) : 1);
  const shares = tx.splitType === 'exact' ? raw.map(s => paise(s.amount)) : allocate(total, weights);
  const participants = raw.map((s, i) => ({ id: member(s.friendId, uid), share: shares[i], paid: Math.max(0, paise(s.paidAmount || 0)) }));
  for (const id of [payer, 'user']) if (!participants.some(p => p.id === id)) participants.push({ id, share: 0, paid: 0 });
  if (participants.every(p => !p.paid)) participants.find(p => p.id === payer)!.paid = total;
  return participants;
}

/** Validate offline inputs before acknowledging a save; AWS validates again on synchronization. */
export function validateOfflineTransaction(tx: TransactionDraft, snapshot: OfflineSnapshot) {
  const total = Math.abs(paise(tx.amount));
  if (!Number.isSafeInteger(total) || !total || total > 10_000_000_000 || Math.abs(tx.amount * 100 - paise(tx.amount)) > 0.00001) throw new Error('Enter a positive amount with at most two decimal places.');
  if (!tx.title?.trim() || tx.title.trim().length > 120) throw new Error('Enter a transaction title with at most 120 characters.');
  const date = new Date(`${tx.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== tx.date) throw new Error('Enter a valid transaction date.');
  const accountId = tx.upiAccountId || snapshot.settings.selectedAccountId;
  if (accountId && !snapshot.accounts.some(account => account.id === accountId)) throw new Error('Choose an active payment profile.');
  if (!['expense', 'income', 'transfer', 'settlement'].includes(tx.type)) throw new Error('Choose a supported transaction type.');
  if (tx.type === 'settlement') {
    const target = member(tx.targetFriendId || tx.paidBy, snapshot.userId);
    const friend = snapshot.friends.find(item => item.id === target);
    if (!friend || target === 'user' || !tx.sourceTransactionId && friend.netBalance <= 0) throw new Error('Only the member owed an outstanding balance can record a settlement.');
    if (tx.sourceTransactionId?.startsWith('offline-')) throw new Error('Sync the original expense before recording its settlement.');
    return;
  }
  if (tx.type === 'transfer' && (!accountId || !snapshot.accounts.some(account => account.id === tx.toAccountId) || accountId === tx.toAccountId)) throw new Error('Choose different source and destination payment profiles.');
  if (tx.type !== 'expense') return;
  const raw = tx.splits?.length ? tx.splits : [{ friendId: 'user', amount: money(total), paidAmount: 0 }];
  if (raw.some(s => !Number.isFinite(s.paidAmount ?? 0) || Math.abs((s.paidAmount ?? 0) * 100 - paise(s.paidAmount ?? 0)) > 0.00001)) throw new Error('Paid amounts must have at most two decimal places.');
  const ids = raw.map(s => member(s.friendId, snapshot.userId));
  if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !id) || ids.length > 12) throw new Error('Choose up to 12 unique split participants.');
  if (tx.splitType === 'exact' && (raw.some(s => s.amount < 0 || Math.abs(s.amount * 100 - paise(s.amount)) > 0.00001) || raw.reduce((n, s) => n + paise(s.amount), 0) !== total)) throw new Error('Exact split amounts must add up to the expense.');
  if (tx.splitType === 'percentage' && (raw.some(s => !Number.isFinite(s.percentage) || Number(s.percentage) < 0) || Math.abs(raw.reduce((n, s) => n + Number(s.percentage), 0) - 100) > 0.00001)) throw new Error('Split percentages must add up to 100.');
  if (tx.splitType === 'shares' && (raw.some(s => !Number.isFinite(s.share) || Number(s.share) < 0) || raw.reduce((n, s) => n + Number(s.share), 0) <= 0)) throw new Error('Split shares must have a positive total.');
  if (!['equal', 'exact', 'percentage', 'shares'].includes(tx.splitType)) throw new Error('Choose a supported split type.');
  const participants = expenseParticipants(tx, snapshot.userId);
  if (participants.length > 12 || participants.reduce((n, p) => n + p.paid, 0) !== total) throw new Error('Payments must add up to the expense.');
  const trip = tx.tripId ? snapshot.trips.find(item => item.id === tx.tripId) : undefined;
  if (tx.tripId && (!trip || participants.some(p => !trip.members.map(id => member(id, snapshot.userId)).includes(p.id)))) throw new Error('All expense participants must belong to the trip.');
  if (!tx.tripId && participants.some(p => p.id !== 'user' && !snapshot.friends.some(friend => friend.id === p.id))) throw new Error('Add this registered member before splitting an expense.');
}

/** Always rebase onto an authoritative snapshot; never persist optimistic balances as the base. */
export function optimisticSnapshot<T extends OfflineSnapshot>(base: T, entries: OutboxEntry[], alreadyCommitted: Iterable<string> = []): T {
  const committedRequests = new Set([...alreadyCommitted, ...base.transactions.map(tx => (tx as Transaction & { clientRequestId?: string }).clientRequestId).filter(Boolean)]);
  const activeEntries = entries.filter(entry => entry.status === 'pending' && entry.generation === (base.generation || 0) && !committedRequests.has(entry.requestId));
  if (!activeEntries.length) return base;
  // Only balances/totals are changed below. Retain opened transaction history,
  // settings, profiles and category metadata instead of serializing the entire
  // ledger on every local save or retry.
  const next = {
    ...base,
    accounts: base.accounts.map(account => ({ ...account })),
    friends: base.friends.map(friend => ({ ...friend })),
    trips: base.trips.map(trip => ({ ...trip })),
    summary: {
      ...base.summary,
      categories: { ...base.summary.categories },
      months: Object.fromEntries(Object.entries(base.summary.months).map(([month, totals]) => [month, { ...totals }])),
    },
  } as T, localTransactions: Transaction[] = [];
  for (const entry of activeEntries) {
    const tx = JSON.parse(entry.bodyJson) as TransactionDraft;
    const accountId = tx.upiAccountId || next.settings.selectedAccountId, account = next.accounts.find(item => item.id === accountId);
    const total = Math.abs(paise(tx.amount)), month = tx.date.slice(0, 7);
    let income = 0, expense = 0;
    const participants = tx.type === 'expense' ? expenseParticipants(tx, base.userId) : [];
    if (tx.type === 'income') {
      income = total;
      if (account) account.balance = add(account.balance, money(total));
    } else if (tx.type === 'transfer') {
      if (account) account.balance = add(account.balance, -money(total));
      const target = next.accounts.find(item => item.id === tx.toAccountId);
      if (target) target.balance = add(target.balance, money(total));
    } else if (tx.type === 'expense') {
      const self = participants.find(p => p.id === 'user')!;
      expense = self.share;
      if (account) { account.balance = add(account.balance, -money(self.paid)); account.totalSpent = add(account.totalSpent, money(self.paid)); }
      next.summary.categories[tx.category] = add(next.summary.categories[tx.category] || 0, money(expense));
      const creditors = participants.map(p => ({ ...p, left: p.paid - p.share })).filter(p => p.left > 0);
      const debtors = participants.map(p => ({ ...p, left: p.share - p.paid })).filter(p => p.left > 0);
      for (let i = 0, j = 0; i < creditors.length && j < debtors.length;) {
        const cents = Math.min(creditors[i].left, debtors[j].left);
        const creditor = creditors[i].id, debtor = debtors[j].id;
        const friend = next.friends.find(item => item.id === (creditor === 'user' ? debtor : creditor));
        if (friend && (creditor === 'user' || debtor === 'user')) friend.netBalance = add(friend.netBalance, money(creditor === 'user' ? cents : -cents));
        creditors[i].left -= cents; debtors[j].left -= cents;
        if (!creditors[i].left) i++; if (!debtors[j].left) j++;
      }
      const trip = next.trips.find(item => item.id === tx.tripId);
      if (trip) trip.totalSpend = add(trip.totalSpend, money(total));
    }
    next.summary.totalIncome = add(next.summary.totalIncome, money(income));
    next.summary.totalExpenses = add(next.summary.totalExpenses, money(expense));
    if (tx.type !== 'settlement') {
      next.summary.months[month] ||= { income: 0, expense: 0 };
      next.summary.months[month].income = add(next.summary.months[month].income, money(income));
      next.summary.months[month].expense = add(next.summary.months[month].expense, money(expense));
    }
    // Pending receipts stay visible, while AWS remains responsible for claim
    // consolidation and validating who may confirm the received payment.
    localTransactions.push({ ...tx, id: entry.localId, amount: money(tx.type === 'income' || tx.type === 'settlement' ? total : -total), upiAccountId: accountId, creatorId: 'user', splits: participants.map(p => ({ friendId: p.id, amount: money(p.share), paidAmount: money(p.paid) })) });
  }
  next.transactions = [...localTransactions.reverse(), ...next.transactions];
  return next;
}
