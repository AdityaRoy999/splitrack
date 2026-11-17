import React from 'react';
import { processColor, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeGradualBlurView } from '../../../modules/gradual-blur';
import type { NativeFadeBlurProps } from './fadeBlurTypes';

export const NativeFadeBlur = ({ position, falloff, locations, axis, intensity, dark, tint }: NativeFadeBlurProps) => {
  const color = processColor(tint === 'transparent' ? 'transparent' : tint);
  const value = typeof color === 'number' ? color >>> 0 : 0;
  const hex = value.toString(16).padStart(8, '0');
  const washColor = `#${hex.slice(2)}${hex.slice(0, 2)}`;

  if (NativeGradualBlurView) {
    return <NativeGradualBlurView pointerEvents="none" position={position} falloff={falloff} locations={locations} intensity={intensity} dark={dark} washColor={washColor} style={StyleSheet.absoluteFill} />;
  }

  // Expo Go cannot load local native views. Keep a soft fade until the IPA or
  // development build is rebuilt, without wrapping a UIKit blur in a parent mask.
  const base = value || (dark ? 0xff09090b : 0xfff4f4f8);
  const colors = falloff.map((alpha) => `rgba(${base >>> 16 & 255},${base >>> 8 & 255},${base & 255},${alpha * (base >>> 24) / 255})`) as [string, string, ...string[]];
  return <LinearGradient colors={colors} locations={locations as [number, number, ...number[]]} start={axis.start} end={axis.end} style={StyleSheet.absoluteFill} />;
};
