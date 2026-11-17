import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

let snapshot = { foreground: AppState.currentState !== 'background' && AppState.currentState !== 'inactive', reducedMotion: false };
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;

function update(next: Partial<typeof snapshot>) {
  const value = { ...snapshot, ...next };
  if (value.foreground === snapshot.foreground && value.reducedMotion === snapshot.reducedMotion) return;
  snapshot = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    let subscribed = true;
    const appState = AppState.addEventListener('change', (state) => update({ foreground: state === 'active' }));
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (reducedMotion) => update({ reducedMotion }));
    update({ foreground: AppState.currentState !== 'background' && AppState.currentState !== 'inactive' });
    AccessibilityInfo.isReduceMotionEnabled().then((reducedMotion) => {
      if (subscribed) update({ reducedMotion });
    }).catch(() => {});
    stopListening = () => {
      subscribed = false;
      appState.remove();
      motion.remove();
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}

const getSnapshot = () => snapshot;

// Share native listeners across all cards instead of subscribing once per Aurora.
export const useVisualActivity = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
