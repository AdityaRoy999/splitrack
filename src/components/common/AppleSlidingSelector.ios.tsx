import React from 'react';
import { requireNativeView } from 'expo';
import { StyleSheet, Text, View, type NativeSyntheticEvent, type ViewProps } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import type { AppleSlidingSelectorProps } from './AppleSlidingSelector';

const NativeSelection = requireNativeView<ViewProps & {
  labels: string[]; selection: number; disabled: boolean; disabledIndices: number[]; colorScheme: string;
  onSelectionChange(event: NativeSyntheticEvent<{ index: number }>): void;
}>('SplittrackControls');

export function AppleSlidingSelector({ items, value, onChange, disabled = false, dock = false, height = 36, style }: AppleSlidingSelectorProps) {
  const { themeMode } = useLiquidGlass();
  const dark = themeMode === 'dark';
  return <View style={[{ height, width: '100%' }, style]}>
    <NativeSelection style={StyleSheet.absoluteFill} labels={items.map(item => item.accessibilityLabel ?? item.label)}
      colorScheme={themeMode} selection={items.findIndex(item => item.value === value)} disabled={disabled}
      disabledIndices={items.flatMap((item, index) => item.disabled ? [index] : [])}
      onSelectionChange={({ nativeEvent: { index } }) => { if (!disabled && items[index] && !items[index].disabled) onChange(items[index].value, index); }} />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
      {items.map(item => {
        const color = item.value === value ? dark ? '#FFFFFF' : '#09090B' : dark ? '#A1A1AA' : '#64748B';
        return <View key={item.value} style={{ flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', flexDirection: dock ? 'column' : 'row', gap: dock ? 3 : 5, opacity: disabled || item.disabled ? 0.45 : 1 }}>
          {React.isValidElement<{ color?: string }>(item.icon) && 'color' in item.icon.props ? React.cloneElement(item.icon, { color }) : item.icon}
          {item.label ? <Text numberOfLines={1} style={{ color, fontSize: dock ? 10 : 12, flexShrink: 1, fontWeight: item.value === value ? '600' : '400' }}>{item.label}</Text> : null}
        </View>;
      })}
    </View>
  </View>;
}
