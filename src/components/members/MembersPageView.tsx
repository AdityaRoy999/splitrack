import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { MinimalisticMagnifierIcon } from '@solar-icons/react-native/bold/minimalistic-magnifier';
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react-native/bold/users-group-two-rounded';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { GlassCard } from '../glass/GlassCard';
import { GlassPill } from '../glass/GlassPill';
import { MemberCard } from './MemberCard';

type MemberFilter = 'All' | 'Owes You' | 'You Owe' | 'Settled';

interface MembersPageViewProps {
  onBack: () => void;
  onSelectMember: (friend: Friend) => void;
  onEditMember: (friend: Friend) => void;
  onAddMember: () => void;
}

export const MembersPageView: React.FC<MembersPageViewProps> = ({
  onBack,
  onSelectMember,
  onEditMember,
  onAddMember,
}) => {
  const { friends, totalOwedToYou, totalYouOwe } = useSplitTrack();
  const { formatAmount, themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('All');

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const pillSurface = isDark ? '#18181D' : '#EFEFF4';
  const chipBg = isDark ? '#18181D' : '#FFFFFF';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const rootBg = isLiquidGlassEnabled
    ? isDark
      ? '#05050A'
      : '#E8EDF6'
    : isDark
      ? '#09090B'
      : '#F2F2F7';

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return friends.filter((f) => {
      if (q) {
        const matchName = f.name.toLowerCase().includes(q);
        const matchHandle = f.handle.toLowerCase().includes(q);
        const matchUpi = (f.upiId || '').toLowerCase().includes(q);
        if (!matchName && !matchHandle && !matchUpi) return false;
      }
      if (filter === 'Owes You') return f.netBalance > 0.01;
      if (filter === 'You Owe') return f.netBalance < -0.01;
      if (filter === 'Settled') return Math.abs(f.netBalance) <= 0.01;
      return true;
    });
  }, [friends, searchQuery, filter]);

  const netTotal = totalOwedToYou - totalYouOwe;

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <AnimatedPressable
          scaleTo={0.94}
          accessibilityLabel="Back to Home"
          onPress={() => {
            triggerImpact(ImpactStyle.Light);
            onBack();
          }}
          contentStyle={[styles.backBtn, { backgroundColor: pillSurface }]}
        >
          <AltArrowLeftIcon size={17} color={textColor} />
          <Text style={[styles.backLabel, { color: textColor }]}>Home</Text>
        </AnimatedPressable>

        <GlassPill
          label="Add Member"
          icon={<AddCircleIcon size={15} color={activeText} />}
          variant="accent"
          size="sm"
          onPress={onAddMember}
        />
      </View>

      {/* Members Directory Summary Banner */}
      <GlassCard borderRadius={24} intensity={24} style={styles.summaryBanner}>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryEyebrow, { color: mutedText }]}>
              PEOPLE & MEMBERS ({friends.length})
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: netTotal >= 0 ? '#10B981' : '#EF4444' },
              ]}
            >
              {netTotal >= 0 ? '+' : '-'}
              {formatAmount(Math.abs(netTotal))}
            </Text>
            <Text style={[styles.summaryMeta, { color: mutedText }]}>
              Owed to you {formatAmount(totalOwedToYou)} • You owe {formatAmount(totalYouOwe)}
            </Text>
          </View>
          <View
            style={[
              styles.bannerIconWrap,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,24,27,0.06)' },
            ]}
          >
            <UsersGroupTwoRoundedIcon size={22} color={textColor} />
          </View>
        </View>
      </GlassCard>

      {/* Search Bar & Filter Pills */}
      <View style={styles.controlsBlock}>
        <View style={[styles.searchBox, { backgroundColor: chipBg }]}>
          <MinimalisticMagnifierIcon size={16} color={mutedText} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search people by name, @handle, or UPI ID..."
            placeholderTextColor={mutedText}
            style={[
              styles.searchInput,
              { color: textColor },
              Platform.OS === 'web' &&
                ({
                  outlineStyle: 'none',
                  outlineWidth: 0,
                  outline: 'none',
                  boxShadow: 'none',
                } as any),
            ]}
          />
        </View>

        <JellyRadio
          scrollable
          fadeColor={rootBg}
          items={['All', 'Owes You', 'You Owe', 'Settled']}
          value={filter}
          onChange={(val) => setFilter(val as MemberFilter)}
          chipColor={chipBg}
          activeColor={activeBg}
          textColor={textColor}
          activeTextColor={activeText}
          size="sm"
          gap={8}
          radius={999}
          swell={0.2}
          barge={6}
        />
      </View>

      {/* Member Cards List (Trip-style double-surface card per member) */}
      {filteredFriends.length === 0 ? (
        <GlassCard borderRadius={24} style={styles.emptyCard}>
          <View style={styles.emptyBox}>
            <UsersGroupTwoRoundedIcon size={30} color={mutedText} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No matching members</Text>
            <Text style={[styles.emptyDesc, { color: mutedText }]}>
              Try clearing your search filter or add a new member.
            </Text>
          </View>
        </GlassCard>
      ) : (
        <View style={styles.cardsColumn}>
          {filteredFriends.map((friend) => (
            <MemberCard
              key={friend.id}
              friend={friend}
              onPress={() => onSelectMember(friend)}
              onEdit={() => onEditMember(friend)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryBanner: {
    padding: 18,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  summaryMeta: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 3,
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBlock: {
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  cardsColumn: {
    gap: 12,
  },
  emptyCard: {
    padding: 28,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default MembersPageView;
