import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import type { AuroraProps } from './Aurora';

// Android keeps the palette without allocating a GL context, shader textures,
// visibility measurements, or a continuous animation loop for every card.
export const Aurora = memo(function Aurora({
  style, colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  direction = 'top', opacity = 1, lightMode = false,
}: AuroraProps) {
  const stops = colorStops.filter(Boolean).slice(0, 4);
  const colors: LinearGradientProps['colors'] = stops.length >= 2
    ? [stops[0], stops[1], ...stops.slice(2)]
    : [stops[0] || '#5227FF', stops[0] || '#5227FF'];
  const bottom = direction === 'bottom';
  const alpha = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
  const base = lightMode ? '255,255,255' : '17,17,20';
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.container, { opacity: alpha }, style]}>
      <LinearGradient pointerEvents="none" colors={colors} dither={false}
        start={{ x: 0, y: bottom ? 0 : 1 }} end={{ x: 1, y: bottom ? 1 : 0 }}
        style={[StyleSheet.absoluteFill, { opacity: lightMode ? 0.38 : 0.62 }]} />
      <LinearGradient pointerEvents="none" dither={false}
        colors={[`rgba(${base},0.98)`, `rgba(${base},0.48)`, `rgba(${base},0)`]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: bottom ? 0 : 1 }} end={{ x: 0.5, y: bottom ? 1 : 0 }}
        style={StyleSheet.absoluteFill} />
    </View>
  );
});

export default Aurora;

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' },
});
