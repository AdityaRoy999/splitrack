import React from 'react';
import { Animated, Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSheetMotion } from './useSheetMotion';

export function ModalPage({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { translateY, panHandlers, close } = useSheetMotion(height);
  return (
    <Animated.View style={[styles.page, { transform: [{ translateY }] }]}>
      {children}
      <View {...panHandlers} accessibilityLabel="Swipe down to close page" onAccessibilityTap={close} style={[styles.dragArea, { top: insets.top }, Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as ViewStyle) : undefined]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  dragArea: { position: 'absolute', left: 90, right: 90, height: 24, zIndex: 50 },
});
