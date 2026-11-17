import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { MagnifierIcon } from '@solar-icons/react-native/bold/magnifier';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BankBrand, PaymentProfileKind, UpiAccount, UpiProvider } from '../../types';
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { GlassPill } from '../glass/GlassPill';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { BankIssuerPickerModal } from './BankIssuerPickerModal';
import { UpiAppPickerModal } from './UpiAppPickerModal';
import { BankItem, BANKS_CATALOG } from '../../constants/banksCatalog';
import { UpiAppItem, UPI_APPS_CATALOG } from '../../constants/upiAppsCatalog';

interface AddUpiProfileModalProps {
  visible: boolean;
  onClose: () => void;
  editingAccount?: UpiAccount | null;
}

const QUICK_PROVIDERS: { value: UpiProvider; label: string }[] = [
  { value: 'gpay', label: 'Google Pay' },
  { value: 'phonepe', label: 'PhonePe' },
  { value: 'paytm', label: 'Paytm' },
  { value: 'slice', label: 'Slice' },
  { value: 'cred', label: 'CRED' },
  { value: 'bank', label: 'Bank UPI' },
];

const CARD_NETWORKS: ('VISA' | 'Mastercard' | 'RuPay')[] = ['VISA', 'Mastercard', 'RuPay'];

interface FormContentProps {
  editingAccount?: UpiAccount | null;
  onClose: () => void;
}

