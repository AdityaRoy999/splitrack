import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { BillListIcon } from '@solar-icons/react-native/bold/bill-list';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { PhoneRoundedIcon } from '@solar-icons/react-native/bold/phone-rounded';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { copyTextSafe, getMemberActivitySummary } from '../../utils/memberActivity';
import { renderSolarIcon } from '../../constants/solarIconsCatalog';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend, Transaction } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { GlassCard } from '../glass/GlassCard';
import { SpotlightCard } from '../glass/SpotlightCard';
import { GlassPill } from '../glass/GlassPill';

type MemberTxFilter = 'All' | 'Splits' | 'Paid by Them' | 'Settlements';

interface MemberDetailViewProps {
  friend: Friend;
  onBack: () => void;
  onEditFriend: (friend: Friend) => void;
  onSettleFriend: (friend: Friend) => void;
  onSplitWithFriend: (friend: Friend) => void;
  onOpenTrip?: (tripId: string) => void;
}

export const MemberDetailView: React.FC<MemberDetailViewProps> = ({
  friend,
  onBack,
  onEditFriend,
  onSettleFriend,
  onSplitWithFriend,
  onOpenTrip,
}) => {
  const { transactions, trips, categories, getSimplifiedDebts } = useSplitTrack();
  const { formatAmount, themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [txFilter, setTxFilter] = useState<MemberTxFilter>('All');
  const [copiedUpi, setCopiedUpi] = useState(false);

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const pillSurface = isDark ? '#18181D' : '#EFEFF4';
  const chipBg = isDark ? '#18181D' : '#FFFFFF';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';
  const rootBg = isLiquidGlassEnabled
    ? isDark
      ? '#05050A'
      : '#E8EDF6'
    : isDark
      ? '#09090B'
      : '#F2F2F7';

  const summary = useMemo(
    () => getMemberActivitySummary(friend, transactions, trips),
    [friend, transactions, trips]
  );

  const memberDebts = useMemo(
    () =>
      getSimplifiedDebts().filter(
        (d) => d.fromId === friend.id || d.toId === friend.id
      ),
    [getSimplifiedDebts, friend.id]
  );

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'Splits') {
      return summary.memberTransactions.filter(
        (tx) => tx.type !== 'settlement' && (tx.splits?.length ?? 0) > 0
      );
    }
    if (txFilter === 'Paid by Them') {
      return summary.memberTransactions.filter(
        (tx) => tx.type !== 'settlement' && tx.paidBy === friend.id
      );
    }
    if (txFilter === 'Settlements') {
      return summary.settlements;
    }
    return summary.memberTransactions;
  }, [txFilter, summary, friend.id]);

  const firstName = friend.name.split(' ')[0] || friend.name;
  const isOwed = friend.netBalance > 0.01;
  const isOwing = friend.netBalance < -0.01;

  const getCategoryMeta = (tx: Transaction) => {
    if (tx.type === 'settlement') {
      return { iconKey: 'check-circle', color: '#10B981' };
    }
    const match = categories.find(
      (c) => c.name.toLowerCase() === tx.category.toLowerCase()
    );
    return {
      iconKey: match?.iconKey || tx.categoryIcon || 'bill-list',
      color: match?.color || textColor,
    };
  };

  const handleCopyUpi = () => {
    if (!friend.upiId) return;
    triggerNotification(NotificationType.Success);
    copyTextSafe(friend.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 1800);
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Row */}
      <View style={styles.topBar}>
        <AnimatedPressable
          scaleTo={0.94}
          accessibilityLabel="Back to Members"
          onPress={onBack}
          contentStyle={[styles.backBtn, { backgroundColor: pillSurface }]}
        >
          <AltArrowLeftIcon size={17} color={textColor} />
          <Text style={[styles.backLabel, { color: textColor }]}>Members</Text>
        </AnimatedPressable>

        <GlassPill
          label={Math.abs(friend.netBalance) > 0.01 ? 'Settle Up' : 'Split Expense'}
          icon={
            Math.abs(friend.netBalance) > 0.01 ? (
              <CheckCircleIcon size={15} color={activeText} />
            ) : (
              <AddCircleIcon size={15} color={activeText} />
            )
          }
          variant="accent"
          size="sm"
          onPress={() =>
            Math.abs(friend.netBalance) > 0.01
              ? onSettleFriend(friend)
              : onSplitWithFriend(friend)
          }
        />
      </View>

      {/* Trip-Style Double-Matte Spotlight Profile Hero */}
      <View style={styles.heroWrap}>
        <SpotlightCard
          borderRadius={24}
          coverImageUri={friend.avatar || undefined}
          highlightableCover={Boolean(friend.avatar)}
          panelStyle={styles.heroShowcasePanel}
          footer={
            <View style={styles.balanceFooterRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.balanceEyebrow, { color: mutedText }]}>
                  {isOwed ? 'OWES YOU' : isOwing ? 'YOU OWE' : 'SETTLEMENT STATUS'}
                </Text>
                <Text
                  style={[
                    styles.balanceHeroAmount,
                    {
                      color: isOwed ? '#10B981' : isOwing ? '#EF4444' : textColor,
                    },
                  ]}
                >
                  {isOwed
                    ? `+${formatAmount(friend.netBalance)}`
                    : isOwing
                      ? `-${formatAmount(Math.abs(friend.netBalance))}`
                      : 'Settled Up'}
                </Text>
              </View>

              <View style={styles.heroActions}>
                <GlassPill
                  label="Split"
                  icon={<AddCircleIcon size={14} color={textColor} />}
                  variant="dark"
                  size="sm"
                  onPress={() => onSplitWithFriend(friend)}
                />
                {Math.abs(friend.netBalance) > 0.01 && (
                  <GlassPill
                    label="Settle"
                    icon={<CheckCircleIcon size={14} color={activeText} />}
                    variant="accent"
                    size="sm"
                    onPress={() => onSettleFriend(friend)}
                  />
                )}
              </View>
            </View>
          }
        >
          <View style={styles.profileTop}>
            {friend.avatar ? (
              <Image
                source={{ uri: friend.avatar }}
                style={[
                  styles.heroAvatar,
                  { backgroundColor: isDark ? '#1E1E24' : '#E5E7EB' },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.heroAvatar,
                  styles.avatarFallback,
                  { backgroundColor: isDark ? '#1E1E24' : '#E5E7EB' },
                ]}
              >
                <Text style={[styles.heroAvatarInitial, { color: textColor }]}>
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.profileTextCol}>
              <Text style={[styles.heroName, { color: textColor }]} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={[styles.heroHandle, { color: mutedText }]} numberOfLines={1}>
                {friend.handle}
              </Text>
            </View>
          </View>

          {(friend.upiId || friend.phone) && (
            <View style={styles.contactBadges}>
              {friend.upiId ? (
                <AnimatedPressable
                  scaleTo={0.95}
                  onPress={handleCopyUpi}
                  contentStyle={[
                    styles.contactChip,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(15,23,42,0.08)',
                    },
                  ]}
                >
                  <CopyIcon size={12} color={mutedText} />
                  <Text style={[styles.contactChipText, { color: textColor }]}>
                    {copiedUpi ? 'Copied UPI' : friend.upiId}
                  </Text>
                </AnimatedPressable>
              ) : null}

              {friend.phone ? (
                <View
                  style={[
                    styles.contactChip,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(15,23,42,0.08)',
                    },
                  ]}
                >
                  <PhoneRoundedIcon size={12} color={mutedText} />
                  <Text style={[styles.contactChipText, { color: mutedText }]}>
                    {friend.phone}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </SpotlightCard>

        <AnimatedPressable
          scaleTo={0.92}
          onPress={() => {
            triggerImpact(ImpactStyle.Light);
            onEditFriend(friend);
          }}
          accessibilityLabel={`Edit ${friend.name}`}
          style={styles.heroEditAnchor}
          contentStyle={[
            styles.heroEditBtn,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.14)'
                : 'rgba(15, 23, 42, 0.08)',
            },
          ]}
        >
          <Pen2Icon size={13} color={textColor} />
          <Text style={[styles.heroEditText, { color: textColor }]}>Edit</Text>
        </AnimatedPressable>
      </View>

      {/* Summary Stats Row */}
      <View style={styles.statsRow}>
        <GlassCard borderRadius={20} style={styles.statTile}>
          <Text style={[styles.statLabel, { color: mutedText }]} numberOfLines={1}>
            Shared Volume
          </Text>
          <Text style={[styles.statValue, { color: textColor }]} numberOfLines={1}>
            {formatAmount(summary.totalSharedVolume)}
          </Text>
        </GlassCard>

        <GlassCard borderRadius={20} style={styles.statTile}>
          <Text style={[styles.statLabel, { color: mutedText }]} numberOfLines={1}>
            Settled ({summary.settlements.length})
          </Text>
          <Text style={[styles.statValue, { color: '#10B981' }]} numberOfLines={1}>
            {formatAmount(summary.settledVolume)}
          </Text>
        </GlassCard>

        <GlassCard borderRadius={20} style={styles.statTile}>
          <Text style={[styles.statLabel, { color: mutedText }]} numberOfLines={1}>
            Paid by {firstName}
          </Text>
          <Text style={[styles.statValue, { color: textColor }]} numberOfLines={1}>
            {formatAmount(summary.paidByMemberTotal)}
          </Text>
        </GlassCard>
      </View>

      {/* Shared Trips & Groups */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: textColor }]}>
            Shared Trips & Groups
          </Text>
          <Text style={[styles.sectionCount, { color: mutedText }]}>
            {summary.sharedTrips.length} {summary.sharedTrips.length === 1 ? 'group' : 'groups'}
          </Text>
        </View>

        {summary.sharedTrips.length === 0 ? (
          <GlassCard borderRadius={22} style={styles.emptyCard}>
            <Text style={[styles.emptyInlineText, { color: mutedText }]}>
              {firstName} is not part of any trip or group yet.
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.tripsWrap}>
            {summary.sharedTrips.map((trip) => (
              <AnimatedPressable
                key={trip.id}
                scaleTo={0.97}
                onPress={() => onOpenTrip?.(trip.id)}
              >
                <GlassCard borderRadius={20} style={styles.tripRowCard}>
                  <View style={styles.tripRowInner}>
                    {trip.coverImage ? (
                      <Image source={{ uri: trip.coverImage }} style={styles.tripThumb} />
                    ) : (
                      <View
                        style={[
                          styles.tripThumb,
                          styles.tripThumbFallback,
                          { backgroundColor: trip.coverGradient[0] || '#3B82F6' },
                        ]}
                      >
                        <Text style={styles.tripThumbLetter}>
                          {trip.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.tripName, { color: textColor }]} numberOfLines={1}>
                        {trip.name}
                      </Text>
                      <Text style={[styles.tripMeta, { color: mutedText }]} numberOfLines={1}>
                        {trip.startDate} • {trip.members.length} members
                      </Text>
                    </View>

                    <Text style={[styles.tripSpend, { color: textColor }]}>
                      {formatAmount(trip.totalSpend)}
                    </Text>
                  </View>
                </GlassCard>
              </AnimatedPressable>
            ))}
          </View>
        )}
      </View>

      {/* Settlements & Balances Section */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: textColor }]}>
            Settlements & Balances
          </Text>
          <Text style={[styles.sectionCount, { color: mutedText }]}>
            {summary.settlements.length}{' '}
            {summary.settlements.length === 1 ? 'settled' : 'settled'}
          </Text>
        </View>

        <GlassCard borderRadius={22} style={styles.groupedCard}>
          {/* Pending simplified debt routes */}
          {memberDebts.map((debt, idx) => {
            const directionText =
              debt.fromId === 'user'
                ? `You owe ${debt.toName}`
                : `${debt.fromName} owes ${debt.toName}`;
            return (
              <React.Fragment key={`${debt.fromId}-${debt.toId}-${idx}`}>
                <View style={styles.settlementRow}>
                  <View style={styles.settlementLeft}>
                    <View
                      style={[
                        styles.settlementBadgeIcon,
                        {
                          backgroundColor:
                            debt.fromId === 'user'
                              ? 'rgba(239, 68, 68, 0.14)'
                              : 'rgba(16, 185, 129, 0.14)',
                        },
                      ]}
                    >
                      <CheckCircleIcon
                        size={17}
                        color={debt.fromId === 'user' ? '#EF4444' : '#10B981'}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.txTitle, { color: textColor }]} numberOfLines={1}>
                        {directionText}
                      </Text>
                      <Text style={[styles.txSub, { color: mutedText }]} numberOfLines={1}>
                        Pending simplified settlement
                      </Text>
                    </View>
                  </View>

                  <View style={styles.settlementRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: debt.fromId === 'user' ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      {formatAmount(debt.amount)}
                    </Text>
                    <AnimatedPressable
                      scaleTo={0.93}
                      onPress={() => onSettleFriend(friend)}
                      contentStyle={[styles.miniSettleBtn, { backgroundColor: activeBg }]}
                    >
                      <Text style={[styles.miniSettleText, { color: activeText }]}>
                        Settle
                      </Text>
                    </AnimatedPressable>
                  </View>
                </View>
                {(idx < memberDebts.length - 1 || summary.settlements.length > 0) && (
                  <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
                )}
              </React.Fragment>
            );
          })}

          {/* Recorded settlement history */}
          {summary.settlements.length === 0 && memberDebts.length === 0 ? (
            <View style={styles.emptySettlementBox}>
              <Text style={[styles.emptyInlineText, { color: mutedText }]}>
                No pending balances or past settlements with {firstName}.
              </Text>
            </View>
          ) : summary.settlements.length === 0 ? (
            <View style={styles.emptySettlementBox}>
              <Text style={[styles.emptyInlineText, { color: mutedText }]}>
                No completed settlements logged with {firstName} yet.
              </Text>
            </View>
          ) : (
            summary.settlements.map((st, idx) => {
              const isIncoming = st.amount > 0;
              const showDivider = idx < summary.settlements.length - 1;
              return (
                <React.Fragment key={st.id}>
                  <View style={styles.settlementRow}>
                    <View style={styles.settlementLeft}>
                      <View
                        style={[
                          styles.settlementBadgeIcon,
                          { backgroundColor: 'rgba(16, 185, 129, 0.14)' },
                        ]}
                      >
                        <CheckCircleIcon size={17} color="#10B981" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.txTitle, { color: textColor }]} numberOfLines={1}>
                          {st.title}
                        </Text>
                        <Text style={[styles.txSub, { color: mutedText }]} numberOfLines={1}>
                          {st.subtitle || (isIncoming ? 'Received settlement' : 'Paid settlement')} •{' '}
                          {st.date}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.txAmount,
                        { color: isIncoming ? '#10B981' : textColor },
                      ]}
                    >
                      {formatAmount(st.amount, true)}
                    </Text>
                  </View>

                  {showDivider && (
                    <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
                  )}
                </React.Fragment>
              );
            })
          )}
        </GlassCard>
      </View>

      {/* All Transactions With Member */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: textColor }]}>
            All Transactions
          </Text>
          <Text style={[styles.sectionCount, { color: mutedText }]}>
            {filteredTransactions.length}{' '}
            {filteredTransactions.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>

        <View style={styles.txFilterWrap}>
          <JellyRadio
            scrollable
            fadeColor={rootBg}
            items={['All', 'Splits', 'Paid by Them', 'Settlements']}
            value={txFilter}
            onChange={(val) => setTxFilter(val as MemberTxFilter)}
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

        {filteredTransactions.length === 0 ? (
          <GlassCard borderRadius={22} style={styles.emptyCard}>
            <View style={styles.emptyTxBox}>
              <BillListIcon size={26} color={mutedText} />
              <Text style={[styles.emptyInlineText, { color: mutedText }]}>
                No matching transactions with {firstName}.
              </Text>
            </View>
          </GlassCard>
        ) : (
          <View style={styles.txCardsList}>
            {filteredTransactions.map((tx) => {
              const catMeta = getCategoryMeta(tx);
              const linkedTrip = tx.tripId
                ? trips.find((t) => t.id === tx.tripId)
                : undefined;
              const payerLabel =
                tx.type === 'settlement'
                  ? tx.amount > 0
                    ? `Received from ${firstName}`
                    : `Paid to ${firstName}`
                  : tx.paidBy === 'user'
                    ? 'Paid by You'
                    : tx.paidBy === friend.id
                      ? `Paid by ${firstName}`
                      : 'Group expense';
              const isPositive = tx.type === 'settlement' && tx.amount > 0;
              const subLine = [payerLabel, linkedTrip?.name, tx.location, tx.date]
                .filter(Boolean)
                .join(' • ');

              return (
                <AnimatedPressable
                  key={tx.id}
                  scaleTo={0.98}
                  onPress={() => onSettleFriend(friend)}
                >
                  <GlassCard borderRadius={22} style={styles.txItemCard}>
                    <View style={styles.txRow}>
                      <View style={styles.txLeft}>
                        <View
                          style={[
                            styles.txIconWrap,
                            { backgroundColor: `${catMeta.color}1F` },
                          ]}
                        >
                          {renderSolarIcon(catMeta.iconKey, 20, catMeta.color)}
                        </View>

                        <View style={styles.txBodyCol}>
                          <Text style={[styles.txTitle, { color: textColor }]} numberOfLines={1}>
                            {tx.title}
                          </Text>
                          <Text style={[styles.txSub, { color: mutedText }]} numberOfLines={1}>
                            {subLine}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.txRightCol}>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: isPositive ? '#10B981' : textColor },
                          ]}
                        >
                          {tx.type === 'settlement'
                            ? formatAmount(tx.amount, true)
                            : formatAmount(Math.abs(tx.amount))}
                        </Text>
                        <Text
                          style={[
                            styles.txStatusTag,
                            { color: tx.settled ? '#10B981' : '#F59E0B' },
                          ]}
                        >
                          {tx.settled ? 'Settled' : 'Unsettled'}
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 16,
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
  heroWrap: {
    position: 'relative',
    width: '100%',
  },
  heroShowcasePanel: {
    minHeight: 146,
    justifyContent: 'space-between',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 72,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarInitial: {
    fontSize: 20,
    fontWeight: '600',
  },
  profileTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  heroHandle: {
    fontSize: 13,
    fontWeight: '400',
  },
  contactBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 0,
  },
  contactChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  balanceFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  balanceEyebrow: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  balanceHeroAmount: {
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroEditAnchor: {
    position: 'absolute',
    top: 26,
    right: 26,
    zIndex: 10,
  },
  heroEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  heroEditText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    padding: 13,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '400',
  },
  tripsWrap: {
    gap: 10,
  },
  tripRowCard: {
    minHeight: 74,
    paddingVertical: 15,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  tripRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  tripThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripThumbLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tripName: {
    fontSize: 14,
    fontWeight: '600',
  },
  tripMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  tripSpend: {
    fontSize: 14,
    fontWeight: '600',
  },
  groupedCard: {
    padding: 16,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: 13,
    gap: 12,
  },
  settlementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  settlementBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  miniSettleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 0,
  },
  miniSettleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txFilterWrap: {
    marginBottom: 2,
  },
  txCardsList: {
    gap: 10,
  },
  txItemCard: {
    minHeight: 88,
    paddingVertical: 18,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
    minWidth: 0,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBodyCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  txSub: {
    fontSize: 12,
    fontWeight: '400',
  },
  txRightCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  txStatusTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  emptyCard: {
    padding: 20,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptySettlementBox: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyTxBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  emptyInlineText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default MemberDetailView;
