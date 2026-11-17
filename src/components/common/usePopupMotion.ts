import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useSheetModal } from './SheetModal';

// Animate geometry only. UIKit blur and Liquid Glass ancestors stay at opacity 1.
export function usePopupMotion() {
  const { open, close, finishExit } = useSheetModal();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = open
      ? Animated.spring(progress, { toValue: 1, tension: 68, friction: 9, useNativeDriver: Platform.OS !== 'web', isInteraction: false })
      : Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(({ finished }) => { if (finished && !open) finishExit(); });
    return () => animation.stop();
  }, [finishExit, open, progress]);
  return { progress, close };
}
