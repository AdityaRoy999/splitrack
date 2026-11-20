import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from '../common/BackdropSurfaceContext';
import { useModalVisual } from '../common/ModalVisualContext';

interface GlassSurfaceProps {
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  glassStyle?: 'regular' | 'clear';
  interactive?: boolean;
  intensity?: number;
  tintColor?: string;
  matteColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Keep Android's existing tint, corner geometry, and sheen without loading
// Apple GlassView APIs or web backdrop styles into its rendering path.
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  borderRadius = 24,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomLeftRadius,
  borderBottomRightRadius,
  glassStyle = 'regular',
  intensity,
  tintColor,
  matteColor,
  style,
  children,
}) => {
  const { isLiquidGlassEnabled, themeMode } = useLiquidGlass();
  const modal = useModalVisual();
  const isDark = themeMode === 'dark';
  const resolvedMatte = modal && (!matteColor || matteColor.startsWith('rgba') || matteColor === 'transparent')
    ? (isDark ? '#17171C' : '#FFFFFF') : matteColor || (isDark ? '#111114' : '#FFFFFF');
  const cornerRadii: ViewStyle = {
    borderRadius,
    ...(borderTopLeftRadius !== undefined ? { borderTopLeftRadius } : {}),
    ...(borderTopRightRadius !== undefined ? { borderTopRightRadius } : {}),
    ...(borderBottomLeftRadius !== undefined ? { borderBottomLeftRadius } : {}),
    ...(borderBottomRightRadius !== undefined ? { borderBottomRightRadius } : {}),
  };

  if (!isLiquidGlassEnabled || modal) {
    return <View style={[styles.surfaceContainer, cornerRadii, { backgroundColor: resolvedMatte }, style]}>
      <BackdropSurfaceContext.Provider value={resolvedMatte}>{children}</BackdropSurfaceContext.Provider>
    </View>;
  }

  const resolvedTint = tintColor || (isDark
    ? glassStyle === 'clear' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(22, 22, 28, 0.62)'
    : glassStyle === 'clear' ? 'rgba(255, 255, 255, 0.36)' : 'rgba(255, 255, 255, 0.74)');
  const resolvedIntensity = intensity ?? (glassStyle === 'clear' ? 38 : isDark ? 75 : 85);

  return <View style={[styles.surfaceContainer, cornerRadii, { backgroundColor: 'transparent' }, style]}>
    <BlurView pointerEvents="none" intensity={resolvedIntensity} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, cornerRadii]} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, cornerRadii, { backgroundColor: resolvedTint }]} />
    <LinearGradient
      pointerEvents="none"
      colors={isDark
        ? ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0)']
        : ['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0)']}
      start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
      style={[StyleSheet.absoluteFill, cornerRadii]}
    />
    <BackdropSurfaceContext.Provider value={resolvedMatte}>{children}</BackdropSurfaceContext.Provider>
  </View>;
};

export const useNativeGlassAvailable = () => false;

const styles = StyleSheet.create({
  surfaceContainer: { position: 'relative', overflow: 'hidden', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
});
