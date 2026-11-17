import React, { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { SceneActivityContext } from './SceneActivityContext';

interface TabSceneProps {
  active: boolean;
  effectsActive?: boolean;
  render: () => React.ReactNode;
}

// Keep scroll positions and expensive page trees stable between tab switches.
export const TabScene = memo(function TabScene({ active, effectsActive = true, render }: TabSceneProps) {
  const content = useMemo(() => render(), [render]);
  const [translateY] = useState(() => new Animated.Value(active ? 6 : 0));

  useEffect(() => {
    translateY.stopAnimation();
    if (!active) {
      translateY.setValue(6);
      return;
    }
    const animation = Animated.timing(translateY, {
      toValue: 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, translateY]);

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.page,
        { display: active ? 'flex' : 'none', transform: [{ translateY }] },
      ]}
    >
      <SceneActivityContext.Provider value={active && effectsActive}>
        {content}
      </SceneActivityContext.Provider>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', height: '100%' },
});
