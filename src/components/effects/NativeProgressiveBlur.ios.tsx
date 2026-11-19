import React, { memo, useMemo } from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import { ProgressiveBlurView } from '@sbaiahmed1/react-native-blur';
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import type { NativeProgressiveBlurProps } from './progressiveNativeTypes';

const AnimatedProgressiveBlurView = Animated.createAnimatedComponent(ProgressiveBlurView);

const AXIS = {
  top: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  bottom: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  left: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
  right: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
};

// The library replaces UIKit's backdrop filter with its variable-radius filter.
// Its iOS implementation uses private Core Animation API; see PROGRESSIVE_BLUR.md.
export const NativeProgressiveBlur = memo(function NativeProgressiveBlur({
  position, intensity, startOffset, reveal, tint, dark,
}: NativeProgressiveBlurProps) {
  const radius = Number.isFinite(intensity) ? Math.max(0, Math.min(100, intensity)) * 0.5 : 0;
  const offset = Number.isFinite(startOffset) ? Math.max(0, Math.min(1, startOffset)) : 0;
  const animatedProps = useAnimatedProps(() => ({
    blurAmount: radius * Math.max(0, Math.min(1, reveal.value)),
  }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, reveal.value)) }));
  const tintColors = useMemo<LinearGradientProps['colors'] | null>(() => {
    const color = processColor(tint);
    if (typeof color !== 'number') return null;
    const alpha = Math.min((color >>> 24) / 255, dark ? 0.12 : 0.1);
    if (alpha <= 0) return null;
    const red = color >>> 16 & 255;
    const green = color >>> 8 & 255;
    const blue = color & 255;
    const colors = Array.from({ length: 9 }, (_, index) => {
      const progress = index / 8;
      return `rgba(${red}, ${green}, ${blue}, ${alpha * progress * progress * progress})`;
    });
    return [colors[0], colors[1], ...colors.slice(2)];
  }, [dark, tint]);
  // The versioned native-library patch adds horizontal masks without rotating
  // UIKit's backdrop. Rotation inside a clipped, animated sheet broke sampling.
  const direction = {
    top: 'blurredTopClearBottom', bottom: 'blurredBottomClearTop',
    left: 'blurredLeftClearRight', right: 'blurredRightClearLeft',
  } as const;

  return (
    <View pointerEvents="none" accessibilityElementsHidden style={styles.container}>
      <AnimatedProgressiveBlurView
        pointerEvents="none" blurType={dark ? 'dark' : 'light'}
        blurAmount={radius} startOffset={offset} direction={direction[position]}
        reducedTransparencyFallbackColor="transparent"
        animatedProps={animatedProps} style={StyleSheet.absoluteFill}
      />
      {tintColors ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, tintStyle]}>
          <LinearGradient
            pointerEvents="none" colors={tintColors}
            locations={[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]}
            start={AXIS[position].start} end={AXIS[position].end} style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' },
});
