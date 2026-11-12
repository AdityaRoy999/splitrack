import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ArrowRightUpIcon } from '@solar-icons/react-native/bold/arrow-right-up';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { Friend } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { SpotlightCard } from '../glass/SpotlightCard';

interface MemberCardProps {
  friend: Friend;
  onPress: () => void;
  onEdit: () => void;
}

/**
 * Trip-style double-matte Spotlight card for each member:
 * quiet inner showcase panel with faded photo backdrop, minimal name & handle,
 * an isolated Edit button, and a clean balance footer.
 */
export const MemberCard: React.FC<MemberCardProps> = ({
  friend,
  onPress,
  onEdit,
}) => {
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const subtleChipBg = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.08)';

  const isOwed = friend.netBalance > 0.01;
  const isOwing = friend.netBalance < -0.01;

  const balanceEyebrow = isOwed ? 'OWES YOU' : isOwing ? 'YOU OWE' : 'STATUS';
  const balanceText = isOwed
    ? `+${formatAmount(friend.netBalance)}`
    : isOwing
      ? `-${formatAmount(Math.abs(friend.netBalance))}`
      : 'Settled';
  const balanceColor = isOwed ? '#10B981' : isOwing ? '#EF4444' : textColor;

  const footerContent = (
    <View style={styles.footerRow}>
      <View style={styles.footerLeft}>
        <Text style={[styles.footerEyebrow, { color: mutedText }]}>
          {balanceEyebrow}
        </Text>
        <Text style={[styles.footerValue, { color: balanceColor }]}>
          {balanceText}
        </Text>
      </View>

      <ArrowRightUpIcon size={18} color={mutedText} />
    </View>
  );

  return (
    <View style={styles.cardWrap}>
      <SpotlightCard
        onPress={onPress}
        coverImageUri={friend.avatar || undefined}
        highlightableCover={false}
        panelStyle={styles.innerShowcasePanel}
        footer={footerContent}
        borderRadius={24}
      >
        <View style={styles.panelTopRow}>
          {friend.avatar ? (
            <Image
              source={{ uri: friend.avatar }}
              style={[
                styles.avatarChip,
                { backgroundColor: isDark ? '#1E1E24' : '#E5E7EB' },
              ]}
            />
          ) : (
            <View style={[styles.avatarChip, styles.avatarFallback, { backgroundColor: subtleChipBg }]}>
              <Text style={[styles.avatarInitial, { color: textColor }]}>
                {friend.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.identityBlock}>
          <Text style={[styles.memberName, { color: textColor }]} numberOfLines={1}>
            {friend.name}
          </Text>
          <Text style={[styles.memberHandle, { color: mutedText }]} numberOfLines={1}>
            {friend.handle}
          </Text>
        </View>
      </SpotlightCard>

      {/* Isolated Edit button sibling so tapping Edit never triggers card navigation */}
      <AnimatedPressable
        scaleTo={0.92}
        onPress={() => {
          triggerImpact(ImpactStyle.Light);
          onEdit();
        }}
        accessibilityLabel={`Edit ${friend.name}`}
        style={styles.editBtnAnchor}
        contentStyle={[styles.editBtn, { backgroundColor: subtleChipBg }]}
      >
        <Pen2Icon size={13} color={textColor} />
        <Text style={[styles.editBtnText, { color: textColor }]}>Edit</Text>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrap: {
    position: 'relative',
    width: '100%',
  },
  innerShowcasePanel: {
    minHeight: 138,
    justifyContent: 'space-between',
  },
  panelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
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
  identityBlock: {
    gap: 2,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  memberHandle: {
    fontSize: 12,
    fontWeight: '400',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flex: 1,
  },
  footerEyebrow: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  editBtnAnchor: {
    position: 'absolute',
    top: 26,
    right: 26,
    zIndex: 10,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MemberCard;
