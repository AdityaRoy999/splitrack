import React from 'react';
import { Text, View } from 'react-native';
import { AppleGlassPressable } from './AppleGlassPressable';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { ACTION_COLORS } from '../../theme/actionColors';
import type { AppleGlassButtonProps } from './AppleGlassButton';

export function AppleGlassButton({ label, icon, onPress, disabled, active, variant, size, shape, style, textStyle, accessibilityLabel }: AppleGlassButtonProps) {
  const { themeMode } = useLiquidGlass();
  const color = variant === 'danger' ? ACTION_COLORS.danger : variant === 'success' ? ACTION_COLORS.success : themeMode === 'dark' ? '#F4F4F5' : '#18181B';
  return <AppleGlassPressable onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel ?? label}
    selected={active} borderRadius={shape === 'pill' ? 999 : 14}
    style={[size === 'lg' ? { width: '100%', alignSelf: 'stretch' } : undefined, style]}
    contentStyle={{ height: size === 'lg' ? 48 : 36, paddingHorizontal: icon && !label ? 0 : size === 'lg' ? 22 : 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    {icon ? <View pointerEvents="none" style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>{React.isValidElement<{ color?: string }>(icon) && 'color' in icon.props ? React.cloneElement(icon, { color }) : icon}</View> : null}
    {label ? <Text numberOfLines={1} style={[{ color, fontSize: 13, fontWeight: '500', flexShrink: 1, minWidth: 0 }, textStyle, { color }]}>{label}</Text> : null}
  </AppleGlassPressable>;
}
