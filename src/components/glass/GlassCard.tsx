import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { getGlassStyles } from '../../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  borderRadius?: number;
  overflow?: 'hidden' | 'visible';
}

/**
 * Unified 100% Borderless, Shadowless Card Container across the entire app.
 * Renders clean elevated matte surfaces with zero background blur bleed-through.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  borderRadius = 24,
  overflow = 'hidden',
}) => {
  const { isLiquidGlassEnabled, themeMode } = useLiquidGlass();
  const glassStyles = getGlassStyles(isLiquidGlassEnabled, themeMode);

  return (
    <View
      style={[
        styles.baseCard,
        glassStyles.card,
        { borderRadius, overflow },
        style,
      ]}
    >
      {children}
    </View>
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
