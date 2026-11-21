import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSheetMotion } from './useSheetMotion';

export function ModalPage({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { animatedStyle, gesture, close } = useSheetMotion(height);
  return (
    <Animated.View style={[styles.page, animatedStyle]}>
      {children}
      <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
        <View collapsable={false} accessibilityLabel="Swipe down to close page" onAccessibilityTap={close} style={[styles.dragArea, { top: insets.top }]} />
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  // Cover the handle and title, keeping the close button and the search field
  // outside this surface. A 32px strip was too small to start a reliable drag.
  dragArea: { position: 'absolute', left: 76, right: 76, height: 80, zIndex: 50 },
});
