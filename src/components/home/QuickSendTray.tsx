import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GradualBlur } from '../effects/GradualBlur';

interface QuickSendTrayProps {
  onSelectFriend: (friend: Friend) => void;
  onAddFriend: () => void;
}

export const QuickSendTray: React.FC<QuickSendTrayProps> = ({
  onSelectFriend,
  onAddFriend,
}) => {
  const { friends } = useSplitTrack();
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
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

      <View style={styles.horizontalBlurWrap}>
        <ScrollView
          horizontal
          style={styles.horizontalScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        {friends.map((friend) => {
          const isOwed = friend.netBalance > 0;
          const isOwing = friend.netBalance < 0;

          return (
            <AnimatedPressable
              key={friend.id}
              scaleTo={0.93}
              onPress={() => handlePressFriend(friend)}
              contentStyle={styles.friendItem}
            >
              <View style={styles.avatarWrapper}>
                {friend.avatar ? (
                  <Image
                    source={{ uri: friend.avatar }}
                    style={[
                      styles.avatar,
                      { backgroundColor: isDark ? '#1E1E24' : '#E5E7EB' },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      { backgroundColor: isDark ? '#1E1E24' : '#E5E7EB' },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { color: textColor }]}>
                      {friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
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
                {friend.netBalance === 0 && (
                  <View
                    style={[
                      styles.badgeSettledCircle,
                      { backgroundColor: isDark ? '#3F3F46' : '#71717A' },
                    ]}
                  >
                    <CheckCircleIcon size={12} color="#FFFFFF" />
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
        <GradualBlur
          position="left"
          width={18}
          strength={1.1}
          layers={5}
          tint={
            isLiquidGlassEnabled
              ? isDark
                ? 'rgba(5, 5, 10, 0.5)'
                : 'rgba(232, 237, 246, 0.5)'
              : isDark
                ? 'rgba(9, 9, 11, 0.8)'
                : 'rgba(242, 242, 247, 0.8)'
          }
        />
        <GradualBlur
          position="right"
          width={22}
          strength={1.2}
          layers={5}
          tint={
            isLiquidGlassEnabled
              ? isDark
                ? 'rgba(5, 5, 10, 0.5)'
                : 'rgba(232, 237, 246, 0.5)'
              : isDark
                ? 'rgba(9, 9, 11, 0.8)'
                : 'rgba(242, 242, 247, 0.8)'
          }
        />
      </View>
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
    marginBottom: 10,
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
    marginBottom: 6,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 0, // completely borderless
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
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
  badgeSettledCircle: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
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
