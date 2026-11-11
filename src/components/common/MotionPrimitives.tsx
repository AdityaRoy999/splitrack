import React, { useEffect, useState } from 'react';
import { Animated, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityLabel?: string;
}

/**
 * Lightweight spring-scale micro-interaction wrapper for buttons and cards.
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPress,
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
      friction: 7,
      tension: 120,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
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
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
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

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};
