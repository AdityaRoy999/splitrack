import type { BlurViewProps } from 'expo-blur';
import type { SharedValue } from 'react-native-reanimated';
import type { GradualBlurLayer } from './blurFalloff';
import type { GradualBlurPosition } from './gradualBlurTypes';

export interface NativeFadeBlurProps {
  position: GradualBlurPosition;
  renderMode: 'edge' | 'page';
  stack: GradualBlurLayer[];
  falloff: number[];
  locations: [number, number, ...number[]];
  axis: { start: { x: number; y: number }; end: { x: number; y: number } };
  opacity: number;
  reveal: SharedValue<number>;
  dark: boolean;
  tint: string;
  blurTarget?: BlurViewProps['blurTarget'];
}
