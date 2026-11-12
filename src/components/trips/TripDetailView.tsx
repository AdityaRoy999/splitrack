import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { UsersGroupRoundedIcon } from '@solar-icons/react-native/bold/users-group-rounded';
import { Trip, Transaction } from '../../types';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { renderSolarIcon } from '../../constants/solarIconsCatalog';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassCard } from '../glass/GlassCard';
import { SpotlightCard } from '../glass/SpotlightCard';
import { GlassPill } from '../glass/GlassPill';
import { AddMemberModal } from './AddMemberModal';

interface TripDetailViewProps {
  trip: Trip;
  onBack: () => void;
  onAddTripExpense: (tripId: string) => void;
  onOpenSettle: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const TripDetailView: React.FC<TripDetailViewProps> = ({
  trip,
  onBack,
  onAddTripExpense,
  onOpenSettle,
  onSelectTransaction,
}) => {
  const { friends, transactions, categories } = useSplitTrack();
  const { formatAmount, themeMode } = useLiquidGlass();
  const [showAddMember, setShowAddMember] = useState(false);
  const isDark = themeMode === 'dark';

  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const pillSurface = isDark ? '#18181D' : '#EFEFF4';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  const tripFriends = friends.filter((f) => trip.members.includes(f.id));
  const tripTransactions = transactions.filter((tx) => tx.tripId === trip.id);

  const getCategoryMeta = (catName: string, fallbackIcon: string) => {
    const match = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    return {
      iconKey: match?.iconKey || fallbackIcon,
      color: match?.color || '#3B82F6',
    };
  };

  return (
    <View style={styles.container}>
      {/* Page Top Bar */}
      <View style={styles.topBar}>
        <AnimatedPressable
          scaleTo={0.94}
          accessibilityLabel="Back to trips"
          onPress={onBack}
          contentStyle={[styles.backBtn, { backgroundColor: pillSurface }]}
        >
          <AltArrowLeftIcon size={17} color={textColor} />
          <Text style={[styles.backLabel, { color: textColor }]}>Trips</Text>
        </AnimatedPressable>

        <GlassPill
          label="Add Expense"
          icon={<AddCircleIcon size={15} color={isDark ? '#09090B' : '#FFFFFF'} />}
          variant="accent"
          size="sm"
          onPress={() => onAddTripExpense(trip.id)}
        />
      </View>

      {/* Double-Matte Spotlight Hero Card with full-bleed interactive backdrop */}
      <SpotlightCard
        borderRadius={24}
        coverImageUri={trip.coverImage}
        highlightableCover={Boolean(trip.coverImage)}
        panelStyle={styles.heroShowcasePanel}
        footer={
          <View style={styles.spendRow}>
            <View>
              <Text style={[styles.spendEyebrow, { color: mutedText }]}>TOTAL TRIP SPENT</Text>
              <Text style={[styles.spendValue, { color: textColor }]}>
                {formatAmount(trip.totalSpend)}
              </Text>
            </View>

            <GlassPill
              label="Settle Balances"
              icon={<CheckCircleIcon size={14} color={textColor} />}
              variant="dark"
              size="sm"
              onPress={onOpenSettle}
            />
          </View>
        }
      >
        <View style={styles.metaRow}>
          <View style={[styles.categoryChip, { backgroundColor: pillSurface }]}>
            <Text style={[styles.categoryChipText, { color: mutedText }]}>
              {trip.category.toUpperCase()}
            </Text>
          </View>
          <View style={styles.dateMeta}>
            <CalendarDateIcon size={13} color={mutedText} />
            <Text style={[styles.dateText, { color: mutedText }]}>
              {trip.startDate}
              {trip.endDate ? ` – ${trip.endDate}` : ''}
            </Text>
          </View>
        </View>

        <Text style={[styles.tripTitle, { color: textColor }]}>{trip.name}</Text>
      </SpotlightCard>

      {/* Members Card */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: textColor }]}>
            Members ({trip.members.length})
          </Text>
          <AnimatedPressable
            scaleTo={0.9}
            onPress={() => setShowAddMember(true)}
            accessibilityLabel="Add trip member"
            contentStyle={[styles.addMemberBtn, { backgroundColor: pillSurface }]}
          >
            <AddCircleIcon size={16} color={textColor} />
          </AnimatedPressable>
        </View>
        <GlassCard borderRadius={22} style={styles.membersCard}>
          <View style={styles.membersWrap}>
            <View style={[styles.memberPill, { backgroundColor: pillSurface }]}>
              <View style={[styles.userDot, { backgroundColor: isDark ? '#FFFFFF' : '#18181B' }]} />
              <Text style={[styles.memberName, { color: textColor }]}>You</Text>
            </View>

