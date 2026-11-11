import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { QrCodeIcon } from '@solar-icons/react-native/bold/qr-code';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { UpiAccount } from '../../types';
import {
  ImpactStyle,
  NotificationType,
  triggerImpact,
  triggerNotification,
} from '../../utils/haptics';
import { Aurora } from '../effects/Aurora';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassPill } from '../glass/GlassPill';
import { AddUpiProfileModal } from './AddUpiProfileModal';
import { UpiQrModal } from './UpiQrModal';

const CARD_HEIGHT = 152;
const STACK_PEEK = 24;
const EXPAND_GAP = 12;

const PROVIDER_AURORA_STOPS: Record<string, [string, string, string]> = {
  slice: ['#5227FF', '#7cff67', '#5227FF'],
  gpay: ['#0EA5E9', '#38BDF8', '#22C55E'],
  phonepe: ['#7C3AED', '#EC4899', '#6366F1'],
  paytm: ['#06B6D4', '#3B82F6', '#0EA5E9'],
  bank: ['#10B981', '#14B8A6', '#059669'],
  cred: ['#F97316', '#F59E0B', '#EF4444'],
};

const BANK_AURORA_STOPS: Record<string, [string, string, string]> = {
  hdfc: ['#0A2567', '#1D4ED8', '#C81E32'],
  icici: ['#EA580C', '#C2410C', '#7C2D12'],
  sbi: ['#0284C7', '#0369A1', '#1E3A8A'],
  axis: ['#9D174D', '#701A75', '#BE185D'],
  kotak: ['#DC2626', '#1E293B', '#B91C1C'],
  amex: ['#334155', '#0284C7', '#94A3B8'],
};

const FALLBACK_AURORA_STOPS: [string, string, string][] = [
  ['#5227FF', '#7cff67', '#5227FF'],
  ['#0EA5E9', '#38BDF8', '#22C55E'],
  ['#7C3AED', '#EC4899', '#6366F1'],
  ['#10B981', '#14B8A6', '#059669'],
];

const getAuroraStops = (acc: UpiAccount, fallbackIndex: number): [string, string, string] => {
  if (acc.bankBrand && BANK_AURORA_STOPS[acc.bankBrand]) {
    return BANK_AURORA_STOPS[acc.bankBrand];
  }
  return (
    PROVIDER_AURORA_STOPS[acc.provider] ||
    FALLBACK_AURORA_STOPS[fallbackIndex % FALLBACK_AURORA_STOPS.length]
  );
};

const copyToClipboard = (text: string) => {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
};

interface ProfileDeckCardProps {
  acc: UpiAccount;
  mapIndex: number;
  rank: number;
  totalCount: number;
  isExpanded: boolean;
  isDefault: boolean;
  isCopied: boolean;
  trackedSpend: number;
  isDark: boolean;
  textColor: string;
  mutedText: string;
  pillSurface: string;
  actionGlassBg: string;
  primaryPillBg: string;
  primaryPillText: string;
  formatAmount: (amount: number) => string;
  onCardPress: (acc: UpiAccount) => void;
  onMakeDefault: (acc: UpiAccount) => void;
  onCopy: (acc: UpiAccount) => void;
  onOpenQr: (acc: UpiAccount) => void;
}

