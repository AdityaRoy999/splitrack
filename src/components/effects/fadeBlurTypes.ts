import type { BlurViewProps } from 'expo-blur';

export interface NativeFadeBlurProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  falloff: number[];
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
  axis: { start: { x: number; y: number }; end: { x: number; y: number } };
  intensity: number;
  dark: boolean;
  tint: string;
  blurTarget?: BlurViewProps['blurTarget'];
}
