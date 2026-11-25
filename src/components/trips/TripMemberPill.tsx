import { ACTION_COLORS } from '../../theme/actionColors';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, StyleSheet, Text } from 'react-native';
import type { Friend } from '../../types';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { UserAvatar } from '../common/UserAvatar';
import { ItemActionReveal } from '../common/ItemActionReveal';

interface TripMemberPillProps {
  member: Friend;
  removalMode: boolean;
  canRemove: boolean;
  onRemove: (animate: () => Promise<void>) => Promise<boolean>;
}

export function TripMemberPill({ member, removalMode, canRemove, onRemove }: TripMemberPillProps) {
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const [progress] = useState(() => new Animated.Value(1));
  const removing = useRef(false);
  const [pending, setPending] = useState(false);

  useEffect(() => () => { progress.stopAnimation(); }, [progress]);

  const remove = async () => {
    if (removing.current) return;
    removing.current = true;
    setPending(true);
    const animate = () => new Promise<void>(resolve => {
      Animated.timing(progress, {
      toValue: 0, duration: 180, easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    }).start(({ finished }) => {
      if (finished && Platform.OS !== 'web') {
        LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
      }
      resolve();
    });
    });
    let removed = false;
    try { removed = await onRemove(animate); } catch { /* The page shows the failure. */ }
    if (!removed) {
      removing.current = false;
      setPending(false);
      Animated.spring(progress, { toValue: 1, friction: 10, tension: 150, useNativeDriver: Platform.OS !== 'web', isInteraction: false }).start();
    }
  };

  return (
    <ItemActionReveal name={`${member.name} from trip`} onDelete={canRemove ? () => { void remove(); } : undefined} disabled={pending} buttons={false} compact borderRadius={999}>
    <Animated.View style={[
      styles.pill,
      { backgroundColor: Platform.OS === 'ios' && isLiquidGlassEnabled ? 'transparent' : isDark ? '#18181D' : '#EFEFF4', opacity: progress,
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
    ]}>
      <UserAvatar avatarUri={member.avatar} name={member.name} size={20} borderRadius={10} isDark={isDark} />
      <Text style={[styles.name, { color: textColor }]}>{member.name}</Text>
      {removalMode ? (
        <AnimatedPressable
          onPress={remove}
          disabled={pending}
          accessibilityLabel={`Remove ${member.name} from trip`}
          style={styles.badgePosition}
          contentStyle={[styles.badge, { backgroundColor: ACTION_COLORS.danger }]}
          hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
        >
          <TrashBinTrashIcon size={11} color="#FFFFFF" />
        </AnimatedPressable>
      ) : null}
    </Animated.View>
    </ItemActionReveal>
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
});
