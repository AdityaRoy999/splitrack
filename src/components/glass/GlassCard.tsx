import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { getGlassStyles } from '../../theme/colors';
import { GlassSurface } from './GlassSurface';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  borderRadius?: number;
  overflow?: 'hidden' | 'visible';
}

/**
 * Unified 100% Borderless, Shadowless Card Container across the entire app.
 * Renders native iOS Liquid Glass / BlurView translucency when Liquid Glass is active,
 * or crisp elevated matte surfaces when Liquid Glass is disabled.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity,
  borderRadius = 24,
  overflow = 'hidden',
}) => {
  const { isLiquidGlassEnabled, themeMode } = useLiquidGlass();
  const glassStyles = getGlassStyles(isLiquidGlassEnabled, themeMode);

  return (
    <GlassSurface
      borderRadius={borderRadius}
      intensity={intensity}
      glassStyle="regular"
      matteColor={glassStyles.card.backgroundColor}
      style={[
        styles.baseCard,
        { overflow },
        style,
      ]}
    >
      {children}
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  baseCard: {
    width: '100%',
    position: 'relative',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});
