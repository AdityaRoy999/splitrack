import React, { useMemo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

export type GradualBlurPosition = 'top' | 'bottom' | 'left' | 'right';
export type GradualBlurCurve = 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';

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
  style?: StyleProp<ViewStyle>;
}

const CSS_DIRECTIONS: Record<GradualBlurPosition, string> = {
  top: 'to top',
  bottom: 'to bottom',
  left: 'to left',
  right: 'to right',
};

const GRADIENT_AXIS: Record<
  GradualBlurPosition,
  { start: { x: number; y: number }; end: { x: number; y: number } }
> = {
  top: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  bottom: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  left: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
  right: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
};

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

function toRgbaWithAlpha(color: string, alphaFactor: number): string {
  if (!color || color === 'transparent') {
    return `rgba(0, 0, 0, ${clamp01(alphaFactor).toFixed(3)})`;
  }
  const rgbaMatch = color.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbaMatch) {
    const [, r, g, b, baseA] = rgbaMatch;
    const finalAlpha = clamp01((baseA !== undefined ? Number(baseA) : 1) * alphaFactor);
    return `rgba(${r}, ${g}, ${b}, ${finalAlpha.toFixed(3)})`;
  }
  const hexMatch = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamp01(alphaFactor).toFixed(3)})`;
  }
  return color;
}

/**
 * React-Bits inspired GradualBlur:
 * Progressive multi-layer CSS backdrop-filter masks on Web
 * and layered BlurView + LinearGradient on iOS/Android.
 */
export const GradualBlur: React.FC<GradualBlurProps> = React.memo(({
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
  style,
}) => {
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const vertical = position === 'top' || position === 'bottom';
  const depth = vertical ? height : (width ?? 28);

  const webContinuousBlur = useMemo(() => {
    if (Platform.OS !== 'web') return null;

    const blurPx = Math.max(12, Math.round(strength * 20));
    const direction = CSS_DIRECTIONS[position];
    const mask = `linear-gradient(${direction}, #000 0%, rgba(0,0,0,0.88) 25%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.25) 75%, transparent 100%)`;

    const filter = `blur(${blurPx}px)${saturation !== 1 ? ` saturate(${saturation})` : ''}`;

    const blurLayer: ViewStyle = {
      position: 'absolute' as const,
      inset: 0,
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      maskImage: mask,
      WebkitMaskImage: mask,
      opacity,
    } as any;

    const washLayer: ViewStyle | null =
      tint && tint !== 'transparent'
        ? ({
            position: 'absolute' as const,
            inset: 0,
            background: `linear-gradient(${direction}, ${tint} 0%, ${toRgbaWithAlpha(tint, 0.7)} 35%, ${toRgbaWithAlpha(tint, 0.3)} 70%, transparent 100%)`,
          } as any)
        : null;

    return { blurLayer, washLayer };
  }, [opacity, position, saturation, strength, tint]);

  const nativeGradient = useMemo(() => {
    if (Platform.OS === 'web') return null;
    const baseColor = tint && tint !== 'transparent' ? tint : isDark ? '#000000' : '#FFFFFF';
    const stops = [1, 0.9, 0.7, 0.45, 0.22, 0.08, 0];
    const colors = stops.map((alpha) => toRgbaWithAlpha(baseColor, alpha * opacity)) as [
      string,
      string,
      ...string[],
    ];
    return { colors, axis: GRADIENT_AXIS[position] };
  }, [isDark, opacity, position, tint]);

  const edgePositionStyle: ViewStyle = {
    position: 'absolute',
    zIndex,
    top: position === 'bottom' ? undefined : 0,
    bottom: position === 'top' ? undefined : 0,
    left: position === 'right' ? undefined : 0,
    right: position === 'left' ? undefined : 0,
    height: vertical ? depth : undefined,
    width: vertical ? undefined : depth,
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  if (Platform.OS === 'web' && webContinuousBlur) {
    return (
      <View pointerEvents="none" style={[edgePositionStyle, style]}>
        <View style={webContinuousBlur.blurLayer} />
        {webContinuousBlur.washLayer ? <View style={webContinuousBlur.washLayer} /> : null}
      </View>
    );
  }

  const nativeBlurIntensity = Math.min(95, Math.max(40, Math.round(strength * 45)));

  return (
    <View pointerEvents="none" style={[edgePositionStyle, style]}>
      {/* Single seamless Gaussian BlurView with ZERO stepped slice lines */}
      <BlurView
        intensity={nativeBlurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {nativeGradient && (
        <LinearGradient
          colors={nativeGradient.colors}
          start={nativeGradient.axis.start}
          end={nativeGradient.axis.end}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
});

GradualBlur.displayName = 'GradualBlur';

export default GradualBlur;
