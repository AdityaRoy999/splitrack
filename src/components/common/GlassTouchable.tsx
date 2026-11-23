import React from 'react';
import { Platform, Pressable, StyleSheet, TouchableOpacity, type PressableProps, type TouchableOpacityProps, type StyleProp, type ViewStyle } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AppleGlassPressable } from './AppleGlassPressable';

export function GlassTouchable({ nativeGlass = true, ...props }: TouchableOpacityProps & { nativeGlass?: boolean }) {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  if (Platform.OS === 'ios' && isLiquidGlassEnabled && nativeGlass && props.onPress) return <AppleGlassPressable
    onPress={() => props.onPress?.({} as never)} onLongPress={props.onLongPress ? () => props.onLongPress?.({} as never) : undefined}
    disabled={props.disabled ?? false} style={outerLayout(props.style as StyleProp<ViewStyle>)} contentStyle={contentLayout(props.style as StyleProp<ViewStyle>)} accessibilityLabel={props.accessibilityLabel}>
    {props.children}
  </AppleGlassPressable>;
  return <TouchableOpacity {...props} />;
}

export function GlassPressable({ nativeGlass = true, ...props }: PressableProps & { nativeGlass?: boolean }) {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  if (Platform.OS === 'ios' && isLiquidGlassEnabled && nativeGlass && props.onPress) return <AppleGlassPressable
    onPress={() => props.onPress?.({} as never)} onLongPress={props.onLongPress ? () => props.onLongPress?.({} as never) : undefined}
    disabled={props.disabled ?? false} style={outerLayout(typeof props.style === 'function' ? props.style({ pressed: false }) : props.style)}
    contentStyle={contentLayout(typeof props.style === 'function' ? props.style({ pressed: false }) : props.style)}
    accessibilityLabel={props.accessibilityLabel} selected={props.accessibilityState?.selected === true || props.accessibilityState?.checked === true}>
    {typeof props.children === 'function' ? props.children({ pressed: false }) : props.children}
  </AppleGlassPressable>;
  return <Pressable {...props} />;
}

function outerLayout(style: StyleProp<ViewStyle> | undefined): ViewStyle {
  const { padding, paddingVertical, paddingHorizontal, paddingTop, paddingBottom, paddingLeft, paddingRight,
    gap, rowGap, columnGap, flexDirection, alignItems, justifyContent, ...outer } = StyleSheet.flatten(style) ?? {};
  return outer;
}

function contentLayout(style: StyleProp<ViewStyle> | undefined): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  return { flexDirection: flat.flexDirection, alignItems: flat.alignItems, justifyContent: flat.justifyContent,
    padding: flat.padding, paddingVertical: flat.paddingVertical, paddingHorizontal: flat.paddingHorizontal,
    paddingTop: flat.paddingTop, paddingBottom: flat.paddingBottom, paddingLeft: flat.paddingLeft, paddingRight: flat.paddingRight,
    gap: flat.gap, rowGap: flat.rowGap, columnGap: flat.columnGap, height: flat.height, minHeight: flat.minHeight, borderRadius: flat.borderRadius };
}
