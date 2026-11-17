import { ModalBackdrop } from '../common/ModalBackdrop';
import { SheetModal } from '../common/SheetModal';
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { ArrowRightIcon } from '@solar-icons/react-native/bold/arrow-right';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { ChatRoundDotsIcon } from '@solar-icons/react-native/bold/chat-round-dots';
import { QrCodeIcon } from '@solar-icons/react-native/bold/qr-code';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassPill } from '../glass/GlassPill';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { UpiQrModal } from '../upi/UpiQrModal';
import { BottomBubble, type BubbleNotice } from '../common/BottomBubble';
import { buildUpiPaymentUri, formatUpiAmount, getReceivingUpiAccount, type UpiPaymentDetails } from '../../utils/upi';
import type { UpiAccount } from '../../types';

interface SettleModalProps {
  visible: boolean;
  onClose: () => void;
  targetFriendId?: string;
}

export const SettleModal: React.FC<SettleModalProps> = ({
  visible,
  onClose,
  targetFriendId,
}) => {
  const { accounts, friends, selectedAccountId, getSimplifiedDebts, settleWithFriend } = useSplitTrack();
  const { formatAmount, themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const [qrRequest, setQrRequest] = useState<({ account: UpiAccount } & UpiPaymentDetails) | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const closeQr = useCallback(() => setQrRequest(null), []);

  const isDark = themeMode === 'dark';
  const rawDebts = getSimplifiedDebts();
  const targetFriend = targetFriendId
    ? friends.find((f) => f.id === targetFriendId) || null
    : null;
  const targetDebts = targetFriendId
    ? rawDebts.filter((d) => d.fromId === targetFriendId || d.toId === targetFriendId)
    : rawDebts;
  const otherDebts = targetFriendId
    ? rawDebts.filter((d) => d.fromId !== targetFriendId && d.toId !== targetFriendId)
    : [];
  const simplifiedDebts = rawDebts;
  const targetHasPendingDebt = targetDebts.length > 0;
  const receivingAccount = getReceivingUpiAccount(accounts, selectedAccountId);

  const openPaymentQr = (amount?: number, debtorName?: string) => {
    if (!receivingAccount) return;
    triggerImpact(ImpactStyle.Light);
    setQrRequest({
      account: receivingAccount, amount,
      note: debtorName ? `SplitTrack settlement with ${debtorName}` : undefined,
    });
  };

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    triggerNotification(NotificationType.Success);

    const friendId = fromId === 'user' ? toId : fromId;
    settleWithFriend(friendId, amount);

    setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, message: `Settled ${formatAmount(amount)} successfully!` }));
  };

  const handleSendReminder = async (debtorName: string, amount: number) => {
    try {
      triggerImpact(ImpactStyle.Light);
      const paymentLink = receivingAccount
        ? buildUpiPaymentUri(receivingAccount, { amount, note: `SplitTrack settlement with ${debtorName}` })
        : '';
      const paymentText = paymentLink ? ` Pay ₹${formatUpiAmount(amount)} via UPI: ${receivingAccount!.upiId}.\n${paymentLink}` : '';
      const message = `Hey ${debtorName}, a quick reminder from SplitTrack: you have a pending split of ${formatAmount(amount)}.${paymentText}\nThanks!`;
      await Share.share({ message });
    } catch {}
  };

  const cardSurface = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')
    : (isDark ? '#141418' : '#FFFFFF');
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const pillSurface = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    : (isDark ? '#1B1B20' : '#F2F2F7');
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  const renderDebtGroup = (
    items: typeof rawDebts,
    highlighted: boolean,
    keyPrefix: string
  ) => (
    <View
      style={[
        styles.debtsGroupCard,
        {
          backgroundColor: cardSurface,
          borderRadius: 22,
          borderWidth: 0,
        },
      ]}
    >
      {items.map((item, idx) => {
        const isUserDebtor = item.fromId === 'user';
        const isUserCreditor = item.toId === 'user';
        const showDivider = idx < items.length - 1;

        return (
          <React.Fragment key={`${keyPrefix}-${item.fromId}-${item.toId}-${idx}`}>
            <View
              style={[
                styles.debtCardInner,
                highlighted && {
                  backgroundColor: isDark
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(16, 185, 129, 0.06)',
                  marginHorizontal: -10,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                },
              ]}
            >
              <View style={styles.partiesRow}>
                <View style={styles.partyBoxLeft}>
                  <Text style={[styles.partyName, { color: textColor }]} numberOfLines={1}>
                    {item.fromName}
                  </Text>
                  <Text style={[styles.partyRole, { color: mutedText }]}>owes</Text>
                </View>

                <View style={styles.arrowIconWrapper}>
                  <ArrowRightIcon size={18} color={mutedText} />
                </View>

                <View style={styles.partyBoxRight}>
                  <View style={styles.recipientNameRow}>
                    {isUserCreditor && receivingAccount ? (
                      <AnimatedPressable
                        scaleTo={0.93}
                        onPress={() => openPaymentQr(item.amount, item.fromName)}
                        accessibilityLabel={`Show payment QR for ${item.fromName} to pay you ${formatUpiAmount(item.amount)} rupees`}
                        contentStyle={[styles.debtQrButton, { backgroundColor: pillSurface }]}
                      >
                        <QrCodeIcon size={17} color={textColor} />
                      </AnimatedPressable>
                    ) : null}
                  <Text
                    style={[styles.partyName, styles.partyNameRight, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {item.toName}
                  </Text>
                  </View>
                  <Text style={[styles.partyRole, styles.partyRoleRight, { color: mutedText }]}>
                    receives
                  </Text>
                </View>
              </View>

              <View style={styles.amountActionRow}>
                <Text style={[styles.debtAmount, { color: textColor }]}>
                  {formatAmount(item.amount)}
                </Text>

                <View style={styles.actionsGroup}>
                  {isUserDebtor ? (
                    <GlassPill
                      label="Mark Settled"
                      icon={<CheckCircleIcon size={14} color={isDark ? '#000000' : '#FFFFFF'} />}
                      variant="accent"
                      size="sm"
                      onPress={() => handleSettle(item.fromId, item.toId, item.amount)}
                    />
                  ) : isUserCreditor ? (
                    <View style={styles.creditorBtnRow}>
                      <GlassPill
                        label="Remind"
                        icon={<ChatRoundDotsIcon size={14} color={textColor} />}
                        variant="dark"
                        size="sm"
                        onPress={() => handleSendReminder(item.fromName, item.amount)}
                      />
                      <GlassPill
                        label="Mark Settled"
                        icon={<CheckCircleIcon size={14} color={isDark ? '#000000' : '#FFFFFF'} />}
                        variant="accent"
                        size="sm"
                        onPress={() => handleSettle(item.fromId, item.toId, item.amount)}
                      />
                    </View>
                  ) : (
                    <GlassPill
                      label="Mark Settled"
                      icon={<CheckCircleIcon size={14} color={textColor} />}
                      variant="dark"
                      size="sm"
                      onPress={() => handleSettle(item.fromId, item.toId, item.amount)}
                    />
                  )}
                </View>
              </View>
            </View>

            {showDivider && (
              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ModalBackdrop onClose={onClose} />
        <GlassModalSheet style={styles.sheetContainer}>
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#27272A' : '#D4D4D8' }]} />
          </View>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.title, { color: textColor }]}>
                {targetFriend ? `Settle with ${targetFriend.name}` : 'Who Needs to Pay Whom'}
              </Text>
              <Text style={[styles.subtitle, { color: mutedText }]}>
                {targetFriend
                  ? 'Prioritized balances & simplified trip splits'
                  : 'Auto-simplified expense balances'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close settle modal"
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1C20' : '#FFFFFF' }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          {receivingAccount ? (
            <View
              style={[
                styles.activeProfileStrip,
                {
                  backgroundColor: cardSurface,
                  borderRadius: 18,
                  borderWidth: 0,
                },
              ]}
            >
              <View style={styles.activeProfileLeft}>
                <Text style={[styles.activeProfileLabel, { color: mutedText }]}>
                  Receiving UPI Profile
                </Text>
                <Text style={[styles.activeProfileValue, { color: textColor }]} numberOfLines={1}>
                  {receivingAccount.title} • {receivingAccount.upiId}
                </Text>
              </View>
              <AnimatedPressable
                scaleTo={0.93}
                onPress={() => {
                  const focusedDebt = targetFriendId ? targetDebts.find((debt) => debt.toId === 'user') : undefined;
                  openPaymentQr(focusedDebt?.amount, focusedDebt?.fromName);
                }}
                accessibilityLabel="Show receiving UPI profile QR"
                contentStyle={[styles.qrMiniPill, { backgroundColor: pillSurface }]}
              >
                <QrCodeIcon size={14} color={textColor} />
                <Text style={[styles.qrMiniText, { color: textColor }]}>QR</Text>
              </AnimatedPressable>
            </View>
          ) : <Text style={[styles.profileHint, { color: mutedText }]}>Add a UPI profile to receive payments by QR.</Text>}

          {targetFriend && !targetHasPendingDebt && simplifiedDebts.length > 0 && (
            <View style={styles.successBanner}>
              <View style={styles.successIconWrap}>
                <CheckCircleIcon size={17} color="#10B981" />
              </View>
              <Text style={styles.successText}>
                You and {targetFriend.name} have no unsettled balance right now.
              </Text>
            </View>
          )}

          <ScrollEdgeFade style={styles.scrollAreaWrap}>
            <ScrollView contentContainerStyle={styles.debtsList} showsVerticalScrollIndicator={false}>
            {simplifiedDebts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CheckCircleIcon size={44} color="#10B981" />
                <Text style={[styles.emptyTitle, { color: textColor }]}>All Settled Up</Text>
                <Text style={[styles.emptySubtitle, { color: mutedText }]}>
                  Nobody owes anyone anything right now.
                </Text>
              </View>
            ) : (
              <>
                {targetDebts.length > 0 &&
                  renderDebtGroup(targetDebts, Boolean(targetFriendId), 'focus')}

                {otherDebts.length > 0 && (
                  <View style={styles.otherSectionWrap}>
                    <Text style={[styles.otherSectionLabel, { color: mutedText }]}>
                      Other Unsettled Balances ({otherDebts.length})
                    </Text>
                    {renderDebtGroup(otherDebts, false, 'other')}
                  </View>
                )}
              </>
            )}
            </ScrollView>
          </ScrollEdgeFade>
        </GlassModalSheet>

        <BottomBubble notice={notice} onDismiss={dismissNotice} />
      </View>

      <UpiQrModal visible={Boolean(qrRequest)} onClose={closeQr} account={qrRequest?.account ?? null} amount={qrRequest?.amount} note={qrRequest?.note} />
    </SheetModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,

    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderWidth: 0,
    marginBottom: 0,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 10,
    gap: 10,
  },
  successIconWrap: {
    flexShrink: 0,
  },
  successText: {
    flex: 1,
    flexShrink: 1,
    color: '#10B981',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  otherSectionWrap: {
    marginTop: 6,
    gap: 8,
  },
  otherSectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  debtsList: {
    gap: 10,
    paddingTop: 14,
    paddingBottom: 28,
  },
  scrollAreaWrap: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  debtsGroupCard: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 0,
  },
  debtCardInner: {
    gap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    height: 1,
    width: '100%',
  },
  partiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partyBoxLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  partyBoxRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  recipientNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, maxWidth: '100%' },
  debtQrButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  profileHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  partyName: {
    fontSize: 15,
    fontWeight: '500',
  },
  partyNameRight: {
    textAlign: 'right',
    flexShrink: 1,
  },
  partyRole: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  partyRoleRight: {
    textAlign: 'right',
  },
  arrowIconWrapper: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  debtAmount: {
    fontSize: 18,
    fontWeight: '500',
  },
  actionsGroup: {
    flexDirection: 'row',
    maxWidth: '100%',
  },
  creditorBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeProfileStrip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0,
  },
  activeProfileLeft: {
    flex: 1,
    marginRight: 10,
  },
  activeProfileLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  activeProfileValue: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  qrMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 44,
    gap: 5,
  },
  qrMiniText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
