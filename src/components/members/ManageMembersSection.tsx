import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react-native/bold/users-group-two-rounded';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassCard } from '../glass/GlassCard';

interface ManageMembersSectionProps {
  onOpenMembersPage: () => void;
}

export const ManageMembersSection: React.FC<ManageMembersSectionProps> = ({
  onOpenMembersPage,
}) => {
  const { friends } = useSplitTrack();
  const { formatAmount, themeMode, palette } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const textColor = palette.sheetTextPrimary;
  const mutedText = palette.sheetTextSecondary;
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';
  const pillSurface = isDark ? '#1B1B22' : '#EFEFF4';

  const handleOpen = () => {
    triggerImpact(ImpactStyle.Light);
    onOpenMembersPage();
  };

  return (
    <View style={styles.outerWrap}>
      <AnimatedPressable
        scaleTo={0.988}
        onPress={handleOpen}
        accessibilityLabel="Manage People and Members"
      >
        <GlassCard borderRadius={24} style={styles.sheetContainer}>
          {/* Section Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <View
                style={[
                  styles.headerIconBox,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,24,27,0.06)' },
                ]}
              >
                <UsersGroupTwoRoundedIcon size={17} color={textColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                  Manage People & Members
                </Text>
                <Text style={[styles.subtitle, { color: mutedText }]} numberOfLines={1}>
                  {friends.length} {friends.length === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>

            <View style={[styles.openBadge, { backgroundColor: pillSurface }]}>
              <Text style={[styles.openBadgeText, { color: textColor }]}>All</Text>
              <AltArrowRightIcon size={13} color={textColor} />
            </View>
          </View>

          {/* Entire Member List */}
          {friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: mutedText }]}>
                No members added yet. Tap to add & manage people.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {friends.map((friend, index) => {
                const showDivider = index < friends.length - 1;
                const isOwed = friend.netBalance > 0.01;
                const isOwing = friend.netBalance < -0.01;

                return (
                  <React.Fragment key={friend.id}>
                    <View style={styles.memberRow}>
                      <View style={styles.leftCol}>
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

                        <View style={styles.infoCol}>
                          <Text style={[styles.memberName, { color: textColor }]} numberOfLines={1}>
                            {friend.name}
                          </Text>
                          <Text style={[styles.memberMeta, { color: mutedText }]} numberOfLines={1}>
                            {friend.handle}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.rightCol}>
                        {isOwed ? (
                          <Text style={[styles.balanceValue, { color: '#10B981' }]}>
                            +{formatAmount(friend.netBalance)}
                          </Text>
                        ) : isOwing ? (
                          <Text style={[styles.balanceValue, { color: '#EF4444' }]}>
                            -{formatAmount(Math.abs(friend.netBalance))}
                          </Text>
                        ) : (
                          <View
                            style={[
                              styles.settledPill,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(16, 185, 129, 0.14)'
                                  : 'rgba(16, 185, 129, 0.12)',
                              },
                            ]}
                          >
                            <CheckCircleIcon size={12} color="#10B981" />
                            <Text style={styles.settledText}>Settled</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {showDivider && (
                      <View
                        style={[
                          styles.rowDivider,
                          { backgroundColor: dividerColor },
                        ]}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </GlassCard>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrap: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 10,
  },
  sheetContainer: {
    padding: 18,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  openBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    gap: 0,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    gap: 10,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberMeta: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  settledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  settledText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#10B981',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});

export default ManageMembersSection;
