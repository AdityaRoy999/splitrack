import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError, errorMessage, requestId } from '../services/api';
import { uploadImage } from '../services/media';
import type { UpiAccount, Friend, Trip, Transaction, CategoryMetric, ChartDataPoint, ExpenseCategory, DebtSimplification, ThemeMode, SelectionStyle } from '../types';
import type { MemberDraft, MemberProfile } from '../utils/memberProfiles';
import { getReceivingUpiAccount } from '../utils/upi';
import { preserveOpenedHistory } from './cloudSnapshot';
import { TransactionOutbox, encodeOfflineCheckpoint, optimisticSnapshot, validateOfflineTransaction, type DuplicateTransaction } from './transactionOutbox';

export interface CloudSettings { selectedAccountId: string; receivingAccountId?: string; themeMode: ThemeMode; currency: 'INR'; hideAmounts: boolean; isLiquidGlassEnabled: boolean; selectionStyle?: SelectionStyle; notificationDirection?: 'top' | 'bottom' }
interface Snapshot {
  schemaVersion: 2; userId: string; revision: number; generation?: number; ledgerResetId?: string | null;
  accounts: UpiAccount[]; friends: Friend[]; trips: Trip[]; transactions: Transaction[]; categories: ExpenseCategory[];
  transactionCursor: string | null; settings: CloudSettings;
  profile: { id: string; name: string; handle: string; avatar: string; avatarRef: string } | null;
  summary: { totalIncome: number; totalExpenses: number; categories: Record<string, number>; months: Record<string, { income: number; expense: number }> };
}
type MutationResult = { result: { id?: string; importedCount?: number; needsContinue?: boolean }; state: Snapshot };
const categories: ExpenseCategory[] = [
  { id: 'cat-food', name: 'Food & Drinks', iconKey: 'cup-hot', color: '#F97316' },
  { id: 'cat-groceries', name: 'Groceries', iconKey: 'cart-large-minimalistic', color: '#10B981' },
  { id: 'cat-travel', name: 'Travel', iconKey: 'bus', color: '#3B82F6' },
  { id: 'cat-stay', name: 'Stay', iconKey: 'home-2', color: '#8B5CF6' },
  { id: 'cat-shopping', name: 'Shopping', iconKey: 'bag-2', color: '#EC4899' },
  { id: 'cat-work', name: 'Work', iconKey: 'case-minimalistic', color: '#06B6D4' },
  { id: 'cat-software', name: 'Software & Tools', iconKey: 'layers', color: '#6366F1' },
  { id: 'cat-fun', name: 'Fun', iconKey: 'confetti', color: '#F59E0B' },
  { id: 'cat-other', name: 'Other', iconKey: 'tag', color: '#71717A' },
];
type Appearance = Pick<CloudSettings, 'themeMode' | 'isLiquidGlassEnabled' | 'hideAmounts' | 'selectionStyle' | 'notificationDirection'>;
const appearances = new Map<string, Appearance>();
const appearanceKey = (uid: string) => `@splittrack_appearance_v1_${uid}`;
const appearanceOf = (settings: CloudSettings): Appearance => ({ themeMode: settings.themeMode, isLiquidGlassEnabled: settings.isLiquidGlassEnabled, hideAmounts: settings.hideAmounts, selectionStyle: settings.selectionStyle ?? 'chips', notificationDirection: settings.notificationDirection ?? 'bottom' });
const empty = (uid = ''): Snapshot => ({ schemaVersion: 2, userId: uid, revision: 0, accounts: [], friends: [], trips: [], transactions: [], categories, transactionCursor: null, profile: null, settings: { selectedAccountId: '', currency: 'INR', themeMode: 'dark', hideAmounts: false, isLiquidGlassEnabled: true, ...appearances.get(uid) }, summary: { totalIncome: 0, totalExpenses: 0, categories: {}, months: {} } });
const cacheKey = (uid: string) => `@splittrack_cloud_v2_${uid}`;
const checkpointWrites = new Map<string, Promise<void>>();
const writeCheckpoint = (uid: string, snapshot: Snapshot, committedRequests: Iterable<string>) => {
  const ids = [...committedRequests];
  const write = (checkpointWrites.get(uid) ?? Promise.resolve()).catch(() => {}).then(() => AsyncStorage.setItem(cacheKey(uid), encodeOfflineCheckpoint(snapshot, ids)));
  checkpointWrites.set(uid, write);
  return write;
};
const rounded = (value: number) => Math.round(value * 100) / 100;
const entityPath = (type: string, id: string) => `/entities/${type}/${encodeURIComponent(id)}`;
type AccountDraft = Omit<UpiAccount, 'id' | 'totalSpent'>;
type TransactionDraft = Omit<Transaction, 'id'>;

