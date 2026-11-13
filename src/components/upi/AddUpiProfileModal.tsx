import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BankBrand, PaymentProfileKind, UpiProvider } from '../../types';
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { GlassPill } from '../glass/GlassPill';
import { GradualBlur } from '../effects/GradualBlur';

interface AddUpiProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const PROVIDER_OPTIONS: { value: UpiProvider; label: string; accent: string; secondary: string }[] = [
  { value: 'gpay', label: 'Google Pay', accent: '#1A428A', secondary: '#0E2248' },
  { value: 'phonepe', label: 'PhonePe', accent: '#4D88FF', secondary: '#1E50BA' },
  { value: 'slice', label: 'Slice', accent: '#12141A', secondary: '#2A2E3D' },
  { value: 'paytm', label: 'Paytm', accent: '#0EA5E9', secondary: '#0369A1' },
  { value: 'bank', label: 'Bank UPI', accent: '#10B981', secondary: '#047857' },
];

const BANK_OPTIONS: { value: BankBrand; label: string; bankName: string; accent: string; secondary: string }[] = [
  { value: 'hdfc', label: 'HDFC Bank', bankName: 'HDFC Bank', accent: '#1D4ED8', secondary: '#C81E32' },
  { value: 'icici', label: 'ICICI Bank', bankName: 'ICICI Bank', accent: '#EA580C', secondary: '#9A3412' },
  { value: 'sbi', label: 'SBI', bankName: 'State Bank', accent: '#0284C7', secondary: '#1E3A8A' },
  { value: 'axis', label: 'Axis Bank', bankName: 'Axis Bank', accent: '#9D174D', secondary: '#701A75' },
  { value: 'kotak', label: 'Kotak', bankName: 'Kotak Bank', accent: '#DC2626', secondary: '#1E293B' },
  { value: 'amex', label: 'Amex', bankName: 'American Express', accent: '#334155', secondary: '#0284C7' },
];

const CARD_NETWORKS: ('VISA' | 'Mastercard' | 'RuPay')[] = ['VISA', 'Mastercard', 'RuPay'];

