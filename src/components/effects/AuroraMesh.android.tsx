import React from 'react';
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import type { AuroraMeshProps } from './AuroraMesh';

// The mesh's Android tessellation is unnecessary for a decorative background.
export const AuroraMesh: React.FC<AuroraMeshProps> = ({ colors, style }) => {
  const stops = colors.filter(Boolean).slice(0, 4);
  const palette: LinearGradientProps['colors'] = [stops[0] || 'transparent', stops[1] || stops[0] || 'transparent', ...stops.slice(2)];
  return <LinearGradient pointerEvents="none" colors={palette} dither={false}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style} />;
};
