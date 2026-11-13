import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { MoonIcon } from '@solar-icons/react-native/bold/moon';
import { Sun2Icon } from '@solar-icons/react-native/bold/sun-2';
import { RefreshCircleIcon } from '@solar-icons/react-native/bold/refresh-circle';
import { Logout2Icon } from '@solar-icons/react-native/bold/logout-2';
import { SparklesIcon } from '@solar-icons/react-native/bold/sparkles';
import { BoxIcon } from '@solar-icons/react-native/bold/box';
import { DocumentAddIcon } from '@solar-icons/react-native/bold/document-add';
import { FileTextIcon } from '@solar-icons/react-native/bold/file-text';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { DangerCircleIcon } from '@solar-icons/react-native/bold/danger-circle';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { VerifiedCheckIcon } from '@solar-icons/react-native/bold/verified-check';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { SmoothCollapsible, triggerSmoothLayout } from '../common/SmoothCollapsible';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { CurrencyCode, ThemeMode } from '../../types';
import { currencies } from '../../theme/colors';
import {
  ImportParseResult,
  parseAnyTextTransactions,
  parseJsonTransactions,
  parseSpreadsheetTransactions,
} from '../../utils/importTransactions';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';

interface SettingsPageProps {
  onBack: () => void;
  onSignOut?: () => void;
  userName?: string;
  userHandle?: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  onSignOut,
  userName = 'Jfiqw Alex',
  userHandle = '@alex',
}) => {
  const insets = useSafeAreaInsets();
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

  const { resetDemoData, eraseAllData, accounts, selectedAccountId, importTransactions } = useSplitTrack();

  const [targetAccountId, setTargetAccountId] = useState<string>(
    selectedAccountId || accounts[0]?.id || 'acc-1'
  );
  const [importResult, setImportResult] = useState<ImportParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('splittrack_user_avatar_uri')
      .then((saved) => {
        if (saved) setAvatarUri(saved);
      })
      .catch(() => {});
  }, []);

  const isDark = themeMode === 'dark';
  const currSym = currencies[currency]?.symbol || '₹';

  const rootBg = isDark ? '#09090B' : '#F4F4F6';
  const cardBg = isDark ? '#141418' : '#FFFFFF';
  const chipBg = isDark ? '#1C1C22' : '#F4F4F6';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  const handlePickAvatar = async () => {
    try {
      triggerImpact(ImpactStyle.Light);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const pickedUri = res.assets[0].uri;
        setAvatarUri(pickedUri);
        await AsyncStorage.setItem('splittrack_user_avatar_uri', pickedUri);
        triggerNotification(NotificationType.Success);
      }
    } catch (err) {
      console.warn('Failed to pick profile photo', err);
    }
  };

  const performErase = () => {
    eraseAllData();
    setImportResult(null);
    setImportStatusMsg({
      type: 'success',
      text: 'All transactions cleared. Fresh start ready with zeroed balances!',
    });
    triggerNotification(NotificationType.Success);
    triggerSmoothLayout(240);
  };

  const handleEraseAllData = () => {
    setShowEraseConfirm(true);
  };

  const handlePickFile = async () => {
    try {
      setIsParsing(true);
      setImportStatusMsg(null);
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/json',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsParsing(false);
        return;
      }

      const asset = res.assets[0];
      const fileName = asset.name || 'imported_data';
      const isJson =
        fileName.toLowerCase().endsWith('.json') ||
        (asset.mimeType && asset.mimeType.includes('json'));

      triggerSmoothLayout(280);

      if (Platform.OS === 'web' && (asset as any).file) {
        const fileObj = (asset as any).file as File;
        if (isJson) {
          const text = await fileObj.text();
          const result = parseJsonTransactions(text, fileName, targetAccountId);
          setImportResult(result);
        } else {
          const buffer = await fileObj.arrayBuffer();
          const result = parseSpreadsheetTransactions(buffer, fileName, targetAccountId);
          setImportResult(result);
        }
      } else {
        const resp = await fetch(asset.uri);
        if (isJson) {
          const text = await resp.text();
          const result = parseJsonTransactions(text, fileName, targetAccountId);
          setImportResult(result);
        } else {
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const result = parseSpreadsheetTransactions(arrayBuffer, fileName, targetAccountId);
            setImportResult(result);
            setIsParsing(false);
          };
          reader.onerror = () => {
            setIsParsing(false);
            setImportStatusMsg({
              type: 'error',
              text: 'Failed to read spreadsheet file from device.',
            });
          };
          reader.readAsArrayBuffer(blob);
          return;
        }
      }
      setIsParsing(false);
    } catch (err: any) {
      setIsParsing(false);
      setImportStatusMsg({
        type: 'error',
        text: err.message || 'Error selecting or parsing document.',
      });
    }
  };

  const handleParsePastedJson = () => {
    if (!jsonInputText.trim()) return;
    triggerSmoothLayout(260);
    const result = parseAnyTextTransactions(jsonInputText, 'pasted_statement.csv', targetAccountId);
    setImportResult(result);
    if (!result.success) {
      setImportStatusMsg({
        type: 'error',
        text: result.error || 'Failed to parse statement data.',
      });
    }
  };

  const handleConfirmImport = () => {
    if (!importResult || !importResult.success || importResult.transactions.length === 0) {
      return;
    }
    const count = importTransactions(importResult.transactions);
    triggerNotification(NotificationType.Success);
    triggerSmoothLayout(260);
    setImportStatusMsg({
      type: 'success',
      text: `Successfully imported ${count} transactions from ${importResult.sourceApp}!`,
    });
    setImportResult(null);
    setJsonInputText('');
    setShowJsonPaste(false);
  };

  return (
    <View style={[styles.pageContainer, { backgroundColor: rootBg, paddingTop: Math.max(16, insets.top) }]}>
      {/* Header Bar with Back Button */}
      <View style={styles.headerRow}>
        <AnimatedPressable
          scaleTo={0.92}
          onPress={() => {
            triggerImpact(ImpactStyle.Light);
            onBack();
          }}
          accessibilityLabel="Back to previous screen"
          contentStyle={[styles.backBtn, { backgroundColor: cardBg }]}
        >
          <AltArrowLeftIcon size={18} color={textColor} />
          <Text style={[styles.backBtnText, { color: textColor }]}>Back</Text>
        </AnimatedPressable>

        <Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(128, insets.bottom + 88) },
        ]}
      >
        {/* User Profile Card Header */}
        <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickAvatar}
            style={styles.profileAvatarWrap}
            accessibilityLabel="Change profile photo"
          >
            <Image
              source={
                avatarUri
                  ? { uri: avatarUri }
                  : isDark
                  ? require('../../../assets/icon-dark.png')
                  : require('../../../assets/icon-light.png')
              }
              style={[styles.profileAvatar, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}
              resizeMode="cover"
            />
            {/* Cutout Verified Star Badge */}
            <View style={styles.verifiedBadgeWrap}>
              <VerifiedCheckIcon size={25} color={cardBg} style={styles.verifiedCutoutStar} />
              <View style={styles.verifiedWhiteCore} />
              <VerifiedCheckIcon size={20} color="#10B981" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.profileName, { color: textColor }]}>{userName}</Text>
          <Text style={[styles.profileHandle, { color: mutedText }]}>{userHandle}</Text>
        </View>

        {/* Joined Settings Card (Theme, Surface Style, Currency, Preferences) */}
        <View style={[styles.joinedCard, { backgroundColor: cardBg }]}>
          {/* Theme Settings */}
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>THEME</Text>
            <JellyRadio
              items={[
                {
                  value: 'dark',
                  label: 'Dark Mode',
                  icon: <MoonIcon size={14} color={themeMode === 'dark' ? activeText : textColor} />,
                },
                {
                  value: 'light',
                  label: 'Light Mode',
                  icon: <Sun2Icon size={14} color={themeMode === 'light' ? activeText : textColor} />,
                },
              ]}
              value={themeMode}
              onChange={(val) => setThemeMode(val as ThemeMode)}
              chipColor={chipBg}
              activeColor={activeBg}
              textColor={textColor}
              activeTextColor={activeText}
              size="sm"
              gap={10}
              radius={999}
            />
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Surface Style */}
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>SURFACE STYLE</Text>
            <JellyRadio
              items={[
                {
                  value: 'glass',
                  label: 'Liquid Glass',
                  icon: (
                    <SparklesIcon
                      size={14}
                      color={isLiquidGlassEnabled ? activeText : textColor}
                    />
                  ),
                },
                {
                  value: 'matte',
                  label: 'Matte Surface',
                  icon: (
                    <BoxIcon
                      size={14}
                      color={!isLiquidGlassEnabled ? activeText : textColor}
                    />
                  ),
                },
              ]}
              value={isLiquidGlassEnabled ? 'glass' : 'matte'}
              onChange={(val) => setIsLiquidGlassEnabled(val === 'glass')}
              chipColor={chipBg}
              activeColor={activeBg}
              textColor={textColor}
              activeTextColor={activeText}
              size="sm"
              gap={10}
              radius={999}
            />
            <Text style={[styles.surfaceCaption, { color: mutedText }]}>
              {isLiquidGlassEnabled
                ? 'Translucent glass refraction, specular sheen & dynamic lighting'
                : 'Clean solid matte cards & opaque controls'}
            </Text>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Currency Settings */}
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>CURRENCY</Text>
            <JellyRadio
              items={[
                { value: 'INR', label: '₹ INR' },
                { value: 'USD', label: '$ USD' },
                { value: 'EUR', label: '€ EUR' },
                { value: 'GBP', label: '£ GBP' },
              ]}
              value={currency}
              onChange={(val) => setCurrency(val as CurrencyCode)}
              chipColor={chipBg}
              activeColor={activeBg}
              textColor={textColor}
              activeTextColor={activeText}
              size="sm"
              gap={8}
              radius={999}
            />
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Preferences */}
          <View style={styles.joinedSection}>
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
        </View>

        {/* Import Transactions from Other Apps */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionHeader, { color: mutedText }]}>
            IMPORT FROM OTHER APPS
          </Text>
          <Text style={[styles.importDesc, { color: mutedText }]}>
            Import expenses from Splitwise, Tricount, Walnut, Fold, or any Excel (.xlsx/.xls), CSV, or JSON file.
          </Text>

          {/* Status Banner */}
          {importStatusMsg && (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor:
                    importStatusMsg.type === 'success'
                      ? 'rgba(16, 185, 129, 0.16)'
                      : 'rgba(239, 68, 68, 0.16)',
                },
              ]}
            >
              {importStatusMsg.type === 'success' ? (
                <CheckCircleIcon size={16} color="#10B981" />
              ) : (
                <DangerCircleIcon size={16} color="#EF4444" />
              )}
              <Text
                style={[
                  styles.statusBannerText,
                  { color: importStatusMsg.type === 'success' ? '#10B981' : '#EF4444' },
                ]}
              >
                {importStatusMsg.text}
              </Text>
            </View>
          )}

          {/* Action Buttons Row */}
          <View style={styles.importButtonsRow}>
            <AnimatedPressable
              scaleTo={0.96}
              onPress={handlePickFile}
              disabled={isParsing}
              contentStyle={[styles.importActionBtn, { backgroundColor: activeBg }]}
            >
              {isParsing ? (
                <ActivityIndicator size="small" color={activeText} />
              ) : (
                <>
                  <DocumentAddIcon size={16} color={activeText} />
                  <Text style={[styles.importActionBtnText, { color: activeText }]}>
                    Import File (.json / .xlsx)
                  </Text>
                </>
              )}
            </AnimatedPressable>

            <AnimatedPressable
              scaleTo={0.96}
              onPress={() => {
                triggerSmoothLayout(240);
                setShowJsonPaste((prev) => !prev);
              }}
              contentStyle={[styles.importSecondaryBtn, { backgroundColor: chipBg }]}
            >
              <FileTextIcon size={15} color={textColor} />
              <Text style={[styles.importSecondaryBtnText, { color: textColor }]}>
                {showJsonPaste ? 'Hide Paste' : 'Paste Data'}
              </Text>
            </AnimatedPressable>
          </View>

          {/* Paste Data Smooth Collapsible */}
          <SmoothCollapsible expanded={showJsonPaste && !importResult}>
            <View style={styles.jsonPasteWrap}>
              <TextInput
                style={[
                  styles.jsonTextInput,
                  { backgroundColor: chipBg, color: textColor },
                  Platform.OS === 'web' && ({ outline: 'none' } as any),
                ]}
                multiline
                numberOfLines={5}
                placeholder="Paste statement CSV or JSON here (e.g. Slice, Splitwise, or bank export)"
                placeholderTextColor={mutedText}
                value={jsonInputText}
                onChangeText={setJsonInputText}
              />
              <AnimatedPressable
                scaleTo={0.96}
                onPress={handleParsePastedJson}
                contentStyle={[styles.parseJsonBtn, { backgroundColor: activeBg }]}
              >
                <Text style={[styles.parseJsonBtnText, { color: activeText }]}>
                  Parse Statement / Data
                </Text>
              </AnimatedPressable>
            </View>
          </SmoothCollapsible>

          {/* Import Preview Smooth Collapsible */}
          <SmoothCollapsible expanded={Boolean(importResult && importResult.success)}>
            {importResult && importResult.success && (
              <View style={[styles.previewCard, { backgroundColor: chipBg }]}>
                <View style={styles.previewHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sourceTagRow}>
                      <View style={[styles.sourceBadge, { backgroundColor: activeBg }]}>
                        <Text style={[styles.sourceBadgeText, { color: activeText }]}>
                          {importResult.sourceApp}
                        </Text>
                      </View>
                      <Text style={[styles.previewCountText, { color: textColor }]}>
                        {importResult.transactions.length} entries detected
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.previewFileSub, { color: mutedText }]}>
                      File: {importResult.fileName}
                    </Text>
                  </View>
                </View>

                {/* Target Profile Selector */}
                <Text style={[styles.accountPickLabel, { color: mutedText }]}>
                  LINK TO UPI / CARD PROFILE:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.accountPickRow}
                >
                  {accounts.map((acc) => {
                    const isPicked = targetAccountId === acc.id;
                    return (
                      <AnimatedPressable
                        key={acc.id}
                        scaleTo={0.94}
                        onPress={() => setTargetAccountId(acc.id)}
                        contentStyle={[
                          styles.accountPickChip,
                          { backgroundColor: isPicked ? activeBg : cardBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.accountPickChipText,
                            { color: isPicked ? activeText : textColor },
                          ]}
                        >
                          {acc.title}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>

                {/* Preview Rows */}
                <View style={styles.previewEntriesList}>
                  {importResult.transactions.slice(0, 3).map((item, idx) => (
                    <View key={idx} style={[styles.previewEntryRow, { backgroundColor: cardBg }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[styles.previewEntryTitle, { color: textColor }]}>
                          {item.title}
                        </Text>
                        <Text style={[styles.previewEntryDate, { color: mutedText }]}>
                          {item.date} • {item.category}
                        </Text>
                      </View>
                      <Text style={[styles.previewEntryAmount, { color: textColor }]}>
                        {currSym}{Math.abs(item.amount).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  {importResult.transactions.length > 3 && (
                    <Text style={[styles.previewMoreNote, { color: mutedText }]}>
                      + {importResult.transactions.length - 3} more transactions...
                    </Text>
                  )}
                </View>

                {/* Confirmation Buttons */}
                <View style={styles.confirmActionRow}>
                  <AnimatedPressable
                    scaleTo={0.96}
                    onPress={handleConfirmImport}
                    contentStyle={[styles.confirmImportBtn, { backgroundColor: '#10B981' }]}
                  >
                    <CheckCircleIcon size={16} color="#FFFFFF" />
                    <Text style={styles.confirmImportBtnText}>
                      Confirm & Import ({importResult.transactions.length})
                    </Text>
                  </AnimatedPressable>

                  <AnimatedPressable
                    scaleTo={0.96}
                    onPress={() => {
                      triggerSmoothLayout(240);
                      setImportResult(null);
                    }}
                    contentStyle={[styles.cancelImportBtn, { backgroundColor: cardBg }]}
                  >
                    <Text style={[styles.cancelImportBtnText, { color: mutedText }]}>Cancel</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}
          </SmoothCollapsible>
        </View>

        {/* Data Management Section */}
        <View style={styles.dataActionsSection}>
          {/* Erase All Data Button */}
          <TouchableOpacity
            onPress={handleEraseAllData}
            style={[
              styles.eraseBtn,
              {
                backgroundColor: isDark ? '#140808' : '#FEE2E2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FCA5A5',
              },
            ]}
            activeOpacity={0.7}
            accessibilityLabel="Erase All Data"
          >
            <TrashBinTrashIcon size={16} color="#EF4444" />
            <Text style={styles.eraseBtnTitle}>Erase All Data</Text>
          </TouchableOpacity>

          {/* Reset Data Button */}
          <TouchableOpacity
            onPress={resetDemoData}
            style={[styles.resetBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E5E7EB' }]}
            activeOpacity={0.7}
          >
            <RefreshCircleIcon size={16} color={mutedText} />
            <Text style={[styles.resetBtnText, { color: mutedText }]}>
              Restore Default Sample Expenses
            </Text>
          </TouchableOpacity>

          {onSignOut && (
            <TouchableOpacity
              onPress={onSignOut}
              style={[styles.resetBtn, { backgroundColor: chipBg }]}
              activeOpacity={0.7}
            >
              <Logout2Icon size={16} color={textColor} />
              <Text style={[styles.resetBtnText, { color: textColor }]}>
                Sign Out to Onboarding
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Erase All Data Confirmation Dialog */}
      <Modal
        visible={showEraseConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEraseConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEraseConfirm(false)}
          />
          <View
            style={[
              styles.confirmDialogCard,
              {
                backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          >
            <View
              style={[
                styles.confirmIconWrap,
                { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' },
              ]}
            >
              <TrashBinTrashIcon size={24} color="#EF4444" />
            </View>
            <Text style={[styles.confirmDialogTitle, { color: textColor }]}>
              Erase All Data?
            </Text>
            <Text style={[styles.confirmDialogMessage, { color: mutedText }]}>
              This will clear all transactions and reset balances to zero for a clean start. Your cards, UPI profiles, and members will be preserved.
            </Text>

            <View style={styles.confirmDialogButtons}>
              <TouchableOpacity
                onPress={() => setShowEraseConfirm(false)}
                style={[styles.confirmCancelBtn, { backgroundColor: chipBg }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmCancelText, { color: textColor }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowEraseConfirm(false);
                  performErase();
                }}
                style={[styles.confirmEraseBtn, { backgroundColor: '#EF4444' }]}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmEraseText}>
                  Erase All Data
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SettingsPage;

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerRightPlaceholder: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileAvatarWrap: {
    position: 'relative',
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  verifiedBadgeWrap: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCutoutStar: {
    position: 'absolute',
  },
  verifiedWhiteCore: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  profileHandle: {
    fontSize: 13,
    fontWeight: '400',
  },
  joinedCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  joinedSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: 20,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 0,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
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
  },
  importDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  importButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  importActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  importSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  importSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  jsonPasteWrap: {
    marginTop: 10,
    gap: 8,
  },
  jsonTextInput: {
    borderRadius: 14,
    padding: 12,
    fontSize: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  parseJsonBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  parseJsonBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewCountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewFileSub: {
    fontSize: 11,
  },
  accountPickLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  accountPickRow: {
    gap: 6,
    paddingVertical: 2,
  },
  accountPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  accountPickChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  previewEntriesList: {
    gap: 6,
    marginTop: 4,
  },
  previewEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  previewEntryTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  previewEntryDate: {
    fontSize: 10,
    marginTop: 2,
  },
  previewEntryAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewMoreNote: {
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 2,
  },
  confirmActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  confirmImportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
  },
  confirmImportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelImportBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  cancelImportBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dataActionsSection: {
    gap: 10,
    marginTop: 6,
  },
  eraseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  eraseBtnTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 999,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmDialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  confirmDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  confirmDialogMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  confirmDialogButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmEraseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmEraseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
