import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
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
import { SheetSizingContext } from './SheetSizingContext';

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
  const [fittedHeight, setFittedHeight] = useState<number | null>(null);
  const sheetHeight = Math.min(fittedHeight ?? maxSheetHeight, maxSheetHeight);
  const measuredHeight = useRef(maxSheetHeight);
  const chromeHeight = useRef<number | null>(null);
  useLayoutEffect(() => { measuredHeight.current = sheetHeight; }, [sheetHeight]);
  const fitContent = useCallback((viewport: number, content: number) => {
    if (viewport <= 0 || content <= 0) return;
    // Capture the header/footer once from the initial bounded layout. Reusing
    // it prevents content-size events racing viewport layout during resizing.
    const chrome = chromeHeight.current ?? Math.max(0, measuredHeight.current - viewport);
    chromeHeight.current = chrome;
    const next = Math.round(Math.min(maxSheetHeight, content + chrome));
    setFittedHeight(previous => previous !== null && Math.abs(previous - next) < 2 ? previous : next);
  }, [maxSheetHeight]);
  const { animatedStyle, gesture, close } = useSheetMotion(windowHeight);

  const bottomPadding = Math.max(16, insets.bottom + 8);

  return (
    <Animated.View
      style={[
        styles.animWrap,
        {
          height: sheetHeight,
          maxHeight: maxSheetHeight,
        },
        animatedStyle,
      ]}
    >
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={windowHeight - sheetHeight}>
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
          <SheetSizingContext.Provider value={fitContent}>{children}</SheetSizingContext.Provider>
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
