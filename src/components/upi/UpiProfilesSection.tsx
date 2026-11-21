import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { QrCodeIcon } from '@solar-icons/react-native/bold/qr-code';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
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
import { BrandEmblemIcon } from '../common/BrandEmblemIcon';
import { GlassPill } from '../glass/GlassPill';
import { SheetModal } from '../common/SheetModal';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { SheetHeader } from '../common/SheetHeader';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';
import { ItemActionReveal } from '../common/ItemActionReveal';

import { GlassSurface } from '../glass/GlassSurface';
import { AddUpiProfileModal } from './AddUpiProfileModal';
import { UpiQrModal } from './UpiQrModal';
import { COMPACT_BUTTON_HEIGHT, COMPACT_BUTTON_HIT_SLOP, COMPACT_ICON_BUTTON_STYLE } from '../../constants/buttonSizes';

const CARD_HEIGHT = 152;
const STACK_PEEK = 24;
const EXPAND_GAP = 12;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const PROVIDER_AURORA_STOPS: Record<string, [string, string, string]> = {
  slice: ['#6366F1', '#A855F7', '#EC4899'],
  gpay: ['#0284C7', '#38BDF8', '#10B981'],
  phonepe: ['#7C3AED', '#EC4899', '#6366F1'],
  paytm: ['#06B6D4', '#3B82F6', '#0EA5E9'],
  bank: ['#059669', '#10B981', '#14B8A6'],
  cred: ['#E11D48', '#F43F5E', '#FB7185'],
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
  ['#6366F1', '#A855F7', '#EC4899'],
  ['#0284C7', '#38BDF8', '#10B981'],
  ['#7C3AED', '#EC4899', '#6366F1'],
  ['#059669', '#10B981', '#14B8A6'],
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
  effectsPaused: boolean;
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
  onEdit: (acc: UpiAccount) => void;
  onDelete: (acc: UpiAccount) => void;
}

