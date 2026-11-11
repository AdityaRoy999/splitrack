import React from 'react';
import { View, StyleSheet } from 'react-native';
import AuroraOriginal from './AuroraOriginal';

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
  amplitude = 1,
  blend = 0.5,
  height = 0.45,
  speed = 1,
  glow = 0.6,
  scale = 1,
  brightness = 1,
  layers = 1,
  direction = 'top',
  mouseInteraction = true,
  intro = true,
  opacity = 0.9,
  lightMode = false,
  paused = false,
  style,
}) => {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: lightMode ? '#F7F7FC' : '#000000' },
        style,
      ]}
      pointerEvents="none"
    >
      <AuroraOriginal
        colorStops={colorStops}
        amplitude={amplitude}
        blend={blend}
        height={height}
        speed={speed}
        glow={glow}
        scale={scale}
        brightness={brightness}
        layers={layers}
        direction={direction}
        opacity={opacity}
        lightMode={lightMode}
        mouseInteraction={mouseInteraction}
        intro={intro}
        paused={paused}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
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
});
