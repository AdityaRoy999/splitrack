import type { BlurViewProps } from 'expo-blur';
import type { StyleProp, ViewStyle } from 'react-native';
import type { GradualBlurCurve } from './blurFalloff';

export type GradualBlurPosition = 'top' | 'bottom' | 'left' | 'right';

export interface GradualBlurProps {
  position?: GradualBlurPosition;
  renderMode?: 'edge' | 'page';
  height?: number;
  width?: number;
  strength?: number;
  layers?: number;
  curve?: GradualBlurCurve;
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  zIndex?: number;
  active?: boolean;
  blurTarget?: BlurViewProps['blurTarget'];
  style?: StyleProp<ViewStyle>;
}
