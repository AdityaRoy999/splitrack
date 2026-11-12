import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export interface AuroraMeshProps {
  colors: string[];
  points: number[][];
  columns: number;
  rows: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Web fallback stub — expo-mesh-gradient targets native iOS/Android only.
 * Aurora.tsx renders a silky blurred Gaussian SVG gradient layer on Web.
 */
export const AuroraMesh: React.FC<AuroraMeshProps> = () => null;
