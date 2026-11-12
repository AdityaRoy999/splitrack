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

const CURVES: Record<GradualBlurCurve, (t: number) => number> = {
  linear: (t) => t,
  bezier: (t) => t * t * (3 - 2 * t),
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

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
 * React-Bits inspired GradualBlur ported cleanly to React Native & React Native Web.
 * Renders stacked progressive CSS backdrop-filter masks on Web and layered BlurView + LinearGradient on iOS/Android.
 */
export const GradualBlur: React.FC<GradualBlurProps> = React.memo(({
  position = 'bottom',
  height = 32,
  width,
  strength = 1.6,
  layers = 6,
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
  const depth = vertical ? height : (width ?? 22);

  const webStack = useMemo(() => {
    if (Platform.OS !== 'web') return null;

    const count = Math.min(Math.max(Math.round(layers) || 1, 1), 12);
    const shape = CURVES[curve] || CURVES.bezier;
    const maxBlur = Math.max(strength, 0) * 10;
    const level = (u: number) => {
      const t = shape(clamp01(u));
      return maxBlur * (exponential ? (Math.pow(2, 4 * t) - 1) / 15 : t);
    };
    const boost = Math.pow(Math.max(saturation, 0), 1 / count);
    const direction = CSS_DIRECTIONS[position];

    const steps = Array.from({ length: count }, (_, i) => {
      const from = level(i / count);
      const to = level((i + 1) / count);
      const radius = Math.sqrt(Math.max(to * to - from * from, 0));
      const filterParts = [`blur(${radius.toFixed(2)}px)`];
      if (Math.abs(boost - 1) > 0.001) {
        filterParts.push(`saturate(${boost.toFixed(3)})`);
      }
      const filter = filterParts.join(' ');
      const mask = `linear-gradient(${direction}, transparent ${((i / count) * 100).toFixed(1)}%, #000 ${(((i + 1) / count) * 100).toFixed(1)}%)`;

      return {
        position: 'absolute' as const,
        inset: 0,
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
        maskImage: mask,
        WebkitMaskImage: mask,
        opacity,
      };
    });

    const stops = Array.from({ length: 7 }, (_, k) => {
      const u = k / 6;
      const t = shape(u);
      const alpha = t * t * t * (t * (t * 6 - 15) + 10);
      return `rgba(0, 0, 0, ${alpha.toFixed(3)}) ${(u * 100).toFixed(1)}%`;
    }).join(', ');

    const wash =
      tint && tint !== 'transparent'
        ? {
            position: 'absolute' as const,
            inset: 0,
            background: tint,
            maskImage: `linear-gradient(${direction}, ${stops})`,
            WebkitMaskImage: `linear-gradient(${direction}, ${stops})`,
          }
        : null;

    return { steps, wash };
  }, [curve, exponential, layers, opacity, position, saturation, strength, tint]);

  const nativeSlices = useMemo(() => {
    if (Platform.OS === 'web') return [];
    const bandCount = 4;
    const shape = CURVES[curve] || CURVES.bezier;
    const maxIntensity = Math.min(48, Math.max(8, strength * 14));
    return Array.from({ length: bandCount }, (_, idx) => {
      const fraction = 1 - idx / bandCount; // 1.0 -> 0.75 -> 0.5 -> 0.25
      const t = shape((idx + 1) / bandCount);
      return {
        key: idx,
        coveragePct: `${Math.round(fraction * 100)}%` as `${number}%`,
        intensity: Math.max(4, Math.round((maxIntensity / bandCount) * (0.65 + t * 0.65))),
      };
    });
  }, [curve, strength]);

  const nativeGradient = useMemo(() => {
    if (Platform.OS === 'web' || !tint || tint === 'transparent') return null;
    const shape = CURVES[curve] || CURVES.bezier;
    const stops = [0, 0.25, 0.55, 0.8, 1];
    const colors = stops.map((u) => {
      const t = shape(u);
      const smooth = t * t * t * (t * (t * 6 - 15) + 10);
      return toRgbaWithAlpha(tint, smooth * opacity);
    }) as [string, string, ...string[]];
    return { colors, axis: GRADIENT_AXIS[position] };
  }, [curve, opacity, position, tint]);

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

  if (Platform.OS === 'web' && webStack) {
    return (
      <View pointerEvents="none" style={[edgePositionStyle, style]}>
        {webStack.steps.map((layerStyle, idx) => (
          <View key={idx} style={layerStyle as unknown as ViewStyle} />
        ))}
        {webStack.wash ? <View style={webStack.wash as unknown as ViewStyle} /> : null}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[edgePositionStyle, style]}>
      {nativeSlices.map((slice) => {
        const sliceStyle: ViewStyle = {
          position: 'absolute',
          top: position === 'bottom' ? undefined : 0,
          bottom: position === 'top' ? undefined : 0,
          left: position === 'right' ? undefined : 0,
          right: position === 'left' ? undefined : 0,
          height: vertical ? slice.coveragePct : undefined,
          width: vertical ? undefined : slice.coveragePct,
          opacity,
        };
        return (
          <BlurView
            key={slice.key}
            intensity={slice.intensity}
            tint={isDark ? 'dark' : 'light'}
            style={sliceStyle}
          />
        );
      })}
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
