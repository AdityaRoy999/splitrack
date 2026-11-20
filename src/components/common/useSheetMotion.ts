import { useEffect } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSheetModal } from './SheetModal';

const SHEET_SPRING = {
  stiffness: 420, damping: 36, mass: 0.65,
  overshootClamping: true, reduceMotion: ReduceMotion.System,
};

// Translation and finger tracking both run on the UI thread. React only handles
// the completed dismissal, so rendering the form cannot stall a sheet's motion.
export function useSheetMotion(distance: number, layoutReady = true) {
  const { open, ready: modalReady, close, finishExit } = useSheetModal();
  const ready = modalReady && layoutReady;
  const translateY = useSharedValue(distance);
  const dragStart = useSharedValue(0);
  const closing = useSharedValue(false);

  useEffect(() => {
    closing.set(!open);
    if (!ready) {
      translateY.set(distance);
      if (!open) finishExit();
      return;
    }
    translateY.set(open
      ? withSpring(0, SHEET_SPRING)
      : withTiming(distance, {
          duration: 210, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System,
        }, (finished) => { if (finished) scheduleOnRN(finishExit); }));
    return () => cancelAnimation(translateY);
  }, [closing, distance, finishExit, open, ready, translateY]);

  const gesture = usePanGesture({
    enabled: open && ready,
    activeOffsetY: 6,
    failOffsetX: [-24, 24],
    onBegin: () => {
      'worklet';
      cancelAnimation(translateY);
      dragStart.set(translateY.get());
    },
    onUpdate: (event) => {
      'worklet';
      translateY.set(Math.max(0, dragStart.get() + event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled && (event.translationY > 100 || (event.translationY > 20 && event.velocityY > 700))) {
        closing.set(true);
        scheduleOnRN(close);
      }
    },
    onFinalize: () => {
      'worklet';
      if (!closing.get()) translateY.set(withSpring(0, SHEET_SPRING));
    },
  });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return { animatedStyle, gesture, close };
}
