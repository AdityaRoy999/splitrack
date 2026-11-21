import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAuth } from '../../auth/AuthContext';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { measureNodeInWindow, type ViewRefNode, type WindowRect } from '../../utils/measureWindow';
import { UserAvatar } from './UserAvatar';

const AVATAR_SIZE = 92;
const Context = createContext<{ moving: boolean; open(source: ViewRefNode | null): void; close(source: ViewRefNode | null, onClose: () => void): void; destination(node: ViewRefNode | null): void; registerSource(node: ViewRefNode | null): void } | null>(null);
export const useSettingsAvatarTransition = () => useContext(Context);

interface AvatarFlight {
  id: number;
  root: WindowRect;
  from: WindowRect;
  to: WindowRect | null;
  direction: 'enter' | 'exit';
  fromRadius: number;
}

export function SettingsAvatarTransitionProvider({ children, onOpen }: { children: React.ReactNode; onOpen(): void }) {
  const { profile } = useAuth();
  const { themeMode } = useLiquidGlass();
  const root = useRef<ViewRefNode>(null);
  const headerSource = useRef<ViewRefNode>(null);
  const returnAnchor = useRef<{ root: WindowRect; header: WindowRect } | null>(null);
  const sequence = useRef(0);
  const active = useRef(false);
  const returning = useRef(false);
  const measurementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flight, setFlight] = useState<AvatarFlight | null>(null);
  const progress = useSharedValue(0);
  const registerSource = useCallback((node: ViewRefNode | null) => { headerSource.current = node; }, []);
  const finish = useCallback((id: number) => {
    if (sequence.current !== id) return;
    active.current = false;
    returning.current = false;
    setFlight(null);
  }, []);
  const open = useCallback((source: ViewRefNode | null) => {
    if (active.current) return;
    const sourceNode = source ?? headerSource.current;
    if (!sourceNode) { onOpen(); return; }
    active.current = true;
    returning.current = false;
    const id = ++sequence.current;
    let settled = false;
    let rootRect: WindowRect | null = null;
    let sourceRect: WindowRect | null = null;
    const start = (fallback = false) => {
      if (settled || sequence.current !== id || (!fallback && (!rootRect || !sourceRect))) return;
      settled = true;
      if (measurementTimer.current) clearTimeout(measurementTimer.current);
      measurementTimer.current = null;
      if (rootRect && sourceRect) {
        returnAnchor.current = { root: rootRect, header: sourceRect };
        progress.set(0);
        setFlight({ id, root: rootRect, from: sourceRect, to: null, direction: 'enter', fromRadius: 14 });
      } else active.current = false;
      onOpen();
    };
    // Wait for both native measurements. Late callbacks cannot open Settings
    // a second time or start a flight after the measurement fallback.
    measurementTimer.current = setTimeout(() => start(true), 120);
    measureNodeInWindow(root.current, rect => { rootRect = rect; start(); });
    measureNodeInWindow(sourceNode, rect => { sourceRect = rect; start(); });
  }, [onOpen, progress]);
  const destination = useCallback((node: ViewRefNode | null) => {
    if (!active.current) return;
    const id = sequence.current;
    measureNodeInWindow(node, rect => setFlight(current => {
      // onLayout and the mount measurement may both report. Lock the first
      // destination so later layout events cannot restart the animation.
      if (!current || current.direction !== 'enter' || current.id !== id || current.to) return current;
      return { ...current, to: rect };
    }));
  }, []);
  const close = useCallback((source: ViewRefNode | null, onClose: () => void) => {
    if (returning.current) return;
    returning.current = true;
    const anchor = returnAnchor.current;
    const id = ++sequence.current;
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
    measurementTimer.current = null;
    if (!anchor) {
      active.current = false;
      returning.current = false;
      setFlight(null);
      onClose();
      return;
    }
    active.current = true;
    // The header is translated offscreen while Settings is open. Its entry
    // coordinates are the stable destination, including the saved scroll offset.
    let settled = false;
    let rootRect: WindowRect | null = null;
    let sourceRect: WindowRect | null = null;
    const start = (fallback = false) => {
      if (settled || sequence.current !== id || (!fallback && (!rootRect || !sourceRect))) return;
      settled = true;
      if (measurementTimer.current) clearTimeout(measurementTimer.current);
      measurementTimer.current = null;
      const currentRoot = rootRect ?? anchor.root;
      let from = sourceRect;
      let radius = 28;
      // A quick Back press can interrupt the outward flight. Continue from its
      // current position instead of jumping to the Settings photo first.
      if (flight) {
        const p = Math.max(0, Math.min(1, progress.get()));
        const to = flight.to ?? flight.from;
        from = {
          x: flight.from.x + (to.x - flight.from.x) * p,
          y: flight.from.y + (to.y - flight.from.y) * p,
          width: flight.from.width + (to.width - flight.from.width) * p,
          height: flight.from.height + (to.height - flight.from.height) * p,
        };
        radius = flight.fromRadius + ((flight.direction === 'enter' ? 28 : 14) - flight.fromRadius) * p;
      }
      cancelAnimation(progress);
      const visible = from && from.y + from.height > currentRoot.y && from.y < currentRoot.y + currentRoot.height && from.x + from.width > currentRoot.x && from.x < currentRoot.x + currentRoot.width;
      if (from && visible) {
        progress.set(0);
        setFlight({ id, root: currentRoot, from, to: { ...anchor.header, x: anchor.header.x + currentRoot.x - anchor.root.x, y: anchor.header.y + currentRoot.y - anchor.root.y }, direction: 'exit', fromRadius: radius });
      } else {
        active.current = false;
        returning.current = false;
        setFlight(null);
      }
      // Reveal the retained main screen behind the returning photo. The real
      // header avatar stays hidden until the flight hands it back at full size.
      onClose();
    };
    measurementTimer.current = setTimeout(() => start(true), 120);
    measureNodeInWindow(root.current, rect => { rootRect = rect; start(); });
    measureNodeInWindow(source, rect => { sourceRect = rect; start(); });
  }, [flight, progress]);
  useLayoutEffect(() => {
    if (!flight?.to) return;
    const id = flight.id;
    progress.set(withTiming(1, { duration: 340, easing: Easing.bezier(0.22, 1, 0.36, 1), reduceMotion: ReduceMotion.System }, done => {
      if (done) scheduleOnRN(finish, id);
    }));
    return () => cancelAnimation(progress);
  }, [finish, flight, progress]);
  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(() => finish(flight.id), 900);
    return () => clearTimeout(timer);
  }, [finish, flight]);
  useEffect(() => () => {
    sequence.current++;
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
  }, []);
  const from = flight?.from;
  const to = flight?.to ?? from;
  const originX = flight?.root.x ?? 0;
  const originY = flight?.root.y ?? 0;
  const fromRadius = flight?.fromRadius ?? 14;
  const toRadius = flight?.direction === 'exit' ? 14 : 28;
  // Worklets capture serializable coordinates, never native View refs.
  const frame = useAnimatedStyle(() => {
    const p = progress.get();
    const size = from && to ? from.width + (to.width - from.width) * p : 42;
    const scale = size / AVATAR_SIZE;
    // Move a fixed decoded image using transforms. Animating layout bounds
    // would resize/re-layout the native image on every Android frame.
    const x = from && to ? from.x + from.width / 2 + (to.x + to.width / 2 - from.x - from.width / 2) * p - originX - AVATAR_SIZE / 2 : 0;
    const y = from && to ? from.y + from.height / 2 + (to.y + to.height / 2 - from.y - from.height / 2) * p - originY - AVATAR_SIZE / 2 : 0;
    return { transform: [{ translateX: x }, { translateY: y }, { scale }], borderRadius: (fromRadius + (toRadius - fromRadius) * p) / scale };
  });
  const context = useMemo(() => ({ moving: flight !== null, open, close, destination, registerSource }), [flight, open, close, destination, registerSource]);
  return <Context.Provider value={context}>
    <View ref={root} collapsable={false} style={styles.root}>
      {children}
      {flight ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.flying, frame]}>
        <UserAvatar avatarUri={profile?.avatar} name={profile?.displayName} size={AVATAR_SIZE} borderRadius={0} isDark={themeMode === 'dark'} />
      </Animated.View> : null}
    </View>
  </Context.Provider>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, flying: { position: 'absolute', top: 0, left: 0, width: AVATAR_SIZE, height: AVATAR_SIZE, zIndex: 1000, overflow: 'hidden' } });
