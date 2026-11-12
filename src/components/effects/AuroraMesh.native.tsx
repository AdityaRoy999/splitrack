import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import { MeshGradientView } from 'expo-mesh-gradient';

export interface AuroraMeshProps {
  colors: string[];
  points: number[][];
  columns: number;
  rows: number;
  style?: StyleProp<ViewStyle>;
}

const isNativeMeshSupported = (): boolean => {
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') {
    const major = parseInt(String(Platform.Version), 10);
    return Number.isNaN(major) ? true : major >= 18;
  }
  return false;
};

const MESH_SUPPORTED = isNativeMeshSupported();

export const AuroraMesh: React.FC<AuroraMeshProps> = ({
  colors,
  points,
  columns,
  rows,
  style,
}) => {
  if (!MESH_SUPPORTED) return null;

  return (
    <MeshGradientView
      pointerEvents="none"
      columns={columns}
      rows={rows}
      colors={colors}
      points={points}
      smoothsColors={true}
      ignoresSafeArea={true}
      resolution={{ x: 24, y: 24 }}
      style={style}
    />
  );
};
