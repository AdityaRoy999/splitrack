import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { ShareCircleIcon } from '@solar-icons/react-native/bold/share-circle';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { UpiAccount } from '../../types';
import { GlassPill } from '../glass/GlassPill';
import { StyledUpiQr } from './StyledUpiQr';
import { getUpiBrandMeta } from './upiBrandLogo';

interface UpiQrModalProps {
  visible: boolean;
  onClose: () => void;
  account: UpiAccount;
}

export const UpiQrModal: React.FC<UpiQrModalProps> = ({
  visible,
  onClose,
  account,
}) => {
  const [copied, setCopied] = useState(false);
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const cardBg = isDark ? '#111114' : '#FFFFFF';
  const pillBg = isDark ? '#18181D' : '#F3F4F6';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const mutedText = isDark ? '#71717A' : '#6B7280';

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
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      triggerImpact(ImpactStyle.Light);
      await Share.share({
        message: `Pay me on SplitTrack via UPI: ${account.upiId} (${account.title})`,
      });
    } catch {}
  };

  const brandMeta = getUpiBrandMeta(account.provider, account.bankBrand);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {Platform.OS === 'web' ? (
          <View
            pointerEvents="none"
            style={[
              styles.backdropFill,
              {
                backgroundColor: isDark ? 'rgba(6, 7, 11, 0.56)' : 'rgba(15, 23, 42, 0.34)',
                backdropFilter: 'blur(18px) saturate(140%)',
                WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              } as unknown as ViewStyle,
            ]}
          />
        ) : (
          <View pointerEvents="none" style={styles.backdropFill}>
            <BlurView
              intensity={isDark ? 36 : 32}
              tint={isDark ? 'dark' : 'light'}
              style={styles.backdropFill}
            />
            <View
              style={[
                styles.backdropFill,
                { backgroundColor: isDark ? 'rgba(6, 7, 11, 0.44)' : 'rgba(15, 23, 42, 0.24)' },
              ]}
            />
          </View>
        )}

        <Pressable
          accessibilityLabel="Close QR modal backdrop"
          onPress={onClose}
          style={styles.backdropFill}
        />

        <View style={[styles.contentCard, { backgroundColor: cardBg }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: pillBg }]}>
            <CloseCircleIcon size={20} color={textColor} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.appBadgePill, { backgroundColor: pillBg }]}>
              <View style={[styles.appDot, { backgroundColor: brandMeta.primary }]} />
              <Text style={[styles.appBadgeText, { color: textColor }]}>{brandMeta.label}</Text>
            </View>
            <Text style={[styles.title, { color: textColor }]}>Scan to Pay via UPI</Text>
            <Text style={[styles.subtitle, { color: mutedText }]}>{account.title}</Text>
          </View>

          {/* Stylish Scannable QR Code with UPI App Image in Center */}
          <View style={styles.qrBox}>
            <StyledUpiQr account={account} size={216} />
          </View>

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
          <View style={styles.actionsRow}>
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
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
  contentCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
    zIndex: 2,
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
  appBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 8,
  },
  appDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
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
