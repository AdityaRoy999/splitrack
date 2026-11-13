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
  { offset: '12%', factor: 0.94 },
  { offset: '25%', factor: 0.82 },
  { offset: '40%', factor: 0.64 },
  { offset: '56%', factor: 0.42 },
  { offset: '72%', factor: 0.22 },
  { offset: '86%', factor: 0.08 },
  { offset: '100%', factor: 0 },
];

/**
 * Universal dynamic Aurora engine:
 * Renders rich, vibrant, flowing northern lights with permanent bottom grounding
 * across iOS, Android, and Web with zero gaps and silky smooth animations.
 */
export const Aurora: React.FC<AuroraProps> = React.memo(({
  colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  amplitude = 1,
  blend = 0.5,
  height = 0.55,
  speed = 1,
  glow = 0.65,
  brightness = 1,
  direction = 'bottom',
  intro = true,
  opacity = 0.9,
  lightMode = false,
  paused = false,
  style,
}) => {
  const rawId = useId();
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, '') || 'aurora', [rawId]);
  const [boxSize, setBoxSize] = useState({ width: 340, height: 180 });

  const [driftAnim1] = useState(() => new Animated.Value(0));
  const [driftAnim2] = useState(() => new Animated.Value(0));
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

    const driftLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim1, {
          toValue: 1,
          duration: 7800 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(driftAnim1, {
          toValue: 0,
          duration: 7800 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const driftLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim2, {
          toValue: 1,
          duration: 9400 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(driftAnim2, {
          toValue: 0,
          duration: 9400 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 5400 / safeSpeed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 5400 / safeSpeed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    driftLoop1.start();
    driftLoop2.start();
    breatheLoop.start();
    return () => {
      driftLoop1.stop();
      driftLoop2.stop();
      breatheLoop.stop();
    };
  }, [driftAnim1, driftAnim2, breatheAnim, speed, paused]);

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

  const isBottom = direction === 'bottom';

  // Layer 1 Horizontal Drift: spans overscan width
  const txDrift1 = driftAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxSize.width * 0.18, boxSize.width * 0.08],
  });

  // Layer 2 Horizontal Drift: counter-directional motion
  const txDrift2 = driftAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [boxSize.width * 0.06, -boxSize.width * 0.16],
  });

  // Breathing vertical expansion
  const syBreathe1 = breatheAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.94, 1.12, 0.94],
  });

  const syBreathe2 = breatheAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1.1, 0.95, 1.1],
  });

  // Foundational grounding colors across the horizon
  const horizonColors = useMemo<[string, string, ...string[]]>(() => {
    const [c0, c1, c2, c3] = fourStops;
    const aBase = lightMode ? 0.38 : 0.52 * strength;
    const aFade = 0;
    if (isBottom) {
      return [
        hexWithAlpha(c0, aFade),
        hexWithAlpha(c1, aBase * 0.4),
        hexWithAlpha(c2, aBase * 0.8),
        hexWithAlpha(c3, aBase),
      ];
    }
    return [
      hexWithAlpha(c0, aBase),
      hexWithAlpha(c1, aBase * 0.8),
      hexWithAlpha(c2, aBase * 0.4),
      hexWithAlpha(c3, aFade),
    ];
  }, [fourStops, isBottom, lightMode, strength]);

  // Dedicated permanent cross-horizon grounding wash (full card height, continuous diagonal ramp, NO hard edges)
  const baselineWashColors = useMemo<[string, string, ...string[]]>(() => {
    const [c0, c1, c2, c3] = fourStops;
    const a = lightMode ? 0.36 : 0.55 * strength;
    const aFade = 0;
    if (isBottom) {
      return [
        hexWithAlpha(c3, aFade),
        hexWithAlpha(c2, a * 0.35),
        hexWithAlpha(c1, a * 0.75),
        hexWithAlpha(c0, a),
      ];
    }
    return [
      hexWithAlpha(c0, a),
      hexWithAlpha(c1, a * 0.75),
      hexWithAlpha(c2, a * 0.35),
      hexWithAlpha(c3, aFade),
    ];
  }, [fourStops, isBottom, lightMode, strength]);

  const svgWidth = boxSize.width * 1.34;
  const svgHeight = boxSize.height;

  // Primary energy nodes anchor coordinates
  const anchorY1 = isBottom ? boxSize.height * 0.94 : boxSize.height * 0.06;
  const anchorY2 = isBottom ? boxSize.height * 0.82 : boxSize.height * 0.18;

  const ry1 = boxSize.height * (0.75 + height * 0.42);
  const ry2 = boxSize.height * (0.62 + height * 0.36);

  return (
    <View onLayout={handleLayout} pointerEvents="none" style={[styles.container, style]}>
      <Animated.View style={[styles.fill, { opacity: revealAnim }]}>
        {/* Layer 1: Ambient Horizon Linear Gradient Wash */}
        <ExpoLinearGradient
          colors={horizonColors}
          start={{ x: 0.05, y: isBottom ? 0.1 : 0 }}
          end={{ x: 0.95, y: isBottom ? 1 : 0.9 }}
          style={[styles.fill, { opacity: clampedOpacity * 0.85 }]}
        />

        {/* Layer 2: Dedicated Permanent Grounding Horizon Wash (full card height, diagonal cross-wash, NO hard edges) */}
        <ExpoLinearGradient
          colors={baselineWashColors}
          start={{ x: 0.95, y: isBottom ? 0.15 : 0 }}
          end={{ x: 0.05, y: isBottom ? 1 : 0.85 }}
          style={[styles.fill, { opacity: clampedOpacity * 0.85 }]}
        />

        {/* Layer 3: Dynamic Primary Aurora Curtain (drifting & breathing) */}
        <Animated.View
          style={[
            styles.curtainLayer,
            {
              width: svgWidth,
              height: svgHeight,
              opacity: clampedOpacity,
              transform: [{ translateX: txDrift1 }, { scaleY: syBreathe1 }],
            },
            Platform.OS === 'web' ? ({ filter: 'blur(20px)' } as unknown as ViewStyle) : undefined,
          ]}
        >
          <Svg width={svgWidth} height={svgHeight}>
            <Defs>
              {fourStops.map((hex, idx) => (
                <RadialGradient
                  key={`${uid}-rg1-${idx}`}
                  id={`${uid}-rg1-${idx}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  {GAUSSIAN_FALLOFF.map((step, sIdx) => (
                    <Stop
                      key={`${uid}-rg1-${idx}-s-${sIdx}`}
                      offset={step.offset}
                      stopColor={hex}
                      stopOpacity={step.factor * (lightMode ? 0.7 : 0.88) * strength}
                    />
                  ))}
                </RadialGradient>
              ))}
            </Defs>

            {fourStops.map((_, idx) => {
              const cx = svgWidth * (0.14 + idx * 0.24);
              const cy = isBottom
                ? anchorY1 + (idx % 2 === 0 ? 6 : -10) * amplitude
                : anchorY1 + (idx % 2 === 0 ? -6 : 10) * amplitude;
              const rx = svgWidth * (0.42 + (idx % 2) * 0.08);

              return (
                <Ellipse
                  key={`${uid}-el1-${idx}`}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry1}
                  fill={`url(#${uid}-rg1-${idx})`}
                />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Layer 4: Dynamic Secondary Aurora Shimmer (counter-motion for depth) */}
        <Animated.View
          style={[
            styles.curtainLayer,
            {
              width: svgWidth,
              height: svgHeight,
              opacity: clampedOpacity * 0.82,
              transform: [{ translateX: txDrift2 }, { scaleY: syBreathe2 }],
            },
            Platform.OS === 'web' ? ({ filter: 'blur(28px)' } as unknown as ViewStyle) : undefined,
          ]}
        >
          <Svg width={svgWidth} height={svgHeight}>
            <Defs>
              {fourStops.slice(0, 3).map((hex, idx) => (
                <RadialGradient
                  key={`${uid}-rg2-${idx}`}
                  id={`${uid}-rg2-${idx}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  {GAUSSIAN_FALLOFF.map((step, sIdx) => (
                    <Stop
                      key={`${uid}-rg2-${idx}-s-${sIdx}`}
                      offset={step.offset}
                      stopColor={hex}
                      stopOpacity={step.factor * (lightMode ? 0.58 : 0.76) * strength}
                    />
                  ))}
                </RadialGradient>
              ))}
            </Defs>

            {fourStops.slice(0, 3).map((_, idx) => {
              const cx = svgWidth * (0.24 + idx * 0.28);
              const cy = isBottom
                ? anchorY2 + (idx % 2 === 0 ? -12 : 8) * amplitude
                : anchorY2 + (idx % 2 === 0 ? 12 : -8) * amplitude;
              const rx = svgWidth * 0.38;

              return (
                <Ellipse
                  key={`${uid}-el2-${idx}`}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry2}
                  fill={`url(#${uid}-rg2-${idx})`}
                />
              );
            })}
          </Svg>
        </Animated.View>
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
  curtainLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
