import React from 'react';
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from '../glass/GlassSurface';

interface GlassModalSheetProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const GlassModalSheet: React.FC<GlassModalSheetProps> = ({
  style,
  children,
}) => {
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const bgMatte = isDark ? '#09090B' : '#F4F4F8';
  const tintGlass = isDark ? 'rgba(18, 18, 24, 0.82)' : 'rgba(255, 255, 255, 0.88)';

  return (
    <GlassSurface
      borderTopLeftRadius={32}
      borderTopRightRadius={32}
      borderBottomLeftRadius={0}
      borderBottomRightRadius={0}
      borderRadius={0}
      glassStyle="regular"
      intensity={isDark ? 85 : 95}
      tintColor={tintGlass}
      matteColor={bgMatte}
      style={[styles.sheetBase, style]}
    >
      {children}
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  sheetBase: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderWidth: 0,
    overflow: 'hidden',
  },
});
