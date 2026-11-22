import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useSheetModal } from './SheetModal';
import { useNativeSheetPresentation } from './NativeSheetPresentation';

// Animate geometry only. UIKit blur and Liquid Glass ancestors stay at opacity 1.
export function usePopupMotion() {
  const { open, ready, close, finishExit } = useSheetModal();
  const native = useNativeSheetPresentation();
  const [progress] = useState(() => new Animated.Value(native ? 1 : 0));
  useEffect(() => {
    if (native) { progress.setValue(1); return; }
    if (!ready) {
      if (!open) finishExit();
      return;
    }
    const animation = open
      ? Animated.spring(progress, { toValue: 1, tension: 68, friction: 10, overshootClamping: true, useNativeDriver: Platform.OS !== 'web', isInteraction: false })
      : Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(({ finished }) => { if (finished && !open) finishExit(); });
    return () => animation.stop();
  }, [finishExit, native, open, progress, ready]);
  return { progress, close };
}
