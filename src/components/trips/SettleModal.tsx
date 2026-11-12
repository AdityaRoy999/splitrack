import React, { useState } from 'react';
import {
  Modal,
  Platform,
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
import { UpiQrModal } from '../upi/UpiQrModal';

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
  const { formatAmount, themeMode } = useLiquidGlass();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const isDark = themeMode === 'dark';
  const isIOS = Platform.OS === 'ios';
  const rawDebts = getSimplifiedDebts();
  const targetFriend = targetFriendId
    ? friends.find((f) => f.id === targetFriendId) || null
    : null;
  const simplifiedDebts = targetFriendId
    ? [...rawDebts].sort((a, b) => {
        const aMatch = a.fromId === targetFriendId || a.toId === targetFriendId ? 1 : 0;
        const bMatch = b.fromId === targetFriendId || b.toId === targetFriendId ? 1 : 0;
        return bMatch - aMatch;
      })
    : rawDebts;
  const targetHasPendingDebt = Boolean(
    targetFriendId &&
      simplifiedDebts.some(
        (d) => d.fromId === targetFriendId || d.toId === targetFriendId,
      ),
  );
  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const activeUpiAccount =
    (activeAccount?.upiId ? activeAccount : accounts.find((a) => Boolean(a.upiId))) ||
    activeAccount;

  const handleSettle = (fromId: string, toId: string, amount: number) => {
    triggerNotification(NotificationType.Success);

    const friendId = fromId === 'user' ? toId : fromId;
    settleWithFriend(friendId, amount);

    setSuccessMsg(`Settled ${formatAmount(amount)} successfully!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSendReminder = async (debtorName: string, amount: number) => {
    try {
      triggerImpact(ImpactStyle.Light);
      const preferredUpi =
        (activeAccount?.upiId ? activeAccount : accounts.find((a) => Boolean(a.upiId))) ||
        activeAccount;
      const handleText = preferredUpi?.upiId
        ? ` Pay via UPI: ${preferredUpi.upiId}.`
        : preferredUpi?.title
          ? ` Account: ${preferredUpi.title}.`
          : '';
      const message = `Hey ${debtorName}, a quick reminder from SplitTrack: you have a pending split of ${formatAmount(amount)}.${handleText} Thanks!`;
      await Share.share({ message });
    } catch {}
  };

  const bgSheet = isDark ? '#09090B' : '#F2F2F7';
  const cardSurface = isDark ? '#141418' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const pillSurface = isDark ? '#1B1B20' : '#F2F2F7';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  return (
    <Modal
      visible={visible}
      transparent={!isIOS}
      presentationStyle={isIOS ? 'pageSheet' : undefined}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, isIOS && { backgroundColor: bgSheet }]}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: bgSheet },
            isIOS && { flex: 1, maxHeight: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingTop: 22 },
          ]}
        >
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

          {activeAccount && (
            <View
              style={[
                styles.activeProfileStrip,
                {
                  backgroundColor: cardSurface,
                  borderRadius: 18,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.activeProfileLeft}>
                <Text style={[styles.activeProfileLabel, { color: mutedText }]}>
                  Receiving UPI Profile
                </Text>
                <Text style={[styles.activeProfileValue, { color: textColor }]} numberOfLines={1}>
                  {activeAccount.title} • {activeAccount.upiId || activeAccount.bankName || 'Default'}
                </Text>
              </View>
              <AnimatedPressable
                scaleTo={0.93}
                onPress={() => {
                  triggerImpact(ImpactStyle.Light);
                  setShowQrModal(true);
                }}
                contentStyle={[styles.qrMiniPill, { backgroundColor: pillSurface }]}
              >
                <QrCodeIcon size={14} color={textColor} />
                <Text style={[styles.qrMiniText, { color: textColor }]}>QR</Text>
              </AnimatedPressable>
            </View>
          )}

          {targetFriend && !targetHasPendingDebt && simplifiedDebts.length > 0 && (
            <View style={styles.successBanner}>
              <CheckCircleIcon size={16} color="#10B981" />
              <Text style={styles.successText}>
                You and {targetFriend.name} have no unsettled balance right now.
              </Text>
            </View>
          )}

          {successMsg && (
            <View style={styles.successBanner}>
              <CheckCircleIcon size={16} color="#10B981" />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          )}

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
              <View
                style={[
                  styles.debtsGroupCard,
                  {
                    backgroundColor: cardSurface,
                    borderRadius: 22,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: cardBorder,
                  },
                ]}
              >
                {simplifiedDebts.map((item, idx) => {
                  const isUserDebtor = item.fromId === 'user';
                  const isUserCreditor = item.toId === 'user';
                  const isFocused = Boolean(
                    targetFriendId &&
                      (item.fromId === targetFriendId || item.toId === targetFriendId),
                  );
                  const showDivider = idx < simplifiedDebts.length - 1;

                  return (
                    <React.Fragment key={`${item.fromId}-${item.toId}-${idx}`}>
                      <View
                        style={[
                          styles.debtCardInner,
                          isFocused && {
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
                            <Text
                              style={[styles.partyName, styles.partyNameRight, { color: textColor }]}
                              numberOfLines={1}
                            >
                              {item.toName}
                            </Text>
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
            )}
          </ScrollView>
        </View>
      </View>

      {activeUpiAccount && (
        <UpiQrModal
          visible={showQrModal}
          onClose={() => setShowQrModal(false)}
          account={activeUpiAccount}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '85%',
    borderWidth: 0,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '500',
  },
  debtsList: {
    gap: 10,
    paddingVertical: 6,
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
  partyName: {
    fontSize: 15,
    fontWeight: '500',
  },
  partyNameRight: {
    textAlign: 'right',
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
  },
  creditorBtnRow: {
    flexDirection: 'row',
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
    gap: 5,
  },
  qrMiniText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