interface SplitTrackContextType {
  accounts: UpiAccount[]; friends: Friend[]; trips: Trip[]; transactions: Transaction[]; categories: ExpenseCategory[];
  categoryMetrics: CategoryMetric[]; chartData: ChartDataPoint[];
  totalBalance: number; totalIncome: number; totalExpenses: number; monthlyExpenses: number;
  netFriendBalance: number; totalOwedToYou: number; totalYouOwe: number;
  selectedAccountId: string; settings: CloudSettings; loading: boolean; syncing: boolean; syncError: string; preferencesReady: boolean;
  revision: number;
  queuedTransactionCount: number;
  pendingDuplicate: { requestId: string; existingTransaction: DuplicateTransaction } | null;
  pendingFailure: { requestId: string; title: string; error: string } | null;
  discardQueuedTransaction(requestId: string): Promise<void>;
  resolveDuplicate(requestId: string, proceed: boolean): Promise<void>;
  refresh(): Promise<void>; loadMoreTransactions(): Promise<void>; hasMoreTransactions: boolean;
  getTripTransactions(id: string, cursor?: string): Promise<{ items: Transaction[]; cursor: string | null; profiles: (MemberProfile & { id: string })[] }>;
  setSelectedAccountId(id: string): Promise<void>; saveSettings(settings: Partial<CloudSettings>): Promise<void>;
  addTransaction(tx: TransactionDraft, intentId?: string): Promise<void>; deleteTransaction(id: string, intentId?: string): Promise<void>;
  editTransaction(id: string, updates: Partial<TransactionDraft>, intentId?: string): Promise<void>;
  restoreTransaction(id: string, intentId?: string): Promise<void>;
  getTransactionBin(): Promise<Transaction[]>;
  settleTransaction(id: string, friendId: string, amount: number, accountId?: string, intentId?: string): Promise<void>;
  importTransactions(txs: TransactionDraft[]): Promise<number>;
  addFriend(friend: MemberProfile & { friendId?: string; userId?: string }): Promise<Friend>;
  updateFriend(id: string, updates: Partial<MemberProfile>): Promise<Friend | null>;
  addMemberToTrip(tripId: string, member: string | MemberDraft): Promise<Friend | null>;
  removeMemberFromTrip(tripId: string, friendId: string, beforeApply?: () => Promise<void>): Promise<boolean>;
  addTrip(trip: Omit<Trip, 'id' | 'totalSpend'>, intentId?: string): Promise<void>; deleteTrip(id: string): Promise<void>;
  addUpiAccount(account: AccountDraft, intentId?: string): Promise<UpiAccount>;
  updateUpiAccount(id: string, updates: Partial<Omit<UpiAccount, 'id'>>): Promise<void>;
  deleteUpiAccount(id: string): Promise<boolean>;
  addCategory(name: string, iconKey: string, color?: string, intentId?: string): Promise<ExpenseCategory>;
  updateCategory(id: string, name: string, iconKey: string, color?: string): Promise<ExpenseCategory | null>;
  deleteCategory(id: string): Promise<boolean>;
  settleWithFriend(friendId: string, amount?: number, accountId?: string, intentId?: string): Promise<void>;
  getSimplifiedDebts(): DebtSimplification[]; eraseAllData(): Promise<void>;
}
const Context = createContext<SplitTrackContextType | undefined>(undefined);

