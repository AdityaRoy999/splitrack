import React from 'react';
import { StyleSheet } from 'react-native';
import { ProgressiveBlurView } from 'expo-backdrop';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import type { NativeProgressiveBlurProps } from './progressiveNativeTypes';

const AnimatedProgressiveBlur = Animated.createAnimatedComponent(ProgressiveBlurView);

export const NativeProgressiveBlur = React.memo(function NativeProgressiveBlur({ position, intensity, startOffset, reveal, tint }: NativeProgressiveBlurProps) {
  const animatedProps = useAnimatedProps(() => ({ intensity: intensity * Math.min(1, Math.max(0, reveal.value)) }));
  // Offscreen scenes retain layout but should stop capturing the backdrop.
  const animatedStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, reveal.value)) }));
  return (
    <AnimatedProgressiveBlur
      edge={position} intensity={intensity}
      startOffset={startOffset} tint="systemUltraThinMaterialDark"
      tintColor={tint} scrollFallback={false} fallbackColor="transparent"
      animatedProps={animatedProps} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, animatedStyle]}
    />
  );
});
