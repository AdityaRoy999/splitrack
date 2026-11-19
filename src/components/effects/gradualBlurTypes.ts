import type { StyleProp, ViewStyle } from 'react-native';
import type { GradualBlurCurve } from './blurFalloff';

export type GradualBlurPosition = 'top' | 'bottom' | 'left' | 'right';

export interface GradualBlurProps {
  position?: GradualBlurPosition;
  height?: number;
  width?: number;
  strength?: number;
  intensity?: number;
  startOffset?: number;
  layers?: number;
  curve?: GradualBlurCurve;
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  zIndex?: number;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}
