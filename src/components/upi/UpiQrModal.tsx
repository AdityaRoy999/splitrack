import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { ShareCircleIcon } from '@solar-icons/react-native/bold/share-circle';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { UpiAccount } from '../../types';
import { GlassPill } from '../glass/GlassPill';
import { GlassSurface } from '../glass/GlassSurface';
import { StyledUpiQr } from './StyledUpiQr';
import { BlurView } from 'expo-blur';
import { useBackdropBlurTarget } from '../common/BackdropBlurTarget';
import { SheetModal } from '../common/SheetModal';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { usePopupMotion } from '../common/usePopupMotion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildUpiPaymentUri, formatUpiAmount, type UpiPaymentDetails } from '../../utils/upi';

interface UpiQrModalProps extends UpiPaymentDetails {
  visible: boolean;
  onClose: () => void;
  account: UpiAccount | null;
}

export const UpiQrModal: React.FC<UpiQrModalProps> = ({
  visible,
  onClose,
  account,
  amount,
  note,
}) => {
  return (
    <SheetModal visible={visible} statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      {account ? <QrModalContent key={`${account.id}-${amount ?? 'profile'}`} account={account} amount={amount} note={note} /> : null}
    </SheetModal>
  );
};

function QrModalContent({ account, amount, note }: { account: UpiAccount } & UpiPaymentDetails) {
  const insets = useSafeAreaInsets();
  const blurTarget = useBackdropBlurTarget();
  const { progress: animVal, close: handleSmoothClose } = usePopupMotion();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const pillBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    : (isDark ? '#18181D' : '#F3F4F6');
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const mutedText = isDark ? '#71717A' : '#6B7280';
  let paymentUri = '';
  let rupeeAmount = '';
  let paymentError = '';
  try {
    paymentUri = buildUpiPaymentUri(account, { amount, note });
    if (amount !== undefined) rupeeAmount = `₹${formatUpiAmount(amount)}`;
  } catch (error) {
    paymentError = error instanceof Error ? error.message : 'This payment QR is unavailable.';
  }

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const handleCopy = () => {
    triggerNotification(NotificationType.Success);
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.writeText
    ) {
      navigator.clipboard.writeText(account.upiId).catch(() => {});
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      triggerImpact(ImpactStyle.Light);
      await Share.share({
        message: `Pay${rupeeAmount ? ` ${rupeeAmount}` : ' me'} on SplitTrack via UPI: ${account.upiId} (${account.title})\n${paymentUri}`,
      });
    } catch {}
  };

  return (
      <View style={[styles.modalOverlay, { paddingTop: Math.max(20, insets.top), paddingBottom: Math.max(20, insets.bottom) }]}>
        <BlurView pointerEvents="none" style={StyleSheet.absoluteFill} intensity={55}
          tint={isDark ? 'dark' : 'light'} blurTarget={blurTarget} blurMethod="dimezisBlurView" />
        <ModalBackdrop label="Close QR modal backdrop" onClose={handleSmoothClose} shadeColor={isDark ? 'rgba(6, 7, 11, 0.44)' : 'rgba(15, 23, 42, 0.24)'} />

        <Animated.View
          style={[
            styles.contentCardWrap,
            {
              opacity: animVal,
              transform: [
                {
                  scale: animVal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateY: animVal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardScrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          <GlassSurface
            borderRadius={28}
            glassStyle="regular"
            intensity={isDark ? 85 : 95}
            tintColor={isDark ? 'rgba(20, 20, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)'}
            matteColor={isDark ? '#111114' : '#FFFFFF'}
            style={styles.contentCard}
          >
            <TouchableOpacity onPress={handleSmoothClose} style={[styles.closeBtn, { backgroundColor: pillBg }]}>
              <CloseCircleIcon size={20} color={textColor} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={[styles.title, { color: textColor }]}>{rupeeAmount ? 'Scan to settle' : 'Scan to pay'}</Text>
              <Text style={[styles.subtitle, { color: mutedText }]}>{account.title}</Text>
              {rupeeAmount ? <Text style={[styles.paymentAmount, { color: textColor }]}>{rupeeAmount}</Text> : null}
              {note ? <Text numberOfLines={2} style={[styles.paymentNote, { color: mutedText }]}>{note}</Text> : null}
            </View>

            {/* Stylish Scannable QR Code with UPI App Image in Center */}
            {paymentUri ? (
              <View style={styles.qrBox}>
                <StyledUpiQr account={account} size={216} amount={amount} note={note} />
              </View>
            ) : <Text style={[styles.paymentNote, { color: '#EF4444' }]}>{paymentError}</Text>}
            {rupeeAmount ? <Text style={[styles.paymentHint, { color: mutedText }]}>Amount is filled in. Confirm the payment in your UPI app.</Text> : null}

            {/* UPI ID Pill */}
            <TouchableOpacity onPress={handleCopy} activeOpacity={0.8} style={[styles.upiPill, { backgroundColor: pillBg }]}>
              <Text style={[styles.upiText, { color: textColor }]}>{account.upiId}</Text>
              {copied ? (
                <CheckCircleIcon size={16} color="#10B981" />
              ) : (
                <CopyIcon size={16} color={mutedText} />
              )}
            </TouchableOpacity>

            {/* Action buttons */}
            {paymentUri ? <View style={styles.actionsRow}>
              <GlassPill
                label={copied ? 'Copied!' : 'Copy UPI'}
                icon={<CopyIcon size={15} color="#000000" />}
                variant="light"
                onPress={handleCopy}
                style={styles.pillAction}
              />
              <GlassPill
                label="Share"
                icon={<ShareCircleIcon size={15} color="#FFFFFF" />}
                variant="dark"
                onPress={handleShare}
                style={styles.pillAction}
              />
            </View> : null}
          </GlassSurface>
          </ScrollView>
        </Animated.View>
      </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  contentCardWrap: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
    zIndex: 2,
    alignItems: 'center',
  },
  cardScroll: { width: '100%', flexGrow: 0, flexShrink: 1, borderRadius: 28 },
  cardScrollContent: { alignItems: 'center' },
  contentCard: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    padding: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: '#000000',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  paymentAmount: { fontSize: 28, fontWeight: '600', marginTop: 10, fontVariant: ['tabular-nums'] },
  paymentNote: { fontSize: 12, textAlign: 'center', marginTop: 6 },
  paymentHint: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 14 },
  qrBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 0,
  },
  upiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 18,
    borderWidth: 0,
  },
  upiText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  pillAction: {
    flex: 1,
  },
});
