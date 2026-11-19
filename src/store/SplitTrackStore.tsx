import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage, requestId } from '../services/api';
import { uploadImage } from '../services/media';
import type { UpiAccount, Friend, Trip, Transaction, CategoryMetric, ChartDataPoint, ExpenseCategory, DebtSimplification, ThemeMode, SelectionStyle } from '../types';
import type { MemberDraft, MemberProfile } from '../utils/memberProfiles';
import { getReceivingUpiAccount } from '../utils/upi';
import { preserveOpenedHistory } from './cloudSnapshot';

export interface CloudSettings { selectedAccountId: string; receivingAccountId?: string; themeMode: ThemeMode; currency: 'INR'; hideAmounts: boolean; isLiquidGlassEnabled: boolean; selectionStyle?: SelectionStyle }
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
const empty = (uid = ''): Snapshot => ({ schemaVersion: 2, userId: uid, revision: 0, accounts: [], friends: [], trips: [], transactions: [], categories, transactionCursor: null, profile: null, settings: { selectedAccountId: '', currency: 'INR', themeMode: 'dark', hideAmounts: false, isLiquidGlassEnabled: true }, summary: { totalIncome: 0, totalExpenses: 0, categories: {}, months: {} } });
const cacheKey = (uid: string) => `@splittrack_cloud_v2_${uid}`;
const rounded = (value: number) => Math.round(value * 100) / 100;
const entityPath = (type: string, id: string) => `/entities/${type}/${encodeURIComponent(id)}`;
type AccountDraft = Omit<UpiAccount, 'id' | 'totalSpent'>;
type TransactionDraft = Omit<Transaction, 'id'>;

interface SplitTrackContextType {
  accounts: UpiAccount[]; friends: Friend[]; trips: Trip[]; transactions: Transaction[]; categories: ExpenseCategory[];
  categoryMetrics: CategoryMetric[]; chartData: ChartDataPoint[];
  totalBalance: number; totalIncome: number; totalExpenses: number; monthlyExpenses: number;
  netFriendBalance: number; totalOwedToYou: number; totalYouOwe: number;
  selectedAccountId: string; settings: CloudSettings; loading: boolean; syncing: boolean; syncError: string;
  revision: number;
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
  const stateRef = useRef(state), uidRef = useRef(uid);
  const [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false), [syncError, setSyncError] = useState('');
  const queue = useRef<Promise<unknown>>(Promise.resolve()), pending = useRef(0), refreshPromise = useRef<Promise<void> | null>(null);
  const serverSnapshot = useRef(false), historyCount = useRef(50), loadingHistory = useRef(false);
  const cacheWrite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotAt = useRef(0);
  const accept = useCallback((next: Snapshot, requestedUid: string, fromServer = true) => {
    if (uidRef.current !== requestedUid || next.userId !== requestedUid || next.schemaVersion !== 2) return;
    if (!fromServer && serverSnapshot.current) return;
    if (stateRef.current.userId === requestedUid && next.revision < stateRef.current.revision) return;
    if (fromServer) serverSnapshot.current = true;
    if (fromServer) lastSnapshotAt.current = Date.now();
    const retained = preserveOpenedHistory(next, stateRef.current, historyCount.current);
    const normalized = { ...retained, settings: { ...next.settings, selectionStyle: next.settings.selectionStyle ?? 'chips' } };
    stateRef.current = normalized; setState(normalized); setSyncError('');
    if (cacheWrite.current) clearTimeout(cacheWrite.current);
    cacheWrite.current = setTimeout(() => {
      if (uidRef.current === requestedUid) void AsyncStorage.setItem(cacheKey(requestedUid), JSON.stringify(stateRef.current)).catch(() => {});
    }, 250);
  }, []);
  const restoreHistory = useCallback(async (next: Snapshot, requestedUid: string) => {
    const items = new Map(next.transactions.map(tx => [tx.id, tx]));
    let cursor = next.transactionCursor;
    // Revalidate the pages the user opened, including deletions and settlement
    // changes, so background sync does not collapse an expanded ledger.
    for (let pageNumber = 0; cursor && items.size < historyCount.current && pageNumber < 20; pageNumber++) {
      if (uidRef.current !== requestedUid) return next;
      const limit = Math.min(100, historyCount.current - items.size);
      const page = await api<{ items: Transaction[]; cursor: string | null }>(`/transactions?limit=${limit}&cursor=${encodeURIComponent(cursor)}`);
      page.items.forEach(tx => items.set(tx.id, tx));
      cursor = page.cursor;
    }
    return { ...next, transactions: [...items.values()], transactionCursor: cursor };
  }, []);
  const reconcile = useCallback((silent = false): Promise<void> => {
    if (!ready || pending.current) return Promise.resolve();
    if (refreshPromise.current) return refreshPromise.current;
    const requestedUid = uid;
    if (!silent) setSyncing(true);
    const work = (silent && serverSnapshot.current && Date.now() - lastSnapshotAt.current < 30000
      ? api<{ changed: boolean; state?: Snapshot }>(`/state?after=${stateRef.current.revision}`).then(result => result.changed ? result.state : undefined)
      : api<Snapshot>('/state'))
      .then(async next => {
        if (uidRef.current !== requestedUid) return;
        setSyncError('');
        if (!next || pending.current) return;
        accept(next, requestedUid);
        if (next.transactionCursor && historyCount.current > next.transactions.length) {
          void restoreHistory(next, requestedUid).then(expanded => {
            if (!pending.current && stateRef.current.revision === next.revision) accept(expanded, requestedUid);
          }).catch(error => {
            if (uidRef.current === requestedUid) setSyncError(`Older history could not be refreshed. ${errorMessage(error)}`);
          });
        }
      }).catch(error => {
      if (uidRef.current === requestedUid) setSyncError(errorMessage(error));
      throw error;
    }).finally(() => { refreshPromise.current = null; if (uidRef.current === requestedUid) { if (!silent) setSyncing(false); setLoading(false); } });
    refreshPromise.current = work;
    return work;
  }, [uid, ready, accept, restoreHistory]);
  const refresh = useCallback(() => reconcile(false), [reconcile]);

