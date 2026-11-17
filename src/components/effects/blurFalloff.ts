export type GradualBlurCurve = 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';

export function createBlurFalloff(layers: number, curve: GradualBlurCurve, exponential: boolean) {
  const count = Math.min(17, Math.max(3, Math.round(layers) + 1));
  const stops = Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    // Cover the outermost pixel, then fade immediately without an opaque band.
    let progress = t;
    if (curve === 'bezier') progress = t ** 3 * (t * (t * 6 - 15) + 10);
    else if (curve === 'ease-in') progress = t ** 2;
    else if (curve === 'ease-out') progress = 1 - (1 - t) ** 2;
    else if (curve === 'ease-in-out') progress = t ** 2 * (3 - 2 * t);
    const alpha = Math.max(0, 1 - progress) ** (exponential ? 1.25 : 1);
    return { position: t, alpha };
  });
  return stops;
}
