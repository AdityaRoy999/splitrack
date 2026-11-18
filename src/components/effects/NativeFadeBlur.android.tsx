import React, { useEffect, useState } from 'react';
import { findNodeHandle, Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { NativeGradualBlurView } from '../../../modules/gradual-blur';
import type { NativeFadeBlurProps } from './fadeBlurTypes';

const AnimatedNativeBlur = NativeGradualBlurView ? Animated.createAnimatedComponent(NativeGradualBlurView) : null;

export const NativeFadeBlur = ({ position, stack, opacity, reveal, dark, blurTarget }: NativeFadeBlurProps) => {
  const [blurTargetId, setBlurTargetId] = useState<number | null>(null);
  useEffect(() => {
    // The content's native ref is assigned at commit, before the sibling blur.
    const frame = requestAnimationFrame(() => setBlurTargetId(blurTarget?.current ? findNodeHandle(blurTarget.current) ?? null : null));
    return () => cancelAnimationFrame(frame);
  }, [blurTarget]);
  const animatedProps = useAnimatedProps(() => ({ reveal: reveal.value }));

  if (!AnimatedNativeBlur || Number(Platform.Version) < 31 || !blurTargetId) return null;
  return <AnimatedNativeBlur
    pointerEvents="none" position={position} stack={stack} opacity={opacity} dark={dark}
    blurTargetId={blurTargetId} animatedProps={animatedProps} style={StyleSheet.absoluteFill}
  />;
};
