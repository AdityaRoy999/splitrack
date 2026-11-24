import { GlassPressable as Pressable } from '../common/GlassTouchable';
import { ACTION_COLORS } from '../../theme/actionColors';
import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, interpolate, interpolateColor, ReduceMotion, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import type { Transaction } from '../../types';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from '../common/BackdropSurfaceContext';
import { COMPACT_BUTTON_HEIGHT, COMPACT_BUTTON_HIT_SLOP } from '../../constants/buttonSizes';
import { useTransactionActions } from './TransactionActions';

let openRow: SwipeableMethods | null = null;
const ACTION_WIDTH = 180;
const ROW_SPRING = { mass: 0.7, damping: 32, stiffness: 420, overshootClamping: true, reduceMotion: ReduceMotion.System };

function SwipeActions({ progress, translation, rowProgress, side, dark, transaction, requestAction }: {
  progress: SharedValue<number>; translation: SharedValue<number>; rowProgress: SharedValue<number>; side: 'left' | 'right'; dark: boolean;
  transaction: Transaction; requestAction(action: 'edit' | 'remove'): void;
}) {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  const nativeGlass = Platform.OS === 'ios' && isLiquidGlassEnabled;
  // Both panels receive the same row translation. Use one writer for the card,
  // and each panel's own progress so the hidden panel stays still.
  useAnimatedReaction(() => Math.max(-1, Math.min(1, translation.get() / ACTION_WIDTH)), value => { if (side === 'left') rowProgress.set(value); });
  const panelMotion = useAnimatedStyle(() => {
    const exposed = Math.max(0, Math.min(ACTION_WIDTH, side === 'left' ? translation.get() : -translation.get()));
    return nativeGlass ? { transform: [{ translateX: (side === 'left' ? -1 : 1) * (ACTION_WIDTH - exposed) }] } : {};
  });
  const editMotion = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (progress.get() - 0.08) / 0.82));
    return nativeGlass ? { opacity: reveal, transform: [{ translateX: (side === 'right' ? 8 : -8) * (1 - reveal) }] } : { opacity: reveal, transform: [{ scale: 0.78 + 0.22 * reveal }, { translateX: (side === 'right' ? 8 : -8) * (1 - reveal) }] };
  });
  const deleteMotion = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (progress.get() - 0.2) / 0.8));
    return nativeGlass ? { opacity: reveal, transform: [{ translateX: (side === 'right' ? 10 : -10) * (1 - reveal) }] } : { opacity: reveal, transform: [{ scale: 0.78 + 0.22 * reveal }, { translateX: (side === 'right' ? 10 : -10) * (1 - reveal) }] };
  });
  return <View style={[styles.actionViewport, nativeGlass && { overflow: 'hidden' }]}><Animated.View style={[styles.actions, panelMotion]}>
    <Animated.View style={editMotion}><Pressable nativeGlass={false} accessibilityRole="button" accessibilityLabel={`Edit ${transaction.title}`}
      hitSlop={COMPACT_BUTTON_HIT_SLOP} onPress={() => requestAction('edit')} style={[styles.action, { backgroundColor: dark ? '#1C1C22' : '#E5E5EA' }]}>
      <Pen2Icon size={16} color={dark ? '#FFFFFF' : '#18181B'} /><Text style={[styles.label, { color: dark ? '#FFFFFF' : '#18181B' }]}>Edit</Text>
    </Pressable></Animated.View>
    <Animated.View style={deleteMotion}><Pressable nativeGlass={false} accessibilityRole="button" accessibilityLabel={`Delete ${transaction.title}`}
      hitSlop={COMPACT_BUTTON_HIT_SLOP} onPress={() => requestAction('remove')} style={[styles.action, styles.delete]}>
      <TrashBinTrashIcon size={16} color="#FFFFFF" /><Text style={styles.label}>Delete</Text>
    </Pressable></Animated.View>
  </Animated.View></View>;
}

