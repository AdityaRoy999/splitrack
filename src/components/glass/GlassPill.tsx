import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { triggerImpact, ImpactStyle } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';

interface GlassPillProps {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  variant?: 'light' | 'glass' | 'accent' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  active?: boolean;
}

export const GlassPill: React.FC<GlassPillProps> = ({
  label,
  icon,
  onPress,
  variant = 'glass',
  size = 'md',
  style,
  textStyle,
  active = false,
}) => {
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const handlePress = () => {
    triggerImpact(ImpactStyle.Light);
    onPress();
  };

  const getContainerStyle = () => {
    switch (variant) {
      case 'light':
        return {
          backgroundColor: '#FFFFFF',
        };
      case 'accent':
        return {
          backgroundColor: isDark ? '#FFFFFF' : '#000000',
        };
      case 'dark':
        return {
          backgroundColor: isDark ? '#1C1C20' : '#E5E5EA',
        };
      case 'glass':
      default:
        return {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
        };
    }
  };

  const getTextColor = () => {
    if (variant === 'light') return '#000000';
    if (variant === 'accent') return isDark ? '#000000' : '#FFFFFF';
    return isDark ? '#FFFFFF' : '#000000';
  };

  const sizePadding = {
    sm: { paddingVertical: 6, paddingHorizontal: 12, height: 32 },
    md: { paddingVertical: 8, paddingHorizontal: 12, height: 38 },
    lg: { paddingVertical: 12, paddingHorizontal: 22, height: 48 },
  }[size];

  return (
    <AnimatedPressable
      scaleTo={0.95}
      onPress={handlePress}
      style={style}
      contentStyle={[
        styles.base,
        getContainerStyle(),
        sizePadding,
        active && { backgroundColor: isDark ? '#FFFFFF' : '#000000' },
      ]}
    >
      {icon && <View style={[styles.iconContainer, label ? { marginRight: 6 } : undefined]}>{icon}</View>}
      {label ? (
        <Text
          numberOfLines={1}
          style={[
            styles.text,
            { color: active ? (isDark ? '#000000' : '#FFFFFF') : getTextColor() },
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 0, // completely borderless
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
