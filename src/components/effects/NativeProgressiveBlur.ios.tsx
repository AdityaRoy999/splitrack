import React, { memo, useCallback, useMemo, useState } from 'react';
import { processColor, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const horizontal = position === 'left' || position === 'right';
  const radius = Number.isFinite(intensity) ? Math.max(0, Math.min(100, intensity)) * 0.5 : 0;
  const offset = Number.isFinite(startOffset) ? Math.max(0, Math.min(1, startOffset)) : 0;
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setSize(previous => previous.width === layout.width && previous.height === layout.height
      ? previous : { width: layout.width, height: layout.height });
  }, []);
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
  // A clockwise quarter turn maps the native vertical coordinate to horizontal.
  // Center a width/height-swapped view so its transformed bounds fill this edge.
  // UIKit keeps sampling the live backdrop beneath that transformed view.
  const blurStyle: ViewStyle = horizontal ? {
    position: 'absolute', width: size.height, height: size.width,
    left: (size.width - size.height) / 2, top: (size.height - size.width) / 2,
    transform: [{ rotate: '90deg' }],
  } : { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 };
  const direction = position === 'bottom' || position === 'left'
    ? 'blurredBottomClearTop' : 'blurredTopClearBottom';

  return (
    <View pointerEvents="none" accessibilityElementsHidden style={styles.container} onLayout={onLayout}>
      {!horizontal || size.width > 0 && size.height > 0 ? (
        <AnimatedProgressiveBlurView
          pointerEvents="none" blurType={dark ? 'dark' : 'light'}
          blurAmount={0} startOffset={offset} direction={direction}
          reducedTransparencyFallbackColor="transparent"
          animatedProps={animatedProps} style={blurStyle}
        />
      ) : null}
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
