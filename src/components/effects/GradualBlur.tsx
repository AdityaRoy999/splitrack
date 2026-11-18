import React, { useEffect, useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { NativeFadeBlur } from './NativeFadeBlur';
import { createBlurStack, createBlurTintFalloff } from './blurFalloff';
import type { GradualBlurProps } from './gradualBlurTypes';
import { useSceneActive } from '../common/SceneActivityContext';

export type { GradualBlurProps, GradualBlurPosition } from './gradualBlurTypes';
export type { GradualBlurCurve } from './blurFalloff';

const GRADIENT_AXIS = {
  top: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  bottom: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  left: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
  right: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
};

// Metro uses GradualBlur.web.tsx for the original browser component. Native
// views use the same stack and put each mask directly on its blur surface.
export const GradualBlur = React.memo(function GradualBlur({
  position = 'bottom', height = 48, width, strength = 1.6, layers = 8,
  curve = 'bezier', exponential = true, opacity = 1, tint = 'transparent',
  zIndex = 20, active = true, blurTarget, style,
}: GradualBlurProps) {
  const { themeMode } = useLiquidGlass();
  const sceneActive = useSceneActive();
  const enabled = active && sceneActive;
  const reveal = useSharedValue(enabled ? 1 : 0);
  useEffect(() => {
    reveal.value = withTiming(enabled ? 1 : 0, {
      duration: 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    });
  }, [enabled, reveal]);
  const vertical = position === 'top' || position === 'bottom';
  const depth = vertical ? height : (width ?? 24);
  const alpha = Math.min(1, Math.max(0, opacity));
  const stack = useMemo(() => createBlurStack(layers, curve, strength, exponential), [curve, exponential, layers, strength]);
  const falloff = useMemo(() => createBlurTintFalloff(curve), [curve]);
  const locations = useMemo(() => falloff.map(stop => stop.position) as [number, number, ...number[]], [falloff]);
  const alphas = useMemo(() => falloff.map(stop => stop.alpha * alpha), [alpha, falloff]);
  const edgeStyle: ViewStyle = {
    position: 'absolute', zIndex,
    top: position === 'bottom' ? undefined : 0,
    bottom: position === 'top' ? undefined : 0,
    left: position === 'right' ? undefined : 0,
    right: position === 'left' ? undefined : 0,
    height: vertical ? depth : undefined,
    width: vertical ? undefined : depth,
    overflow: 'hidden',
  };

  if (depth <= 0 || strength <= 0 || alpha <= 0) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[edgeStyle, style]}>
      <NativeFadeBlur
        position={position} stack={stack} falloff={alphas} locations={locations}
        axis={GRADIENT_AXIS[position]} opacity={alpha} reveal={reveal}
        dark={themeMode === 'dark'} tint={tint} blurTarget={blurTarget}
      />
    </View>
  );
});

export default GradualBlur;