const ProfileFormContent: React.FC<FormContentProps> = ({ editingAccount, onClose }) => {
  const { addUpiAccount, updateUpiAccount, setSelectedAccountId } = useSplitTrack();
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [kind, setKind] = useState<PaymentProfileKind>(
    () => (editingAccount?.kind as PaymentProfileKind) || 'upi'
  );
  const [label, setLabel] = useState(() => editingAccount?.title || '');
  const [upiId, setUpiId] = useState(() => editingAccount?.upiId || '');
  const [provider, setProvider] = useState<UpiProvider>(
    () => (editingAccount?.provider as UpiProvider) || 'gpay'
  );
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiAppItem>(() => {
    if (editingAccount?.provider) {
      const match = UPI_APPS_CATALOG.find((a) => a.id === editingAccount.provider);
      if (match) return match;
    }
    return UPI_APPS_CATALOG[0];
  });
  const [bankBrand, setBankBrand] = useState<BankBrand>(
    () => (editingAccount?.bankBrand as BankBrand) || 'hdfc'
  );
  const [selectedBank, setSelectedBank] = useState<BankItem>(() => {
    if (editingAccount?.bankBrand) {
      const match = BANKS_CATALOG.find((b) => b.id === editingAccount.bankBrand);
      if (match) return match;
    }
    return BANKS_CATALOG[1];
  });
  const [last4, setLast4] = useState(() =>
    (editingAccount?.cardNumber || '').replace(/\D/g, '').slice(-4)
  );
  const [expiry, setExpiry] = useState(() => editingAccount?.expiry || '08/30');
  const [cardType, setCardType] = useState<'VISA' | 'Mastercard' | 'RuPay'>(
    () => (editingAccount?.cardType as any) || 'VISA'
  );
  const [makeActive, setMakeActive] = useState(() =>
    editingAccount ? Boolean(editingAccount.isDefault) : true
  );

  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);

  const isEditing = Boolean(editingAccount);

  const cardBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')
    : (isDark ? '#121216' : '#FFFFFF');
  const inputBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    : (isDark ? '#1B1B20' : '#F2F3F7');
  const chipBg = isLiquidGlassEnabled
    ? (isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)')
    : (isDark ? '#1C1C22' : '#EFEFF4');
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const handleSelectBank = (bank: BankItem) => {
    setSelectedBank(bank);
    setBankBrand(bank.id);
  };

  const handleSelectUpiApp = (app: UpiAppItem) => {
    setSelectedUpiApp(app);
    setProvider((app.id as UpiProvider) || 'bank');
    if (!upiId || upiId.includes('@')) {
      const prefix = upiId.includes('@') ? upiId.split('@')[0] : 'alex';
      setUpiId(`${prefix}${app.defaultHandle}`);
    }
  };

  const handleSave = () => {
    if (kind === 'upi') {
      const cleanUpi = upiId.trim();
      if (!cleanUpi || !cleanUpi.includes('@')) {
        triggerNotification(NotificationType.Error);
        return;
      }

      const cleanLabel = label.trim() || `${selectedUpiApp.name} Splits`;

      if (isEditing && editingAccount) {
        updateUpiAccount(editingAccount.id, {
          title: cleanLabel,
          kind: 'upi',
          provider: (provider as UpiProvider) || 'bank',
          upiId: cleanUpi,
          accentColor: selectedUpiApp.accentColor,
          secondaryColor: selectedUpiApp.secondaryColor,
          isDefault: makeActive,
        });
        if (makeActive) {
          setSelectedAccountId(editingAccount.id);
        }
      } else {
        const created = addUpiAccount({
          title: cleanLabel,
          kind: 'upi',
          provider: (provider as UpiProvider) || 'bank',
          upiId: cleanUpi,
          cardHolder: 'Alex',
          cardNumber: '',
          expiry: '',
          cardType: 'RuPay',
          accentColor: selectedUpiApp.accentColor,
          secondaryColor: selectedUpiApp.secondaryColor,
          balance: 0,
          isDefault: makeActive,
        });

        if (makeActive && created?.id) {
          setSelectedAccountId(created.id);
        }
      }
    } else {
      const cleanLast4 = last4.replace(/\D/g, '').slice(-4);
      if (cleanLast4.length < 4 && kind !== 'netbanking' && kind !== 'wallet') {
        triggerNotification(NotificationType.Error);
        return;
      }

      const kindSuffix =
        kind === 'credit'
          ? 'Credit'
          : kind === 'debit'
          ? 'Debit'
          : kind === 'wallet'
          ? 'Wallet'
          : kind === 'forex'
          ? 'Forex'
          : 'NetBanking';
      const cleanLabel = label.trim() || `${selectedBank.shortName} ${kindSuffix}`;

      if (isEditing && editingAccount) {
        updateUpiAccount(editingAccount.id, {
          title: cleanLabel,
          kind,
          bankName: selectedBank.name,
          bankBrand,
          cardNumber: cleanLast4 ? `•••• •••• •••• ${cleanLast4}` : editingAccount.cardNumber,
          expiry: expiry.trim() || '08/30',
          cardType,
          accentColor: selectedBank.accentColor,
          secondaryColor: selectedBank.secondaryColor,
          isDefault: makeActive,
        });
        if (makeActive) {
          setSelectedAccountId(editingAccount.id);
        }
      } else {
        const created = addUpiAccount({
          title: cleanLabel,
          kind,
          bankName: selectedBank.name,
          bankBrand,
          provider: 'bank',
          upiId: '',
          cardHolder: 'Alex',
          cardNumber: cleanLast4 ? `•••• •••• •••• ${cleanLast4}` : '•••• •••• •••• 1001',
          expiry: expiry.trim() || '08/30',
          cardType,
          accentColor: selectedBank.accentColor,
          secondaryColor: selectedBank.secondaryColor,
          balance: 0,
          isDefault: makeActive,
        });

        if (makeActive && created?.id) {
          setSelectedAccountId(created.id);
        }
      }
    }

    triggerNotification(NotificationType.Success);
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
    <>
      <GlassModalSheet style={styles.sheetContainer}>
        <View style={styles.dragHandleWrap}>
          <View style={[styles.dragHandle, { backgroundColor: isDark ? '#27272A' : '#D4D4D8' }]} />
        </View>

        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: textColor }]}>
              {isEditing ? 'Edit Profile & Account' : 'New UPI or Card Profile'}
            </Text>
            <Text style={[styles.subtitleText, { color: mutedText }]}>
              {isEditing
                ? 'Update your account credentials & details'
                : 'Add a UPI handle, card, wallet, or netbanking profile'}
            </Text>
          </View>
          <AnimatedPressable
            onPress={onClose}
            scaleTo={0.9}
            accessibilityLabel="Close profile modal"
            contentStyle={[styles.closeBtn, { backgroundColor: cardBg }]}
          >
            <CloseCircleIcon size={20} color={textColor} />
          </AnimatedPressable>
        </View>

        <View style={styles.scrollAreaWrap}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.fieldLabel, { color: mutedText }]}>PROFILE TYPE</Text>
              <JellyRadio
                scrollable
                blurWidth={0}
                items={[
                  { value: 'upi', label: 'UPI ID' },
                  { value: 'debit', label: 'Debit Card' },
                  { value: 'credit', label: 'Credit Card' },
                  { value: 'wallet', label: 'Prepaid Wallet' },
                  { value: 'forex', label: 'Forex Card' },
                  { value: 'netbanking', label: 'Net Banking' },
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
                {kind === 'upi' ? 'PROFILE LABEL' : 'CARD / ACCOUNT LABEL'}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: inputBg, color: textColor },
                  webOutlineNone,
                ]}
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
                    style={[
                      styles.textInput,
                      { backgroundColor: inputBg, color: textColor },
                      webOutlineNone,
                    ]}
                    placeholder="e.g. alex@slice or 9137657510@okaxis"
                    placeholderTextColor={mutedText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={upiId}
                    onChangeText={setUpiId}
                  />

                  {/* UPI App Picker Header with clean search icon button */}
                  <View style={styles.pickerSectionHeader}>
                    <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 0 }]}>
                      UPI APP / PROVIDER
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowAppPicker(true)}
                      style={[styles.searchIconButton, { backgroundColor: inputBg }]}
                      accessibilityLabel="Search all UPI apps"
                    >
                      <MagnifierIcon size={14} color={textColor} />
                    </TouchableOpacity>
                  </View>

                  {/* Quick Horizontal Options */}
                  <View style={{ marginTop: 4 }}>
                    <JellyRadio
                      scrollable
                      blurWidth={0}
                      items={QUICK_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
                      value={provider}
                      onChange={(val) => {
                        setProvider(val as UpiProvider);
                        const matched = UPI_APPS_CATALOG.find((a) => a.id === val);
                        if (matched) handleSelectUpiApp(matched);
                      }}
                      chipColor={chipBg}
                      activeColor={activeBg}
                      textColor={textColor}
                      activeTextColor={activeText}
                      size="sm"
                      gap={6}
                      radius={999}
                    />
                  </View>
                </>
              ) : (
                <>
                  {/* Bank Issuer Header with clean search icon button */}
                  <View style={styles.pickerSectionHeader}>
                    <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 0 }]}>
                      BANK ISSUER
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowBankPicker(true)}
                      style={[styles.searchIconButton, { backgroundColor: inputBg }]}
                      accessibilityLabel="Search all banks"
                    >
                      <MagnifierIcon size={14} color={textColor} />
                    </TouchableOpacity>
                  </View>

                  {/* Quick Popular Banks Chips */}
                  <View style={{ marginTop: 4 }}>
                    <JellyRadio
                      scrollable
                      blurWidth={0}
                      items={BANKS_CATALOG.slice(0, 6).map((b) => ({
                        value: b.id,
                        label: b.shortName,
                      }))}
                      value={selectedBank.id}
                      onChange={(val) => {
                        const match = BANKS_CATALOG.find((b) => b.id === val);
                        if (match) handleSelectBank(match);
                      }}
                      chipColor={chipBg}
                      activeColor={activeBg}
                      textColor={textColor}
                      activeTextColor={activeText}
                      size="sm"
                      gap={6}
                      radius={999}
                    />
                  </View>

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
                        value={expiry}
                        onChangeText={setExpiry}
                      />
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                    CARD NETWORK
                  </Text>
                  <JellyRadio
                    blurWidth={0}
                    items={CARD_NETWORKS.map((n) => ({ value: n, label: n }))}
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

            {/* Make Active Toggle */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <SpringCheck
                label="Make this the default profile"
                checked={makeActive}
                onChange={setMakeActive}
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

            <GlassPill
              label={
                isEditing
                  ? 'Save Changes'
                  : kind === 'upi'
                  ? 'Save UPI Profile'
                  : 'Save Card Profile'
              }
              variant="light"
              size="lg"
              onPress={handleSave}
              style={styles.saveBtn}
            />
          </ScrollView>
        </View>
      </GlassModalSheet>

      {/* Dedicated Bank Issuer Picker (Full Page with Authentic Logos) */}
      <BankIssuerPickerModal
        visible={showBankPicker}
        selectedBankId={selectedBank.id}
        onClose={() => setShowBankPicker(false)}
        onSelectBank={handleSelectBank}
      />

      {/* Dedicated UPI App Picker (Full Page with Authentic Logos) */}
      <UpiAppPickerModal
        visible={showAppPicker}
        selectedAppId={selectedUpiApp.id}
        onClose={() => setShowAppPicker(false)}
        onSelectApp={handleSelectUpiApp}
      />
    </>
  );
};

export const AddUpiProfileModal: React.FC<AddUpiProfileModalProps> = ({
  visible,
  onClose,
  editingAccount,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss modal backdrop"
        />
        {visible ? (
          <ProfileFormContent
            key={editingAccount ? editingAccount.id : 'new-profile-form'}
            editingAccount={editingAccount}
            onClose={onClose}
          />
        ) : null}
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
    maxHeight: '90%',
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
  subtitleText: {
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 0,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  pickerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  searchIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  saveBtn: {
    marginTop: 4,
  },
});
