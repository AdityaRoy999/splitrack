import React from 'react';
import { processColor, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { NativeProgressiveBlurProps } from './progressiveNativeTypes';

const AXIS = {
  top: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  bottom: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  left: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  right: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
};

// A frosted edge approximation: one static gradient and a compositor opacity
// reveal. No backdrop snapshots, CPU blur buffers, or native RenderEffects.
export const NativeProgressiveBlur = React.memo(function NativeProgressiveBlur({ position, intensity, startOffset, reveal, tint, dark }: NativeProgressiveBlurProps) {
  const fallback = dark ? '#09090B' : '#F4F4F8';
  const parsed = processColor(tint);
  const color = typeof parsed === 'number' && (parsed >>> 24) > 0 ? parsed : processColor(fallback) as number;
  const rgb = `${color >>> 16 & 255},${color >>> 8 & 255},${color & 255}`;
  const alpha = Math.min(0.96, Math.max(0, intensity / 35));
  const offset = Math.min(0.9, Math.max(0, startOffset));
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = Math.min(1, Math.max(0, reveal.value));
    return { opacity, display: opacity > 0 ? 'flex' : 'none' };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
      <LinearGradient pointerEvents="none" dither={false}
        colors={[`rgba(${rgb},${alpha})`, `rgba(${rgb},${alpha * 0.55})`, `rgba(${rgb},0)`]}
        locations={[0, offset + (1 - offset) * 0.45, 1]}
        start={AXIS[position].start} end={AXIS[position].end} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});
