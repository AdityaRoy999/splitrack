import React, { useMemo } from 'react';
import type { BlurViewProps } from 'expo-blur';
import { Platform, type StyleProp, type ViewStyle, View } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { NativeFadeBlur } from './NativeFadeBlur';
import { createBlurFalloff, type GradualBlurCurve } from './blurFalloff';

export type GradualBlurPosition = 'top' | 'bottom' | 'left' | 'right';
export type { GradualBlurCurve } from './blurFalloff';

export interface GradualBlurProps {
  position?: GradualBlurPosition;
  height?: number;
  width?: number;
  strength?: number;
  layers?: number;
  curve?: GradualBlurCurve;
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  zIndex?: number;
  blurTarget?: BlurViewProps['blurTarget'];
  style?: StyleProp<ViewStyle>;
}

const CSS_DIRECTIONS: Record<GradualBlurPosition, string> = {
  top: 'to bottom', bottom: 'to top', left: 'to right', right: 'to left',
};
const GRADIENT_AXIS = {
  top: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  bottom: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  left: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  right: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
};

// One blurred surface per edge, with the same smooth alpha falloff on each platform.
export const GradualBlur = React.memo(function GradualBlur({
  position = 'bottom',
  height = 48,
  width,
  strength = 1.6,
  layers = 8,
  curve = 'bezier',
  exponential = true,
  opacity = 1,
  saturation = 1,
  tint = 'transparent',
  zIndex = 20,
  blurTarget,
  style,
}: GradualBlurProps) {
  const { themeMode } = useLiquidGlass();
  const vertical = position === 'top' || position === 'bottom';
  const depth = vertical ? height : (width ?? 28);
  const alpha = Math.min(1, Math.max(0, opacity));
  const falloff = useMemo(() => createBlurFalloff(layers, curve, exponential), [layers, curve, exponential]);
  const mask = useMemo(() => {
    const stops = falloff.map((stop) => `rgba(0,0,0,${stop.alpha.toFixed(4)}) ${(stop.position * 100).toFixed(2)}%`);
    return `linear-gradient(${CSS_DIRECTIONS[position]}, ${stops.join(', ')})`;
  }, [falloff, position]);
  const maskColors = useMemo(() => falloff.map((stop) => `rgba(0,0,0,${(stop.alpha * alpha).toFixed(4)})`) as [string, string, ...string[]], [alpha, falloff]);
  const locations = useMemo(() => falloff.map((stop) => stop.position) as [number, number, ...number[]], [falloff]);

  if (depth <= 0 || strength <= 0 || alpha <= 0) return null;

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
  const blurFilter = `blur(${Math.round(strength * 20)}px) saturate(${saturation})`;
  const webStyle = {
    backdropFilter: blurFilter,
    WebkitBackdropFilter: blurFilter,
    maskImage: mask,
    WebkitMaskImage: mask,
    backgroundColor: tint,
    opacity: alpha,
  } as unknown as ViewStyle;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[edgeStyle, Platform.OS === 'web' ? webStyle : undefined, style]}>
      {Platform.OS !== 'web' ? (
        <NativeFadeBlur
          position={position}
          falloff={falloff.map((stop) => stop.alpha * alpha)}
          colors={maskColors}
          locations={locations}
          axis={GRADIENT_AXIS[position]}
          intensity={Math.min(95, Math.max(1, Math.round(strength * 45)))}
          dark={themeMode === 'dark'}
          tint={tint}
          blurTarget={blurTarget}
        />
      ) : null}
    </View>
  );
});

export default GradualBlur;
