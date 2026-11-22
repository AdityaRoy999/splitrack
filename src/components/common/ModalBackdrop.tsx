import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { useSheetModal } from './SheetModal';
import { useNativeSheetPresentation } from './NativeSheetPresentation';

export function ModalBackdrop({ onClose, label = 'Dismiss modal backdrop', shadeColor = 'rgba(0, 0, 0, 0.72)' }: { onClose: () => void; label?: string; shadeColor?: string }) {
  const { open, ready } = useSheetModal();
  const native = useNativeSheetPresentation();
  const pressStartedHere = useRef(false);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!ready || native) return;
    const animation = Animated.timing(opacity, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [native, opacity, open, ready]);

  if (native) return null;

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      accessibilityLabel={label}
      accessibilityRole="button"
      onAccessibilityTap={onClose}
      onPressIn={() => { pressStartedHere.current = true; }}
      onPress={() => {
        // Web can dispatch a click without a press starting on this surface.
        const shouldClose = pressStartedHere.current;
        pressStartedHere.current = false;
        if (shouldClose) onClose();
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: shadeColor, opacity }]}
      />
    </Pressable>
  );
}
