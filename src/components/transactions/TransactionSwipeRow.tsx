import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import type { Transaction } from '../../types';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from '../common/BackdropSurfaceContext';
import { useTransactionActions } from './TransactionActions';

let openRow: SwipeableMethods | null = null;

// The installed gesture library animates and tracks the row on the UI thread.
export function TransactionSwipeRow({ transaction, children }: { transaction: Transaction; children: React.ReactNode }) {
  const actions = useTransactionActions();
  const { themeMode } = useLiquidGlass();
  const surface = useContext(BackdropSurfaceContext);
  const swipeable = useRef<SwipeableMethods>(null);
  useEffect(() => {
    const row = swipeable.current;
    return () => { if (openRow === row) openRow = null; };
  }, []);
  const renderActions = useCallback(() => <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${transaction.title}`}
      onPress={() => { swipeable.current?.close(); actions.edit(transaction); }} style={[styles.action, styles.edit]}>
      <Pen2Icon size={20} color="#FFFFFF" /><Text style={styles.label}>Edit</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${transaction.title}`}
      onPress={() => { swipeable.current?.close(); actions.remove(transaction); }} style={[styles.action, styles.delete]}>
      <TrashBinTrashIcon size={20} color="#FFFFFF" /><Text style={styles.label}>Delete</Text>
    </Pressable>
  </View>, [actions, transaction]);

  if (!actions.canManage(transaction)) return <>{children}</>;
  return <ReanimatedSwipeable ref={swipeable} enabled={!actions.busy} friction={1}
    leftThreshold={48} rightThreshold={48} overshootLeft={false} overshootRight={false}
    dragOffsetFromLeft={18} dragOffsetFromRight={18}
    renderLeftActions={renderActions} renderRightActions={renderActions}
    onSwipeableWillOpen={() => {
      if (openRow !== swipeable.current) openRow?.close();
      openRow = swipeable.current;
    }}
    containerStyle={styles.row}
    childrenContainerStyle={{ backgroundColor: surface ?? (themeMode === 'dark' ? '#17171C' : '#FFFFFF') }}>
    {children}
  </ReanimatedSwipeable>;
}

const styles = StyleSheet.create({
  row: { borderRadius: 16, borderWidth: 0 },
  actions: { width: 164, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  action: { width: 66, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, borderWidth: 0 },
  edit: { backgroundColor: '#5A5B65' }, delete: { backgroundColor: '#E5484D' },
  label: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
});
