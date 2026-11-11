import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

const canUseNativeLiquidGlass = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return (
      typeof isGlassEffectAPIAvailable === 'function' &&
      isGlassEffectAPIAvailable() &&
      typeof isLiquidGlassAvailable === 'function' &&
      isLiquidGlassAvailable()
    );
  } catch {
    return false;
  }
})();

interface GlassSurfaceProps {
  borderRadius?: number;
  glassStyle?: 'regular' | 'clear';
  interactive?: boolean;
  intensity?: number;
  tintColor?: string;
  matteColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Adaptive surface backing Layer:
 * - When Liquid Glass is enabled:
 *   - iOS 26+: native UIVisualEffectView / UIGlassEffect via expo-glass-effect GlassView
 *   - Older iOS / Android: native BlurView frosted glass with subtle specular sheen
 *   - Web: CSS backdrop-filter translucent frosted glass
 * - When Liquid Glass is disabled: clean solid matte surface.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  borderRadius = 24,
  glassStyle = 'regular',
  interactive = false,
  intensity,
  tintColor,
  matteColor,
  style,
  children,
}) => {
  const { isLiquidGlassEnabled, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const resolvedMatte = matteColor || (isDark ? '#111114' : '#FFFFFF');

  if (!isLiquidGlassEnabled) {
    return (
      <View
        style={[
          styles.surfaceContainer,
          { backgroundColor: resolvedMatte, borderRadius },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const resolvedTint =
    tintColor ||
    (isDark
      ? glassStyle === 'clear'
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(22, 22, 28, 0.58)'
      : glassStyle === 'clear'
        ? 'rgba(255, 255, 255, 0.36)'
        : 'rgba(255, 255, 255, 0.68)');

  const resolvedIntensity = intensity ?? (glassStyle === 'clear' ? 32 : isDark ? 55 : 72);

  return (
    <View
      style={[
        styles.surfaceContainer,
        {
          borderRadius,
          backgroundColor:
            canUseNativeLiquidGlass
              ? 'transparent'
              : Platform.OS === 'web'
                ? resolvedTint
                : 'transparent',
        },
        Platform.OS === 'web'
          ? ({
              backdropFilter: `blur(${glassStyle === 'clear' ? 14 : 22}px) saturate(175%)`,
              WebkitBackdropFilter: `blur(${glassStyle === 'clear' ? 14 : 22}px) saturate(175%)`,
            } as unknown as ViewStyle)
          : undefined,
        style,
      ]}
    >
      {canUseNativeLiquidGlass ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle={glassStyle}
          isInteractive={interactive}
          colorScheme={isDark ? 'dark' : 'light'}
          tintColor={resolvedTint}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : Platform.OS !== 'web' ? (
        <>
          <BlurView
            pointerEvents="none"
            intensity={resolvedIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: resolvedTint, borderRadius },
            ]}
          />
        </>
      ) : null}

      {/* Specular soft top-to-bottom internal sheen (borderless) */}
      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0)']
            : ['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0)']
        }
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {children}
    </View>
  );
};

export const useNativeGlassAvailable = () => canUseNativeLiquidGlass;

const styles = StyleSheet.create({
  surfaceContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});
