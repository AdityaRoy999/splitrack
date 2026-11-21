import React from 'react';
import { StyleSheet } from 'react-native';
import { ProgressiveBlurView } from 'expo-backdrop';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { NativeProgressiveBlurProps } from './progressiveNativeTypes';

const AnimatedProgressiveBlur = Animated.createAnimatedComponent(ProgressiveBlurView);

export const NativeProgressiveBlur = React.memo(function NativeProgressiveBlur({ position, intensity, startOffset, reveal, tint }: NativeProgressiveBlurProps) {
  // Keep the blur radius fixed during the reveal. Changing intensity each frame
  // rebuilds eight native RenderEffects (or CPU blur buffers on older Android).
  // Fade only the finished backdrop and stop native capture once fully hidden.
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = Math.min(1, Math.max(0, reveal.value));
    return { opacity, display: opacity > 0 ? 'flex' : 'none' };
  });
  return (
    <AnimatedProgressiveBlur
      edge={position} intensity={intensity}
      startOffset={startOffset} tint="systemUltraThinMaterialDark"
      tintColor={tint} scrollFallback={false} fallbackColor="transparent"
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, animatedStyle]}
    />
  );
});
