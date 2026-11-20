import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { useAuth } from '../../auth/AuthContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { api, errorMessage } from '../../services/api';
import type { Transaction } from '../../types';
import { SheetModal } from '../common/SheetModal';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { GlassPill } from '../glass/GlassPill';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
import { AddExpenseModal } from '../split/AddExpenseModal';
import { BottomBubble, type BubbleNotice } from '../common/BottomBubble';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';

const Context = createContext({ open: (_tx: Transaction) => {}, edit: (_tx: Transaction) => {}, remove: (_tx: Transaction) => {}, openDeleted: () => {}, canManage: (_tx: Transaction): boolean => false, busy: false });
export const useTransactionActions = () => useContext(Context);

export function TransactionActionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { transactions, friends, selectedAccountId, settleTransaction, deleteTransaction, restoreTransaction, getTransactionBin, editTransaction, revision } = useSplitTrack();
  const { themeMode, formatAmount } = useLiquidGlass();
  const { runWithIntent, pending, error, setError } = useAsyncAction();
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [binOpen, setBinOpen] = useState(false);
  const [bin, setBin] = useState<Transaction[]>([]);
  const [binLoading, setBinLoading] = useState(false);
  const [binError, setBinError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const dark = themeMode === 'dark';
  const color = dark ? '#F4F4F5' : '#18181B';
  const surface = dark ? '#242428' : '#EDEDF1';
  const owner = useCallback((tx: Transaction) => tx.type === 'expense' ? tx.paidBy === 'user' : tx.creatorId === user?.uid, [user?.uid]);
  const current = detail && (transactions.find(tx => tx.id === detail.id) || detail);
  const open = useCallback((tx: Transaction) => {
    if (pending) return;
    setError('');
    setAmounts({}); setEditTitle(tx.title); setEditAmount(String(Math.abs(tx.amount))); setEditDate(tx.date); setDetail(tx);
  }, [pending, setError]);
  const detailId = detail?.id;
  useEffect(() => {
    if (!detailId) return;
    let active = true;
    // Older trip pages may be outside the store's current snapshot.
    void api<Transaction>(`/transactions/${encodeURIComponent(detailId)}`).then(tx => {
      if (active) setDetail(tx);
    }).catch(e => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [detailId, revision, setError]);
  useEffect(() => {
    if (!binOpen) return;
    let active = true;
    void getTransactionBin().then(items => { if (active) { setBin(items); setBinError(''); } }).catch(e => { if (active) setBinError(errorMessage(e)); }).finally(() => { if (active) setBinLoading(false); });
    return () => { active = false; };
  }, [binOpen, getTransactionBin, revision]);
  const closeDetail = () => { if (!pending) { setDetail(null); setConfirmDelete(false); setError(''); } };
  const toast = (message: string) => setNotice(old => ({ id: (old?.id || 0) + 1, message }));
  const editExpense = (tx: Transaction) => { setEditing(tx); setEditSession(previous => previous + 1); setEditingOpen(true); };
  const edit = useCallback((tx: Transaction) => {
    if (pending || !owner(tx)) return;
    setError('');
    if (tx.type === 'expense') {
      setEditing(tx); setEditSession(previous => previous + 1); setEditingOpen(true);
    } else {
      setEditTitle(tx.title); setEditAmount(String(Math.abs(tx.amount))); setEditDate(tx.date); setDetail(tx);
    }
  }, [owner, pending, setError]);
  const requestDelete = useCallback((tx: Transaction) => {
    if (pending || !owner(tx)) return;
    setError(''); setDetail(tx); setConfirmDelete(true);
  }, [owner, pending, setError]);
  const remove = () => {
    if (!detail || !owner(detail)) return;
    void runWithIntent(detail.id, async (id, intent) => {
      await deleteTransaction(id, intent);
      setDetail(null); setConfirmDelete(false); toast('Transaction deleted. Restore it in Settings within 7 days.');
    });
  };
  const openDeleted = useCallback(() => { if (!pending) { setError(''); setBinError(''); setBinLoading(true); setBinOpen(true); } }, [pending, setError]);
  const context = useMemo(() => ({ open, edit, remove: requestDelete, openDeleted, canManage: owner, busy: pending }), [open, edit, requestDelete, openDeleted, owner, pending]);
  return <Context.Provider value={context}>
    {children}
    <SheetModal visible={Boolean(detail) || confirmDelete} onRequestClose={closeDetail}>
      <View style={styles.fill}><ModalBackdrop onClose={closeDetail} /><GlassModalSheet>
        <View style={styles.handleWrap}><View style={[styles.handle, { backgroundColor: dark ? '#52525B' : '#A1A1AA' }]} /></View>
        <ScrollEdgeFade>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
          <Text style={[styles.title, { color }]}>{confirmDelete ? 'Delete transaction?' : current?.title}</Text>
          {confirmDelete ? <>
            <Text style={{ color }}>This updates balances for everyone involved. You can restore these entries for 7 days.</Text>
            <GlassPill label={pending ? 'Deleting…' : 'Delete transaction'} size="lg" shape="rounded" variant="danger" disabled={pending} onPress={remove} />
          </> : current ? <>
            <Text style={{ color }}>{formatAmount(Math.abs(current.amount))} · {current.date}</Text>
            <Text style={{ color }}>{current.settled ? 'Settled' : `${formatAmount(current.remainingAmount || 0)} remaining`}</Text>
            {current.settlementVector?.map(vector => <View key={vector.memberId} style={[styles.member, { backgroundColor: surface }]}>
              <Text style={{ color }}>{vector.memberId === 'user' ? 'You' : friends.find(f => f.id === vector.memberId)?.name || 'Member'}</Text>
              <Text style={{ color }}>{formatAmount(vector.remainingAmount)} remaining</Text>
              {vector.balances.map((balance, index) => <Text key={index} style={{ color }}>{balance.creditorId === 'user' ? 'Owes you' : balance.debtorId === 'user' ? 'You owe' : 'Outstanding'} {formatAmount(balance.amount)}</Text>)}
              {current.paidBy === 'user' && vector.balances.some(b => b.creditorId === 'user') ? <>
                <TextInput accessibilityLabel="Amount received" keyboardType="decimal-pad" value={amounts[vector.memberId] ?? String(vector.remainingAmount)} onChangeText={value => setAmounts(old => ({ ...old, [vector.memberId]: value }))} style={[styles.input, { color, backgroundColor: dark ? '#333338' : '#FFFFFF' }]} />
                <GlassPill label="Mark member settled" disabled={pending} onPress={() => {
                  const value = Number(amounts[vector.memberId] ?? vector.remainingAmount);
                  void runWithIntent({ id: current.id, memberId: vector.memberId, amount: value }, async (draft, intent) => {
                    if (!Number.isFinite(draft.amount) || draft.amount <= 0) throw new Error('Enter a positive payment amount.');
                    await settleTransaction(draft.id, draft.memberId, draft.amount, selectedAccountId, intent); toast('Payment recorded; balances updated');
                  });
                }} />
              </> : null}
            </View>)}
            {owner(current) ? <>
              {current.type === 'expense' ? <GlassPill label="Edit transaction" onPress={() => { editExpense(current); setDetail(null); }} /> : <>
                <TextInput accessibilityLabel="Transaction title" value={editTitle || current.title} onChangeText={setEditTitle} style={[styles.input, { color, backgroundColor: surface }]} />
                <TextInput accessibilityLabel="Transaction amount" keyboardType="decimal-pad" value={editAmount} onChangeText={setEditAmount} style={[styles.input, { color, backgroundColor: surface }]} />
                <TextInput accessibilityLabel="Transaction date YYYY-MM-DD" value={editDate} onChangeText={setEditDate} style={[styles.input, { color, backgroundColor: surface }]} />
                <GlassPill label="Save changes" disabled={pending} onPress={() => { void runWithIntent({ id: current.id, title: editTitle || current.title, amount: Number(editAmount), date: editDate }, async (draft, intent) => { await editTransaction(draft.id, { title: draft.title, amount: draft.amount, date: draft.date }, intent); setDetail(null); toast('Transaction updated'); }); }} />
              </>}
              <GlassPill label="Delete transaction" size="lg" shape="rounded" variant="danger" onPress={() => setConfirmDelete(true)} />
            </> : <Text style={{ color }}>Only the transaction owner can edit, delete or mark its members settled.</Text>}
          </> : null}
          <FormError message={error} />
          <GlassPill label={confirmDelete ? 'Cancel' : 'Close'} size="lg" disabled={pending} onPress={closeDetail} />
        </ScrollView>
        </ScrollEdgeFade>
      </GlassModalSheet></View>
    </SheetModal>
    <SheetModal visible={binOpen} onRequestClose={() => !pending && setBinOpen(false)}>
      <View style={styles.fill}><ModalBackdrop onClose={() => !pending && setBinOpen(false)} /><GlassModalSheet>
        <View style={styles.handleWrap}><View style={[styles.handle, { backgroundColor: dark ? '#52525B' : '#A1A1AA' }]} /></View>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={[styles.title, { color }]}>Deleted transactions</Text>
          <Text style={[styles.caption, { color: dark ? '#A1A1AA' : '#71717A' }]}>Restore an entry within 7 days.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close deleted transactions" disabled={pending}
            onPress={() => setBinOpen(false)} style={[styles.close, { backgroundColor: surface }]}><CloseCircleIcon size={22} color={color} /></Pressable>
        </View>
        <ScrollEdgeFade>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {binLoading ? <ActivityIndicator color={color} /> : null}
          {!binLoading && !bin.length && !binError ? <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: surface }]}><TrashBinTrashIcon size={28} color={color} /></View>
            <Text style={[styles.emptyTitle, { color }]}>No deleted transactions</Text>
            <Text style={[styles.caption, { color: dark ? '#A1A1AA' : '#71717A' }]}>Transactions you delete will appear here.</Text>
          </View> : null}
          {bin.map(tx => <View key={tx.id} style={[styles.member, { backgroundColor: surface }]}>
            <View style={styles.deletedRow}><Text numberOfLines={2} style={[styles.deletedTitle, { color }]}>{tx.title}</Text><Text style={{ color, fontWeight: '600' }}>{formatAmount(Math.abs(tx.amount))}</Text></View>
            <Text style={[styles.caption, { color: dark ? '#A1A1AA' : '#71717A' }]}>Permanently deleted {new Date((tx.expiresAt || 0) * 1000).toLocaleDateString()}</Text>
            {tx.canRestore ? <GlassPill label="Restore" size="lg" variant="success" disabled={pending} onPress={() => { void runWithIntent(tx.id, async (id, intent) => { await restoreTransaction(id, intent); setBin(old => old.filter(item => item.id !== id)); toast('Transaction restored'); }); }} /> : <Text style={{ color }}>The transaction owner can restore this entry.</Text>}
          </View>)}
          <FormError message={binError || error} />
        </ScrollView>
        </ScrollEdgeFade>
      </GlassModalSheet></View>
    </SheetModal>
    <AddExpenseModal key={`editing-${editSession}`} visible={editingOpen} transactionToEdit={editing ?? undefined} onClose={() => setEditingOpen(false)} />
    <BottomBubble notice={notice} onDismiss={() => setNotice(null)} />
  </Context.Provider>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  handleWrap: { alignItems: 'center', paddingVertical: 6, marginBottom: 12 },
  handle: { width: 38, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  caption: { fontSize: 12, lineHeight: 18 },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyIcon: { padding: 18, borderRadius: 24 }, emptyTitle: { fontSize: 16, fontWeight: '500' },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, deletedTitle: { fontSize: 15, fontWeight: '500', flex: 1 },
  member: { padding: 14, borderRadius: 18, gap: 10, borderWidth: 0 }, input: { height: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 0 },
});
