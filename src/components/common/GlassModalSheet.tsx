import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from '../glass/GlassSurface';

interface GlassModalSheetProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const GlassModalSheet: React.FC<GlassModalSheetProps> = ({
  style,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const bgMatte = isDark ? '#09090B' : '#F4F4F8';
  const tintGlass = isDark ? 'rgba(18, 18, 24, 0.88)' : 'rgba(255, 255, 255, 0.92)';

  // Start well off-screen so the sheet smoothly slides up from the true bottom
  const [slideAnim] = useState(() => new Animated.Value(Math.min(SCREEN_HEIGHT, 650)));

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      stiffness: 380,
      damping: 30,
      mass: 0.7,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [slideAnim]);

  const bottomPadding = Math.max(34, insets.bottom + 16);

  return (
    <Animated.View
      style={[
        styles.animWrap,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
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
        style={[
          styles.sheetBase,
          style,
          {
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            marginBottom: 0,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {children}
      </GlassSurface>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginBottom: 0,
  },
  sheetBase: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    borderWidth: 0,
    overflow: 'hidden',
  },
});
