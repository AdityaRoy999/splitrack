import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  StyleProp,
  StyleSheet,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Triggers a springy, smooth native layout animation for surrounding views.
 * Call this right before updating state that expands or contracts content.
 */
export const triggerSmoothLayout = (duration = 280) => {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  LayoutAnimation.configureNext({
    duration,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.spring,
      springDamping: 0.84,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
};

interface SmoothCollapsibleProps {
  expanded: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

/**
 * A smooth, hardware-accelerated accordion/collapsible container.
 * Seamlessly interpolates height, opacity, and subtle translation on both Native & Web.
 */
export const SmoothCollapsible: React.FC<SmoothCollapsibleProps> = ({
  expanded,
  children,
  style,
  duration = 260,
}) => {
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [animProgress] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    Animated.timing(animProgress, {
      toValue: expanded ? 1 : 0,
      duration,
      easing: expanded
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, duration, animProgress]);

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webContainer,
          {
            maxHeight: expanded ? 280 : 0,
            opacity: expanded ? 1 : 0,
            transform: expanded ? 'translateY(0)' : 'translateY(-6px)',
            transition:
              'max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
            pointerEvents: expanded ? 'auto' : 'none',
          } as unknown as ViewStyle,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const maxHeight = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 280)],
  });

  const opacity = animProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.45, 1],
  });

  const translateY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  return (
    <Animated.View
      style={[
        styles.nativeContainer,
        {
          maxHeight,
          opacity,
          transform: [{ translateY }],
          overflow: 'hidden',
        },
        style,
      ]}
      pointerEvents={expanded ? 'auto' : 'none'}
    >
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - contentHeight) > 2) {
            setContentHeight(h);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  webContainer: {
    overflow: 'hidden',
    width: '100%',
  },
  nativeContainer: {
    overflow: 'hidden',
    width: '100%',
  },
});
