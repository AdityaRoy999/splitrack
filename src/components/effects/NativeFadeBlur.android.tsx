import React, { useMemo } from 'react';
import { PixelRatio, Platform, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import type { NativeFadeBlurProps } from './fadeBlurTypes';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Adapted from rit3zh/expo-progressive-blur, app/index.tsx (f1f32e8).
// One live BlurView sits behind an eased alpha mask. SDK 58 requires a
// BlurTargetView ref and blurMethod on Android; the demo's black wash is omitted.
export const NativeFadeBlur = React.memo(function NativeFadeBlur({ stack, falloff, locations, axis, reveal, dark, blurTarget }: NativeFadeBlurProps) {
  const colors = useMemo<LinearGradientProps['colors']>(() => {
    const color = (alpha: number) => `rgba(0, 0, 0, ${alpha})`;
    return [color(falloff[0] ?? 0), color(falloff[1] ?? 1), ...falloff.slice(2).map(color)];
  }, [falloff]);
  const radius = stack[stack.length - 1]?.level ?? 0;
  // Keep Expo's material tint subtle while preserving the requested pixel
  // radius through its documented Android reduction factor.
  const intensity = Math.min(25, Math.max(1, radius * 2));
  const reduction = intensity / Math.max(0.5, radius * PixelRatio.get());
  const animatedProps = useAnimatedProps(() => ({ intensity: intensity * Math.min(1, Math.max(0, reveal.value)) }));
  const animatedStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, reveal.value)) }));

  if (Number(Platform.Version) < 31 || !blurTarget || radius <= 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
      <MaskedView
        pointerEvents="none"
        androidRenderingMode="hardware"
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            pointerEvents="none" colors={colors} locations={locations}
            start={axis.start} end={axis.end} dither style={StyleSheet.absoluteFill}
          />
        }
      >
        <AnimatedBlurView
          pointerEvents="none" blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus" blurReductionFactor={reduction}
          intensity={intensity} animatedProps={animatedProps}
          tint={dark ? 'systemUltraThinMaterialDark' : 'extraLight'}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
    </Animated.View>
  );
});
