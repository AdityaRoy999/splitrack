import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Platform } from 'react-native';
import { triggerSelection } from '../utils/haptics';

/** Shifts an ISO `YYYY-MM-DD` date string cleanly by `deltaDays` (handles month/year boundaries). */
export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = (Number(mStr) || 1) - 1;
  const d = Number(dStr) || 1;
  const next = new Date(y, m, d + deltaDays);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

interface UseDateMonthSwipeOptions {
  onStepDay: (delta: -1 | 1) => void;
  onStepMonth: (delta: -1 | 1) => void;
  holdDurationMs?: number;
  swipeThreshold?: number;
}

interface GesturePointState {
  active: boolean;
  startX: number;
  startY: number;
  startAt: number;
  monthUnlocked: boolean;
}

/**
 * Distinguishes quick horizontal swipes (step day by ±1) from
 * holding 2s then swiping left/right (step month by ±1) using native touch + web mouse event handlers.
 */
export function useDateMonthSwipeGesture({
  onStepDay,
  onStepMonth,
  holdDurationMs = 2000,
  swipeThreshold = 34,
}: UseDateMonthSwipeOptions) {
  const [isMonthHoldReady, setIsMonthHoldReady] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointRef = useRef<GesturePointState>({
    active: false,
    startX: 0,
    startY: 0,
    startAt: 0,
    monthUnlocked: false,
  });

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const resetGesture = useCallback(() => {
    clearHoldTimer();
    pointRef.current.active = false;
    pointRef.current.monthUnlocked = false;
    setIsMonthHoldReady(false);
  }, [clearHoldTimer]);

  const startTrack = useCallback(
    (x: number, y: number) => {
      clearHoldTimer();
      pointRef.current = {
        active: true,
        startX: x,
        startY: y,
        startAt: Date.now(),
        monthUnlocked: false,
      };
      setIsMonthHoldReady(false);

      holdTimerRef.current = setTimeout(() => {
        if (!pointRef.current.active) return;
        pointRef.current.monthUnlocked = true;
        setIsMonthHoldReady(true);
        triggerSelection();
      }, holdDurationMs);
    },
    [clearHoldTimer, holdDurationMs]
  );

  const moveTrack = useCallback(
    (x: number, y: number) => {
      const state = pointRef.current;
      if (!state.active || state.monthUnlocked) return;
      const dist = Math.hypot(x - state.startX, y - state.startY);
      if (dist > 14 && Date.now() - state.startAt < holdDurationMs) {
        clearHoldTimer();
      }
    },
    [clearHoldTimer, holdDurationMs]
  );

  const endTrack = useCallback(
    (x: number, y: number) => {
      const state = pointRef.current;
      if (!state.active) {
        resetGesture();
        return;
      }

      const dx = x - state.startX;
      const dy = y - state.startY;
      const useMonthMode =
        state.monthUnlocked || Date.now() - state.startAt >= holdDurationMs;

      if (Math.abs(dx) >= swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.15) {
        const delta: -1 | 1 = dx < 0 ? 1 : -1;
        triggerSelection();
        if (useMonthMode) {
          onStepMonth(delta);
        } else {
          onStepDay(delta);
        }
      }

      resetGesture();
    },
    [holdDurationMs, onStepDay, onStepMonth, resetGesture, swipeThreshold]
  );

  useEffect(() => clearHoldTimer, [clearHoldTimer]);

  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const pt = e.nativeEvent;
      startTrack(pt.pageX, pt.pageY);
    },
    [startTrack]
  );

  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const pt = e.nativeEvent;
      moveTrack(pt.pageX, pt.pageY);
    },
    [moveTrack]
  );

  const onTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      const pt = e.nativeEvent;
      endTrack(pt.pageX, pt.pageY);
    },
    [endTrack]
  );

  const onMouseDown = useCallback(
    (e: { pageX: number; pageY: number }) => {
      startTrack(e.pageX, e.pageY);
    },
    [startTrack]
  );

  const onMouseMove = useCallback(
    (e: { pageX: number; pageY: number }) => {
      moveTrack(e.pageX, e.pageY);
    },
    [moveTrack]
  );

  const onMouseUp = useCallback(
    (e: { pageX: number; pageY: number }) => {
      endTrack(e.pageX, e.pageY);
    },
    [endTrack]
  );

  const gestureHandlers =
    Platform.OS === 'web'
      ? ({
          onTouchStart,
          onTouchMove,
          onTouchEnd,
          onTouchCancel: resetGesture,
          onMouseDown,
          onMouseMove,
          onMouseUp,
          onMouseLeave: resetGesture,
        } as Record<string, unknown>)
      : {
          onTouchStart,
          onTouchMove,
          onTouchEnd,
          onTouchCancel: resetGesture,
        };

  return { gestureHandlers, isMonthHoldReady };
}
