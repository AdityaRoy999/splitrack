import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, interpolate, interpolateColor, ReduceMotion, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import type { Transaction } from '../../types';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from '../common/BackdropSurfaceContext';
import { useTransactionActions } from './TransactionActions';

let openRow: SwipeableMethods | null = null;
const ACTION_WIDTH = 164;
const ROW_SPRING = { mass: 0.7, damping: 32, stiffness: 420, overshootClamping: true, reduceMotion: ReduceMotion.System };

function SwipeActions({ translation, rowProgress, side, dark, transaction, methods, edit, remove }: {
  translation: SharedValue<number>; rowProgress: SharedValue<number>; side: 'left' | 'right'; dark: boolean;
  transaction: Transaction; methods: SwipeableMethods; edit(tx: Transaction): void; remove(tx: Transaction): void;
}) {
  useAnimatedReaction(() => Math.min(1, Math.abs(translation.get()) / ACTION_WIDTH), value => { if (side === 'left') rowProgress.set(value); });
  const editMotion = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (Math.abs(translation.get()) / ACTION_WIDTH - 0.08) / 0.82));
    return { opacity: reveal, transform: [{ scale: 0.78 + 0.22 * reveal }, { translateX: (side === 'right' ? 8 : -8) * (1 - reveal) }] };
  });
  const deleteMotion = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (Math.abs(translation.get()) / ACTION_WIDTH - 0.2) / 0.8));
    return { opacity: reveal, transform: [{ scale: 0.78 + 0.22 * reveal }, { translateX: (side === 'right' ? 10 : -10) * (1 - reveal) }] };
  });
  return <View style={styles.actions}>
    <Animated.View style={editMotion}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${transaction.title}`}
      onPress={() => { methods.close(); edit(transaction); }} style={[styles.action, { backgroundColor: dark ? '#1C1C22' : '#E5E5EA' }]}>
      <Pen2Icon size={20} color={dark ? '#FFFFFF' : '#18181B'} /><Text style={[styles.label, { color: dark ? '#FFFFFF' : '#18181B' }]}>Edit</Text>
    </Pressable></Animated.View>
    <Animated.View style={deleteMotion}><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${transaction.title}`}
      onPress={() => { methods.close(); remove(transaction); }} style={[styles.action, styles.delete]}>
      <TrashBinTrashIcon size={20} color="#FFFFFF" /><Text style={styles.label}>Delete</Text>
    </Pressable></Animated.View>
  </View>;
}

// The installed gesture library animates and tracks the row on the UI thread.
export function TransactionSwipeRow({ transaction, children }: { transaction: Transaction; children: React.ReactNode }) {
  const actions = useTransactionActions();
  const { themeMode } = useLiquidGlass();
  const surface = useContext(BackdropSurfaceContext);
  const swipeable = useRef<SwipeableMethods>(null);
  const rowProgress = useSharedValue(0);
  const dark = themeMode === 'dark';
  const baseSurface = surface ?? (dark ? '#17171C' : '#FFFFFF');
  const cardMotion = useAnimatedStyle(() => {
    const reveal = interpolate(rowProgress.get(), [0, 0.35], [0, 1], Extrapolation.CLAMP);
    return { borderRadius: 16 * reveal, paddingHorizontal: 12 * reveal, backgroundColor: interpolateColor(reveal, [0, 1], [baseSurface, dark ? '#29292E' : '#E5E5EA']) };
  });
  useEffect(() => {
    const row = swipeable.current;
    return () => { if (openRow === row) openRow = null; };
  }, []);
  const renderLeftActions = useCallback((_progress: SharedValue<number>, translation: SharedValue<number>, methods: SwipeableMethods) =>
    <SwipeActions translation={translation} rowProgress={rowProgress} side="left" dark={dark} transaction={transaction} methods={methods} edit={actions.edit} remove={actions.remove} />,
  [actions.edit, actions.remove, dark, rowProgress, transaction]);
  const renderRightActions = useCallback((_progress: SharedValue<number>, translation: SharedValue<number>, methods: SwipeableMethods) =>
    <SwipeActions translation={translation} rowProgress={rowProgress} side="right" dark={dark} transaction={transaction} methods={methods} edit={actions.edit} remove={actions.remove} />,
  [actions.edit, actions.remove, dark, rowProgress, transaction]);
  const closeOtherRow = () => {
    if (openRow !== swipeable.current) openRow?.close();
    openRow = swipeable.current;
  };

  if (!actions.canManage(transaction)) return <>{children}</>;
  return <ReanimatedSwipeable ref={swipeable} enabled={!actions.busy} friction={1}
    leftThreshold={48} rightThreshold={48} overshootLeft={false} overshootRight={false}
    dragOffsetFromLeft={18} dragOffsetFromRight={-18}
    animationOptions={ROW_SPRING}
    renderLeftActions={renderLeftActions} renderRightActions={renderRightActions}
    onSwipeableOpenStartDrag={closeOtherRow} onSwipeableWillOpen={closeOtherRow}
    containerStyle={styles.row}>
    <Animated.View style={[styles.card, cardMotion]}>{children}</Animated.View>
  </ReanimatedSwipeable>;
}

const styles = StyleSheet.create({
  row: { borderWidth: 0 },
  card: { overflow: 'hidden', borderWidth: 0 },
  actions: { width: ACTION_WIDTH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  action: { width: 66, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14, borderWidth: 0 },
  delete: { backgroundColor: '#E5484D' },
  label: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
});
