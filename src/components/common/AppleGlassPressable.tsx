import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface AppleGlassPressableProps {
  children: ReactNode; onPress(): void; onLongPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string; selected?: boolean; borderRadius?: number;
}
export function AppleGlassPressable(_props: AppleGlassPressableProps) { return null; }
