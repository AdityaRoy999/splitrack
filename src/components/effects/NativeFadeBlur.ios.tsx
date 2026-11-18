import React, { useMemo } from 'react';
import { processColor, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { NativeGradualBlurView } from '../../../modules/gradual-blur';
import type { NativeFadeBlurProps } from './fadeBlurTypes';

const AnimatedNativeBlur = NativeGradualBlurView ? Animated.createAnimatedComponent(NativeGradualBlurView) : null;

export const NativeFadeBlur = ({ position, renderMode, stack, falloff, locations, opacity, reveal, dark, tint }: NativeFadeBlurProps) => {
  const washColor = useMemo(() => {
    const color = processColor(tint);
    const value = typeof color === 'number' ? color >>> 0 : 0;
    const hex = value.toString(16).padStart(8, '0');
    return '#' + hex.slice(2) + hex.slice(0, 2);
  }, [tint]);
  const animatedProps = useAnimatedProps(() => ({ reveal: reveal.value }));

  // Local native views are available in the IPA/development build. A colour
  // gradient in Expo Go is not a blur, so do not substitute a painted strip.
  if (!AnimatedNativeBlur) return null;
  return (
    <AnimatedNativeBlur
      pointerEvents="none" position={position} renderMode={renderMode} stack={stack}
      falloff={falloff} locations={locations} opacity={opacity} dark={dark}
      washColor={washColor} animatedProps={animatedProps} style={StyleSheet.absoluteFill}
    />
  );
};
