import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from '../common/BackdropSurfaceContext';

export function useNativeGlassAvailable() {
  try { return isGlassEffectAPIAvailable() && isLiquidGlassAvailable(); } catch { return false; }
}

interface Props {
  borderRadius?: number;
  borderTopLeftRadius?: number; borderTopRightRadius?: number;
  borderBottomLeftRadius?: number; borderBottomRightRadius?: number;
  glassStyle?: 'regular' | 'clear'; interactive?: boolean; intensity?: number;
  tintColor?: string; matteColor?: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}

export function GlassSurface({ children, style, borderRadius = 24, glassStyle = 'regular',
  borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius, matteColor }: Props) {
  const { isLiquidGlassEnabled, themeMode } = useLiquidGlass();
  const available = useNativeGlassAvailable();
  const matte = matteColor && !matteColor.startsWith('rgba') && matteColor !== 'transparent'
    ? matteColor : themeMode === 'dark' ? '#111114' : '#FFFFFF';
  const corners = { borderRadius, borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius };
  return <View style={[styles.surface, corners, style, { backgroundColor: isLiquidGlassEnabled ? 'transparent' : matte }]}>
    {isLiquidGlassEnabled ? available
      ? <GlassView pointerEvents="none" glassEffectStyle={glassStyle} isInteractive={false}
          colorScheme={themeMode} style={[StyleSheet.absoluteFill, corners]} />
      : <BlurView pointerEvents="none" tint="systemMaterial" intensity={60} style={[StyleSheet.absoluteFill, corners]} />
      : null}
    <BackdropSurfaceContext.Provider value={isLiquidGlassEnabled ? 'transparent' : matte}>{children}</BackdropSurfaceContext.Provider>
  </View>;
}

const styles = StyleSheet.create({ surface: { position: 'relative', overflow: 'hidden', borderWidth: 0, shadowOpacity: 0 } });
