import { clamp, MAX_LAYERS, MAX_STOPS, toOklch, unwrapHues } from './auroraShader';

export interface AuroraOptions {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  time?: number;
  height?: number;
  scale?: number;
  glow?: number;
  brightness?: number;
  layers?: number;
  direction?: 'top' | 'bottom';
  mouseInteraction?: boolean;
  intro?: boolean;
  opacity?: number;
  lightMode?: boolean;
  paused?: boolean;
  dpr?: number;
}

export interface AuroraSettings {
  stops: string[];
  amplitude: number;
  blend: number;
  speed: number;
  time?: number;
  height: number;
  scale: number;
  glow: number;
  brightness: number;
  layers: number;
  flip: number;
  mouseInteraction: boolean;
  intro: boolean;
  opacity: number;
  lightMode: boolean;
  paused: boolean;
  dpr?: number;
}

export function normalizeAuroraSettings({
  colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  amplitude = 1,
  blend = 0.5,
  speed = 1,
  time,
  height = 0.45,
  scale = 1,
  glow = 0.6,
  brightness = 1,
  layers = 1,
  direction = 'top',
  mouseInteraction = true,
  intro = true,
  opacity = 1,
  lightMode = false,
  paused = false,
  dpr,
}: AuroraOptions): AuroraSettings {
  const stops = (Array.isArray(colorStops) ? colorStops : []).filter(Boolean).map(String).slice(0, MAX_STOPS);
  return {
    stops: stops.length >= 2 ? stops : stops.length === 1 ? [stops[0], stops[0]] : ['#5227FF', '#7cff67'],
    amplitude: Math.max(0, amplitude),
    blend: clamp(blend, 0, 1),
    speed,
    time,
    height: clamp(height, 0, 1),
    scale: Math.max(0.1, scale),
    glow: Math.max(0, glow),
    brightness: Math.max(0, brightness),
    layers: clamp(Math.round(layers), 1, MAX_LAYERS),
    flip: direction === 'bottom' ? 1 : 0,
    mouseInteraction,
    intro,
    opacity: clamp(opacity, 0, 1),
    lightMode,
    paused,
    dpr,
  };
}

export function createAuroraPalette(stops: string[], parseColor: (color: string) => number[]): Float32Array {
  const palette = new Float32Array(MAX_STOPS * 3);
  unwrapHues(stops.map((color) => toOklch(parseColor(color)))).forEach((stop, index) => {
    palette.set(stop, index * 3);
  });
  return palette;
}