// The installed gesture library animates and tracks the row on the UI thread.
export function TransactionSwipeRow({ transaction, children }: { transaction: Transaction; children: React.ReactNode }) {
  const actions = useTransactionActions();
  const { themeMode, transactionActionStyle, isLiquidGlassEnabled } = useLiquidGlass();
  const surface = useContext(BackdropSurfaceContext);
  const swipeable = useRef<SwipeableMethods>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const rowProgress = useSharedValue(0);
  const dark = themeMode === 'dark';
  const baseSurface = Platform.OS === 'ios' && isLiquidGlassEnabled ? 'transparent' : surface ?? (dark ? '#17171C' : '#FFFFFF');
  const cardMotion = useAnimatedStyle(() => {
    const reveal = interpolate(Math.abs(rowProgress.get()), [0, 0.35], [0, 1], Extrapolation.CLAMP);
    // Padding changes re-layout every text and icon on Android during a drag.
    // Keep the row geometry fixed; its translation, corner and color reveal stay.
    return { borderRadius: 16 * reveal, backgroundColor: interpolateColor(reveal, [0, 1], [baseSurface, dark ? '#29292E' : '#E5E5EA']) };
  });
  // Add breathing room at the revealed end without re-laying out text during
  // the gesture. Normal list alignment returns when the row closes.
  const contentMotion = useAnimatedStyle(() => ({ transform: [{ translateX: rowProgress.get() * 8 }] }));
  useEffect(() => {
    const row = swipeable.current;
    return () => { if (openRow === row) openRow = null; };
  }, []);
  const requestAction = useCallback((action: 'edit' | 'remove') => {
    if (Platform.OS === 'ios' && isLiquidGlassEnabled) {
      pendingAction.current = null;
      swipeable.current?.close();
      actions[action](transaction);
      return;
    }
    pendingAction.current = () => actions[action](transaction);
    swipeable.current?.close();
  }, [actions, isLiquidGlassEnabled, transaction]);
  const finishClose = useCallback(() => {
    if (openRow === swipeable.current) openRow = null;
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }, []);
  const renderLeftActions = useCallback((progress: SharedValue<number>, translation: SharedValue<number>) =>
    <SwipeActions progress={progress} translation={translation} rowProgress={rowProgress} side="left" dark={dark} transaction={transaction} requestAction={requestAction} />,
  [dark, requestAction, rowProgress, transaction]);
  const renderRightActions = useCallback((progress: SharedValue<number>, translation: SharedValue<number>) =>
    <SwipeActions progress={progress} translation={translation} rowProgress={rowProgress} side="right" dark={dark} transaction={transaction} requestAction={requestAction} />,
  [dark, requestAction, rowProgress, transaction]);
  const closeOtherRow = () => {
    pendingAction.current = null;
    if (openRow !== swipeable.current) openRow?.close();
    openRow = swipeable.current;
  };

  if (!actions.canManage(transaction)) return <>{children}</>;
  if (transactionActionStyle === 'buttons') return <View>
    {children}
    <View style={styles.inlineActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${transaction.title}`} disabled={actions.busy} onPress={() => actions.edit(transaction)} style={[styles.action, { backgroundColor: dark ? '#1C1C22' : '#E5E5EA' }]}>
        <Pen2Icon size={16} color={dark ? '#FFFFFF' : '#18181B'} /><Text style={[styles.label, { color: dark ? '#FFFFFF' : '#18181B' }]}>Edit</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${transaction.title}`} disabled={actions.busy} onPress={() => actions.remove(transaction)} style={[styles.action, styles.delete]}>
        <TrashBinTrashIcon size={16} color="#FFFFFF" /><Text style={styles.label}>Delete</Text>
      </Pressable>
    </View>
  </View>;
  return <ReanimatedSwipeable ref={swipeable} enabled={!actions.busy} friction={1}
    leftThreshold={48} rightThreshold={48} overshootLeft={false} overshootRight={false}
    dragOffsetFromLeft={10} dragOffsetFromRight={-10}
    animationOptions={ROW_SPRING}
    renderLeftActions={renderLeftActions} renderRightActions={renderRightActions}
    onSwipeableOpenStartDrag={closeOtherRow} onSwipeableWillOpen={closeOtherRow}
    onSwipeableClose={finishClose}
    containerStyle={styles.row}>
    <Animated.View style={[styles.card, cardMotion]}><Animated.View style={contentMotion}>{children}</Animated.View></Animated.View>
  </ReanimatedSwipeable>;
}

const styles = StyleSheet.create({
  row: { borderWidth: 0 },
  card: { overflow: 'hidden', borderWidth: 0 },
  actionViewport: { width: ACTION_WIDTH, justifyContent: 'center' },
  actions: { width: ACTION_WIDTH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 4 },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 12, paddingBottom: 10 },
  action: { width: 66, height: COMPACT_BUTTON_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 0 },
  delete: { backgroundColor: ACTION_COLORS.danger },
  label: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
});