            {tripFriends.map((f) => (
              <View key={f.id} style={[styles.memberPill, { backgroundColor: pillSurface }]}>
                {f.avatar ? (
                  <Image source={{ uri: f.avatar }} style={styles.memberAvatar} />
                ) : (
                  <View
                    style={[
                      styles.memberInitialCircle,
                      { backgroundColor: isDark ? '#27272F' : '#D4D4D8' },
                    ]}
                  >
                    <Text style={[styles.memberInitialText, { color: textColor }]}>
                      {f.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.memberName, { color: textColor }]}>{f.name}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </View>

      {/* Trip Expenses Card */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: textColor }]}>Trip Activity</Text>
          <Text style={[styles.sectionCount, { color: mutedText }]}>
            {tripTransactions.length} {tripTransactions.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>

        {tripTransactions.length === 0 ? (
          <GlassCard borderRadius={22} style={styles.emptyCard}>
            <View style={styles.emptyBox}>
              <UsersGroupRoundedIcon size={28} color={mutedText} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No expenses logged yet</Text>
              <Text style={[styles.emptyDesc, { color: mutedText }]}>
                Tap Add Expense above to record your first split for {trip.name}.
              </Text>
            </View>
          </GlassCard>
        ) : (
          <GlassCard borderRadius={22} style={styles.activityCard}>
            {tripTransactions.map((tx, idx) => {
              const meta = getCategoryMeta(tx.category, tx.categoryIcon);
              const showDivider = idx < tripTransactions.length - 1;
              const isPos = tx.amount > 0;
              const payerFriend =
                tx.paidBy === 'user'
                  ? null
                  : friends.find((f) => f.id === tx.paidBy);
              const payerName =
                tx.paidBy === 'user' ? 'You' : payerFriend?.name || 'Friend';
              const payerFirstName =
                tx.paidBy === 'user'
                  ? 'You'
                  : payerName.split(' ')[0] || payerName;

              return (
                <React.Fragment key={tx.id}>
                  <AnimatedPressable
                    scaleTo={0.985}
                    onPress={() =>
                      onSelectTransaction ? onSelectTransaction(tx) : onOpenSettle()
                    }
                    contentStyle={styles.txRow}
                  >
                    <View style={[styles.txIconBox, { backgroundColor: `${meta.color}20` }]}>
                      {renderSolarIcon(meta.iconKey, 18, meta.color)}
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={[styles.txTitle, { color: textColor }]} numberOfLines={1}>
                        {tx.title}
                      </Text>
                      <Text style={[styles.txMeta, { color: mutedText }]} numberOfLines={1}>
                        {[tx.category, tx.location, tx.date].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                    <View style={[styles.payerBadge, { backgroundColor: pillSurface }]}>
                      {tx.paidBy === 'user' ? (
                        <View
                          style={[
                            styles.payerDot,
                            { backgroundColor: isDark ? '#F4F4F5' : '#18181B' },
                          ]}
                        />
                      ) : payerFriend?.avatar ? (
                        <Image
                          source={{ uri: payerFriend.avatar }}
                          style={styles.payerAvatar}
                        />
                      ) : (
                        <View style={[styles.payerDot, { backgroundColor: '#10B981' }]} />
                      )}
                      <Text style={[styles.payerText, { color: textColor }]} numberOfLines={1}>
                        Paid by {payerFirstName}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isPos ? '#10B981' : textColor },
                      ]}
                    >
                      {formatAmount(tx.amount, true)}
                    </Text>
                  </AnimatedPressable>
                  {showDivider ? (
                    <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </GlassCard>
        )}
      </View>

      <AddMemberModal
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        tripId={trip.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 5,
    borderWidth: 0,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  membersCard: {
    padding: 14,
  },
  emptyCard: {
    padding: 24,
  },
  activityCard: {
    padding: 16,
  },
  heroShowcasePanel: {
    minHeight: 168,
    justifyContent: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
  },
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '400',
  },
  tripTitle: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  spendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  spendEyebrow: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  spendValue: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.6,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '400',
  },
  membersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 6,
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  memberAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  memberInitialCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitialText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addMemberBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptyDesc: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  txMeta: {
    fontSize: 12,
    fontWeight: '400',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '500',
  },
  payerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 5,
    maxWidth: 120,
  },
  payerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  payerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  payerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '100%',
  },
});

export default TripDetailView;
