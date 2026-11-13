import React, { useEffect, useState } from 'react';
import { Animated, Platform, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityLabel?: string;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Lightweight spring-scale micro-interaction wrapper for buttons and cards.
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPress,
  onHoverIn,
  onHoverOut,
  disabled = false,
  scaleTo = 0.97,
  style,
  contentStyle,
  hitSlop,
  accessibilityLabel,
}) => {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const animateTo = (toValue: number) => {
    Animated.spring(scaleAnim, {
      toValue,
      friction: 10,
      tension: 150,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      {...(Platform.OS === 'web' && (onHoverIn || onHoverOut)
        ? ({ onMouseEnter: onHoverIn, onMouseLeave: onHoverOut } as any)
        : {})}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled || !onPress}
        onPress={onPress}
        onPressIn={() => !disabled && animateTo(scaleTo)}
        onPressOut={() => animateTo(1)}
        hitSlop={hitSlop}
        accessibilityLabel={accessibilityLabel}
        style={contentStyle}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

interface FadeInSlideProps {
  children: React.ReactNode;
  duration?: number;
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Smooth entrance fade + upward slide micro-animation for tab views and cards.
 */
export const FadeInSlide: React.FC<FadeInSlideProps> = ({
  children,
  duration = 200,
  offsetY = 8,
  style,
}) => {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    // Guarantee completion if Web animation frames throttle on tab switches
    const fallback = setTimeout(() => {
      anim.setValue(1);
    }, duration + 60);
    return () => {
      animation.stop();
      clearTimeout(fallback);
    };
  }, [anim, duration]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  // Never animate container opacity below 1 when native iOS GlassView is active
  const avoidOpacityForNativeGlass = Platform.OS === 'ios' && isLiquidGlassEnabled;

  return (
    <Animated.View
      style={[
        style,
        avoidOpacityForNativeGlass
          ? { transform: [{ translateY }] }
          : { opacity: anim, transform: [{ translateY }] },
      ]}
    >
      {children}
    </Animated.View>
  );
};
