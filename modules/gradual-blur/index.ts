import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ViewProps } from 'react-native';

export interface NativeGradualBlurProps extends ViewProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  stack: { from: number; to: number; radius: number; level: number }[];
  falloff?: number[];
  locations?: number[];
  opacity: number;
  reveal?: number;
  dark?: boolean;
  washColor?: string;
}

export const NativeGradualBlurView = requireOptionalNativeModule('SplittrackGradualBlur')
  ? requireNativeView<NativeGradualBlurProps>('SplittrackGradualBlur')
  : null;
