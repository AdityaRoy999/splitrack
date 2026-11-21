interface Rgba { r: number; g: number; b: number; a: number }

// Expo 58's Android BlurView without blurTarget/blurMethod draws these exact
// fallback colors. A plain View can render the same material without mounting a
// native blur controller and the BlurView component's target-resolution render.
export function androidBlurFallbackTint(dark: boolean, intensity: number): string {
  const alphaByte = Math.trunc(255 * intensity / 100 * (dark ? 0.69 : 0.78));
  return `rgba(${dark ? '25,25,25' : '249,249,249'},${alphaByte / 255})`;
}

function rgba(value: string): Rgba | null {
  const match = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (match) return { r: +match[1], g: +match[2], b: +match[3], a: match[4] === undefined ? 1 : +match[4] };
  const hex = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!hex) return null;
  const rgb = parseInt(hex[1], 16);
  return { r: rgb >>> 16 & 255, g: rgb >>> 8 & 255, b: rgb & 255, a: hex[2] ? parseInt(hex[2], 16) / 255 : 1 };
}

// Source-over composition lets two uniform translucent tint layers become one
// without changing their result over any background. Unknown color formats
// retain separate plain Views rather than changing the requested appearance.
export function combineAndroidGlassTints(under: string, over: string): string | null {
  const lower = rgba(under), upper = rgba(over);
  if (!lower || !upper) return null;
  const alpha = upper.a + lower.a * (1 - upper.a);
  if (alpha <= 0) return 'transparent';
  const channel = (key: 'r' | 'g' | 'b') => Math.round((upper[key] * upper.a + lower[key] * lower.a * (1 - upper.a)) / alpha);
  return `rgba(${channel('r')},${channel('g')},${channel('b')},${alpha})`;
}
