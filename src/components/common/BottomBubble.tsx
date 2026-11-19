import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

export interface BubbleNotice {
  id: number;
  message: string;
}

interface BottomBubbleProps {
  notice: BubbleNotice | null;
  onDismiss: () => void;
}

export function BottomBubble({ notice, onDismiss }: BottomBubbleProps) {
  const { themeMode, notificationDirection } = useLiquidGlass();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const noticeId = notice?.id;
  const dismissRef = useRef(onDismiss);
  useLayoutEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (noticeId === undefined) return;
    let cancelled = false;
    const useNativeDriver = Platform.OS !== 'web';
    progress.stopAnimation();
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1, friction: 8, tension: 85, useNativeDriver, isInteraction: false,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver,
        isInteraction: false,
      }).start(({ finished }) => {
        if (finished && !cancelled) dismissRef.current();
      });
    }, 2600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [noticeId, progress]);

  if (!notice) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          ...(notificationDirection === 'top'
            ? { top: Math.max(16, insets.top + 12) }
            : { bottom: Math.max(26, insets.bottom + 12) }), opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [notificationDirection === 'top' ? -72 : 72, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.bubble, { backgroundColor: themeMode === 'dark' ? '#1F2026' : '#18181B' }]}>
        <CheckCircleIcon size={18} color="#10B981" />
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.text}>
          {notice.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 999 },
  bubble: {
    flexDirection: 'row', alignItems: 'center', maxWidth: '100%', paddingVertical: 12,
    paddingHorizontal: 18, borderRadius: 999, gap: 9, borderWidth: 0,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 20, elevation: 10,
  },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
