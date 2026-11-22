import { ACTION_COLORS } from '../../theme/actionColors';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { ReduceMotion, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

let openItem: SwipeableMethods | null = null;
const SPRING = { mass: 0.7, damping: 32, stiffness: 420, overshootClamping: true, reduceMotion: ReduceMotion.System };

function RevealedButton({ progress, label, name, onPress, danger, disabled, compact }: { progress?: SharedValue<number>; label: string; name: string; onPress(): void; danger?: boolean; disabled?: boolean; compact?: boolean }) {
  const { themeMode } = useLiquidGlass();
  const dark = themeMode === 'dark';
  const motion = useAnimatedStyle(() => {
    const value = progress ? Math.max(0, Math.min(1, (progress.get() - 0.08) / 0.92)) : 1;
    return { opacity: value, transform: [{ scale: 0.8 + value * 0.2 }] };
  });
  const color = danger || dark ? '#FFFFFF' : '#18181B';
  return <Animated.View style={motion}><Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label} ${name}`} accessibilityState={{ disabled }} onPress={onPress} style={[styles.button, compact && styles.compactButton, { backgroundColor: danger ? ACTION_COLORS.danger : dark ? '#1C1C22' : '#E5E5EA' }]}>
    {danger ? <TrashBinTrashIcon size={16} color={color} /> : <Pen2Icon size={16} color={color} />}{compact ? null : <Text style={[styles.label, { color }]}>{label}</Text>}
  </Pressable></Animated.View>;
}

export function ItemActionReveal({ children, name, onEdit, onDelete, disabled = false, style, borderRadius = 20, buttons = true, compact = false }: {
  children: React.ReactNode; name: string; onEdit?: () => void; onDelete?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; borderRadius?: number; buttons?: boolean; compact?: boolean;
}) {
  const { transactionActionStyle } = useLiquidGlass();
  const swipeable = useRef<SwipeableMethods>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  useEffect(() => {
    const row = swipeable.current;
    return () => { if (openItem === row) openItem = null; pendingAction.current = null; };
  }, [transactionActionStyle]);
  const request = useCallback((action?: () => void) => {
    if (disabled || !action) return;
    if (!swipeable.current) { action(); return; }
    pendingAction.current = action;
    swipeable.current.close();
  }, [disabled]);
  const finishClose = useCallback(() => {
    if (openItem === swipeable.current) openItem = null;
    const action = pendingAction.current; pendingAction.current = null; action?.();
  }, []);
  const renderActions = useCallback((progress: SharedValue<number>) => <View style={[styles.actions, compact && styles.compactActions, { width: compact ? (onEdit && onDelete ? 104 : 60) : onEdit && onDelete ? 180 : 108 }]}>
    {onEdit ? <RevealedButton progress={progress} label="Edit" name={name} disabled={disabled} compact={compact} onPress={() => request(onEdit)} /> : null}
    {onDelete ? <RevealedButton progress={progress} label="Delete" name={name} danger disabled={disabled} compact={compact} onPress={() => request(onDelete)} /> : null}
  </View>, [compact, disabled, name, onDelete, onEdit, request]);
  const open = () => { pendingAction.current = null; if (openItem !== swipeable.current) openItem?.close(); openItem = swipeable.current; };
  if (!onEdit && !onDelete) return <View style={style}>{children}</View>;
  if (transactionActionStyle === 'buttons') return <View style={style}>{children}{buttons ? <View style={styles.inlineActions}>
    {onEdit ? <RevealedButton label="Edit" name={name} disabled={disabled} onPress={onEdit} /> : null}
    {onDelete ? <RevealedButton label="Delete" name={name} danger disabled={disabled} onPress={onDelete} /> : null}
  </View> : null}</View>;
  return <View style={style}><ReanimatedSwipeable ref={swipeable} enabled={!disabled} friction={1} leftThreshold={compact ? 24 : 42} rightThreshold={compact ? 24 : 42} overshootLeft={false} overshootRight={false}
    dragOffsetFromLeft={10} dragOffsetFromRight={-10} animationOptions={SPRING} renderLeftActions={renderActions} renderRightActions={renderActions}
    onSwipeableOpenStartDrag={open} onSwipeableWillOpen={open} onSwipeableClose={finishClose} containerStyle={{ borderRadius, borderWidth: 0 }}>
    {children}
  </ReanimatedSwipeable></View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, gap: 12 },
  button: { width: 66, height: 36, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 0 },
  compactButton: { width: 32, height: 30, borderRadius: 10 },
  compactActions: { paddingHorizontal: 14 },
  label: { fontSize: 11, fontWeight: '600' },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
});
