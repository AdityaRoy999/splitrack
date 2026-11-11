import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  height?: number;
  speed?: number;
  glow?: number;
  scale?: number;
  brightness?: number;
  layers?: number;
  direction?: 'top' | 'bottom';
  mouseInteraction?: boolean;
  intro?: boolean;
  opacity?: number;
  lightMode?: boolean;
  paused?: boolean;
  style?: any;
}

export const Aurora: React.FC<AuroraProps> = ({
  colorStops = ['#5227FF', '#7cff67', '#5227FF'],
  amplitude: _amplitude = 1,
  blend: _blend = 0.5,
  height: _height = 0.45,
  speed = 1,
  glow: _glow = 0.6,
  scale: _scale = 1,
  brightness: _brightness = 1,
  layers: _layers = 1,
  direction: _direction = 'top',
  mouseInteraction: _mouseInteraction = true,
  intro: _intro = true,
  opacity = 0.9,
  lightMode = false,
  paused: _paused = false,
  style,
}) => {
  const [anim1] = useState(() => new Animated.Value(0));
  const [anim2] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, {
          toValue: 1,
          duration: 6000 / speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim1, {
          toValue: 0,
          duration: 6000 / speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, {
          toValue: 1,
          duration: 8000 / speed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim2, {
          toValue: 0,
          duration: 8000 / speed,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [anim1, anim2, speed]);

  const translateX = anim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-35, 45],
  });
  const translateY = anim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const scaleAnim = anim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1],
  });

  const stop1 = colorStops[0] || '#5227FF';
  const stop2 = colorStops[1] || '#7cff67';
  const bgFade = lightMode ? '#F7F7FC' : '#000000';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgFade },
        style,
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.blob,
          {
            transform: [
              { translateX },
              { translateY },
              { scale: scaleAnim },
            ],
            opacity: lightMode ? Math.min(opacity, 0.58) : opacity,
          },
        ]}
      >
        <Svg width="120%" height="120%" viewBox="0 0 500 350">
          <Defs>
            <RadialGradient id="auroraGrad1" cx="40%" cy="30%" rx="55%" ry="50%">
              <Stop offset="0%" stopColor={stop2} stopOpacity={lightMode ? '0.42' : '0.45'} />
              <Stop offset="50%" stopColor={stop1} stopOpacity={lightMode ? '0.32' : '0.35'} />
              <Stop offset="100%" stopColor={bgFade} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="auroraGrad2" cx="65%" cy="50%" rx="50%" ry="45%">
              <Stop offset="0%" stopColor={stop1} stopOpacity={lightMode ? '0.36' : '0.5'} />
              <Stop offset="60%" stopColor={stop2} stopOpacity={lightMode ? '0.2' : '0.2'} />
              <Stop offset="100%" stopColor={bgFade} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="220" cy="140" rx="200" ry="120" fill="url(#auroraGrad1)" />
          <Ellipse cx="320" cy="180" rx="180" ry="110" fill="url(#auroraGrad2)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default Aurora;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
  },
});
