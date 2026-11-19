import type { SharedValue } from 'react-native-reanimated';
import type { GradualBlurPosition } from './gradualBlurTypes';

export interface NativeProgressiveBlurProps {
  position: GradualBlurPosition;
  intensity: number;
  startOffset: number;
  reveal: SharedValue<number>;
  tint: string;
  dark: boolean;
}
