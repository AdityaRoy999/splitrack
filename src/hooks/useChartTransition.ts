import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Swap chart data while hidden, then reveal it after React commits the new SVG. */
export function useChartTransition(ready = true) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateX] = useState(() => new Animated.Value(0));
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ sequence: number; direction: -1 | 0 | 1 } | null>(null);

  const runChartTransition = useCallback((direction: -1 | 0 | 1, commit: () => void) => {
    const current = ++sequence.current;
    pending.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    animation.current?.stop();

    const exit = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0, duration: 90, easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
      }),
      Animated.timing(translateX, {
        toValue: -direction * 12, duration: 90, easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
      }),
    ]);
    animation.current = exit;
    exit.start(({ finished }) => {
      if (!finished || !mounted.current || current !== sequence.current) return;
      pending.current = { sequence: current, direction };
      commit();
      setRevision((value) => value + 1);
    });
  }, [opacity, translateX]);

  useLayoutEffect(() => {
    const next = pending.current;
    if (!next || next.sequence !== sequence.current) return;
    if (!ready) return;
    translateX.setValue(next.direction * 12);
    opacity.setValue(0);

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!mounted.current || next.sequence !== sequence.current) return;
      // A cache refresh can change readiness between this commit and the next
      // frame. Keep the pending reveal until a ready frame actually runs.
      pending.current = null;
      const enter = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: 210, easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
        }),
        Animated.timing(translateX, {
          toValue: 0, duration: 240, easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
        }),
      ]);
      animation.current = enter;
      enter.start();
    });

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [revision, ready, opacity, translateX]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
      pending.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      animation.current?.stop();
      opacity.stopAnimation();
      translateX.stopAnimation();
    };
  }, [opacity, translateX]);

  return { runChartTransition, opacity, translateX, revision };
}
