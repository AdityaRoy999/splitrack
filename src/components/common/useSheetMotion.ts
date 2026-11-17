import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { useSheetModal } from './SheetModal';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function useSheetMotion(distance: number) {
  const { open, close, finishExit } = useSheetModal();
  const [translateY] = useState(() => new Animated.Value(distance));
  const openRef = useRef(open);
  const closeRef = useRef(close);
  const dragStart = useRef(0);
  useLayoutEffect(() => { openRef.current = open; closeRef.current = close; }, [close, open]);

  const restore = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0, stiffness: 420, damping: 34, mass: 0.65,
      useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
    }).start();
  }, [translateY]);

  useEffect(() => {
    const animation = open
      ? Animated.spring(translateY, {
          toValue: 0, stiffness: 420, damping: 34, mass: 0.65,
          useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
        })
      : Animated.timing(translateY, {
          toValue: distance, duration: 220, easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false,
        });
    animation.start(({ finished }) => { if (finished && !open) finishExit(); });
    return () => animation.stop();
  }, [distance, finishExit, open, translateY]);

  const shouldDrag = useCallback((_: GestureResponderEvent, gesture: PanResponderGestureState) =>
    openRef.current && gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx), []);
  const startDrag = useCallback(() => {
    translateY.stopAnimation((value) => { dragStart.current = value; });
  }, [translateY]);
  const moveDrag = useCallback((_: GestureResponderEvent, gesture: PanResponderGestureState) => {
    translateY.setValue(Math.max(0, dragStart.current + gesture.dy));
  }, [translateY]);
  const endDrag = useCallback((_: GestureResponderEvent, gesture: PanResponderGestureState) => {
    if (gesture.dy > 90 || (gesture.dy > 20 && gesture.vy > 0.7)) closeRef.current();
    else restore();
  }, [restore]);

  // PanResponder stores these callbacks; it invokes them only for gesture events.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    // This responder is attached only to the dedicated drag handle. Claim the
    // start so its first movement cannot be taken by the sheet's scroll view.
    onStartShouldSetPanResponder: () => openRef.current,
    onMoveShouldSetPanResponder: shouldDrag,
    onPanResponderGrant: startDrag,
    onPanResponderMove: moveDrag,
    onPanResponderRelease: endDrag,
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: restore,
  }), [endDrag, moveDrag, restore, shouldDrag, startDrag]);

  return { translateY, panHandlers: responder.panHandlers, close };
}