export function SplitTrackProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  return <CloudStore key={user?.uid ?? 'signed-out'} uid={user?.uid ?? ''} ready={Boolean(user && profile?.username)}>{children}</CloudStore>;
}
function CloudStore({ children, uid, ready }: { children: React.ReactNode; uid: string; ready: boolean }) {
  const [state, setState] = useState<Snapshot>(() => empty(uid));
  const stateRef = useRef(state), baseRef = useRef(state), uidRef = useRef(uid);
  const [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false), [syncError, setSyncError] = useState('');
  const [preferencesReady, setPreferencesReady] = useState(() => !uid || appearances.has(uid));
  const [outboxVersion, setOutboxVersion] = useState(0);
  const outbox = useMemo(() => new TransactionOutbox(uid, AsyncStorage, () => setOutboxVersion(value => value + 1)), [uid]);
  const knownCommitted = useRef(new Set<string>());
  const queue = useRef<Promise<unknown>>(Promise.resolve()), pending = useRef(0), refreshPromise = useRef<Promise<void> | null>(null);
  const serverSnapshot = useRef(false), historyCount = useRef(50), loadingHistory = useRef(false);
  const cacheWrite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotAt = useRef(0), hydration = useRef<Promise<void>>(Promise.resolve());
  const publish = useCallback(() => {
    if (uidRef.current !== uid) return;
    const next = optimisticSnapshot(baseRef.current, outbox.entries, knownCommitted.current);
    stateRef.current = next; setState(next);
  }, [uid, outbox]);
  useEffect(() => { publish(); }, [outboxVersion, publish]);
  const accept = useCallback((next: Snapshot, requestedUid: string, fromServer = true) => {
    if (uidRef.current !== requestedUid || !next || next.userId !== requestedUid || next.schemaVersion !== 2) return;
    if (!Number.isInteger(next.revision) || next.revision < 0 || !next.settings || !next.summary
      || !Number.isFinite(next.summary.totalIncome) || !Number.isFinite(next.summary.totalExpenses)
      || !next.summary.categories || !next.summary.months || !next.accounts?.every(item => typeof item.id === 'string' && Number.isFinite(item.balance) && Number.isFinite(item.totalSpent))
      || !next.friends?.every(item => typeof item.id === 'string' && Number.isFinite(item.netBalance))
      || !next.trips?.every(item => typeof item.id === 'string' && Number.isFinite(item.totalSpend) && Array.isArray(item.members))
      || !next.transactions?.every(item => typeof item.id === 'string' && Number.isFinite(item.amount) && typeof item.date === 'string' && Array.isArray(item.splits))
      || !Array.isArray(next.categories)) throw new Error('Saved records could not be read. Reconnect to refresh them.');
    if (!fromServer && serverSnapshot.current) return;
    if (baseRef.current.userId === requestedUid && next.revision < baseRef.current.revision) return;
    if (fromServer) { serverSnapshot.current = true; lastSnapshotAt.current = Date.now(); }
    const retained = preserveOpenedHistory(next, baseRef.current, historyCount.current);
    const normalized = { ...retained, settings: { ...next.settings, selectionStyle: next.settings.selectionStyle ?? 'chips', notificationDirection: next.settings.notificationDirection ?? 'bottom', ...(!fromServer ? appearances.get(requestedUid) : undefined) } };
    baseRef.current = normalized; publish();
    const appearance = appearanceOf(normalized.settings), previousAppearance = appearances.get(requestedUid);
    appearances.set(requestedUid, appearance); setPreferencesReady(true);
    if (JSON.stringify(previousAppearance) !== JSON.stringify(appearance)) void AsyncStorage.setItem(appearanceKey(requestedUid), JSON.stringify(appearance)).catch(() => {});
    if (cacheWrite.current) clearTimeout(cacheWrite.current);
    cacheWrite.current = setTimeout(() => {
      if (uidRef.current === requestedUid) {
        // Checkpoint the base and acknowledged request IDs together. Even an old
        // dated transaction outside the first history page cannot be added twice.
        void writeCheckpoint(requestedUid, baseRef.current, knownCommitted.current).catch(() => {});
      }
    }, 250);
  }, [publish]);
  const restoreHistory = useCallback(async (next: Snapshot, requestedUid: string) => {
    const items = new Map(next.transactions.map(tx => [tx.id, tx]));
    let cursor = next.transactionCursor;
    for (let pageNumber = 0; cursor && items.size < historyCount.current && pageNumber < 20; pageNumber++) {
      if (uidRef.current !== requestedUid) return next;
      const limit = Math.min(100, historyCount.current - items.size);
      const page = await api<{ items: Transaction[]; cursor: string | null }>(`/transactions?limit=${limit}&cursor=${encodeURIComponent(cursor)}`, { expectedUid: requestedUid, attempts: 1 });
      page.items.forEach(tx => items.set(tx.id, tx)); cursor = page.cursor;
    }
    return { ...next, transactions: [...items.values()], transactionCursor: cursor };
  }, []);
  const flushOutbox = useCallback(async (requestedUid: string) => {
    await outbox.ready;
    while (uidRef.current === requestedUid) {
      const entry = outbox.entries.find(item => item.status === 'pending');
      if (!entry) return;
      try {
        const result = await api<MutationResult>('/transactions', { method: 'POST', rawBody: entry.bodyJson, id: entry.requestId, expectedUid: requestedUid, attempts: 1, timeoutMs: 8000 });
        if (uidRef.current !== requestedUid) return;
        knownCommitted.current.add(entry.requestId);
        accept(result.state, requestedUid);
        // Keep the committed server state durable before dropping the request.
        // If this checkpoint fails, the original key remains safe to replay.
        await writeCheckpoint(requestedUid, baseRef.current, knownCommitted.current);
        await outbox.update(entries => entries.filter(item => item.requestId !== entry.requestId));
        // Remove the in-memory checkpoint only after durable acknowledgement;
        // persisted checkpoints are naturally bounded by outstanding requests.
        knownCommitted.current.delete(entry.requestId);
      } catch (error) {
        if (uidRef.current !== requestedUid) return;
        if (error instanceof ApiError && error.code === 'DUPLICATE_TRANSACTION' && error.details?.existingTransaction) {
          const existingTransaction = error.details.existingTransaction as DuplicateTransaction;
          await outbox.update(entries => entries.map(item => item.requestId === entry.requestId ? { ...item, status: 'duplicate', existingTransaction, error: error.message } : item));
          continue;
        }
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && !['WRITE_CONFLICT', 'LEDGER_RESETTING', 'UNAUTHENTICATED'].includes(error.code) && error.status !== 401 && error.status !== 429) {
          await outbox.update(entries => entries.map(item => item.requestId === entry.requestId ? { ...item, status: 'failed', error: error.message } : item));
          setSyncError(`A saved transaction needs attention: ${errorMessage(error)}`);
          continue;
        }
        throw error;
      }
    }
  }, [outbox, accept]);
  const reconcile = useCallback((silent = false): Promise<void> => {
    if (!ready || pending.current) return Promise.resolve();
    if (refreshPromise.current) return refreshPromise.current;
    const requestedUid = uid;
    if (!silent || outbox.entries.some(entry => entry.status === 'pending')) setSyncing(true);
    const work = queue.current.catch(() => {}).then(async () => {
      await hydration.current; await outbox.ready;
      if (uidRef.current !== requestedUid) return;
      // Replay before fetching, so an uncertain write gets its existing result
      // before a new snapshot can include the same optimistic effects.
      await flushOutbox(requestedUid);
      if (uidRef.current !== requestedUid) return;
      const next = silent && serverSnapshot.current && Date.now() - lastSnapshotAt.current < 30000
        ? (await api<{ changed: boolean; state?: Snapshot }>(`/state?after=${baseRef.current.revision}`, { expectedUid: requestedUid, attempts: 1, timeoutMs: 8000 })).state
        : await api<Snapshot>('/state', { expectedUid: requestedUid, attempts: 1, timeoutMs: 8000 });
      if (uidRef.current !== requestedUid) return;
      const failure = outbox.entries.find(entry => entry.status === 'failed');
      setSyncError(failure ? `A saved transaction needs attention: ${failure.error}` : '');
      if (!next) return;
      accept(next, requestedUid);
      if (next.transactionCursor && historyCount.current > next.transactions.length) {
        const expanded = await restoreHistory(next, requestedUid);
        if (uidRef.current === requestedUid && baseRef.current.revision === next.revision) accept(expanded, requestedUid);
      }
    }).catch(error => {
      if (uidRef.current === requestedUid) setSyncError(errorMessage(error));
      throw error;
    }).finally(() => {
      refreshPromise.current = null;
      if (uidRef.current === requestedUid) { setSyncing(false); setLoading(false); }
    });
    queue.current = work; refreshPromise.current = work;
    return work;
  }, [uid, ready, outbox, flushOutbox, accept, restoreHistory]);
  const refresh = useCallback(() => reconcile(false), [reconcile]);

  useEffect(() => {
    let active = true;
    hydration.current = (async () => {
      if (!ready) { setLoading(false); return; }
      try {
        await checkpointWrites.get(uid)?.catch(() => {});
        const [[, appearanceRaw], [, ledgerRaw]] = await AsyncStorage.multiGet([appearanceKey(uid), cacheKey(uid)]);
        await outbox.ready;
        if (!active) return;
        if (appearanceRaw && !appearances.has(uid)) {
          try {
            const saved = JSON.parse(appearanceRaw) as Appearance;
            if (['dark', 'light'].includes(saved.themeMode) && typeof saved.isLiquidGlassEnabled === 'boolean' && typeof saved.hideAmounts === 'boolean'
              && (saved.selectionStyle === undefined || ['chips', 'dropdown'].includes(saved.selectionStyle))
              && (saved.notificationDirection === undefined || ['top', 'bottom'].includes(saved.notificationDirection))) {
              appearances.set(uid, appearanceOf({ ...baseRef.current.settings, ...saved }));
            }
          } catch { /* AWS replaces invalid preferences. */ }
        }
        if (ledgerRaw) {
          try {
            const checkpoint = JSON.parse(ledgerRaw);
            const cached = checkpoint.snapshot ?? checkpoint;
            const pendingIds = new Set(outbox.entries.map(entry => entry.requestId));
            if (cached.userId === uid && Array.isArray(checkpoint.committedRequests)) knownCommitted.current = new Set(checkpoint.committedRequests.filter((id: unknown) => typeof id === 'string' && pendingIds.has(id)));
            accept(cached, uid, false);
          } catch { /* Invalid cache is replaced by AWS. */ }
        }
        publish(); setPreferencesReady(true); setLoading(false);
      } catch (error) { if (active) { setSyncError(errorMessage(error)); setLoading(false); } throw error; }
    })();
    void hydration.current.then(refresh).catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failureCount = 0;
    const schedule = () => {
      clearTimeout(timer);
      if (active && ready && AppState.currentState === 'active') timer = setTimeout(poll, Math.min(30000, 5000 * 2 ** failureCount));
    };
    const poll = async () => {
      if (!active || AppState.currentState !== 'active') return;
      try { await reconcile(true); failureCount = 0; }
      catch { failureCount = Math.min(3, failureCount + 1); }
      schedule();
    };
    const listener = AppState.addEventListener('change', value => {
      clearTimeout(timer);
      if (value === 'active' && ready) { failureCount = 0; void poll(); }
    });
    schedule();
    return () => { active = false; listener.remove(); clearTimeout(timer); };
  }, [uid, ready, outbox, accept, publish, refresh, reconcile]);
  useEffect(() => {
    uidRef.current = uid;
    return () => {
      uidRef.current = '';
      if (cacheWrite.current) {
        clearTimeout(cacheWrite.current);
        // Keep per-user snapshots across restarts/sign-out for offline access.
        if (uid) void writeCheckpoint(uid, baseRef.current, knownCommitted.current).catch(() => {});
      }
    };
  }, [uid]);

  const mutate = useCallback((path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown, beforeApply?: () => Promise<void>, intentId?: string): Promise<MutationResult> => {
    const requestedUid = uid, id = intentId ?? requestId(); pending.current++;
    const work = queue.current.catch(() => {}).then(async () => {
      await hydration.current;
      if (!requestedUid || uidRef.current !== requestedUid) throw new Error('Please sign in again.');
      await flushOutbox(requestedUid);
      if (uidRef.current !== requestedUid) throw new Error('Please sign in again.');
      let result = await api<MutationResult>(path, { method, body, id, expectedUid: requestedUid });
      while (path === '/state/erase' && result.result.needsContinue) {
        accept(result.state, requestedUid);
        result = await api<MutationResult>(path, { method, body, id, expectedUid: requestedUid });
      }
      if (uidRef.current !== requestedUid) throw new Error('Your session changed. Please sign in again.');
      if (path === '/state/erase') { historyCount.current = 50; await AsyncStorage.removeItem(cacheKey(requestedUid)); }
      await beforeApply?.(); accept(result.state, requestedUid);
      if (result.state.transactionCursor && historyCount.current > result.state.transactions.length) {
        void restoreHistory(result.state, requestedUid).then(expanded => {
          if (uidRef.current === requestedUid && baseRef.current.revision === result.state.revision) accept(expanded, requestedUid);
        }).catch(error => { if (uidRef.current === requestedUid) setSyncError(`Saved. Older history could not be refreshed. ${errorMessage(error)}`); });
      }
      return result;
    }).catch(error => { if (uidRef.current === requestedUid) setSyncError(errorMessage(error)); throw error; }).finally(() => { pending.current--; });
    queue.current = work; return work;
  }, [uid, accept, restoreHistory, flushOutbox]);
  useEffect(() => {
    if (!ready || !state.ledgerResetId) return;
    let stopped = false, attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resume = async () => {
      if (stopped) return;
      if (pending.current || AppState.currentState !== 'active') { timer = setTimeout(resume, 2000); return; }
      try { await mutate('/state/erase', 'POST', undefined, undefined, state.ledgerResetId!); }
      catch { if (!stopped) timer = setTimeout(resume, Math.min(15000, 2000 * 2 ** Math.min(++attempts, 3))); }
    };
    timer = setTimeout(resume, 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [ready, state.ledgerResetId, mutate]);
  const resolveDuplicate = useCallback(async (id: string, proceed: boolean) => {
    await hydration.current;
    if (uidRef.current !== uid) return;
    await outbox.update(entries => {
      const entry = entries.find(item => item.requestId === id);
      if (!entry || entry.status !== 'duplicate') return entries;
      if (!proceed) return entries.filter(item => item.requestId !== id);
      const nextId = requestId();
      return entries.map(item => item.requestId === id ? {
        ...item, requestId: nextId, localId: `offline-${nextId}`,
        bodyJson: JSON.stringify({ ...JSON.parse(item.bodyJson), confirmDuplicate: true }),
        status: 'pending', existingTransaction: undefined, error: undefined,
      } : item);
    });
    publish(); void refresh().catch(() => {});
  }, [uid, outbox, publish, refresh]);
  const discardQueuedTransaction = useCallback(async (id: string) => {
    await hydration.current;
    if (uidRef.current !== uid) return;
    // Only an entry explicitly rejected by AWS may be discarded. A pending
    // request may have committed after a lost reply and must be retried first.
    await outbox.update(entries => entries.filter(entry => entry.requestId !== id || entry.status === 'pending'));
    publish(); void refresh().catch(() => {});
  }, [uid, outbox, publish, refresh]);
  const saveSettings = useCallback(async (body: Partial<CloudSettings>) => { await mutate('/api/settings', 'PUT', body); }, [mutate]);
  const setSelectedAccountId = useCallback(async (id: string) => { await saveSettings({ selectedAccountId: id }); }, [saveSettings]);
  const addTransaction = useCallback(async (tx: TransactionDraft, intentId?: string) => {
    await hydration.current; await outbox.ready;
    if (!ready || uidRef.current !== uid) throw new Error('Please sign in again.');
    if (baseRef.current.ledgerResetId) throw new Error('Your ledger is being reset. Reconnect before saving transactions.');
    validateOfflineTransaction(tx, baseRef.current);
    await outbox.enqueue(tx, intentId ?? requestId(), baseRef.current.generation || 0);
    publish(); void refresh().catch(() => {});
  }, [uid, ready, outbox, publish, refresh]);
  const deleteTransaction = useCallback(async (id: string, intentId?: string) => {
    if (id.startsWith('offline-')) throw new Error('This transaction is waiting to sync. Reconnect before deleting it.');
    await mutate(`/transactions/${encodeURIComponent(id)}`, 'DELETE', undefined, undefined, intentId);
  }, [mutate]);
  const editTransaction = useCallback(async (id: string, updates: Partial<TransactionDraft>, intentId?: string) => {
    if (id.startsWith('offline-')) throw new Error('This transaction is waiting to sync. Reconnect before editing it.');
    await mutate(`/api/transactions/${encodeURIComponent(id)}`, 'PUT', updates, undefined, intentId);
  }, [mutate]);
  const restoreTransaction = useCallback(async (id: string, intentId?: string) => { await mutate(`/api/transactions/${encodeURIComponent(id)}/restore`, 'POST', undefined, undefined, intentId); }, [mutate]);
  const getTransactionBin = useCallback(async () => (await api<{ items: Transaction[] }>('/api/transactions/bin')).items, []);
  const queueReceipt = useCallback(async (friendId: string, suppliedAmount?: number, accountId?: string, intentId?: string, sourceTransactionId?: string) => {
    await hydration.current;
    const current = stateRef.current, friend = current.friends.find(item => item.id === friendId);
    const amount = suppliedAmount ?? friend?.netBalance;
    if (!friend || amount === undefined || !Number.isFinite(amount) || amount <= 0 || !sourceTransactionId && friend.netBalance <= 0) throw new Error('Only the member owed an outstanding balance can record a settlement.');
    const source = sourceTransactionId ? current.transactions.find(tx => tx.id === sourceTransactionId) : undefined;
    if (source && (source.type !== 'expense' || !['user', uid].includes(source.paidBy))) throw new Error('Only the transaction payer can settle its members.');
    if (sourceTransactionId?.startsWith('offline-')) throw new Error('Sync the original expense before recording its settlement.');
    const clock = new Date().toISOString(), date = clock.slice(0, 10);
    const receipt: TransactionDraft & { targetFriendId: string } = {
      title: 'Settlement', amount, type: 'settlement', category: 'Settlement', categoryIcon: 'tag', date,
      time: clock.slice(11, 16),
      upiAccountId: accountId || current.settings.selectedAccountId, paidBy: friendId, targetFriendId: friendId,
      splitType: 'equal', splits: [], settled: false, sourceTransactionId,
    };
    await addTransaction(receipt, intentId);
  }, [uid, addTransaction]);
  const settleTransaction = useCallback(async (id: string, friendId: string, amount: number, accountId?: string, intentId?: string) => {
    await queueReceipt(friendId, amount, accountId, intentId, id);
  }, [queueReceipt]);
  const importTransactions = useCallback(async (txs: TransactionDraft[]) => {
    await hydration.current; await outbox.ready;
    if (!ready || uidRef.current !== uid) throw new Error('Please sign in again.');
    if (baseRef.current.ledgerResetId) throw new Error('Your ledger is being reset. Reconnect before importing.');
    txs.forEach(tx => validateOfflineTransaction(tx, baseRef.current));
    const generation = baseRef.current.generation || 0;
    // Publish the whole import with stable per-entry keys in one device write.
    await outbox.update(entries => [...entries, ...txs.map(tx => {
      const id = requestId();
      return { requestId: id, localId: `offline-${id}`, bodyJson: JSON.stringify({ ...tx, duplicateCheck: true, ledgerGeneration: generation }), generation, status: 'pending' as const };
    })]);
    publish(); void refresh().catch(() => {});
    return txs.length;
  }, [uid, ready, outbox, publish, refresh]);
  const addFriend = useCallback(async (friend: MemberProfile & { friendId?: string; userId?: string }) => {
    const result = await mutate(entityPath('friends', friend.friendId ?? friend.userId ?? requestId()), 'PUT', { userId: friend.friendId ?? friend.userId, handle: friend.handle });
    return result.state.friends.find(item => item.id === result.result.id)!;
  }, [mutate]);
  const updateFriend = useCallback(async (id: string, updates: Partial<MemberProfile>) => {
    const existing = stateRef.current.friends.find(friend => friend.id === id);
    // Saving a nickname must not persist an expiring S3 download URL as a photo.
    const avatarRef = updates.avatar !== undefined && updates.avatar !== existing?.avatar
      ? await uploadImage(updates.avatar) : undefined;
    const result = await mutate(entityPath('friends', id), 'PUT', { userId: id, nickname: updates.name, phone: updates.phone, avatarRef });
    return result.state.friends.find(item => item.id === id) ?? null;
  }, [mutate]);
  const addMemberToTrip = useCallback(async (tripId: string, member: string | MemberDraft) => {
    let id: string;
    if (typeof member === 'string') id = member;
    else {
      const response = await api<{ items: (MemberProfile & { id: string })[] }>(`/api/users/search?q=${encodeURIComponent(member.handle ?? '')}`);
      const match = response.items.find(item => item.handle.toLowerCase() === member.handle?.toLowerCase());
      if (!match) throw new Error('Select a registered member from search.');
      id = match.id;
    }
    const result = await mutate(`/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(id)}`, 'PUT');
    return result.state.friends.find(item => item.id === id) ?? null;
  }, [mutate]);
  const removeMemberFromTrip = useCallback(async (tripId: string, friendId: string, beforeApply?: () => Promise<void>) => { await mutate(`/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(friendId)}`, 'DELETE', undefined, beforeApply); return true; }, [mutate]);
  const addTrip = useCallback(async (trip: Omit<Trip, 'id' | 'totalSpend'>, intentId?: string) => { const coverImageRef = await uploadImage(trip.coverImage ?? ''); await mutate(entityPath('trips', intentId ?? requestId()), 'PUT', { ...trip, coverImage: undefined, coverImageRef }, undefined, intentId); }, [mutate]);
  const deleteTrip = useCallback(async (id: string) => { await mutate(entityPath('trips', id), 'DELETE'); }, [mutate]);
  const addUpiAccount = useCallback(async (account: AccountDraft, intentId?: string) => {
    const result = await mutate(entityPath('accounts', intentId ?? requestId()), 'PUT', { ...account, cardNumber: account.cardNumber.replace(/\D/g, '').slice(-4) }, undefined, intentId);
    return result.state.accounts.find(item => item.id === result.result.id)!;
  }, [mutate]);
  const updateUpiAccount = useCallback(async (id: string, updates: Partial<Omit<UpiAccount, 'id'>>) => { await mutate(entityPath('accounts', id), 'PUT', { ...updates, ...(updates.cardNumber !== undefined ? { cardNumber: updates.cardNumber.replace(/\D/g, '').slice(-4) } : {}) }); }, [mutate]);
  const deleteUpiAccount = useCallback(async (id: string) => { await mutate(entityPath('accounts', id), 'DELETE'); return true; }, [mutate]);
  const addCategory = useCallback(async (name: string, iconKey: string, color = '#6366F1', intentId?: string) => { const id = intentId ?? requestId(); const result = await mutate(entityPath('categories', id), 'PUT', { name, iconKey, color }, undefined, intentId); return result.state.categories.find(item => item.id === id)!; }, [mutate]);
  const updateCategory = useCallback(async (id: string, name: string, iconKey: string, color = '#6366F1') => { const result = await mutate(entityPath('categories', id), 'PUT', { name, iconKey, color }); return result.state.categories.find(item => item.id === id) ?? null; }, [mutate]);
  const deleteCategory = useCallback(async (id: string) => { await mutate(entityPath('categories', id), 'DELETE'); return true; }, [mutate]);
  const settleWithFriend = useCallback(async (friendId: string, amount?: number, accountId?: string, intentId?: string) => {
    await queueReceipt(friendId, amount, accountId, intentId);
  }, [queueReceipt]);
  const eraseAllData = useCallback(async () => {
    await outbox.ready;
    if (outbox.entries.length) throw new Error('Sync your saved transactions and resolve pending warnings before resetting the ledger.');
    await mutate('/state/erase', 'POST');
  }, [outbox, mutate]);
  const loadMoreTransactions = useCallback(async () => {
    if (pending.current || loadingHistory.current) return;
    loadingHistory.current = true;
    const work = queue.current.catch(() => {}).then(async () => {
      await hydration.current; await flushOutbox(uid);
      const cursor = baseRef.current.transactionCursor;
      if (!cursor || uidRef.current !== uid) return;
      const revision = baseRef.current.revision;
      const page = await api<{ items: Transaction[]; cursor: string | null }>(`/transactions?cursor=${encodeURIComponent(cursor)}`, { expectedUid: uid, attempts: 1, timeoutMs: 8000 });
      if (baseRef.current.revision !== revision || uidRef.current !== uid) return;
      const items = [...new Map([...baseRef.current.transactions, ...page.items].map(tx => [tx.id, tx])).values()];
      historyCount.current = Math.max(historyCount.current, items.length);
      accept({ ...baseRef.current, transactions: items, transactionCursor: page.cursor }, uid);
    }).finally(() => { loadingHistory.current = false; });
    queue.current = work;
    await work;
  }, [uid, accept, flushOutbox]);
  const getTripTransactions = useCallback(async (id: string, cursor?: string) => {
    try { return await api<{ items: Transaction[]; cursor: string | null; profiles: (MemberProfile & { id: string })[] }>(`/api/trips/${encodeURIComponent(id)}/transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { expectedUid: uid, attempts: 1, timeoutMs: 8000 }); }
    catch (error) {
      if (uidRef.current !== uid || !(error instanceof ApiError) || error.status > 0 && error.status < 500) throw error;
      const snapshot = stateRef.current;
      const profiles = snapshot.friends.map(friend => ({ id: friend.id, name: friend.name, handle: friend.handle, avatar: friend.avatar, phone: friend.phone }));
      return { items: snapshot.transactions.filter(tx => tx.tripId === id), cursor: null, profiles };
    }
  }, [uid]);

  const metrics = useMemo(() => {
    const totalOwedToYou = rounded(state.friends.reduce((sum, friend) => sum + Math.max(0, friend.netBalance), 0));
    const totalYouOwe = rounded(state.friends.reduce((sum, friend) => sum + Math.max(0, -friend.netBalance), 0));
    const categoryMetrics = Object.entries(state.summary.categories).filter(([, value]) => value > 0).map(([name, amount], index): CategoryMetric => {
      const category = state.categories.find(item => item.name === name), percentage = state.summary.totalExpenses ? amount / state.summary.totalExpenses * 100 : 0;
      return { id: category?.id ?? name, name, amount, percentage, color: category?.color ?? '#71717A', icon: category?.iconKey ?? 'tag', size: Math.max(15, percentage), x: 20 + (index % 3) * 30, y: 25 + Math.floor(index / 3) * 25 };
    });
    const chartData = Object.entries(state.summary.months).sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ date: `${month}-01`, label: new Date(`${month}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short' }), income: values.income, expense: values.expense }));
    return { totalBalance: rounded(state.accounts.reduce((sum, account) => sum + account.balance, 0)), totalIncome: state.summary.totalIncome, totalExpenses: state.summary.totalExpenses, monthlyExpenses: state.summary.months[new Date().toISOString().slice(0, 7)]?.expense ?? 0, totalOwedToYou, totalYouOwe, netFriendBalance: rounded(totalOwedToYou - totalYouOwe), categoryMetrics, chartData };
  }, [state.accounts, state.friends, state.categories, state.summary]);
  const getSimplifiedDebts = useCallback((): DebtSimplification[] => {
    const account = getReceivingUpiAccount(state.accounts, state.settings.selectedAccountId);
    return state.friends.filter(friend => Math.round(Math.abs(friend.netBalance) * 100) > 0).map(friend => friend.netBalance > 0
      ? { fromId: friend.id, fromName: friend.name, toId: 'user', toName: 'You', amount: friend.netBalance, toUpiId: account?.upiId }
      : { fromId: 'user', fromName: 'You', toId: friend.id, toName: friend.name, amount: Math.abs(friend.netBalance), toUpiId: friend.upiId });
  }, [state.accounts, state.friends, state.settings.selectedAccountId]);
  const outboxEntries = outbox.entries;
  const pendingDuplicate = useMemo(() => {
    const entry = outboxEntries.find(item => item.status === 'duplicate' && item.existingTransaction);
    return entry ? { requestId: entry.requestId, existingTransaction: entry.existingTransaction! } : null;
  }, [outboxEntries]);
  const pendingFailure = useMemo(() => {
    const entry = outboxEntries.find(item => item.status === 'failed');
    return entry ? { requestId: entry.requestId, title: (JSON.parse(entry.bodyJson) as TransactionDraft).title, error: entry.error || 'This transaction could not be saved.' } : null;
  }, [outboxEntries]);
  const queuedTransactionCount = outbox.entries.length;
  const value = useMemo(() => ({ ...metrics, queuedTransactionCount, pendingDuplicate, pendingFailure, resolveDuplicate, discardQueuedTransaction, revision: state.revision, accounts: state.accounts, friends: state.friends, trips: state.trips, transactions: state.transactions, categories: state.categories, settings: state.settings, selectedAccountId: state.settings.selectedAccountId, loading, syncing, syncError, preferencesReady, refresh, loadMoreTransactions, hasMoreTransactions: Boolean(state.transactionCursor), getTripTransactions, saveSettings, setSelectedAccountId, addTransaction, deleteTransaction, editTransaction, restoreTransaction, getTransactionBin, settleTransaction, importTransactions, addFriend, updateFriend, addMemberToTrip, removeMemberFromTrip, addTrip, deleteTrip, addUpiAccount, updateUpiAccount, deleteUpiAccount, addCategory, updateCategory, deleteCategory, settleWithFriend, getSimplifiedDebts, eraseAllData }), [metrics, queuedTransactionCount, pendingDuplicate, pendingFailure, resolveDuplicate, discardQueuedTransaction, state, loading, syncing, syncError, preferencesReady, refresh, loadMoreTransactions, getTripTransactions, saveSettings, setSelectedAccountId, addTransaction, deleteTransaction, editTransaction, restoreTransaction, getTransactionBin, settleTransaction, importTransactions, addFriend, updateFriend, addMemberToTrip, removeMemberFromTrip, addTrip, deleteTrip, addUpiAccount, updateUpiAccount, deleteUpiAccount, addCategory, updateCategory, deleteCategory, settleWithFriend, getSimplifiedDebts, eraseAllData]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSplitTrack() { const value = useContext(Context); if (!value) throw new Error('SplitTrackProvider is missing.'); return value; }
