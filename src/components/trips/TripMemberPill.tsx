import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutAnimation, Platform, StyleSheet, Text, View } from 'react-native';
import type { Friend } from '../../types';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';

interface TripMemberPillProps {
  member: Friend;
  removalMode: boolean;
  onRemove: () => boolean;
}

export function TripMemberPill({ member, removalMode, onRemove }: TripMemberPillProps) {
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const [progress] = useState(() => new Animated.Value(1));
  const removing = useRef(false);

  useEffect(() => () => { progress.stopAnimation(); }, [progress]);

  const remove = () => {
    if (removing.current) return;
    removing.current = true;
    Animated.timing(progress, {
      toValue: 0, duration: 180, easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    }).start(({ finished }) => {
      if (!finished) return;
      if (Platform.OS !== 'web') {
        LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
      }
      if (!onRemove()) {
        removing.current = false;
        Animated.spring(progress, {
          toValue: 1, friction: 10, tension: 150, useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }).start();
      }
    });
  };

  return (
    <Animated.View style={[
      styles.pill,
      { backgroundColor: isDark ? '#18181D' : '#EFEFF4', opacity: progress,
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
    ]}>
      {member.avatar ? <Image source={{ uri: member.avatar }} style={styles.avatar} /> : (
        <View style={[styles.avatar, styles.initialCircle, { backgroundColor: isDark ? '#27272F' : '#D4D4D8' }]}>
          <Text style={[styles.initial, { color: textColor }]}>{member.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={[styles.name, { color: textColor }]}>{member.name}</Text>
      {removalMode ? (
        <AnimatedPressable
          onPress={remove}
          accessibilityLabel={`Remove ${member.name} from trip`}
          style={styles.badgePosition}
          contentStyle={[styles.badge, { backgroundColor: isDark ? '#52525B' : '#D4D4D8' }]}
          hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
        >
          <Text style={[styles.minus, { color: textColor }]}>−</Text>
        </AnimatedPressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  initialCircle: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 10, fontWeight: '600' },
  name: { fontSize: 12, fontWeight: '500' },
  badgePosition: { position: 'absolute', top: -5, right: -5, zIndex: 2 },
  badge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  minus: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
});
