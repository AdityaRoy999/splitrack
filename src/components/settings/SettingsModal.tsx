import React from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { MoonIcon } from '@solar-icons/react-native/bold/moon';
import { Sun2Icon } from '@solar-icons/react-native/bold/sun-2';
import { RefreshCircleIcon } from '@solar-icons/react-native/bold/refresh-circle';
import { LogOut, Sparkles, Square } from 'lucide-react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { CurrencyCode, ThemeMode } from '../../types';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onSignOut,
}) => {
  const {
    isLiquidGlassEnabled,
    setIsLiquidGlassEnabled,
    hideAmounts,
    toggleHideAmounts,
    themeMode,
    setThemeMode,
    currency,
    setCurrency,
  } = useLiquidGlass();

  const { resetDemoData } = useSplitTrack();

  const isDark = themeMode === 'dark';

  const bgSheet = isDark ? '#0C0C0E' : '#F4F4F8';
  const cardBg = isLiquidGlassEnabled
    ? isDark
      ? 'rgba(28, 28, 36, 0.55)'
      : 'rgba(255, 255, 255, 0.72)'
    : isDark
      ? '#141418'
      : '#FFFFFF';
  const chipBg = isLiquidGlassEnabled
    ? isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(15, 23, 42, 0.06)'
    : isDark
      ? '#1C1C22'
      : '#EFEFF4';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const themeItems = [
    {
      value: 'dark',
      label: 'Dark Mode',
      icon: (
        <MoonIcon
          size={15}
          color={themeMode === 'dark' ? activeText : mutedText}
        />
      ),
    },
    {
      value: 'light',
      label: 'Light Mode',
      icon: (
        <Sun2Icon
          size={15}
          color={themeMode === 'light' ? activeText : mutedText}
        />
      ),
    },
  ];

  const surfaceItems = [
    {
      value: 'glass',
      label: 'Liquid Glass',
      icon: (
        <Sparkles
          size={14}
          color={isLiquidGlassEnabled ? activeText : mutedText}
        />
      ),
    },
    {
      value: 'matte',
      label: 'Matte Surface',
      icon: (
        <Square
          size={14}
          color={!isLiquidGlassEnabled ? activeText : mutedText}
        />
      ),
    },
  ];

  const currencyItems = [
    { value: 'INR', label: '₹ INR' },
    { value: 'USD', label: '$ USD' },
    { value: 'EUR', label: '€ EUR' },
    { value: 'GBP', label: '£ GBP' },
  ];

  const isIOS = Platform.OS === 'ios';

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
            isIOS && {
              flex: 1,
              maxHeight: '100%',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              paddingTop: 22,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: textColor }]}>Settings & Display</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: cardBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Theme, Surface Style (Liquid Glass vs Matte), and Currency */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.sectionHeader, { color: mutedText }]}>THEME</Text>
              <JellyRadio
                items={themeItems}
                value={themeMode}
                onChange={(val) => setThemeMode(val as ThemeMode)}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="md"
                gap={8}
                radius={999}
              />

              <Text style={[styles.sectionHeader, { color: mutedText, marginTop: 16 }]}>
                SURFACE STYLE
              </Text>
              <JellyRadio
                items={surfaceItems}
                value={isLiquidGlassEnabled ? 'glass' : 'matte'}
                onChange={(val) => setIsLiquidGlassEnabled(val === 'glass')}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="md"
                gap={8}
                radius={999}
              />
              <Text style={[styles.surfaceCaption, { color: mutedText }]}>
                {isLiquidGlassEnabled
                  ? 'Translucent iOS Liquid Glass cards, floating dock & ambient refraction'
                  : 'Clean solid matte cards & opaque controls'}
              </Text>

              <Text style={[styles.sectionHeader, { color: mutedText, marginTop: 16 }]}>
                CURRENCY
              </Text>
              <JellyRadio
                scrollable
                items={currencyItems}
                value={currency}
                onChange={(val) => setCurrency(val as CurrencyCode)}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="md"
                gap={8}
                radius={999}
              />
            </View>

            {/* Preferences using React Bits SpringCheck */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.sectionHeader, { color: mutedText }]}>PREFERENCES</Text>
              <View style={styles.checkList}>
                <View style={[styles.checkRow, { backgroundColor: chipBg }]}>
                  <SpringCheck
                    label="Hide Balances & Amounts"
                    checked={hideAmounts}
                    onChange={() => toggleHideAmounts()}
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
            </View>

            {/* Reset Data Button */}
            <TouchableOpacity
              onPress={resetDemoData}
              style={[styles.resetBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEE2E2' }]}
              activeOpacity={0.7}
            >
              <RefreshCircleIcon size={18} color="#EF4444" />
              <Text style={styles.resetBtnText}>Restore Default Sample Expenses</Text>
            </TouchableOpacity>

            {onSignOut && (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onSignOut();
                }}
                style={[styles.resetBtn, { backgroundColor: chipBg }]}
                activeOpacity={0.7}
              >
                <LogOut size={16} color={textColor} />
                <Text style={[styles.resetBtnText, { color: textColor }]}>
                  Sign Out to Onboarding
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
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
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '90%',
    borderWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 0,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  surfaceCaption: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 8,
    lineHeight: 15,
  },
  checkList: {
    gap: 8,
  },
  checkRow: {
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 0,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 0,
  },
  resetBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
});
