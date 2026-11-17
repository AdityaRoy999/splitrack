import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ViewProps } from 'react-native';

export interface NativeGradualBlurProps extends ViewProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  falloff: number[];
  locations: number[];
  intensity: number;
  dark: boolean;
  washColor: string;
}

export const NativeGradualBlurView = requireOptionalNativeModule('SplittrackGradualBlur')
  ? requireNativeView<NativeGradualBlurProps>('SplittrackGradualBlur')
  : null;
