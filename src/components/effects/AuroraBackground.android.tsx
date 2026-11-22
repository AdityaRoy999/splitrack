import React from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const AuroraBackground: React.FC<{ height?: number; width?: number; opacity?: number; style?: StyleProp<ViewStyle> }> = ({
  height = 240, width, opacity = 0.85, style,
}) => {
  const window = useWindowDimensions();
  return <LinearGradient pointerEvents="none" dither={false}
    colors={['#000000', '#18181B', '#09090B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={[StyleSheet.absoluteFill, { height, width: width ?? window.width - 36, opacity }, style]} />;
};
