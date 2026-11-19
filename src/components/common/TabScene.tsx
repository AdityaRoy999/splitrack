import React, { memo, useLayoutEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SceneActivityContext } from './SceneActivityContext';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

interface TabSceneProps {
  active: boolean;
  effectsActive?: boolean;
  render?: () => React.ReactNode;
  children?: React.ReactNode;
  sceneKey?: string;
}

// Keep scroll positions and expensive page trees stable between tab switches.
export const TabScene = memo(function TabScene({ active, effectsActive = true, render, children, sceneKey }: TabSceneProps) {
  const content = useMemo(() => render ? render() : children, [render, children]);
  const { width } = useWindowDimensions();
  const { palette } = useLiquidGlass();
  const progress = useSharedValue(0);

  useLayoutEffect(() => {
    progress.set(0);
    if (active) progress.set(withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [active, progress, sceneKey]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: active ? 0 : width * 2 }, { translateY: (1 - progress.get()) * 4 }],
  }));
  // Fade a plain cover instead of a blur ancestor. UIKit backdrop effects
  // keep opacity 1, and cached pages retain their layout while offscreen.
  const coverMotion = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.page,
        { zIndex: active ? 2 : 1, backgroundColor: palette.background }, motion,
      ]}
    >
      <SceneActivityContext.Provider value={active && effectsActive}>
        {content}
      </SceneActivityContext.Provider>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }, coverMotion]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
});
