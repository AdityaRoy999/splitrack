import { useCallback, useEffect, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { measure, useAnimatedRef, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { isEffectVisible } from './effectVisibility';

// Retained ScrollViews keep their entire card tree mounted. Tab visibility alone
// cannot stop GL work for cards below or above the visible part of that tab.
export function useAndroidEffectVisibility(active: boolean) {
  const ref = useAnimatedRef<View>();
  const { width, height } = useWindowDimensions();
  const android = Platform.OS === 'android';
  const [visible, setVisible] = useState(!android);
  const lastCheck = useSharedValue(-1000);
  const lastVisible = useSharedValue(!android);
  const report = useCallback((next: boolean) => setVisible(next), []);
  const checkVisibility = useCallback(({ timestamp }: { timestamp: number }) => {
    'worklet';
    if (timestamp - lastCheck.get() < 250) return;
    lastCheck.set(timestamp);
    const next = isEffectVisible(measure(ref), width, height);
    if (next !== lastVisible.get()) {
      lastVisible.set(next);
      scheduleOnRN(report, next);
    }
  }, [height, lastCheck, lastVisible, ref, report, width]);
  const frame = useFrameCallback(checkVisibility, false);
  useEffect(() => {
    frame.setActive(android && active);
    return () => frame.setActive(false);
  }, [active, android, frame]);
  return { ref, visible: !android || visible };
}
