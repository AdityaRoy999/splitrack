import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { InfoCircleIcon } from '@solar-icons/react-native/linear/info-circle';
import type { NotificationDirection, ThemeMode } from '../../types';

export interface BubbleNotice {
  id: number;
  message: string;
  durationMs?: number;
  tone?: 'success' | 'info';
}

interface BottomBubbleProps {
  notice: BubbleNotice | null;
  onDismiss: () => void;
}

type QueuedNotice = { source: string; notice: BubbleNotice; onDismiss: () => void };
const NoticeContext = createContext<{
  publish: (source: string, notice: BubbleNotice, onDismiss: () => void) => void;
  remove: (source: string) => void;
  registerHost: (host: string) => void;
  unregisterHost: (host: string) => void;
  active: QueuedNotice | undefined;
  activeHost: string | undefined;
  finish: (entry: QueuedNotice) => void;
  themeMode: ThemeMode;
  notificationDirection: NotificationDirection;
  reserveTop: (source: string, height: number) => void;
  topObstruction: number;
} | null>(null);

/** A single host prevents independent success/offline notices from overlapping. */
export function BubbleNoticeProvider({ children, themeMode, notificationDirection }: {
  children: React.ReactNode;
  themeMode: ThemeMode;
  notificationDirection: NotificationDirection;
}) {
  const [queue, setQueue] = useState<QueuedNotice[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  const [topReservations, setTopReservations] = useState<Record<string, number>>({});
  const queueRef = useRef(queue);
  useLayoutEffect(() => { queueRef.current = queue; }, [queue]);
  const publish = useCallback((source: string, notice: BubbleNotice, onDismiss: () => void) => {
    setQueue(current => [...current.filter(entry => entry.source !== source), { source, notice, onDismiss }]);
  }, []);
  const remove = useCallback((source: string) => {
    setQueue(current => current.some(entry => entry.source === source) ? current.filter(entry => entry.source !== source) : current);
  }, []);
  const registerHost = useCallback((host: string) => setHosts(current => [...current.filter(id => id !== host), host]), []);
  const unregisterHost = useCallback((host: string) => setHosts(current => current.filter(id => id !== host)), []);
  const reserveTop = useCallback((source: string, height: number) => {
    setTopReservations(current => current[source] === height ? current : { ...current, [source]: height });
  }, []);
  const finish = useCallback((entry: QueuedNotice) => {
    // A completion from an old host or notice cannot remove its replacement.
    if (queueRef.current[0] !== entry) return;
    queueRef.current = queueRef.current.filter(current => current !== entry);
    setQueue(current => current.filter(item => item !== entry));
    entry.onDismiss();
  }, []);
  const active = queue[0];
  const activeHost = hosts.at(-1);
  const topObstruction = Math.max(0, ...Object.values(topReservations));
  const context = useMemo(() => ({ publish, remove, registerHost, unregisterHost, active, activeHost, finish, themeMode, notificationDirection, reserveTop, topObstruction }), [publish, remove, registerHost, unregisterHost, active, activeHost, finish, themeMode, notificationDirection, reserveTop, topObstruction]);
  return <NoticeContext.Provider value={context}>
    {children}
    <BubbleNoticeHost root />
  </NoticeContext.Provider>;
}

/** Reserve space for an inline status header without moving modal notices. */
export function useNoticeTopReservation(active: boolean) {
  const context = useContext(NoticeContext);
  const source = useId();
  const reserve = context?.reserveTop;
  useLayoutEffect(() => () => reserve?.(source, 0), [active, reserve, source]);
  return useCallback((event: LayoutChangeEvent) => {
    if (active) reserve?.(source, event.nativeEvent.layout.height);
  }, [active, reserve, source]);
}

/** Mount within each retained native modal so notices stay above that modal. */
export function BubbleNoticeHost({ root = false }: { root?: boolean }) {
  const context = useContext(NoticeContext);
  const host = useId();
  const register = context?.registerHost, unregister = context?.unregisterHost;
  useLayoutEffect(() => {
    if (root || !register || !unregister) return;
    register(host);
    return () => unregister(host);
  }, [host, register, root, unregister]);
  if (!context?.active || (root ? context.activeHost !== undefined : context.activeHost !== host)) return null;
  const entry = context.active;
  return <BubbleView
    key={`${entry.source}:${entry.notice.id}`}
    notice={entry.notice}
    themeMode={context.themeMode}
    notificationDirection={context.notificationDirection}
    topObstruction={root ? context.topObstruction : 0}
    onDismiss={() => context.finish(entry)}
  />;
}

export function BottomBubble({ notice, onDismiss }: BottomBubbleProps) {
  const context = useContext(NoticeContext);
  const source = useId();
  const dismissRef = useRef(onDismiss);
  const latestNotice = useRef(notice);
  useLayoutEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useLayoutEffect(() => { latestNotice.current = notice; }, [notice]);
  const publish = context?.publish, remove = context?.remove;
  useEffect(() => {
    if (!publish || !remove || !notice) return;
    publish(source, notice, () => { if (latestNotice.current === notice) dismissRef.current(); });
    return () => remove(source);
  }, [notice, publish, remove, source]);
  return null;
}

function BubbleView({ notice, onDismiss, themeMode, notificationDirection, topObstruction = 0 }: BottomBubbleProps & {
  themeMode: ThemeMode;
  notificationDirection: NotificationDirection;
  topObstruction?: number;
}) {
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const [bubbleHeight, setBubbleHeight] = useState(72);
  // The keyed host keeps the entry direction fixed for the entire notice.
  const [entryDirection] = useState(notificationDirection);
  const noticeId = notice?.id;
  const durationMs = notice?.durationMs ?? 2600;
  const dismissRef = useRef(onDismiss);
  const exitRef = useRef<(() => void) | null>(null);
  const top = Math.max(16, insets.top + 12, topObstruction + 12);
  useLayoutEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (noticeId === undefined) return;
    let cancelled = false;
    let exiting = false;
    const useNativeDriver = Platform.OS !== 'web';
    progress.stopAnimation();
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1, friction: 8, tension: 85, useNativeDriver, isInteraction: false,
    }).start();
    const exit = () => {
      if (cancelled || exiting) return;
      exiting = true;
      clearTimeout(timer);
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver,
        isInteraction: false,
      }).start(({ finished }) => {
        if (finished && !cancelled) dismissRef.current();
      });
    };
    const timer = setTimeout(exit, durationMs);
    exitRef.current = exit;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      progress.stopAnimation();
      if (exitRef.current === exit) exitRef.current = null;
    };
  }, [durationMs, noticeId, progress]);

  if (!notice) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={event => setBubbleHeight(event.nativeEvent.layout.height)}
      style={[
        styles.wrap,
        {
          ...(entryDirection === 'top'
            ? { top }
            : { bottom: Math.max(26, insets.bottom + 12) }), opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [entryDirection === 'top' ? -(bubbleHeight + top + 16) : bubbleHeight + insets.bottom + 38, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.bubble, { backgroundColor: themeMode === 'dark' ? '#1F2026' : '#18181B' }]}>
        {notice.tone === 'info' ? <InfoCircleIcon size={18} color="#A1A1AA" /> : <CheckCircleIcon size={18} color="#10B981" />}
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.text}>
          {notice.message}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={() => exitRef.current?.()}
          style={styles.close}
        >
          <CloseCircleIcon size={18} color="#A1A1AA" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 999 },
  bubble: {
    flexDirection: 'row', alignItems: 'center', maxWidth: '100%', paddingVertical: 12,
    paddingLeft: 18, paddingRight: 4, borderRadius: 999, gap: 9, borderWidth: 0,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 20, elevation: 10,
  },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', flexShrink: 1 },
  close: { width: 44, height: 44, marginVertical: -10, alignItems: 'center', justifyContent: 'center' },
});
