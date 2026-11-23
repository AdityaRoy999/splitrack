import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from './GlassSurface';

// Existing form/card geometry stays identical in Matte mode.
export function GlassPanel({ style, children, ...props }: ViewProps) {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  if (Platform.OS !== 'ios' || !isLiquidGlassEnabled) return <View {...props} style={style}>{children}</View>;
  const radius = StyleSheet.flatten(style)?.borderRadius;
  return <View {...props} style={[style, { backgroundColor: 'transparent' }]}>
    <GlassSurface borderRadius={typeof radius === 'number' ? radius : 14} style={StyleSheet.absoluteFill} />
    {children}
  </View>;
}
