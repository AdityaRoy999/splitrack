import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Platform, TouchableOpacity, Share } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { CopyIcon } from '@solar-icons/react-native/bold/copy';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { ShareCircleIcon } from '@solar-icons/react-native/bold/share-circle';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { UpiAccount } from '../../types';
import { GlassPill } from '../glass/GlassPill';

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.contentCard, { backgroundColor: cardBg }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: pillBg }]}>
            <CloseCircleIcon size={20} color={textColor} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>Scan to Pay via UPI</Text>
            <Text style={[styles.subtitle, { color: mutedText }]}>{account.title}</Text>
          </View>

          {/* Borderless High contrast QR Box */}
          <View style={styles.qrBox}>
            <Svg width={180} height={180} viewBox="0 0 180 180">
              <Rect width={180} height={180} fill="#FFFFFF" />
              {/* Corner position markers */}
              <Rect x={10} y={10} width={40} height={40} fill="#000000" rx={8} />
              <Rect x={18} y={18} width={24} height={24} fill="#FFFFFF" rx={4} />
              <Rect x={24} y={24} width={12} height={12} fill="#000000" rx={2} />

              <Rect x={130} y={10} width={40} height={40} fill="#000000" rx={8} />
              <Rect x={138} y={18} width={24} height={24} fill="#FFFFFF" rx={4} />
              <Rect x={144} y={24} width={12} height={12} fill="#000000" rx={2} />

              <Rect x={10} y={130} width={40} height={40} fill="#000000" rx={8} />
              <Rect x={18} y={138} width={24} height={24} fill="#FFFFFF" rx={4} />
              <Rect x={24} y={144} width={12} height={12} fill="#000000" rx={2} />

              {/* QR modules */}
              <Rect x={65} y={20} width={10} height={10} fill="#000000" />
              <Rect x={85} y={15} width={12} height={12} fill="#000000" />
              <Rect x={105} y={30} width={10} height={10} fill="#000000" />
              <Rect x={60} y={60} width={25} height={25} fill="#000000" rx={4} />
              <Rect x={100} y={70} width={20} height={10} fill="#000000" />
              <Rect x={135} y={65} width={15} height={20} fill="#000000" />
              <Rect x={70} y={100} width={30} height={10} fill="#000000" />
              <Rect x={110} y={105} width={15} height={15} fill="#000000" />
              <Rect x={65} y={135} width={20} height={20} fill="#000000" />
              <Rect x={100} y={140} width={25} height={12} fill="#000000" />
              <Rect x={135} y={130} width={30} height={30} fill="#000000" rx={4} />
            </Svg>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    marginBottom: 20,
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
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
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
