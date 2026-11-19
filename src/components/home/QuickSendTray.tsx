import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { ClipPath, Defs, ForeignObject, Path } from 'react-native-svg';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { HorizontalEdgeFade, useHorizontalScrollEdges } from '../common/ScrollEdgeFade';
import { UserAvatar } from '../common/UserAvatar';

const AVATAR_SIZE = 54;
const CHECK_ICON_SIZE = 16;
const CUTOUT_CENTER_X = 45.5;
const CUTOUT_CENTER_Y = 45.5;
const CUTOUT_RADIUS = 10.8;

/** Computes a closed SVG path of a circle with a true transparent circular cutout at the bottom-right corner. */
function buildCircleNotchPath(size: number, cutX: number, cutY: number, cutR: number): string {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const dx = cutX - cx;
  const dy = cutY - cy;
  const d = Math.hypot(dx, dy);
  const a = (r * r - cutR * cutR + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const mx = cx + (a * dx) / d;
  const my = cy + (a * dy) / d;
  const p1x = (mx - (h * dy) / d).toFixed(3);
  const p1y = (my + (h * dx) / d).toFixed(3);
  const p2x = (mx + (h * dy) / d).toFixed(3);
  const p2y = (my - (h * dx) / d).toFixed(3);
  return `M ${p1x},${p1y} A ${r},${r} 0 1 1 ${p2x},${p2y} A ${cutR},${cutR} 0 0 0 ${p1x},${p1y} Z`;
}

const SETTLED_AVATAR_CUTOUT_PATH = buildCircleNotchPath(
  AVATAR_SIZE,
  CUTOUT_CENTER_X,
  CUTOUT_CENTER_Y,
  CUTOUT_RADIUS
);

interface QuickSendTrayProps {
  onSelectFriend: (friend: Friend) => void;
  onAddFriend: () => void;
}

export const QuickSendTray: React.FC<QuickSendTrayProps> = ({
  onSelectFriend,
  onAddFriend,
}) => {
  const { friends } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const scrollEdges = useHorizontalScrollEdges();
  const isDark = themeMode === 'dark';

  const handlePressFriend = (friend: Friend) => {
    triggerImpact(ImpactStyle.Light);
    onSelectFriend(friend);
  };

  const handlePressAdd = () => {
    triggerImpact(ImpactStyle.Medium);
    onAddFriend();
  };

  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: textColor }]}>Quick Send & Settle</Text>
        <AnimatedPressable
          onPress={handlePressAdd}
          scaleTo={0.9}
          contentStyle={[
            styles.addBtn,
            { backgroundColor: isDark ? '#18181D' : '#FFFFFF' },
          ]}
        >
          <AddCircleIcon size={18} color={textColor} />
        </AnimatedPressable>
      </View>

      <HorizontalEdgeFade style={styles.horizontalBlurWrap} tint={isDark ? '#09090B' : '#F4F4F8'} width={22} left={scrollEdges.left} right={scrollEdges.right}>
        <ScrollView
          horizontal
          onScroll={scrollEdges.onScroll}
          onLayout={scrollEdges.onLayout}
          onContentSizeChange={scrollEdges.onContentSizeChange}
          scrollEventThrottle={16}
          style={styles.horizontalScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        {friends.map((friend) => {
          const isOwed = friend.netBalance > 0;
          const isOwing = friend.netBalance < 0;
          const isSettled = friend.netBalance === 0;
          const avatarBg = isDark ? '#1E1E24' : '#E5E7EB';
          const clipId = `quick-cutout-${friend.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

          return (
            <AnimatedPressable
              key={friend.id}
              scaleTo={0.93}
              onPress={() => handlePressFriend(friend)}
              contentStyle={styles.friendItem}
            >
              <View style={styles.avatarWrapper}>
                {isSettled ? (
                  <Svg
                    width={AVATAR_SIZE}
                    height={AVATAR_SIZE}
                    viewBox={`0 0 ${AVATAR_SIZE} ${AVATAR_SIZE}`}
                  >
                    <Defs>
                      <ClipPath id={clipId}>
                        <Path d={SETTLED_AVATAR_CUTOUT_PATH} />
                      </ClipPath>
                    </Defs>
                    <ForeignObject x={0} y={0} width={AVATAR_SIZE} height={AVATAR_SIZE} clipPath={`url(#${clipId})`}>
                      <UserAvatar avatarUri={friend.avatar} name={friend.name} size={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} isDark={isDark} />
                    </ForeignObject>
                  </Svg>
                ) : (
                  <UserAvatar avatarUri={friend.avatar} name={friend.name} size={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} isDark={isDark} style={{ backgroundColor: avatarBg }} />
                )}
                {isOwed && (
                  <View style={[styles.badge, styles.badgeOwed]}>
                    <Text style={styles.badgeText}>+{Math.round(friend.netBalance)}</Text>
                  </View>
                )}
                {isOwing && (
                  <View style={[styles.badge, styles.badgeOwing]}>
                    <Text style={styles.badgeText}>-{Math.round(Math.abs(friend.netBalance))}</Text>
                  </View>
                )}
                {isSettled && (
                  <View pointerEvents="none" style={styles.badgeSettledIcon}>
                    <CheckCircleIcon
                      size={CHECK_ICON_SIZE}
                      color="#10B981"
                    />
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.friendName, { color: isDark ? '#D4D4D8' : '#374151' }]}
              >
                {friend.name}
              </Text>
            </AnimatedPressable>
          );
        })}
        </ScrollView>
      </HorizontalEdgeFade>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  horizontalBlurWrap: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  horizontalScroll: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  friendItem: {
    alignItems: 'center',
    width: 68,
  },
  avatarWrapper: {
    position: 'relative',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: 6,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  badgeOwed: {
    backgroundColor: '#10B981',
  },
  badgeOwing: {
    backgroundColor: '#EF4444',
  },
  badgeSettledIcon: {
    position: 'absolute',
    left: CUTOUT_CENTER_X - CHECK_ICON_SIZE / 2,
    top: CUTOUT_CENTER_Y - CHECK_ICON_SIZE / 2,
    width: CHECK_ICON_SIZE,
    height: CHECK_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '500',
  },
  friendName: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },
});
