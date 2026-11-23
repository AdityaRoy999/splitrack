import type { ReactNode } from 'react';
import type { ViewStyle, TextStyle } from 'react-native';
export interface AppleGlassButtonProps {
  label?: string; icon?: ReactNode; onPress(): void; disabled?: boolean; active?: boolean;
  role?: 'default' | 'cancel' | 'destructive' | 'close';
  variant: 'light' | 'glass' | 'accent' | 'dark' | 'danger' | 'success';
  size: 'sm' | 'md' | 'lg'; shape: 'pill' | 'rounded'; style?: ViewStyle;
  textStyle?: TextStyle; accessibilityLabel?: string;
}
export function AppleGlassButton(_props: AppleGlassButtonProps) { return null; }
