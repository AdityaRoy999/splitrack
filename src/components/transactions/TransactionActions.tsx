import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const Context = createContext({ open: (_tx: Transaction) => {}, select: (_tx: Transaction) => {}, openBin: () => {}, selected: new Set<string>(), selecting: false });
export const useTransactionActions = () => useContext(Context);

export function TransactionActionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { transactions, friends, selectedAccountId, settleTransaction, deleteTransaction, restoreTransaction, getTransactionBin, editTransaction, revision } = useSplitTrack();
  const { themeMode, formatAmount } = useLiquidGlass();
  const { runWithIntent, pending, error, setError } = useAsyncAction();
  const [selection, setSelection] = useState<Transaction[]>([]);
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
  const insets = useSafeAreaInsets();
  const dark = themeMode === 'dark';
  const color = dark ? '#F4F4F5' : '#18181B';
  const surface = dark ? '#242428' : '#EDEDF1';
  const owner = useCallback((tx: Transaction) => tx.type === 'expense' ? tx.paidBy === 'user' : tx.creatorId === user?.uid, [user?.uid]);
  const selected = useMemo(() => new Set(selection.map(tx => tx.id)), [selection]);
  const current = detail && (transactions.find(tx => tx.id === detail.id) || detail);
  const select = useCallback((tx: Transaction) => {
    if (pending) return;
    setError('');
    if (!owner(tx)) { setDetail(tx); return; }
    setSelection(previous => previous.some(item => item.id === tx.id) ? previous.filter(item => item.id !== tx.id) : [...previous, tx]);
  }, [owner, pending, setError]);
  const open = useCallback((tx: Transaction) => {
    if (pending) return;
    if (selection.length) { select(tx); return; }
    setError('');
    setAmounts({}); setEditTitle(tx.title); setEditAmount(String(Math.abs(tx.amount))); setEditDate(tx.date); setDetail(tx);
  }, [pending, selection.length, select, setError]);
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
  const remove = () => {
    const ids = selection.length ? selection.map(tx => tx.id) : detail ? [detail.id] : [];
    void runWithIntent(ids, async (values, intent) => {
      let completed = 0;
      for (const id of values) {
        try { await deleteTransaction(id, `${intent}_${completed}`); completed++; }
        catch (e) { setSelection(previous => previous.filter(tx => !values.slice(0, completed).includes(tx.id))); throw new Error(`${completed ? `${completed} moved to the bin. ` : ''}${errorMessage(e)}`); }
      }
      setSelection([]); setDetail(null); setConfirmDelete(false); toast(`${completed} ${completed === 1 ? 'transaction' : 'transactions'} moved to the bin for 7 days`);
    });
  };
  const openBin = useCallback(() => { if (!pending) { setError(''); setBinError(''); setBinLoading(true); setBinOpen(true); } }, [pending, setError]);
  const context = useMemo(() => ({ open, select, openBin, selected, selecting: Boolean(selection.length) }), [open, select, openBin, selected, selection.length]);
  const actionStyle = { backgroundColor: surface, minHeight: 44, borderRadius: 22, paddingHorizontal: 14, alignItems: 'center' as const, justifyContent: 'center' as const };
  return <Context.Provider value={context}>
    {children}
    <View pointerEvents="box-none" style={[styles.toolbar, { bottom: insets.bottom + 106 }]}>
      {selection.length ? <View style={[styles.bar, { backgroundColor: surface }]}>
        <Text style={{ color }}>{selection.length} selected</Text>
        {selection.length === 1 ? <Pressable style={actionStyle} onPress={() => { const tx = selection[0]; setError(''); setSelection([]); if (tx.type === 'expense') editExpense(tx); else { setDetail(tx); setEditTitle(tx.title); setEditAmount(String(Math.abs(tx.amount))); setEditDate(tx.date); } }}><Text style={{ color }}>Edit</Text></Pressable> : null}
        <Pressable style={actionStyle} onPress={() => { setError(''); setConfirmDelete(true); }}><Text style={{ color: '#F87171' }}>Delete</Text></Pressable>
        <Pressable style={actionStyle} onPress={() => setSelection([])}><Text style={{ color }}>Done</Text></Pressable>
      </View> : null}
    </View>
    <SheetModal visible={Boolean(detail) || confirmDelete} onRequestClose={closeDetail}>
      <View style={styles.fill}><ModalBackdrop onClose={closeDetail} /><GlassModalSheet>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
          <Text style={[styles.title, { color }]}>{confirmDelete ? 'Move to transaction bin?' : current?.title}</Text>
          {confirmDelete ? <>
            <Text style={{ color }}>This updates balances for everyone involved. You can restore these entries for 7 days.</Text>
            <GlassPill label={pending ? 'Deleting…' : 'Move to bin'} textStyle={{ color: '#F87171' }} disabled={pending} onPress={remove} />
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
              <GlassPill label="Delete transaction" textStyle={{ color: '#F87171' }} onPress={() => setConfirmDelete(true)} />
            </> : <Text style={{ color }}>Only the transaction owner can edit, delete or mark its members settled.</Text>}
          </> : null}
          <FormError message={error} />
          <GlassPill label="Close" disabled={pending} onPress={closeDetail} />
        </ScrollView>
      </GlassModalSheet></View>
    </SheetModal>
    <SheetModal visible={binOpen} onRequestClose={() => !pending && setBinOpen(false)}>
      <View style={styles.fill}><ModalBackdrop onClose={() => !pending && setBinOpen(false)} /><GlassModalSheet>
        <Text style={[styles.title, { color }]}>Transaction bin</Text>
        <Text style={{ color, marginBottom: 16 }}>Deleted entries can be restored for 7 days.</Text>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {binLoading ? <ActivityIndicator color={color} /> : null}
          {!binLoading && !bin.length ? <Text style={{ color }}>Your bin is empty.</Text> : null}
          {bin.map(tx => <View key={tx.id} style={[styles.member, { backgroundColor: surface }]}>
            <Text style={{ color }}>{tx.title} · {formatAmount(Math.abs(tx.amount))}</Text>
            <Text style={{ color }}>Expires {new Date((tx.expiresAt || 0) * 1000).toLocaleDateString()}</Text>
            {tx.canRestore ? <GlassPill label="Restore" disabled={pending} onPress={() => { void runWithIntent(tx.id, async (id, intent) => { await restoreTransaction(id, intent); setBin(old => old.filter(item => item.id !== id)); toast('Transaction restored'); }); }} /> : <Text style={{ color }}>The transaction owner can restore this entry.</Text>}
          </View>)}
          <FormError message={binError || error} />
        </ScrollView>
        <GlassPill label="Close" disabled={pending} onPress={() => setBinOpen(false)} />
      </GlassModalSheet></View>
    </SheetModal>
    <AddExpenseModal key={`editing-${editSession}`} visible={editingOpen} transactionToEdit={editing ?? undefined} onClose={() => setEditingOpen(false)} />
    <BottomBubble notice={notice} onDismiss={() => setNotice(null)} />
  </Context.Provider>;
}

const styles = StyleSheet.create({ fill: { flex: 1, justifyContent: 'flex-end' }, toolbar: { position: 'absolute', left: 16, right: 16, zIndex: 80 }, bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', justifyContent: 'space-between', padding: 6, borderRadius: 28 }, title: { fontSize: 22, fontWeight: '600', marginTop: 24, marginBottom: 8 }, member: { padding: 14, borderRadius: 18, gap: 10 }, input: { height: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 0 } });