const ProfileDeckCard: React.FC<ProfileDeckCardProps> = ({
  acc,
  mapIndex,
  rank,
  totalCount,
  isExpanded,
  isDefault,
  isCopied,
  effectsPaused,
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
  onEdit,
  onDelete,
}) => {
  const { transactionActionStyle } = useLiquidGlass();
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
        tension: 48,
        friction: 10,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scaleAnim, {
        toValue: targetScale,
        tension: 48,
        friction: 10,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(footerOpacityAnim, {
        toValue: targetFooterOpacity,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
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
          zIndex: cardZIndex,
          transform: [{ translateY: topAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <ItemActionReveal name={acc.title} buttons={false} borderRadius={24} onEdit={() => onEdit(acc)} onDelete={() => onDelete(acc)}>
      <GlassSurface
        borderRadius={24}
        glassStyle="regular"
        intensity={isDark ? 82 : 92}
        matteColor={cardBaseBg}
        style={styles.upiCardGradient}
      >
        <Aurora
          colorStops={auroraStops}
          amplitude={0.88}
          blend={0.5}
          height={0.46}
          speed={0.85}
          glow={0.48}
          layers={2}
          paused={effectsPaused || (!isExpanded && !isDefault)}
          direction="bottom"
          opacity={isCardProfile ? (isDark ? 0.88 : 0.72) : isDark ? 0.82 : 0.68}
          lightMode={!isDark}
          style={{ borderRadius: 24 }}
        />

        {/* Full-card tap layer (expands stack or collapses default card) */}
        <Pressable
          onPress={() => onCardPress(acc)}
          accessibilityLabel={`${acc.title} card`}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.upiCardInner} pointerEvents="box-none">

        {/* Card Top Header */}
        <View style={styles.cardTopRow} pointerEvents="box-none">
          <BrandEmblemIcon
            id={isCardProfile || acc.provider === 'bank' ? acc.bankBrand : acc.provider}
            name={acc.bankName || acc.title}
            accentColor={auroraStops[0]}
            size={30}
            borderRadius={8}
          />
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

          <Animated.View
            style={[styles.topActionsRow, { opacity: footerOpacityAnim }]}
            pointerEvents={!isExpanded && rank > 0 ? 'none' : 'auto'}
          >
            {!isDefault && (
              <AnimatedPressable
                scaleTo={0.93}
                onPress={() => onMakeDefault(acc)}
                accessibilityLabel={`Make ${acc.title} default`}
                hitSlop={COMPACT_BUTTON_HIT_SLOP}
                contentStyle={[styles.makeDefaultPill, { backgroundColor: primaryPillBg }]}
              >
                <Text style={[styles.makeDefaultText, { color: primaryPillText }]}>
                  Make Default
                </Text>
              </AnimatedPressable>
            )}

            {isExpanded && transactionActionStyle === 'buttons' && (
              <View style={styles.cardEditDeleteRow}>
                <AnimatedPressable
                  scaleTo={0.9}
                  onPress={() => onEdit(acc)}
                  accessibilityLabel={`Edit ${acc.title}`}
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
                  contentStyle={[styles.cardActionIconBtn, { backgroundColor: actionGlassBg }]}
                >
                  <Pen2Icon size={13} color={textColor} />
                </AnimatedPressable>

                <AnimatedPressable
                  scaleTo={0.9}
                  onPress={() => onDelete(acc)}
                  accessibilityLabel={`Delete ${acc.title}`}
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
                  contentStyle={[styles.cardActionIconBtn, { backgroundColor: actionGlassBg }]}
                >
                  <TrashBinTrashIcon size={13} color="#EF4444" />
                </AnimatedPressable>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Middle Row for Real Debit / Credit Bank Cards */}
        {isCardProfile && (
          <View style={styles.cardMiddleRow} pointerEvents="none">
            <Image
              source={require('../../../assets/card-chip.png')}
              style={styles.emvChipImage}
              resizeMode="contain"
            />
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
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
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
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
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
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
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
      </GlassSurface></ItemActionReveal>
    </Animated.View>
  );
};

export const UpiProfilesSection: React.FC = () => {
  const { accounts, selectedAccountId, setSelectedAccountId, transactions, deleteUpiAccount } = useSplitTrack();
  const { run, pending, error } = useAsyncAction();
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UpiAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<UpiAccount | null>(null);
  const [qrAccount, setQrAccount] = useState<UpiAccount | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeId = accounts.some((a) => a.id === selectedAccountId)
    ? selectedAccountId
    : accounts[0]?.id;

  const rankMap = useMemo(() => {
    const ranks = new Map<string, number>();
    let nextRank = 1;
    for (const acc of accounts) {
      ranks.set(acc.id, acc.id === activeId ? 0 : nextRank++);
    }
    return ranks;
  }, [accounts, activeId]);
  const spendByAccount = useMemo(() => {
    const spending = new Map<string, number>();
    for (const transaction of transactions) {
      spending.set(transaction.upiAccountId, (spending.get(transaction.upiAccountId) ?? 0) + Math.abs(transaction.amount));
    }
    return spending;
  }, [transactions]);

  const count = Math.max(1, accounts.length);
  const targetDeckHeight = isExpanded
    ? count * (CARD_HEIGHT + EXPAND_GAP) - EXPAND_GAP
    : CARD_HEIGHT + (count - 1) * STACK_PEEK;

  const [deckHeightAnim] = useState(() => new Animated.Value(targetDeckHeight));

  useEffect(() => {
    Animated.spring(deckHeightAnim, {
      toValue: targetDeckHeight,
      tension: 48,
      friction: 10,
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
    void run(async () => { await setSelectedAccountId(acc.id); triggerNotification(NotificationType.Success); });
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
      <FormError message={error} />
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
              hitSlop={COMPACT_BUTTON_HIT_SLOP}
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
          const trackedSpend = spendByAccount.get(acc.id) || acc.totalSpent || 0;

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
              effectsPaused={showAddProfile || !!accountToDelete || !!qrAccount}
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
              onEdit={(targetAcc) => {
                setEditingAccount(targetAcc);
                setShowAddProfile(true);
              }}
              onDelete={(targetAcc) => {
                setAccountToDelete(targetAcc);
              }}
            />
          );
        })}
      </Animated.View>

      <AddUpiProfileModal
        visible={showAddProfile}
        editingAccount={editingAccount}
        onClose={() => {
          setShowAddProfile(false);
          setEditingAccount(null);
        }}
      />

      <SheetModal visible={Boolean(accountToDelete)} onRequestClose={() => !pending && setAccountToDelete(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <ModalBackdrop onClose={() => !pending && setAccountToDelete(null)} />
          <GlassModalSheet>
            <SheetHeader title="Delete payment profile?" subtitle="Your previous transactions remain in the ledger" onClose={() => !pending && setAccountToDelete(null)} disabled={pending} />
            <ScrollEdgeFade><ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
              <View style={{ padding: 18, borderRadius: 22, gap: 10, backgroundColor: isDark ? '#111114' : '#EDEDF1' }}>
                <Text style={{ color: textColor, fontSize: 17, fontWeight: '600' }}>{accountToDelete?.title}</Text>
                <Text style={{ color: mutedText, fontSize: 13, lineHeight: 20 }}>Delete this payment profile? Past recorded transactions will remain available.</Text>
              </View>
              <FormError message={error} />
              <GlassPill label={pending ? 'Deleting…' : 'Delete profile'} size="lg" variant="danger" disabled={pending} onPress={() => {
                if (!accountToDelete) return;
                void run(async () => { await deleteUpiAccount(accountToDelete.id); setAccountToDelete(null); });
              }} />
              <GlassPill label="Cancel" size="lg" variant="dark" disabled={pending} onPress={() => setAccountToDelete(null)} />
            </ScrollView></ScrollEdgeFade>
          </GlassModalSheet>
        </View>
      </SheetModal>

      <UpiQrModal visible={!!qrAccount} onClose={() => setQrAccount(null)} account={qrAccount} />
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
    height: COMPACT_BUTTON_HEIGHT,
    justifyContent: 'center',
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
    top: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  upiCardGradient: {
    flex: 1,
    borderRadius: 24,
    padding: 0,
    overflow: 'hidden',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  upiCardInner: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTopInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  bankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankHeading: {
    flexShrink: 1,
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
    height: COMPACT_BUTTON_HEIGHT,
    justifyContent: 'center',
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
  emvChipImage: {
    width: 34,
    height: 27,
    borderRadius: 5,
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
    height: COMPACT_BUTTON_HEIGHT,
    justifyContent: 'center',
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
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardEditDeleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardActionIconBtn: {
    ...COMPACT_ICON_BUTTON_STYLE,
    borderRadius: COMPACT_BUTTON_HEIGHT / 2,
    borderWidth: 0,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteDialogCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 0,
  },
  deleteDialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  deleteDialogBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteDialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  deleteCancelBtn: {
    paddingHorizontal: 16,
    height: COMPACT_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  deleteCancelText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteConfirmBtn: {
    paddingHorizontal: 18,
    height: COMPACT_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },
  deleteConfirmText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default UpiProfilesSection;
