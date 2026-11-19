import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { NativeProgressiveBlur } from './NativeProgressiveBlur';
import type { GradualBlurProps } from './gradualBlurTypes';
import { useSceneActive } from '../common/SceneActivityContext';

export type { GradualBlurProps, GradualBlurPosition } from './gradualBlurTypes';
export type { GradualBlurCurve } from './blurFalloff';

// Platform adapters use the libraries' native backdrop implementations. The
// browser keeps the React Bits component through GradualBlur.web.tsx.
export const GradualBlur = React.memo(function GradualBlur({
  position = 'bottom', height = 48, width, strength = 1.6,
  intensity, startOffset = 0.05, opacity = 1, tint = 'transparent',
  zIndex = 20, active = true, style,
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
  const amount = Math.min(100, Math.max(0, intensity ?? strength * 55)) * Math.min(1, Math.max(0, opacity));
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

  if (depth <= 0 || amount <= 0) return null;
  return (
    <View collapsable={false} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[edgeStyle, style]}>
      <NativeProgressiveBlur
        position={position} intensity={amount} startOffset={Math.min(1, Math.max(0, startOffset))}
        reveal={reveal} dark={themeMode === 'dark'} tint={tint}
      />
    </View>
  );
});

export default GradualBlur;
