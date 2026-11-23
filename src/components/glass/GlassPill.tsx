import React from 'react';
import { Platform, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { triggerImpact, ImpactStyle } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassSurface } from './GlassSurface';
import { useModalVisual } from '../common/ModalVisualContext';
import { COMPACT_BUTTON_HEIGHT, COMPACT_BUTTON_HIT_SLOP } from '../../constants/buttonSizes';
import { ACTION_COLORS } from '../../theme/actionColors';
import { AppleGlassButton } from '../common/AppleGlassButton';

interface GlassPillProps {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  variant?: 'light' | 'glass' | 'accent' | 'dark' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  active?: boolean;
  disabled?: boolean;
  shape?: 'pill' | 'rounded';
  backgroundColor?: string;
  accessibilityLabel?: string;
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
  disabled = false,
  shape,
  backgroundColor,
  accessibilityLabel,
}) => {
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const modal = useModalVisual();
  const radius = (shape ?? (modal ? 'rounded' : 'pill')) === 'rounded' ? 14 : 999;

  const handlePress = () => {
    triggerImpact(ImpactStyle.Light);
    onPress();
  };

  const getContainerStyle = () => {
    if (backgroundColor) return { backgroundColor };
    if (modal && variant !== 'danger' && variant !== 'success') return { backgroundColor: isDark ? '#1C1C22' : '#E5E5EA' };
    switch (variant) {
      case 'light':
        return {
          backgroundColor: '#FFFFFF',
        };
      case 'accent':
        return {
          backgroundColor: isDark ? '#FFFFFF' : '#000000',
        };
      case 'danger':
        return { backgroundColor: ACTION_COLORS.danger };
      case 'success':
        return { backgroundColor: ACTION_COLORS.success };
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
    if (modal && variant !== 'danger' && variant !== 'success') return isDark ? '#F4F4F5' : '#18181B';
    if (variant === 'light') return '#000000';
    if (variant === 'danger' || variant === 'success') return ACTION_COLORS.onAction;
    if (variant === 'accent') return isDark ? '#000000' : '#FFFFFF';
    return isDark ? '#FFFFFF' : '#000000';
  };

  const sizePadding = {
    sm: { paddingHorizontal: 12, height: COMPACT_BUTTON_HEIGHT },
    md: { paddingHorizontal: 12, height: COMPACT_BUTTON_HEIGHT },
    lg: { paddingHorizontal: 22, height: modal ? 48 : COMPACT_BUTTON_HEIGHT },
  }[size];

  const useTranslucentGlass = isLiquidGlassEnabled && (Platform.OS === 'ios' || !modal) && !backgroundColor && (variant === 'glass' || variant === 'dark') && !active;

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

  if (Platform.OS === 'ios' && isLiquidGlassEnabled) return <AppleGlassButton label={label} icon={icon} onPress={handlePress}
    disabled={disabled} active={active} variant={variant} size={size} shape={radius === 999 ? 'pill' : 'rounded'}
    style={style} textStyle={textStyle} accessibilityLabel={accessibilityLabel} />;

  return (
    <AnimatedPressable
      disabled={disabled}
      scaleTo={0.95}
      onPress={handlePress}
      hitSlop={COMPACT_BUTTON_HIT_SLOP}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[size === 'lg' ? styles.fullWidth : undefined, style]}
      contentStyle={
        useTranslucentGlass
          ? [styles.glassPressReset, { borderRadius: radius }]
          : [
              styles.base,
              { borderRadius: radius },
              getContainerStyle(),
              sizePadding,
              active && { backgroundColor: isDark ? '#FFFFFF' : '#000000' },
            ]
      }
    >
      {useTranslucentGlass ? (
        <GlassSurface
          borderRadius={radius}
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
          style={[styles.base, sizePadding, { borderRadius: radius }]}
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
  fullWidth: { width: '100%', alignSelf: 'stretch' },
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
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
