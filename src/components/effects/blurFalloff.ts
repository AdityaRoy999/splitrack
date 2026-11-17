export type GradualBlurCurve = 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface GradualBlurLayer {
  from: number;
  to: number;
  radius: number;
  level: number;
}

// The curves and incremental Gaussian radii follow the React Bits source at
// src/vendor/react-bits/GradualBlur.tsx. Blurring once and fading its opacity
// does not produce the same progressive change in blur radius.
const CURVES: Record<GradualBlurCurve, (t: number) => number> = {
  linear: t => t,
  bezier: t => t * t * (3 - 2 * t),
  'ease-in': t => t * t,
  'ease-out': t => 1 - (1 - t) * (1 - t),
  'ease-in-out': t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

export function createBlurStack(layers: number, curve: GradualBlurCurve, strength: number, exponential: boolean): GradualBlurLayer[] {
  const count = Math.min(Math.max(Math.round(layers) || 1, 1), 16);
  const shape = CURVES[curve] || CURVES.linear;
  const maxBlur = Math.max(strength, 0) * 12;
  const level = (u: number) => {
    const t = shape(Math.min(1, Math.max(0, u)));
    return maxBlur * (exponential ? (Math.pow(2, 4 * t) - 1) / 15 : t);
  };
  return Array.from({ length: count }, (_, i) => {
    const from = level(i / count);
    const to = level((i + 1) / count);
    return { from: i / count, to: (i + 1) / count, radius: Math.sqrt(Math.max(to * to - from * from, 0)), level: to };
  });
}

export function createBlurTintFalloff(curve: GradualBlurCurve) {
  const shape = CURVES[curve] || CURVES.linear;
  return Array.from({ length: 9 }, (_, i) => {
    const t = shape(i / 8);
    return { position: i / 8, alpha: t * t * t * (t * (t * 6 - 15) + 10) };
  });
}
