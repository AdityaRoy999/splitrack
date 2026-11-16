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
 * Continuous Gaussian Blur:
 * Renders a true continuous Gaussian blur with smooth alpha masking.
 * No stepped slices or multi-layer banding artifacts.
 */
export const GradualBlur: React.FC<GradualBlurProps> = React.memo(({
  position = 'bottom',
  height = 36,
  width,
  strength = 1.6,
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

  const blurRadiusPx = Math.max(16, Math.min(48, Math.round(strength * 18)));
  const nativeIntensity = Math.max(20, Math.min(90, Math.round(strength * 30)));

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
  };

  const gradientAxis = GRADIENT_AXIS[position];

  // Native iOS / Android: Single continuous BlurView with smooth LinearGradient fade
  const fadeColors = useMemo(() => {
    const baseColor = tint && tint !== 'transparent' ? tint : (isDark ? '#000000' : '#FFFFFF');
    return [
      toRgbaWithAlpha(baseColor, 0),
      toRgbaWithAlpha(baseColor, 0.15 * opacity),
      toRgbaWithAlpha(baseColor, 0.55 * opacity),
      toRgbaWithAlpha(baseColor, 0.88 * opacity),
    ] as [string, string, string, string];
  }, [tint, isDark, opacity]);

  if (Platform.OS === 'web') {
    const direction = CSS_DIRECTIONS[position];
    const mask = `linear-gradient(${direction}, transparent 0%, rgba(0, 0, 0, 0.4) 30%, #000000 100%)`;
    const filter = saturation > 1
      ? `blur(${blurRadiusPx}px) saturate(${saturation.toFixed(2)})`
      : `blur(${blurRadiusPx}px)`;

    return (
      <View pointerEvents="none" style={[edgePositionStyle, style]}>
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backdropFilter: filter,
            WebkitBackdropFilter: filter,
            maskImage: mask,
            WebkitMaskImage: mask,
            opacity,
          } as unknown as ViewStyle}
        />
        {tint && tint !== 'transparent' ? (
          <View
            style={{
              position: 'absolute',
              inset: 0,
              background: tint,
              maskImage: mask,
              WebkitMaskImage: mask,
              opacity,
            } as unknown as ViewStyle}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[edgePositionStyle, style]}>
      <BlurView
        intensity={nativeIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { opacity }]}
      />
      <LinearGradient
        colors={fadeColors}
        start={gradientAxis.start}
        end={gradientAxis.end}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

GradualBlur.displayName = 'GradualBlur';

export default GradualBlur;