const ProfileDeckCard: React.FC<ProfileDeckCardProps> = ({
  acc,
  mapIndex,
  rank,
  totalCount,
  isExpanded,
  isDefault,
  isCopied,
  trackedSpend,
  isDark,
  textColor,
  mutedText,
  pillSurface,
  actionGlassBg,
  primaryPillBg,
  primaryPillText,
  formatAmount,
  onCardPress,
  onMakeDefault,
  onCopy,
  onOpenQr,
}) => {
  const targetTop = isExpanded ? rank * (CARD_HEIGHT + EXPAND_GAP) : rank * STACK_PEEK;
  const targetScale = isExpanded ? 1 : Math.max(0.82, 1 - rank * 0.035);
  const targetFooterOpacity = isExpanded || rank === 0 ? 1 : 0;

  const [topAnim] = useState(() => new Animated.Value(targetTop));
  const [scaleAnim] = useState(() => new Animated.Value(targetScale));
  const [footerOpacityAnim] = useState(() => new Animated.Value(targetFooterOpacity));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(topAnim, {
        toValue: targetTop,
        tension: 60,
        friction: 9,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: targetScale,
        tension: 60,
        friction: 9,
        useNativeDriver: false,
      }),
      Animated.timing(footerOpacityAnim, {
        toValue: targetFooterOpacity,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [targetTop, targetScale, targetFooterOpacity, topAnim, scaleAnim, footerOpacityAnim]);

  const isCardProfile = acc.kind === 'debit' || acc.kind === 'credit';
  const auroraStops = getAuroraStops(acc, mapIndex);
  const cardBaseBg = isDark ? '#111114' : '#FFFFFF';
  const cardZIndex = isDefault ? totalCount + 10 : totalCount - rank;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          top: topAnim,
          zIndex: cardZIndex,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.upiCardGradient, { backgroundColor: cardBaseBg }]}>
        <Aurora
          colorStops={auroraStops}
          amplitude={1.05}
          blend={0.55}
          height={isCardProfile ? 0.85 : 0.72}
          speed={0.9}
          glow={0.65}
          layers={2}
          direction="bottom"
          opacity={isCardProfile ? (isDark ? 0.82 : 0.62) : isDark ? 0.72 : 0.56}
          lightMode={!isDark}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: cardBaseBg, borderRadius: 24 },
          ]}
        />

        {/* Full-card tap layer (expands stack or collapses default card) */}
        <Pressable
          onPress={() => onCardPress(acc)}
          accessibilityLabel={`${acc.title} card`}
          style={StyleSheet.absoluteFill}
        />

        {/* Card Top Header */}
        <View style={styles.cardTopRow} pointerEvents="box-none">
          <View style={styles.cardTopInfo} pointerEvents="none">
            {isCardProfile ? (
              <>
                <View style={styles.bankTitleRow}>
                  <Text style={[styles.bankHeading, { color: textColor }]} numberOfLines={1}>
                    {(acc.bankName || 'BANK CARD').toUpperCase()}
                  </Text>
                  <View style={[styles.kindPill, { backgroundColor: pillSurface }]}>
                    <Text style={[styles.kindPillText, { color: textColor }]}>
                      {acc.kind === 'credit' ? 'CREDIT' : 'DEBIT'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.profileHandle, { color: mutedText }]} numberOfLines={1}>
                  {acc.title}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.profileTitle, { color: textColor }]} numberOfLines={1}>
                  {acc.title}
                </Text>
                <Text style={[styles.profileHandle, { color: mutedText }]} numberOfLines={1}>
                  {acc.upiId}
                </Text>
              </>
            )}
          </View>

          {!isDefault && (
            <Animated.View
              style={{ opacity: footerOpacityAnim }}
              pointerEvents={!isExpanded && rank > 0 ? 'none' : 'auto'}
            >
              <AnimatedPressable
                scaleTo={0.93}
                onPress={() => onMakeDefault(acc)}
                accessibilityLabel={`Make ${acc.title} default`}
                contentStyle={[styles.makeDefaultPill, { backgroundColor: primaryPillBg }]}
              >
                <Text style={[styles.makeDefaultText, { color: primaryPillText }]}>
                  Make Default
                </Text>
              </AnimatedPressable>
            </Animated.View>
          )}
        </View>

        {/* Middle Row for Real Debit / Credit Bank Cards */}
        {isCardProfile && (
          <View style={styles.cardMiddleRow} pointerEvents="none">
            <View
              style={[
                styles.emvChip,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 224, 153, 0.24)'
                    : 'rgba(180, 140, 60, 0.22)',
                },
              ]}
            >
              <View
                style={[
                  styles.emvChipInnerH,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)' },
                ]}
              />
              <View
                style={[
                  styles.emvChipInnerV,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)' },
                ]}
              />
            </View>
            <Text style={[styles.cardNumberDigits, { color: textColor }]} numberOfLines={1}>
              {acc.cardNumber}
            </Text>
            {acc.expiry ? (
              <Text style={[styles.cardExpiryText, { color: mutedText }]}>{acc.expiry}</Text>
            ) : null}
          </View>
        )}

        {/* Bottom Footer Row */}
        <Animated.View
          style={[styles.cardFooterRow, { opacity: footerOpacityAnim }]}
          pointerEvents={!isExpanded && rank > 0 ? 'none' : 'box-none'}
        >
          <View pointerEvents="none">
            <Text style={[styles.trackedValue, { color: textColor }]}>
              {formatAmount(trackedSpend)}
            </Text>
          </View>

          <View
            style={styles.actionsRow}
            pointerEvents={!isExpanded && rank > 0 ? 'none' : 'auto'}
          >
            {isCardProfile ? (
              <>
                <AnimatedPressable
                  scaleTo={0.93}
                  onPress={() => onCopy(acc)}
                  accessibilityLabel={`Copy ${acc.title}`}
                  contentStyle={[styles.actionPill, { backgroundColor: actionGlassBg }]}
                >
                  <CopyIcon size={13} color={isCopied ? '#10B981' : textColor} />
                  <Text
                    style={[
                      styles.actionText,
                      { color: isCopied ? '#10B981' : textColor },
                    ]}
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </Text>
                </AnimatedPressable>

                <View style={[styles.networkBadge, { backgroundColor: pillSurface }]}>
                  {acc.cardType === 'Mastercard' && (
                    <View style={styles.mcCircles}>
                      <View style={[styles.mcCircle, { backgroundColor: '#EB001B' }]} />
                      <View
                        style={[
                          styles.mcCircle,
                          { backgroundColor: '#F79E1B', marginLeft: -5 },
                        ]}
                      />
                    </View>
                  )}
                  <Text style={[styles.networkText, { color: textColor }]}>{acc.cardType}</Text>
                </View>
              </>
            ) : (
              <>
                <AnimatedPressable
                  scaleTo={0.93}
                  onPress={() => onCopy(acc)}
                  accessibilityLabel={`Copy ${acc.upiId}`}
                  contentStyle={[styles.actionPill, { backgroundColor: actionGlassBg }]}
                >
                  <CopyIcon size={14} color={isCopied ? '#10B981' : textColor} />
                  <Text
                    style={[
                      styles.actionText,
                      { color: isCopied ? '#10B981' : textColor },
                    ]}
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </Text>
                </AnimatedPressable>

                <AnimatedPressable
                  scaleTo={0.93}
                  onPress={() => {
                    triggerImpact(ImpactStyle.Light);
                    onOpenQr(acc);
                  }}
                  accessibilityLabel={`Open QR for ${acc.upiId}`}
                  contentStyle={[styles.actionPill, { backgroundColor: primaryPillBg }]}
                >
                  <QrCodeIcon size={14} color={primaryPillText} />
                  <Text style={[styles.actionText, { color: primaryPillText }]}>QR</Text>
                </AnimatedPressable>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

export const UpiProfilesSection: React.FC = () => {
  const { accounts, selectedAccountId, setSelectedAccountId, transactions } = useSplitTrack();
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [qrAccount, setQrAccount] = useState<UpiAccount | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeId = accounts.some((a) => a.id === selectedAccountId)
    ? selectedAccountId
    : accounts[0]?.id;

  const rankMap = new Map<string, number>();
  let nextRank = 1;
  for (const acc of accounts) {
    if (acc.id === activeId) {
      rankMap.set(acc.id, 0);
    } else {
      rankMap.set(acc.id, nextRank++);
    }
  }

  const count = Math.max(1, accounts.length);
  const targetDeckHeight = isExpanded
    ? count * (CARD_HEIGHT + EXPAND_GAP) - EXPAND_GAP
    : CARD_HEIGHT + (count - 1) * STACK_PEEK;

  const [deckHeightAnim] = useState(() => new Animated.Value(targetDeckHeight));

  useEffect(() => {
    Animated.spring(deckHeightAnim, {
      toValue: targetDeckHeight,
      tension: 62,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [targetDeckHeight, deckHeightAnim]);

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? 'rgba(255, 255, 255, 0.72)' : '#52525B';
  const pillSurface = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.08)';
  const actionGlassBg = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.78)';
  const primaryPillBg = isDark ? '#F4F4F5' : '#18181B';
  const primaryPillText = isDark ? '#18181B' : '#FFFFFF';

  const handleCopy = (acc: UpiAccount) => {
    triggerNotification(NotificationType.Success);
    copyToClipboard(acc.upiId || acc.cardNumber || acc.title);
    setCopiedId(acc.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === acc.id ? null : prev));
    }, 1800);
  };

  const handleMakeDefault = (acc: UpiAccount) => {
    triggerNotification(NotificationType.Success);
    setSelectedAccountId(acc.id);
  };

  const handleCardPress = (acc: UpiAccount) => {
    if (!isExpanded) {
      triggerImpact(ImpactStyle.Medium);
      setIsExpanded(true);
      return;
    }
    triggerImpact(ImpactStyle.Light);
    if (acc.id === activeId) {
      setIsExpanded(false);
    }
  };

  return (
    <View style={styles.sectionContainer}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>UPI & Card Profiles</Text>

        <View style={styles.headerActions}>
          {count > 1 && (
            <AnimatedPressable
              scaleTo={0.94}
              onPress={() => {
                triggerImpact(ImpactStyle.Light);
                setIsExpanded((prev) => !prev);
              }}
              accessibilityLabel={isExpanded ? 'Collapse UPI stack' : 'Expand UPI stack'}
              contentStyle={[styles.stackToggleBtn, { backgroundColor: pillSurface }]}
            >
              <Text style={[styles.stackToggleText, { color: textColor }]}>
                {isExpanded ? 'Stack' : 'Expand'}
              </Text>
            </AnimatedPressable>
          )}

          <GlassPill
            label="New"
            icon={<AddCircleIcon size={15} color={textColor} />}
            variant="dark"
            size="sm"
            onPress={() => setShowAddProfile(true)}
          />
        </View>
      </View>

      {/* Stacked UPI & Bank Cards Deck */}
      <Animated.View style={[styles.deckContainer, { height: deckHeightAnim }]}>
        {accounts.map((acc, mapIndex) => {
          const rank = rankMap.get(acc.id) ?? mapIndex;
          const linkedTx = transactions.filter((t) => t.upiAccountId === acc.id);
          const trackedSpend =
            linkedTx.reduce((sum, t) => sum + Math.abs(t.amount), 0) || acc.totalSpent || 0;

          return (
            <ProfileDeckCard
              key={acc.id}
              acc={acc}
              mapIndex={mapIndex}
              rank={rank}
              totalCount={count}
              isExpanded={isExpanded}
              isDefault={acc.id === activeId}
              isCopied={copiedId === acc.id}
              trackedSpend={trackedSpend}
              isDark={isDark}
              textColor={textColor}
              mutedText={mutedText}
              pillSurface={pillSurface}
              actionGlassBg={actionGlassBg}
              primaryPillBg={primaryPillBg}
              primaryPillText={primaryPillText}
              formatAmount={formatAmount}
              onCardPress={handleCardPress}
              onMakeDefault={handleMakeDefault}
              onCopy={handleCopy}
              onOpenQr={setQrAccount}
            />
          );
        })}
      </Animated.View>

      <AddUpiProfileModal
        visible={showAddProfile}
        onClose={() => setShowAddProfile(false)}
      />

      {qrAccount && (
        <UpiQrModal
          visible={!!qrAccount}
          onClose={() => setQrAccount(null)}
          account={qrAccount}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 22,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stackToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  stackToggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deckContainer: {
    position: 'relative',
    width: '100%',
  },
  cardWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  upiCardGradient: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTopInfo: {
    flex: 1,
    gap: 3,
  },
  bankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankHeading: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  kindPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  kindPillText: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  profileTitle: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  profileHandle: {
    fontSize: 13,
    fontWeight: '400',
  },
  makeDefaultPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 0,
  },
  makeDefaultText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emvChip: {
    width: 30,
    height: 21,
    borderRadius: 5,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emvChipInnerH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  emvChipInnerV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  cardNumberDigits: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  cardExpiryText: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackedValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 5,
    borderWidth: 0,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mcCircles: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    opacity: 0.9,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

export default UpiProfilesSection;