export const AddUpiProfileModal: React.FC<AddUpiProfileModalProps> = ({
  visible,
  onClose,
}) => {
  const { addUpiAccount, setSelectedAccountId } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [kind, setKind] = useState<PaymentProfileKind>('upi');
  const [label, setLabel] = useState('');
  const [upiId, setUpiId] = useState('');
  const [provider, setProvider] = useState<UpiProvider>('gpay');
  const [bankBrand, setBankBrand] = useState<BankBrand>('hdfc');
  const [last4, setLast4] = useState('');
  const [expiry, setExpiry] = useState('08/30');
  const [cardType, setCardType] = useState<'VISA' | 'Mastercard' | 'RuPay'>('VISA');
  const [makeActive, setMakeActive] = useState(true);

  const bgSheet = isDark ? '#09090B' : '#F4F4F8';
  const cardBg = isDark ? '#121216' : '#FFFFFF';
  const inputBg = isDark ? '#1B1B20' : '#F2F3F7';
  const chipBg = isDark ? '#1C1C22' : '#EFEFF4';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const resetForm = () => {
    setKind('upi');
    setLabel('');
    setUpiId('');
    setProvider('gpay');
    setBankBrand('hdfc');
    setLast4('');
    setExpiry('08/30');
    setCardType('VISA');
    setMakeActive(true);
  };

  const handleSave = () => {
    if (kind === 'upi') {
      const cleanUpi = upiId.trim();
      if (!cleanUpi || !cleanUpi.includes('@')) return;

      const providerMeta =
        PROVIDER_OPTIONS.find((p) => p.value === provider) || PROVIDER_OPTIONS[0];
      const cleanLabel = label.trim() || `${providerMeta.label} Splits`;

      const created = addUpiAccount({
        title: cleanLabel,
        kind: 'upi',
        provider,
        upiId: cleanUpi,
        cardHolder: 'Alex',
        cardNumber: '',
        expiry: '',
        cardType: 'RuPay',
        accentColor: providerMeta.accent,
        secondaryColor: providerMeta.secondary,
        balance: 0,
        isDefault: makeActive,
      });

      if (makeActive && created?.id) {
        setSelectedAccountId(created.id);
      }
    } else {
      const cleanLast4 = last4.replace(/\D/g, '').slice(-4);
      if (cleanLast4.length < 4) return;

      const bankMeta = BANK_OPTIONS.find((b) => b.value === bankBrand) || BANK_OPTIONS[0];
      const kindSuffix = kind === 'credit' ? 'Credit' : 'Debit';
      const cleanLabel = label.trim() || `${bankMeta.label} ${kindSuffix}`;

      const created = addUpiAccount({
        title: cleanLabel,
        kind,
        bankName: bankMeta.bankName,
        bankBrand,
        provider: 'bank',
        upiId: '',
        cardHolder: 'Alex',
        cardNumber: `•••• •••• •••• ${cleanLast4}`,
        expiry: expiry.trim() || '08/30',
        cardType,
        accentColor: bankMeta.accent,
        secondaryColor: bankMeta.secondary,
        balance: 0,
        isDefault: makeActive,
      });

      if (makeActive && created?.id) {
        setSelectedAccountId(created.id);
      }
    }

    triggerNotification(NotificationType.Success);
    resetForm();
    onClose();
  };

  const webOutlineNone =
    Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          outline: 'none',
          boxShadow: 'none',
        } as any)
      : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss modal backdrop"
        />
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: bgSheet },
          ]}
        >
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#27272A' : '#D4D4D8' }]} />
          </View>

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: textColor }]}>New UPI or Card Profile</Text>
              <Text style={[styles.subtitle, { color: mutedText }]}>
                Add a UPI handle, debit card, or credit card
              </Text>
            </View>
            <AnimatedPressable
              onPress={onClose}
              scaleTo={0.9}
              accessibilityLabel="Close new profile modal"
              contentStyle={[styles.closeBtn, { backgroundColor: cardBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <View style={styles.scrollAreaWrap}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.fieldLabel, { color: mutedText }]}>PROFILE TYPE</Text>
              <JellyRadio
                items={[
                  { value: 'upi', label: 'UPI ID' },
                  { value: 'debit', label: 'Debit Card' },
                  { value: 'credit', label: 'Credit Card' },
                ]}
                value={kind}
                onChange={(val) => setKind(val as PaymentProfileKind)}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="sm"
                gap={8}
                radius={999}
              />

              <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                {kind === 'upi' ? 'PROFILE LABEL' : 'CARD NAME / VARIANT'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, webOutlineNone]}
                placeholder={kind === 'upi' ? 'e.g. Roommates Split UPI' : 'e.g. Regalia Gold'}
                placeholderTextColor={mutedText}
                value={label}
                onChangeText={setLabel}
              />

              {kind === 'upi' ? (
                <>
                  <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                    UPI ID HANDLE
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, color: textColor }, webOutlineNone]}
                    placeholder="e.g. alex@okicici"
                    placeholderTextColor={mutedText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={upiId}
                    onChangeText={setUpiId}
                  />

                  <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                    UPI APP / PROVIDER
                  </Text>
                  <JellyRadio
                    scrollable
                    items={PROVIDER_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                    value={provider}
                    onChange={(val) => setProvider(val as UpiProvider)}
                    chipColor={chipBg}
                    activeColor={activeBg}
                    textColor={textColor}
                    activeTextColor={activeText}
                    size="sm"
                    gap={8}
                    radius={999}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                    BANK ISSUER
                  </Text>
                  <JellyRadio
                    scrollable
                    items={BANK_OPTIONS.map((b) => ({ value: b.value, label: b.label }))}
                    value={bankBrand}
                    onChange={(val) => setBankBrand(val as BankBrand)}
                    chipColor={chipBg}
                    activeColor={activeBg}
                    textColor={textColor}
                    activeTextColor={activeText}
                    size="sm"
                    gap={8}
                    radius={999}
                  />

                  <View style={styles.splitRow}>
                    <View style={styles.splitColLeft}>
                      <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                        LAST 4 DIGITS
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          { backgroundColor: inputBg, color: textColor },
                          webOutlineNone,
                        ]}
                        placeholder="4821"
                        placeholderTextColor={mutedText}
                        keyboardType="number-pad"
                        maxLength={4}
                        value={last4}
                        onChangeText={setLast4}
                      />
                    </View>

                    <View style={styles.splitColRight}>
                      <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                        VALID THRU
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          { backgroundColor: inputBg, color: textColor },
                          webOutlineNone,
                        ]}
                        placeholder="08/30"
                        placeholderTextColor={mutedText}
                        maxLength={5}
                        value={expiry}
                        onChangeText={setExpiry}
                      />
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                    CARD NETWORK
                  </Text>
                  <JellyRadio
                    items={CARD_NETWORKS.map((net) => ({ value: net, label: net }))}
                    value={cardType}
                    onChange={(val) => setCardType(val as 'VISA' | 'Mastercard' | 'RuPay')}
                    chipColor={chipBg}
                    activeColor={activeBg}
                    textColor={textColor}
                    activeTextColor={activeText}
                    size="sm"
                    gap={8}
                    radius={999}
                  />
                </>
              )}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <View style={[styles.checkRow, { backgroundColor: inputBg }]}>
                <SpringCheck
                  label="Make this the default profile"
                  checked={makeActive}
                  onChange={(checked) => setMakeActive(checked)}
                  color={textColor}
                  fillColor={activeBg}
                  checkColor={activeText}
                  boxSize={22}
                  boxRadius={999}
                  fontSize={14}
                  strike="none"
                  doneOpacity={1}
                />
              </View>
            </View>
            </ScrollView>
            <GradualBlur position="top" height={22} strength={1.3} layers={6} tint={bgSheet} />
            <GradualBlur position="bottom" height={26} strength={1.4} layers={6} tint={bgSheet} />
          </View>

          <GlassPill
            label={kind === 'upi' ? 'Save UPI Profile' : 'Save Card Profile'}
            variant="accent"
            size="lg"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </View>
      </View>
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
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxHeight: '88%',
    borderWidth: 0,
  },
  dragHandleWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  scrollAreaWrap: {
    position: 'relative',
    flexShrink: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 0,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 0,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  splitColLeft: {
    flex: 1,
  },
  splitColRight: {
    flex: 1,
  },
  checkRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 0,
  },
  saveBtn: {
    width: '100%',
    marginTop: 6,
  },
});

export default AddUpiProfileModal;
