import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage, requestId } from '../services/api';
import { uploadImage } from '../services/media';
import type { UpiAccount, Friend, Trip, Transaction, CategoryMetric, ChartDataPoint, ExpenseCategory, DebtSimplification, ThemeMode } from '../types';
import type { MemberDraft, MemberProfile } from '../utils/memberProfiles';
import { getReceivingUpiAccount } from '../utils/upi';

export interface CloudSettings { selectedAccountId: string; receivingAccountId?: string; themeMode: ThemeMode; currency: 'INR'; hideAmounts: boolean; isLiquidGlassEnabled: boolean }
interface Snapshot {
  schemaVersion: 2; userId: string; revision: number;
  accounts: UpiAccount[]; friends: Friend[]; trips: Trip[]; transactions: Transaction[]; categories: ExpenseCategory[];
  transactionCursor: string | null; settings: CloudSettings;
  profile: { id: string; name: string; handle: string; avatar: string; avatarRef: string } | null;
  summary: { totalIncome: number; totalExpenses: number; categories: Record<string, number>; months: Record<string, { income: number; expense: number }> };
}
type MutationResult = { result: { id?: string; importedCount?: number }; state: Snapshot };
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
  addTransaction(tx: TransactionDraft, intentId?: string): Promise<void>; deleteTransaction(id: string): Promise<void>;
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
  const accept = useCallback((next: Snapshot, requestedUid: string, fromServer = true) => {
    if (uidRef.current !== requestedUid || next.userId !== requestedUid || next.schemaVersion !== 2) return;
    if (!fromServer && serverSnapshot.current) return;
    if (stateRef.current.userId === requestedUid && next.revision < stateRef.current.revision) return;
    if (fromServer) serverSnapshot.current = true;
    stateRef.current = next; setState(next); setSyncError('');
    void AsyncStorage.setItem(cacheKey(requestedUid), JSON.stringify(next)).catch(() => {});
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
  const refresh = useCallback((): Promise<void> => {
    if (!ready || pending.current) return Promise.resolve();
    if (refreshPromise.current) return refreshPromise.current;
    const requestedUid = uid;
    setSyncing(true);
    const work = api<Snapshot>('/state').then(next => restoreHistory(next, requestedUid)).then(next => accept(next, requestedUid)).catch(error => {
      if (uidRef.current === requestedUid) setSyncError(errorMessage(error));
      throw error;
    }).finally(() => { refreshPromise.current = null; if (uidRef.current === requestedUid) { setSyncing(false); setLoading(false); } });
    refreshPromise.current = work;
    return work;
  }, [uid, ready, accept, restoreHistory]);

  useEffect(() => {
    let active = true;
    refreshPromise.current = null;
    if (ready) {
      void AsyncStorage.getItem(cacheKey(uid)).then(raw => {
        if (active && raw) { try { accept(JSON.parse(raw), uid, false); } catch { /* Invalid cache is replaced by AWS. */ } }
      });
      void refresh().catch(() => {});
    }
    const listener = AppState.addEventListener('change', value => { if (value === 'active' && ready) void refresh().catch(() => {}); });
    const timer = ready ? setInterval(() => { if (AppState.currentState === 'active') void refresh().catch(() => {}); }, 60000) : undefined;
    return () => { active = false; listener.remove(); clearInterval(timer); };
  }, [uid, ready, accept, refresh]);
  useEffect(() => {
    uidRef.current = uid;
    return () => { uidRef.current = ''; if (uid) void AsyncStorage.removeItem(cacheKey(uid)); };
  }, [uid]);

  const mutate = useCallback((path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown, beforeApply?: () => Promise<void>, intentId?: string): Promise<MutationResult> => {
    const requestedUid = uid, id = intentId ?? requestId(); pending.current++;
    const work = queue.current.catch(() => {}).then(async () => {
      if (!requestedUid || uidRef.current !== requestedUid) throw new Error('Please sign in again.');
      const result = await api<MutationResult>(path, { method, body, id });
      if (path === '/state/erase') historyCount.current = 50;
      let historyError = '';
      try { result.state = await restoreHistory(result.state, requestedUid); }
      catch (error) { historyError = `Saved. Older history could not be refreshed. ${errorMessage(error)}`; }
      await beforeApply?.();
      accept(result.state, requestedUid);
      if (historyError && uidRef.current === requestedUid) setSyncError(historyError);
      return result;
    }).catch(error => { if (uidRef.current === requestedUid) setSyncError(errorMessage(error)); throw error; }).finally(() => { pending.current--; });
    queue.current = work;
    return work;
  }, [uid, accept, restoreHistory]);
  const saveSettings = useCallback(async (body: Partial<CloudSettings>) => { await mutate('/api/settings', 'PUT', body); }, [mutate]);
  const setSelectedAccountId = useCallback(async (id: string) => { await saveSettings({ selectedAccountId: id }); }, [saveSettings]);
  const addTransaction = useCallback(async (tx: TransactionDraft, intentId?: string) => { await mutate('/transactions', 'POST', tx, undefined, intentId); }, [mutate]);
  const deleteTransaction = useCallback(async (id: string) => { await mutate(`/transactions/${encodeURIComponent(id)}`, 'DELETE'); }, [mutate]);
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
    const avatarRef = updates.avatar !== undefined ? await uploadImage(updates.avatar) : undefined;
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
  const value = useMemo(() => ({ ...metrics, revision: state.revision, accounts: state.accounts, friends: state.friends, trips: state.trips, transactions: state.transactions, categories: state.categories, settings: state.settings, selectedAccountId: state.settings.selectedAccountId, loading, syncing, syncError, refresh, loadMoreTransactions, hasMoreTransactions: Boolean(state.transactionCursor), getTripTransactions, saveSettings, setSelectedAccountId, addTransaction, deleteTransaction, importTransactions, addFriend, updateFriend, addMemberToTrip, removeMemberFromTrip, addTrip, deleteTrip, addUpiAccount, updateUpiAccount, deleteUpiAccount, addCategory, updateCategory, deleteCategory, settleWithFriend, getSimplifiedDebts, eraseAllData }), [metrics, state, loading, syncing, syncError, refresh, loadMoreTransactions, getTripTransactions, saveSettings, setSelectedAccountId, addTransaction, deleteTransaction, importTransactions, addFriend, updateFriend, addMemberToTrip, removeMemberFromTrip, addTrip, deleteTrip, addUpiAccount, updateUpiAccount, deleteUpiAccount, addCategory, updateCategory, deleteCategory, settleWithFriend, getSimplifiedDebts, eraseAllData]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSplitTrack() { const value = useContext(Context); if (!value) throw new Error('SplitTrackProvider is missing.'); return value; }
