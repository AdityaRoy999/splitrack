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
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const MAX_STOPS = 5;
const MAX_LAYERS = 3;

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

const sampleOklchRamp = (
  rawStops: string[],
  sampleCount: number,
  lightMode: boolean
): { offset: string; color: string }[] => {
  const safe = rawStops.slice(0, MAX_STOPS);
  const normalized =
    safe.length === 0 ? ['#5227FF', '#7cff67', '#5227FF'] : safe.length === 1 ? [safe[0], safe[0]] : safe;
  const lchStops = unwrapHues(normalized.map((hex) => toOklch(parseHexRgb(hex))));
  const count = lchStops.length;

  const result: { offset: string; color: string }[] = [];
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
      L = clamp(L, 0.56, 0.76);
      C = Math.min(0.25, C * 1.1);
    } else {
      L = clamp(L, 0.44, 0.88);
      C = Math.min(0.32, C * 1.12);
    }

    result.push({
      offset: `${Math.round(t * 1000) / 10}%`,
      color: oklchToHex(L, C, h),
    });
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

const buildCurtainPath = (
  width: number,
  height: number,
  direction: 'top' | 'bottom',
  layer: number,
  reachRatio: number,
  amplitude: number,
  scale: number,
  points: number = 28
): string => {
  const anchorY = direction === 'top' ? -height * 0.08 : height * 1.08;
  const seed = layer * 2.37;
  const coords: { x: number; y: number }[] = [];

  for (let i = 0; i <= points; i++) {
    const u = i / points;
    const x = u * width;
    const w = (u - 0.5) * Math.PI * 2 * clamp(scale, 0.4, 2.4);
    const wave =
      Math.sin(w * 1.15 + seed) * 0.56 +
      Math.cos(w * 2.1 - seed * 1.4) * 0.28 +
      Math.sin(w * 3.3 + seed * 0.7) * 0.16;

    const span = clamp(reachRatio + wave * 0.16 * amplitude, 0.12, 1.08) * height;
    const y = direction === 'top' ? span : height - span;
    coords.push({ x, y });
  }

  let d = `M ${coords[0].x.toFixed(1)} ${anchorY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const midX = ((p0.x + p1.x) * 0.5).toFixed(1);
    const midY = ((p0.y + p1.y) * 0.5).toFixed(1);
    d += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}, ${midX} ${midY}`;
  }
  const last = coords[coords.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${anchorY.toFixed(1)} Z`;
  return d;
};

/**
 * Pure React Native OKLCH Aurora Shader Curtain component
 * Ported directly from React Bits <Aurora /> geometry & OKLCH math so iOS,
 * Android, and Web execute identical multi-layer flowing northern-lights waves.
 */
export const Aurora: React.FC<AuroraProps> = ({
  colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  amplitude = 1,
  blend = 0.5,
  height = 0.45,
  speed = 1,
  glow = 0.6,
  scale = 1,
  brightness = 1,
  layers = 1,
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
  const [pulseAnim] = useState(() => new Animated.Value(0));
  const [revealAnim] = useState(() => new Animated.Value(intro ? 0 : 1));

  useEffect(() => {
    if (intro) {
      revealAnim.setValue(0);
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 850,
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
          duration: 7500 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(driftAnim, {
          toValue: 0,
          duration: 7500 / safeSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 5600 / safeSpeed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 5600 / safeSpeed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    driftLoop.start();
    pulseLoop.start();
    return () => {
      driftLoop.stop();
      pulseLoop.stop();
    };
  }, [driftAnim, pulseAnim, speed, paused]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 10 && h > 10 && (Math.abs(w - boxSize.width) > 2 || Math.abs(h - boxSize.height) > 2)) {
      setBoxSize({ width: w, height: h });
    }
  };

  const rampStops = useMemo(
    () => sampleOklchRamp(colorStops, 9, lightMode),
    [colorStops, lightMode]
  );

  const canvasW = boxSize.width * 1.44;
  const canvasH = boxSize.height;
  const activeLayers = clamp(Math.round(layers), 1, MAX_LAYERS);
  const strength = clamp(brightness, 0.2, 1.8);

  const curtainSpecs = useMemo(() => {
    const featherOffsets = [-0.24, -0.1, 0.03, 0.16, 0.29];
    const featherAlphas = lightMode
      ? [0.34, 0.28, 0.21, 0.14, 0.07]
      : [0.38, 0.30, 0.22, 0.14, 0.08];
    const softSpan = 0.2 + blend * 0.26 + glow * 0.22;

    const layersList: {
      layerIndex: number;
      gradId: string;
      paths: { d: string; fillOpacity: number }[];
    }[] = [];

    for (let k = 0; k < activeLayers; k++) {
      const layerDecay = k === 0 ? 1 : 0.56 / k;
      const baseReach = clamp(height + k * 0.07, 0.22, 0.92);
      const paths = featherOffsets.map((offsetRatio, idx) => {
        const bandReach = clamp(baseReach + offsetRatio * softSpan, 0.14, 1.04);
        return {
          d: buildCurtainPath(
            canvasW,
            canvasH,
            direction,
            k + idx * 0.18,
            bandReach,
            amplitude,
            scale
          ),
          fillOpacity: clamp(featherAlphas[idx] * layerDecay * strength, 0.03, 0.92),
        };
      });

      layersList.push({
        layerIndex: k,
        gradId: `${uid}-curtain-${k}`,
        paths,
      });
    }
    return layersList;
  }, [activeLayers, amplitude, blend, canvasH, canvasW, direction, glow, height, lightMode, scale, strength, uid]);

  const txPrimary = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxSize.width * 0.34, -boxSize.width * 0.08],
  });
  const txSecondary = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxSize.width * 0.06, -boxSize.width * 0.36],
  });
  const syWave = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.96, 1.07, 0.96],
  });

  // Soft anchor atmospheric glow tapering transparently across the card
  const edgeWashColors = useMemo(() => {
    const midHex = rampStops[Math.floor(rampStops.length / 2)]?.color || colorStops[0] || '#5227FF';
    const strongTint = hexWithAlpha(midHex, lightMode ? 0.16 : 0.26);
    const faintTint = hexWithAlpha(midHex, lightMode ? 0.05 : 0.09);
    const clear = hexWithAlpha(midHex, 0);
    return direction === 'top'
      ? ([strongTint, faintTint, clear] as const)
      : ([clear, faintTint, strongTint] as const);
  }, [colorStops, direction, lightMode, rampStops]);

  const clampedOpacity = clamp(opacity, 0, 1);

  return (
    <View
      onLayout={handleLayout}
      pointerEvents="none"
      style={[styles.container, style]}
    >
      <Animated.View style={[styles.fill, { opacity: revealAnim }]}>
        <ExpoLinearGradient
          colors={[...edgeWashColors]}
          locations={direction === 'top' ? [0, 0.5, 0.95] : [0.05, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.fill, { opacity: clampedOpacity }]}
        />

        {curtainSpecs.map((spec) => {
          const isPrimary = spec.layerIndex % 2 === 0;
          return (
            <Animated.View
              key={spec.gradId}
              style={[
                styles.curtainCanvas,
                {
                  width: canvasW,
                  height: canvasH,
                  opacity: clampedOpacity,
                  transform: [
                    { translateX: isPrimary ? txPrimary : txSecondary },
                    { scaleY: syWave },
                  ],
                },
              ]}
            >
              <Svg
                width={canvasW}
                height={canvasH}
                viewBox={`0 0 ${canvasW} ${canvasH}`}
                preserveAspectRatio="none"
              >
                <Defs>
                  <LinearGradient id={spec.gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    {rampStops.map((stop, idx) => (
                      <Stop
                        key={`${spec.gradId}-s-${idx}`}
                        offset={stop.offset}
                        stopColor={stop.color}
                      />
                    ))}
                  </LinearGradient>
                </Defs>
                {spec.paths.map((p, idx) => (
                  <Path
                    key={`${spec.gradId}-p-${idx}`}
                    d={p.d}
                    fill={`url(#${spec.gradId})`}
                    fillOpacity={p.fillOpacity}
                  />
                ))}
              </Svg>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
};

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
  curtainCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
