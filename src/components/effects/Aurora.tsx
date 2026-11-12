import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { AuroraMesh } from './AuroraMesh';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const MAX_STOPS = 5;

export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  height?: number;
  speed?: number;
  glow?: number;
  scale?: number;
  brightness?: number;
  layers?: number;
  direction?: 'top' | 'bottom';
  mouseInteraction?: boolean;
  intro?: boolean;
  opacity?: number;
  lightMode?: boolean;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseHexRgb = (hex: string): [number, number, number] => {
  const clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r / 255, g / 255, b / 255];
  }
  const full = clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return [r / 255, g / 255, b / 255];
};

const toOklch = (rgb: [number, number, number]): [number, number, number] => {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
};

const unwrapHues = (stops: [number, number, number][]): [number, number, number][] => {
  const known = stops.findIndex((s) => s[1] > 0.02);
  const anchor = known === -1 ? 0 : stops[known][2];
  let prev = anchor;
  return stops.map((s) => {
    let hue = s[1] > 0.02 ? s[2] : prev;
    while (hue - prev > Math.PI) hue -= Math.PI * 2;
    while (hue - prev < -Math.PI) hue += Math.PI * 2;
    prev = hue;
    return [s[0], s[1], hue];
  });
};

const oklchToHex = (L: number, C: number, h: number): string => {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toSrgbChannel = (c: number) => {
    const clamped = clamp(c, 0, 1);
    const val = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(clamp(val, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${toSrgbChannel(linR)}${toSrgbChannel(linG)}${toSrgbChannel(linB)}`;
};

const sampleOklchHexes = (
  rawStops: string[],
  sampleCount: number,
  lightMode: boolean
): string[] => {
  const safe = rawStops.slice(0, MAX_STOPS);
  const normalized =
    safe.length === 0 ? ['#5227FF', '#7cff67', '#5227FF'] : safe.length === 1 ? [safe[0], safe[0]] : safe;
  const lchStops = unwrapHues(normalized.map((hex) => toOklch(parseHexRgb(hex))));
  const count = lchStops.length;

  const result: string[] = [];
  for (let s = 0; s < sampleCount; s++) {
    const t = s / Math.max(1, sampleCount - 1);
    const x = clamp(t, 0, 1) * (count - 1);
    const i = Math.min(Math.floor(x), count - 2);
    let f = x - i;
    f = f * f * (3 - 2 * f);

    const a = lchStops[i];
    const b = lchStops[i + 1];
    let L = a[0] + (b[0] - a[0]) * f;
    let C = a[1] + (b[1] - a[1]) * f;
    const h = a[2] + (b[2] - a[2]) * f;

    if (lightMode) {
      L = clamp(L, 0.58, 0.78);
      C = Math.min(0.24, C * 1.05);
    } else {
      L = clamp(L, 0.48, 0.86);
      C = Math.min(0.30, C * 1.1);
    }

    result.push(oklchToHex(L, C, h));
  }
  return result;
};

const hexWithAlpha = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
};

const GAUSSIAN_FALLOFF = [
  { offset: '0%', factor: 1.0 },
  { offset: '14%', factor: 0.92 },
  { offset: '28%', factor: 0.78 },
  { offset: '44%', factor: 0.58 },
  { offset: '60%', factor: 0.36 },
  { offset: '75%', factor: 0.18 },
  { offset: '88%', factor: 0.06 },
  { offset: '100%', factor: 0 },
];

/**
 * Hardware-accelerated SwiftUI MeshGradient on iOS 18+/26+ and Android,
 * backed by Gaussian radial diffusion on Web and legacy OS versions so every
 * Aurora card renders silky smooth with zero visible bands or contours.
 */
export const Aurora: React.FC<AuroraProps> = React.memo(({
  colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  amplitude = 1,
  blend = 0.5,
  height = 0.45,
  speed = 1,
  glow = 0.6,
  brightness = 1,
  direction = 'top',
  intro = true,
  opacity = 0.9,
  lightMode = false,
  paused = false,
  style,
}) => {
  const rawId = useId();
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, '') || 'aurora', [rawId]);
  const [boxSize, setBoxSize] = useState({ width: 340, height: 180 });

  const [driftAnim] = useState(() => new Animated.Value(0));
  const [breatheAnim] = useState(() => new Animated.Value(0));
  const [revealAnim] = useState(() => new Animated.Value(intro ? 0 : 1));

  useEffect(() => {
    if (intro) {
      revealAnim.setValue(0);
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      revealAnim.setValue(1);
    }
  }, [intro, revealAnim]);

  useEffect(() => {
    if (paused) return;
    const safeSpeed = Math.max(0.25, speed);
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, {
          toValue: 1,
          duration: 8500 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(driftAnim, {
          toValue: 0,
          duration: 8500 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 6200 / safeSpeed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 6200 / safeSpeed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    driftLoop.start();
    breatheLoop.start();
    return () => {
      driftLoop.stop();
      breatheLoop.stop();
    };
  }, [driftAnim, breatheAnim, speed, paused]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 10 && h > 10 && (Math.abs(w - boxSize.width) > 2 || Math.abs(h - boxSize.height) > 2)) {
      setBoxSize({ width: w, height: h });
    }
  };

  const strength = clamp(brightness, 0.2, 1.5);
  const clampedOpacity = clamp(opacity, 0, 1);

  const fourStops = useMemo(
    () => sampleOklchHexes(colorStops, 4, lightMode),
    [colorStops, lightMode]
  );

  // Build 4x3 cubic MeshGradient colors & organic points anchored on top or bottom
  const meshConfig = useMemo(() => {
    const [c0, c1, c2, c3] = fourStops;
    const primaryAlpha = clamp((lightMode ? 0.84 : 0.94) * strength, 0.25, 0.98);
    const midAlpha = clamp((lightMode ? 0.36 : 0.5) * strength * (0.7 + blend * 0.4), 0.12, 0.72);
    const tailAlpha = glow > 0.7 ? (lightMode ? 0.05 : 0.08) : 0;

    const strongRow = [
      hexWithAlpha(c0, primaryAlpha),
      hexWithAlpha(c1, primaryAlpha),
      hexWithAlpha(c2, primaryAlpha),
      hexWithAlpha(c3, primaryAlpha),
    ];
    const midRow = [
      hexWithAlpha(c1, midAlpha),
      hexWithAlpha(c2, midAlpha),
      hexWithAlpha(c0, midAlpha),
      hexWithAlpha(c3, midAlpha * 0.85),
    ];
    const fadeRow = [
      hexWithAlpha(c0, tailAlpha),
      hexWithAlpha(c1, tailAlpha),
      hexWithAlpha(c2, tailAlpha),
      hexWithAlpha(c3, tailAlpha),
    ];

    const reachY = clamp(0.32 + height * 0.44 + blend * 0.12, 0.35, 0.82);
    const waveTilt = clamp(amplitude * 0.08, 0.02, 0.14);

    if (direction === 'top') {
      return {
        colors: [...strongRow, ...midRow, ...fadeRow],
        points: [
          [0.0, 0.0], [0.33, 0.0], [0.67, 0.0], [1.0, 0.0],
          [0.0, clamp(reachY - waveTilt, 0.2, 0.85)],
          [0.36, clamp(reachY + waveTilt, 0.25, 0.9)],
          [0.64, clamp(reachY - waveTilt * 0.7, 0.2, 0.85)],
          [1.0, clamp(reachY + waveTilt * 0.5, 0.22, 0.88)],
          [0.0, 1.0], [0.33, 1.0], [0.67, 1.0], [1.0, 1.0],
        ],
      };
    }

    const invY = 1 - reachY;
    return {
      colors: [...fadeRow, ...midRow, ...strongRow],
      points: [
        [0.0, 0.0], [0.33, 0.0], [0.67, 0.0], [1.0, 0.0],
        [0.0, clamp(invY + waveTilt * 0.5, 0.12, 0.78)],
        [0.34, clamp(invY - waveTilt, 0.1, 0.75)],
        [0.68, clamp(invY + waveTilt, 0.14, 0.8)],
        [1.0, clamp(invY - waveTilt * 0.6, 0.12, 0.78)],
        [0.0, 1.0], [0.33, 1.0], [0.67, 1.0], [1.0, 1.0],
      ],
    };
  }, [fourStops, direction, height, blend, glow, amplitude, lightMode, strength]);

  const txDrift = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxSize.width * 0.14, 0],
  });
  const syBreathe = breatheAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.98, 1.06, 0.98],
  });

  const canUseMesh = Platform.OS === 'ios' || Platform.OS === 'android';

  // Soft anchor wash so both native and Gaussian fallback melt gently into background
  const edgeWashColors = useMemo(() => {
    const midHex = fourStops[1] || colorStops[0] || '#5227FF';
    const strongTint = hexWithAlpha(midHex, lightMode ? 0.14 : 0.2);
    const faintTint = hexWithAlpha(midHex, lightMode ? 0.04 : 0.06);
    const clear = hexWithAlpha(midHex, 0);
    return direction === 'top'
      ? ([strongTint, faintTint, clear] as const)
      : ([clear, faintTint, strongTint] as const);
  }, [colorStops, direction, fourStops, lightMode]);

  const blobAnchorY = direction === 'top' ? boxSize.height * 0.18 : boxSize.height * 0.82;

  return (
    <View onLayout={handleLayout} pointerEvents="none" style={[styles.container, style]}>
      <Animated.View style={[styles.fill, { opacity: revealAnim }]}>
        <ExpoLinearGradient
          colors={[...edgeWashColors]}
          locations={direction === 'top' ? [0, 0.55, 0.96] : [0.04, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.fill, { opacity: clampedOpacity }]}
        />

        {canUseMesh ? (
          <Animated.View
            style={[
              styles.meshOverscan,
              {
                width: boxSize.width * 1.18,
                height: boxSize.height,
                opacity: clampedOpacity,
                transform: [{ translateX: txDrift }, { scaleY: syBreathe }],
              },
            ]}
          >
            <AuroraMesh
              columns={4}
              rows={3}
              colors={meshConfig.colors}
              points={meshConfig.points}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        {/* Smooth Gaussian Radial Blobs (always shown on Web + legacy OS, and seamlessly blends on all platforms) */}
        {!canUseMesh && (
          <Animated.View
            style={[
              styles.meshOverscan,
              {
                width: boxSize.width * 1.24,
                height: boxSize.height,
                opacity: clampedOpacity,
                transform: [{ translateX: txDrift }, { scaleY: syBreathe }],
              },
              Platform.OS === 'web'
                ? ({ filter: 'blur(26px)' } as unknown as ViewStyle)
                : undefined,
            ]}
          >
            <Svg width={boxSize.width * 1.24} height={boxSize.height}>
              <Defs>
                {fourStops.map((hex, idx) => (
                  <RadialGradient
                    key={`${uid}-rg-${idx}`}
                    id={`${uid}-rg-${idx}`}
                    cx="50%"
                    cy="50%"
                    r="50%"
                  >
                    {GAUSSIAN_FALLOFF.map((step, sIdx) => (
                      <Stop
                        key={`${uid}-rg-${idx}-s-${sIdx}`}
                        offset={step.offset}
                        stopColor={hex}
                        stopOpacity={step.factor * (lightMode ? 0.65 : 0.78)}
                      />
                    ))}
                  </RadialGradient>
                ))}
              </Defs>

              {fourStops.map((_, idx) => {
                const w = boxSize.width * 1.24;
                const cx = w * (0.18 + idx * 0.22);
                const cy =
                  direction === 'top'
                    ? blobAnchorY + (idx % 2 === 0 ? -8 : 14)
                    : blobAnchorY + (idx % 2 === 0 ? 8 : -14);
                const rx = boxSize.width * (0.46 + (idx % 2) * 0.1);
                const ry = boxSize.height * (0.58 + height * 0.34);
                return (
                  <Ellipse
                    key={`${uid}-el-${idx}`}
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    fill={`url(#${uid}-rg-${idx})`}
                  />
                );
              })}
            </Svg>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
});

Aurora.displayName = 'Aurora';

export default Aurora;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  meshOverscan: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
