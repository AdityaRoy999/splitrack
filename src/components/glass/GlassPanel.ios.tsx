import React, { useContext } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from '../common/BackdropSurfaceContext';
import { GlassSurface } from './GlassSurface';

// A panel inside glass shares its parent's material. Standalone sheet sections
// get one clear surface rather than painting a solid rectangle over the sheet.
export function GlassPanel({ style, children, ...props }: ViewProps) {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  const parentSurface = useContext(BackdropSurfaceContext);
  if (!isLiquidGlassEnabled) return <View {...props} style={style}>{children}</View>;

  const clearStyle = [style, styles.clear];
  if (parentSurface === 'transparent') return <View {...props} style={clearStyle}>{children}</View>;

  const radius = StyleSheet.flatten(style)?.borderRadius;
  return <View {...props} style={clearStyle}>
    <GlassSurface borderRadius={typeof radius === 'number' ? radius : 14} style={StyleSheet.absoluteFill} />
    <BackdropSurfaceContext.Provider value="transparent">{children}</BackdropSurfaceContext.Provider>
  </View>;
}

const styles = StyleSheet.create({
  clear: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
});
