import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AuroraProps {
  height?: number;
  width?: number;
  opacity?: number;
  style?: any;
}

/**
 * Aurora Background component inspired by React Bits (reactbits.dev/c/backgrounds/aurora)
 * Custom engineered for React Native with organic, drifting monochrome aurora curtains
 * and smooth micro-animations. Free of bluish tint or oversaturated "vibecoded" colors.
 */
export const AuroraBackground: React.FC<AuroraProps> = ({
  height = 240,
  width = SCREEN_WIDTH - 36,
  opacity = 0.85,
  style,
}) => {
  // Animation drivers for floating aurora curtains
  const [anim1] = useState(() => new Animated.Value(0));
  const [anim2] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Smooth infinite drifting animations mimicking northern lights
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim1, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, {
          toValue: 1,
          duration: 7500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim2, {
          toValue: 0,
          duration: 7500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [anim1, anim2]);

  // Interpolations for organic drifting motion
  const translateX1 = anim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 40],
  });
  const translateY1 = anim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });
  const scale1 = anim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1],
  });

  const translateX2 = anim2.interpolate({
    inputRange: [0, 1],
    outputRange: [40, -35],
  });
  const scale2 = anim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1.1, 0.95, 1.1],
  });

  return (
    <View style={[styles.container, { width, height }, style]} pointerEvents="none">
      {/* Aurora Layer 1: Titanium / Silver ambient curtain */}
      <Animated.View
        style={[
          styles.blob,
          {
            transform: [
              { translateX: translateX1 },
              { translateY: translateY1 },
              { scale: scale1 },
            ],
            opacity,
          },
        ]}
      >
        <Svg width={width * 1.5} height={height * 1.4} viewBox="0 0 400 300">
          <Defs>
            <RadialGradient id="aurora1" cx="50%" cy="40%" rx="60%" ry="45%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
              <Stop offset="40%" stopColor="#A1A1AA" stopOpacity="0.06" />
              <Stop offset="80%" stopColor="#27272A" stopOpacity="0.03" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="200" cy="150" rx="190" ry="110" fill="url(#aurora1)" />
        </Svg>
      </Animated.View>

      {/* Aurora Layer 2: Deep Carbon / Charcoal soft glow */}
      <Animated.View
        style={[
          styles.blob,
          {
            transform: [
              { translateX: translateX2 },
              { scale: scale2 },
            ],
            opacity: opacity * 0.9,
          },
        ]}
      >
        <Svg width={width * 1.4} height={height * 1.3} viewBox="0 0 380 280">
          <Defs>
            <RadialGradient id="aurora2" cx="45%" cy="50%" rx="55%" ry="50%">
              <Stop offset="0%" stopColor="#E4E4E7" stopOpacity="0.09" />
              <Stop offset="35%" stopColor="#52525B" stopOpacity="0.05" />
              <Stop offset="85%" stopColor="#18181B" stopOpacity="0.02" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="190" cy="140" rx="170" ry="95" fill="url(#aurora2)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  blob: {
    position: 'absolute',
    top: -30,
    left: -40,
  },
});