  useEffect(() => {
    let active = true;
    refreshPromise.current = null;
    if (ready) {
      void AsyncStorage.getItem(cacheKey(uid)).then(raw => {
        if (active && raw) { try { accept(JSON.parse(raw), uid, false); } catch { /* Invalid cache is replaced by AWS. */ } }
      });
      void Promise.resolve().then(refresh).catch(() => {});
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failureCount = 0;
    const schedule = () => {
      clearTimeout(timer);
      if (active && ready && AppState.currentState === 'active') timer = setTimeout(poll, Math.min(15000, 1200 * 2 ** failureCount));
    };
    const poll = async () => {
      if (!active || AppState.currentState !== 'active') return;
      try { await reconcile(true); failureCount = 0; }
      catch { failureCount = Math.min(4, failureCount + 1); }
      schedule();
    };
    const listener = AppState.addEventListener('change', value => {
      clearTimeout(timer);
      if (value === 'active' && ready) { failureCount = 0; void poll(); }
    });
    schedule();
    return () => { active = false; listener.remove(); clearTimeout(timer); };
  }, [uid, ready, accept, refresh, reconcile]);
  useEffect(() => {
    uidRef.current = uid;
    return () => { uidRef.current = ''; if (cacheWrite.current) clearTimeout(cacheWrite.current); if (uid) void AsyncStorage.removeItem(cacheKey(uid)); };
  }, [uid]);

  const mutate = useCallback((path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown, beforeApply?: () => Promise<void>, intentId?: string): Promise<MutationResult> => {
    const requestedUid = uid, id = intentId ?? requestId(); pending.current++;
    const work = queue.current.catch(() => {}).then(async () => {
      if (!requestedUid || uidRef.current !== requestedUid) throw new Error('Please sign in again.');
      let result = await api<MutationResult>(path, { method, body, id });
      while (path === '/state/erase' && result.result.needsContinue) {
        accept(result.state, requestedUid);
        result = await api<MutationResult>(path, { method, body, id });
      }
      if (path === '/state/erase') { historyCount.current = 50; await AsyncStorage.removeItem(cacheKey(requestedUid)); }
      await beforeApply?.();
      accept(result.state, requestedUid);
      if (result.state.transactionCursor && historyCount.current > result.state.transactions.length) {
        void restoreHistory(result.state, requestedUid).then(expanded => {
          if (stateRef.current.revision === result.state.revision) accept(expanded, requestedUid);
        }).catch(error => {
          if (uidRef.current === requestedUid) setSyncError(`Saved. Older history could not be refreshed. ${errorMessage(error)}`);
        });
      }
      return result;
    }).catch(error => { if (uidRef.current === requestedUid) setSyncError(errorMessage(error)); throw error; }).finally(() => { pending.current--; });
    queue.current = work;
    return work;
  }, [uid, accept, restoreHistory]);
  useEffect(() => {
    if (!ready || !state.ledgerResetId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const resume = async () => {
      if (stopped) return;
      if (pending.current || AppState.currentState !== 'active') { timer = setTimeout(resume, 2000); return; }
      try { await mutate('/state/erase', 'POST', undefined, undefined, state.ledgerResetId!); }
      catch { if (!stopped) timer = setTimeout(resume, Math.min(15000, 2000 * 2 ** Math.min(++attempts, 3))); }
    };
    // A durable server marker also resumes after an app restart or a lost reply.
    timer = setTimeout(resume, 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [ready, state.ledgerResetId, mutate]);
  const saveSettings = useCallback(async (body: Partial<CloudSettings>) => { await mutate('/api/settings', 'PUT', body); }, [mutate]);
  const setSelectedAccountId = useCallback(async (id: string) => { await saveSettings({ selectedAccountId: id }); }, [saveSettings]);
  const addTransaction = useCallback(async (tx: TransactionDraft, intentId?: string) => { await mutate('/transactions', 'POST', tx, undefined, intentId); }, [mutate]);
  const deleteTransaction = useCallback(async (id: string, intentId?: string) => { await mutate(`/transactions/${encodeURIComponent(id)}`, 'DELETE', undefined, undefined, intentId); }, [mutate]);
  const editTransaction = useCallback(async (id: string, updates: Partial<TransactionDraft>, intentId?: string) => { await mutate(`/api/transactions/${encodeURIComponent(id)}`, 'PUT', updates, undefined, intentId); }, [mutate]);
  const restoreTransaction = useCallback(async (id: string, intentId?: string) => { await mutate(`/api/transactions/${encodeURIComponent(id)}/restore`, 'POST', undefined, undefined, intentId); }, [mutate]);
  const getTransactionBin = useCallback(async () => (await api<{ items: Transaction[] }>('/api/transactions/bin')).items, []);
  const settleTransaction = useCallback(async (id: string, friendId: string, amount: number, accountId?: string, intentId?: string) => { await mutate(`/api/transactions/${encodeURIComponent(id)}/settle`, 'POST', { friendId, amount, accountId }, undefined, intentId); }, [mutate]);
  const importTransactions = useCallback(async (txs: TransactionDraft[]) => {
    let count = 0;
    for (let offset = 0; offset < txs.length; offset += 50) {
      try { const result = await mutate('/transactions/batch', 'POST', { transactions: txs.slice(offset, offset + 50) }); count += result.result.importedCount ?? 0; }
      catch (error) { await refresh().catch(() => {}); throw new Error(`${count ? `${count} entries were saved. ` : ''}${errorMessage(error)} Review the ledger before importing again.`); }
    }
    return count;
  }, [mutate, refresh]);
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
  const settleWithFriend = useCallback(async (friendId: string, amount?: number, accountId?: string, intentId?: string) => { await mutate('/api/settlements', 'POST', { friendId, amount, accountId, title: 'Settlement' }, undefined, intentId); }, [mutate]);
  const eraseAllData = useCallback(async () => { await mutate('/state/erase', 'POST'); }, [mutate]);
  const loadMoreTransactions = useCallback(async () => {
    const cursor = stateRef.current.transactionCursor;
    if (!cursor || pending.current || loadingHistory.current) return;
    loadingHistory.current = true;
    const revision = stateRef.current.revision;
    try {
      const page = await api<{ items: Transaction[]; cursor: string | null }>(`/transactions?cursor=${encodeURIComponent(cursor)}`);
      if (stateRef.current.revision !== revision || uidRef.current !== uid) return;
      const items = [...new Map([...stateRef.current.transactions, ...page.items].map(tx => [tx.id, tx])).values()];
      historyCount.current = Math.max(historyCount.current, items.length);
      accept({ ...stateRef.current, transactions: items, transactionCursor: page.cursor }, uid);
    } finally { loadingHistory.current = false; }
  }, [uid, accept]);
  const getTripTransactions = useCallback((id: string, cursor?: string) => api<{ items: Transaction[]; cursor: string | null; profiles: (MemberProfile & { id: string })[] }>(`/api/trips/${encodeURIComponent(id)}/transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`), []);

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
  const value = useMemo(() => ({ ...metrics, revision: state.revision, accounts: state.accounts, friends: state.friends, trips: state.trips, transactions: state.transactions, categories: state.categories, settings: state.settings, selectedAccountId: state.settings.selectedAccountId, loading, syncing, syncError, refresh, loadMoreTransactions, hasMoreTransactions: Boolean(state.transactionCursor), getTripTransactions, saveSettings, setSelectedAccountId, addTransaction, deleteTransaction, editTransaction, restoreTransaction, getTransactionBin, settleTransaction, importTransactions, addFriend, updateFriend, addMemberToTrip, removeMemberFromTrip, addTrip, deleteTrip, addUpiAccount, updateUpiAccount, deleteUpiAccount, addCategory, updateCategory, deleteCategory, settleWithFriend, getSimplifiedDebts, eraseAllData }), [metrics, state, loading, syncing, syncError, refresh, loadMoreTransactions, getTripTransactions, saveSettings, setSelectedAccountId, addTransaction, deleteTransaction, editTransaction, restoreTransaction, getTransactionBin, settleTransaction, importTransactions, addFriend, updateFriend, addMemberToTrip, removeMemberFromTrip, addTrip, deleteTrip, addUpiAccount, updateUpiAccount, deleteUpiAccount, addCategory, updateCategory, deleteCategory, settleWithFriend, getSimplifiedDebts, eraseAllData]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSplitTrack() { const value = useContext(Context); if (!value) throw new Error('SplitTrackProvider is missing.'); return value; }
