import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

export interface AppleRadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AppleGraphicalCalendarProps {
  title?: string;
  selectedDate: string | null;
  onSelectDate: (isoDate: string) => void;
  onToday: () => void;
  onClear?: () => void;
  allowClear?: boolean;
  isDark: boolean;
}

export interface AppleRadioControlProps {
  items: AppleRadioOption[];
  value: string;
  onChange: (value: string, index: number) => void;
  size?: 'sm' | 'md' | 'lg';
  gap?: number;
  columns?: number;
  scrollable?: boolean;
  disabled?: boolean;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface AppleToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isDark: boolean;
  tintColor?: string;
}

export interface NativeGlassContainerProps {
  spacing?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const AppleGraphicalCalendar: React.FC<AppleGraphicalCalendarProps> = () => null;
export const AppleRadioControl: React.FC<AppleRadioControlProps> = () => null;
export const AppleToggleSwitch: React.FC<AppleToggleSwitchProps> = () => null;

export const NativeGlassContainer: React.FC<NativeGlassContainerProps> = ({ style, children }) => (
  <View style={style}>{children}</View>
);
