import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from '../glass/GlassSurface';
import { useSheetMotion } from './useSheetMotion';

interface GlassModalSheetProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const GlassModalSheet: React.FC<GlassModalSheetProps> = ({
  style,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const bgMatte = isDark ? '#09090B' : '#F4F4F8';
  const tintGlass = isDark ? 'rgba(18, 18, 24, 0.88)' : 'rgba(255, 255, 255, 0.92)';

  const maxSheetHeight = Math.round(Math.min(windowHeight * 0.92, windowHeight - insets.top - 8));
  const { animatedStyle, gesture, close } = useSheetMotion(windowHeight);

  const bottomPadding = Math.max(34, insets.bottom + 16);

  return (
    <Animated.View
      style={[
        styles.animWrap,
        {
          height: maxSheetHeight,
          maxHeight: maxSheetHeight,
        },
        animatedStyle,
      ]}
    >
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={windowHeight - maxSheetHeight}>
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
              maxHeight: maxSheetHeight,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              marginBottom: 0,
              paddingBottom: bottomPadding,
            },
          ]}
        >
          {children}
        </GlassSurface>
      </KeyboardAvoidingView>
      <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
        <View collapsable={false} accessibilityLabel="Swipe down to close sheet" onAccessibilityTap={close} style={styles.dragArea} />
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  dragArea: { position: 'absolute', top: 0, left: 64, right: 64, height: 32, zIndex: 50 },
  keyboardArea: { flex: 1, minHeight: 0, width: '100%' },
  animWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexShrink: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    zIndex: 10,
  },
  sheetBase: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    borderWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
});
