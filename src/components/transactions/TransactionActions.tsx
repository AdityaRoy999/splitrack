import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { useAuth } from '../../auth/AuthContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { api, errorMessage } from '../../services/api';
import type { Transaction } from '../../types';
import { SheetModal } from '../common/SheetModal';
import { SheetFooter } from '../common/SheetFooter';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { GlassPill } from '../glass/GlassPill';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
import { AddExpenseModal } from '../split/AddExpenseModal';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';
import { SheetHeader } from '../common/SheetHeader';
import { UserAvatar } from '../common/UserAvatar';
import { BillListIcon } from '@solar-icons/react-native/bold/bill-list';

const Context = createContext({ open: (_tx: Transaction) => {}, edit: (_tx: Transaction) => {}, remove: (_tx: Transaction) => {}, openDeleted: () => {}, canManage: (_tx: Transaction): boolean => false, busy: false, modalVisible: false });
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
  const detailPresented = useRef(false);
  const [detailMounted, setDetailMounted] = useState(false);
  const queuedExpense = useRef<Transaction | null>(null);
  const [binOpen, setBinOpen] = useState(false);
  const [binMounted, setBinMounted] = useState(false);
  const [bin, setBin] = useState<Transaction[]>([]);
  const [binLoading, setBinLoading] = useState(false);
  const [binError, setBinError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editRequested, setEditRequested] = useState(false);
  const [editDate, setEditDate] = useState('');
  const dark = themeMode === 'dark';
  const color = dark ? '#F4F4F5' : '#18181B';
  const surface = dark ? '#111114' : '#EDEDF1';
  const owner = useCallback((tx: Transaction) => !tx.id.startsWith('offline-') && (tx.type === 'expense' ? tx.paidBy === 'user' : tx.creatorId === user?.uid), [user?.uid]);
  const current = detail && (detail.id.startsWith('offline-')
    ? transactions.find(tx => tx.id === detail.id) || transactions.find(tx => (tx as Transaction & { clientRequestId?: string }).clientRequestId === detail.id.slice('offline-'.length))
    : transactions.find(tx => tx.id === detail.id) || detail);
  const open = useCallback((tx: Transaction) => {
    if (pending) return;
    queuedExpense.current = null;
    detailPresented.current = true;
    setDetailMounted(true);
    setError('');
    setEditRequested(false); setConfirmDelete(false);
    setAmounts({}); setEditTitle(tx.title); setEditAmount(String(Math.abs(tx.amount))); setEditDate(tx.date); setDetail(tx);
  }, [pending, setError]);
  const detailId = current?.id;
  useEffect(() => {
    if (!detailId || detailId.startsWith('offline-')) return;
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
  const closeDetail = () => { if (!pending) { queuedExpense.current = null; setDetail(null); setConfirmDelete(false); setError(''); } };
  const presentExpenseEditor = useCallback((tx: Transaction) => {
    setEditing(tx); setEditSession(previous => previous + 1); setEditingOpen(true);
  }, []);
  const finishDetailExit = useCallback(() => {
    detailPresented.current = false;
    setDetailMounted(false);
    const tx = queuedExpense.current;
    queuedExpense.current = null;
    if (tx) presentExpenseEditor(tx);
  }, [presentExpenseEditor]);
  const closeExpenseEditor = useCallback(() => setEditingOpen(false), []);
  const finishExpenseExit = useCallback(() => setEditing(null), []);
  const edit = useCallback((tx: Transaction) => {
    if (pending || !owner(tx)) return;
    setError('');
    if (tx.type === 'expense') {
      if (detailPresented.current) {
        queuedExpense.current = tx;
        setDetail(null); setConfirmDelete(false);
      } else presentExpenseEditor(tx);
    } else {
      detailPresented.current = true;
      setDetailMounted(true);
      setEditRequested(true); setConfirmDelete(false);
      setEditTitle(tx.title); setEditAmount(String(Math.abs(tx.amount))); setEditDate(tx.date); setDetail(tx);
    }
  }, [owner, pending, presentExpenseEditor, setError]);
  const requestDelete = useCallback((tx: Transaction) => {
    if (pending || !owner(tx)) return;
    queuedExpense.current = null;
    detailPresented.current = true;
    setDetailMounted(true);
    setError(''); setDetail(tx); setConfirmDelete(true);
  }, [owner, pending, setError]);
  const remove = () => {
    if (!current || !owner(current)) return;
    void runWithIntent(current.id, async (id, intent) => {
      await deleteTransaction(id, intent);
      setDetail(null); setConfirmDelete(false);
    });
  };
  const openDeleted = useCallback(() => { if (!pending) { setError(''); setBinError(''); setBinLoading(true); setBinMounted(true); setBinOpen(true); } }, [pending, setError]);
  const finishBinExit = useCallback(() => setBinMounted(false), []);
  const modalVisible = detailMounted || Boolean(editing) || binMounted;
  const context = useMemo(() => ({ open, edit, remove: requestDelete, openDeleted, canManage: owner, busy: pending, modalVisible }), [open, edit, requestDelete, openDeleted, owner, pending, modalVisible]);
  return <Context.Provider value={context}>
    {children}
    <SheetModal visible={Boolean(current) || confirmDelete} onRequestClose={closeDetail} onExitComplete={finishDetailExit}>
      <View style={styles.fill}><ModalBackdrop onClose={closeDetail} /><GlassModalSheet>
        <SheetHeader title={confirmDelete ? 'Delete transaction?' : editRequested ? 'Edit transaction' : current?.type === 'settlement' ? 'Payment details' : 'Transaction details'}
          subtitle={confirmDelete ? 'Restore deleted entries in Settings within 7 days.' : editRequested ? 'Update the details and save your changes.' : 'Shared balances and individual payments'} onClose={closeDetail} disabled={pending} />
        <ScrollEdgeFade>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {current ? <View style={[styles.summaryCard, { backgroundColor: surface }]}>
              <View style={styles.summaryHeading}><View style={[styles.summaryIcon, { backgroundColor: dark ? '#1C1C22' : '#DADAE0' }]}>
                {confirmDelete ? <TrashBinTrashIcon size={20} color="#E5484D" /> : <BillListIcon size={20} color={color} />}
              </View><View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.recordTitle, { color }]}>{current.title}</Text><Text style={[styles.caption, { color: dark ? '#8E8E93' : '#71717A' }]}>{current.date} · {current.type === 'settlement' ? 'Payment' : current.category}</Text></View></View>
              <Text style={[styles.summaryAmount, { color }]}>{formatAmount(Math.abs(current.amount))}</Text>
              {!confirmDelete ? <Text style={[styles.caption, { color: dark ? '#8E8E93' : '#71717A' }]}>{current.id.startsWith('offline-') ? 'Saved on this device. Waiting to sync.' : current.settled ? 'Settled' : `${formatAmount(current.remainingAmount || 0)} remaining`}</Text> : null}
            </View> : null}
            {confirmDelete ? <>
              <View style={[styles.sectionCard, { backgroundColor: surface }]}><Text style={[styles.sectionLabel, { color: dark ? '#8E8E93' : '#71717A' }]}>BEFORE YOU DELETE</Text><Text style={[styles.body, { color }]}>Balances update for everyone involved. You can restore this entry from Deleted transactions in Settings for 7 days.</Text></View>
              <GlassPill label={pending ? 'Deleting…' : 'Delete transaction'} size="lg" shape="rounded" variant="danger" disabled={pending} onPress={remove} />
            </> : current ? <>
              {current.settlementVector?.map(vector => {
                const member = friends.find(friend => friend.id === vector.memberId);
                return <View key={vector.memberId} style={[styles.sectionCard, { backgroundColor: surface }]}>
                  <View style={styles.summaryHeading}><UserAvatar avatarUri={member?.avatar} name={vector.memberId === 'user' ? 'You' : member?.name || 'Member'} size={36} borderRadius={12} isDark={dark} /><View style={{ flex: 1 }}><Text style={[styles.recordTitle, { color }]}>{vector.memberId === 'user' ? 'You' : member?.name || 'Member'}</Text><Text style={[styles.caption, { color: dark ? '#8E8E93' : '#71717A' }]}>{formatAmount(vector.remainingAmount)} remaining</Text></View></View>
                  {vector.balances.map((balance, index) => <Text key={index} style={[styles.body, { color }]}>{balance.creditorId === 'user' ? 'Owes you' : balance.debtorId === 'user' ? 'You owe' : 'Outstanding'} {formatAmount(balance.amount)}</Text>)}
                  {current.paidBy === 'user' && vector.balances.some(balance => balance.creditorId === 'user') ? <>
                    <Text style={[styles.sectionLabel, { color: dark ? '#8E8E93' : '#71717A' }]}>AMOUNT RECEIVED</Text>
                    <TextInput accessibilityLabel="Amount received" keyboardType="decimal-pad" value={amounts[vector.memberId] ?? String(vector.remainingAmount)} onChangeText={value => setAmounts(old => ({ ...old, [vector.memberId]: value }))} style={[styles.input, { color, backgroundColor: dark ? '#1C1C22' : '#DADAE0' }]} />
                    <GlassPill label="Mark member settled" size="lg" variant="dark" disabled={pending} onPress={() => {
                      const amount = Number(amounts[vector.memberId] ?? vector.remainingAmount);
                      void runWithIntent({ id: current.id, memberId: vector.memberId, amount }, async (draft, intent) => {
                        if (!Number.isFinite(draft.amount) || draft.amount <= 0) throw new Error('Enter a positive payment amount.');
                        await settleTransaction(draft.id, draft.memberId, draft.amount, selectedAccountId, intent);
                      });
                    }} />
                  </> : null}
                </View>;
              })}
              {owner(current) ? <>
                {current.type !== 'expense' && editRequested ? <View style={[styles.sectionCard, { backgroundColor: surface }]}>
                  <Text style={[styles.sectionLabel, { color: dark ? '#8E8E93' : '#71717A' }]}>DESCRIPTION</Text>
                  <TextInput accessibilityLabel="Transaction title" value={editTitle} onChangeText={setEditTitle} style={[styles.input, { color, backgroundColor: dark ? '#1C1C22' : '#DADAE0' }]} />
                  <Text style={[styles.sectionLabel, { color: dark ? '#8E8E93' : '#71717A' }]}>AMOUNT</Text>
                  <TextInput accessibilityLabel="Transaction amount" keyboardType="decimal-pad" value={editAmount} onChangeText={setEditAmount} style={[styles.input, { color, backgroundColor: dark ? '#1C1C22' : '#DADAE0' }]} />
                  <Text style={[styles.sectionLabel, { color: dark ? '#8E8E93' : '#71717A' }]}>DATE</Text>
                  <TextInput accessibilityLabel="Transaction date YYYY-MM-DD" value={editDate} onChangeText={setEditDate} style={[styles.input, { color, backgroundColor: dark ? '#1C1C22' : '#DADAE0' }]} />
                  <GlassPill label={pending ? 'Saving…' : 'Save changes'} size="lg" variant="dark" disabled={pending} onPress={() => {
                    void runWithIntent({ id: current.id, title: editTitle.trim(), amount: Number(editAmount), date: editDate }, async (draft, intent) => {
                      if (!draft.title || !Number.isFinite(draft.amount) || draft.amount <= 0) throw new Error('Enter a description and positive amount.');
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) throw new Error('Enter a date as YYYY-MM-DD.');
                      await editTransaction(draft.id, { title: draft.title, amount: draft.amount, date: draft.date }, intent); setDetail(null);
                    });
                  }} />
                </View> : <GlassPill label="Edit transaction" size="lg" variant="dark" backgroundColor={dark ? '#111114' : undefined} onPress={() => edit(current)} />}
                <GlassPill label="Delete transaction" size="lg" variant="danger" onPress={() => setConfirmDelete(true)} />
              </> : <Text style={[styles.body, { color }]}>{current.id.startsWith('offline-') ? 'Reconnect before editing, deleting or settling this transaction.' : 'Only the transaction owner can edit, delete or mark its members settled.'}</Text>}
            </> : null}
            <FormError message={error} />
          </ScrollView>
        </ScrollEdgeFade>
        <SheetFooter><GlassPill label={confirmDelete ? 'Cancel' : 'Close'} size="lg" variant="dark" disabled={pending} onPress={closeDetail} /></SheetFooter>
      </GlassModalSheet></View>
    </SheetModal>
    <SheetModal visible={binOpen} onRequestClose={() => !pending && setBinOpen(false)} onExitComplete={finishBinExit}>
      <View style={styles.fill}><ModalBackdrop onClose={() => !pending && setBinOpen(false)} /><GlassModalSheet>
        <SheetHeader title="Deleted transactions" subtitle="Restore an entry within 7 days." onClose={() => !pending && setBinOpen(false)} disabled={pending} />
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
            {tx.canRestore ? <GlassPill label="Restore" size="lg" variant="success" disabled={pending} onPress={() => { void runWithIntent(tx.id, async (id, intent) => { await restoreTransaction(id, intent); setBin(old => old.filter(item => item.id !== id)); }); }} /> : <Text style={{ color }}>The transaction owner can restore this entry.</Text>}
          </View>)}
          <FormError message={binError || error} />
        </ScrollView>
        </ScrollEdgeFade>
      </GlassModalSheet></View>
    </SheetModal>
    {editing ? <AddExpenseModal key={`editing-${editSession}`} visible={editingOpen} transactionToEdit={editing} onClose={closeExpenseEditor} onExitComplete={finishExpenseExit} /> : null}
  </Context.Provider>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  content: { gap: 14, paddingBottom: 4 },
  sectionCard: { padding: 16, borderRadius: 22, gap: 12 },
  summaryCard: { padding: 18, borderRadius: 22, gap: 10 },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryAmount: { fontSize: 28, fontWeight: '600', letterSpacing: -0.6 },
  sectionLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  recordTitle: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 13, lineHeight: 20 },
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
