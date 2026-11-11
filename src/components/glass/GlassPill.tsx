import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { triggerImpact, ImpactStyle } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassSurface } from './GlassSurface';

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
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
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
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.65)',
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

  const useTranslucentGlass = isLiquidGlassEnabled && (variant === 'glass' || variant === 'dark') && !active;

  const innerContent = (
    <>
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
    </>
  );

  return (
    <AnimatedPressable
      scaleTo={0.95}
      onPress={handlePress}
      style={style}
      contentStyle={
        useTranslucentGlass
          ? styles.glassPressReset
          : [
              styles.base,
              getContainerStyle(),
              sizePadding,
              active && { backgroundColor: isDark ? '#FFFFFF' : '#000000' },
            ]
      }
    >
      {useTranslucentGlass ? (
        <GlassSurface
          borderRadius={999}
          glassStyle="clear"
          interactive
          intensity={36}
          tintColor={
            variant === 'dark'
              ? isDark
                ? 'rgba(32, 32, 40, 0.56)'
                : 'rgba(255, 255, 255, 0.54)'
              : isDark
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(255, 255, 255, 0.45)'
          }
          style={[styles.base, sizePadding]}
        >
          {innerContent}
        </GlassSurface>
      ) : (
        innerContent
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  glassPressReset: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 0,
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
