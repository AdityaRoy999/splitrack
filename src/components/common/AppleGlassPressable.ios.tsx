import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, HStack, Host } from '@expo/ui/swift-ui';
import { accessibilityLabel as nativeLabel, buttonStyle, contentShape, disabled as nativeDisabled, frame, glassEffect, onLongPressGesture, shapes } from '@expo/ui/swift-ui/modifiers';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from '../glass/GlassSurface';
import type { AppleGlassPressableProps } from './AppleGlassPressable';
import { ACTION_COLORS } from '../../theme/actionColors';
import { GlassPanel } from '../glass/GlassPanel';

// Render the RN label once in Yoga. SwiftUI owns only the button's material
// and hit area, avoiding a second label tree and nested native layout passes.
export function AppleGlassPressable({ children, onPress, onLongPress, disabled = false, style, contentStyle, accessibilityLabel, borderRadius, selected }: AppleGlassPressableProps) {
  const { themeMode } = useLiquidGlass();
  const layout = StyleSheet.flatten(style) ?? {};
  const originalContent = StyleSheet.flatten(contentStyle) ?? {};
  const content = { ...originalContent, ...(typeof layout.height === 'number' ? { height: layout.height } : {}) };
  const proposedRadius = borderRadius ?? content.borderRadius ?? layout.borderRadius ?? 14;
  const radius = typeof proposedRadius === 'number' ? proposedRadius : 14;
  const [bounds, setBounds] = useState({ width: typeof layout.width === 'number' ? layout.width : 0, height: typeof layout.height === 'number' ? layout.height : typeof content.height === 'number' ? content.height : 36 });
  const neutralStyle = { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 };
  const foreground = originalContent.backgroundColor === ACTION_COLORS.danger ? ACTION_COLORS.danger
    : originalContent.backgroundColor === ACTION_COLORS.success ? ACTION_COLORS.success
    : themeMode === 'dark' ? '#F4F4F5' : '#18181B';
  const adaptLabel = (nodes: React.ReactNode): React.ReactNode => React.Children.map(nodes, child => {
    if (!React.isValidElement<{ style?: any; children?: React.ReactNode; color?: string }>(child)) return child;
    if (child.type === GlassSurface || child.type === GlassPanel) return <View style={[child.props.style, neutralStyle]}>{adaptLabel(child.props.children)}</View>;
    if (child.type === Text) {
      const color = StyleSheet.flatten(child.props.style)?.color;
      return React.cloneElement(child, { style: [child.props.style, !color || ['#FFFFFF', '#ffffff', '#000000', '#F4F4F5', '#18181B', '#fff', '#FFF', '#09090B', '#111114'].includes(String(color)) ? { color: foreground } : undefined] });
    }
    if (child.props.color && ['#FFFFFF', '#ffffff', '#000000', '#F4F4F5', '#18181B', '#fff', '#09090B'].includes(child.props.color)) return React.cloneElement(child, { color: foreground });
    return child.props.children ? React.cloneElement(child, {}, adaptLabel(child.props.children)) : child;
  });
  // The native button owns the material of an existing glass icon action.
  const labelContent = adaptLabel(children);
  const labelText = (nodes: React.ReactNode): string => React.Children.toArray(nodes).map(child =>
    typeof child === 'string' || typeof child === 'number' ? String(child)
      : React.isValidElement<{ children?: React.ReactNode }>(child) ? labelText(child.props.children) : '').filter(Boolean).join(' ');
  const accessibleName = accessibilityLabel ?? labelText(children);
  return <View style={[style, neutralStyle]}>
    {bounds.width > 0 ? <Host colorScheme={themeMode} ignoreSafeArea="all" alignment="center" style={StyleSheet.absoluteFill}>
      <Button onPress={() => { if (!disabled) onPress(); }} modifiers={[
        buttonStyle('plain'), nativeDisabled(disabled),
        ...(accessibleName ? [nativeLabel(accessibleName)] : []),
        ...(onLongPress ? [onLongPressGesture(() => { if (!disabled) onLongPress(); }, 0.35)] : []),
      ]}>
        <HStack modifiers={[frame({ width: bounds.width, height: bounds.height }),
          glassEffect({ glass: { variant: 'regular', interactive: false }, shape: radius >= 100 ? 'capsule' : 'roundedRectangle', cornerRadius: radius }),
          contentShape(shapes.roundedRectangle({ cornerRadius: radius }))]}>{null}</HStack>
      </Button>
    </Host> : null}
    {selected ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} /> : null}
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[content, neutralStyle, { opacity: disabled ? 0.6 : 1, alignSelf: 'stretch' }]}
      onLayout={({ nativeEvent: { layout: measured } }) => {
        if (measured.width > 0 && measured.height > 0) setBounds(previous => Math.abs(previous.width - measured.width) < 0.5 && Math.abs(previous.height - measured.height) < 0.5 ? previous : { width: measured.width, height: measured.height });
      }}>{labelContent}</View>
  </View>;
}
