import React, { useEffect, useRef } from 'react';
import {
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
 * Triggers a silky smooth native layout animation for surrounding views.
 * Uses easeInEaseOut to prevent bouncy spring twitching on iOS.
 */
export const triggerSmoothLayout = (duration = 240) => {
  if (Platform.OS === 'web') return;
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
      type: LayoutAnimation.Types.easeInEaseOut,
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
 * A smooth accordion/collapsible container:
 * - Web: Hardware-accelerated CSS cubic-bezier maxHeight & opacity transitions.
 * - iOS/Android: Native UIKit/Android layout animation with easeInEaseOut, zero frame jumping.
 */
export const SmoothCollapsible: React.FC<SmoothCollapsibleProps> = ({
  expanded,
  children,
  style,
  duration = 240,
}) => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (Platform.OS !== 'web') {
      triggerSmoothLayout(duration);
    }
  }, [expanded, duration]);

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webContainer,
          {
            maxHeight: expanded ? 360 : 0,
            opacity: expanded ? 1 : 0,
            transform: expanded ? 'translateY(0)' : 'translateY(-4px)',
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

  if (!expanded) {
    return null;
  }

  return (
    <View style={[styles.nativeContainer, style]}>
      {children}
    </View>
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

export default SmoothCollapsible;
