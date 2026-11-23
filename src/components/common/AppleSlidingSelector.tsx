import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
export interface AppleSlidingSelectorProps {
  items: { value: string; label: string; icon?: ReactNode; accessibilityLabel?: string; disabled?: boolean }[];
  value: string; onChange(value: string, index: number): void; disabled?: boolean; dock?: boolean;
  height?: number; style?: StyleProp<ViewStyle>;
}
export function AppleSlidingSelector(_props: AppleSlidingSelectorProps) { return null; }
