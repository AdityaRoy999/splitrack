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
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { CurrencyCode, ThemeMode } from '../../types';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
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
  const cardBg = isDark ? '#141418' : '#FFFFFF';
  const chipBg = isDark ? '#1C1C22' : '#EFEFF4';
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

  const currencyItems = [
    { value: 'INR', label: '₹ INR' },
    { value: 'USD', label: '$ USD' },
    { value: 'EUR', label: '€ EUR' },
    { value: 'GBP', label: '£ GBP' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.sheetContainer, { backgroundColor: bgSheet }]}>
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
            {/* Theme Selector using rounded JellyRadio */}
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
                    label="Smooth Surface Contrast"
                    checked={isLiquidGlassEnabled}
                    onChange={(checked) => setIsLiquidGlassEnabled(checked)}
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
              style={[styles.resetBtn, { backgroundColor: isDark ? '#1C1414' : '#FEE2E2' }]}
              activeOpacity={0.7}
            >
              <RefreshCircleIcon size={18} color="#EF4444" />
              <Text style={styles.resetBtnText}>Restore Default Sample Expenses</Text>
            </TouchableOpacity>
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
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 36,
    maxHeight: '88%',
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 16,
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
