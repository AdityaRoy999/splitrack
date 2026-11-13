import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as DocumentPicker from 'expo-document-picker';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
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
  parseJsonTransactions,
  parseSpreadsheetTransactions,
} from '../../utils/importTransactions';
import { NotificationType, triggerNotification } from '../../utils/haptics';

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

  const { resetDemoData, eraseAllData, accounts, selectedAccountId, importTransactions } = useSplitTrack();

  const handleEraseAllData = () => {
    const performErase = () => {
      eraseAllData();
      setImportResult(null);
      setImportStatusMsg({
        type: 'success',
        text: 'All transactions cleared. Fresh start ready with zeroed balances!',
      });
      triggerSmoothLayout(240);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (
        window.confirm(
          'Erase all transactions and reset balances to zero? Your cards, UPI profiles, and members will be preserved for a fresh start.'
        )
      ) {
        performErase();
      }
    } else {
      Alert.alert(
        'Erase All Data?',
        'This will erase all transactions and reset balances to zero so you can start fresh. Your cards and UPI profiles will remain intact.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Erase Everything',
            style: 'destructive',
            onPress: performErase,
          },
        ]
      );
    }
  };

  const [targetAccountId, setTargetAccountId] = useState<string>(
    selectedAccountId || accounts[0]?.id || 'acc-1'
  );
  const [importResult, setImportResult] = useState<ImportParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isDark = themeMode === 'dark';
  const currSym = currencies[currency]?.symbol || '₹';

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
          const buf = await fileObj.arrayBuffer();
          const result = parseSpreadsheetTransactions(buf, fileName, targetAccountId);
          setImportResult(result);
        }
      } else {
        const response = await fetch(asset.uri);
        if (isJson) {
          const text = await response.text();
          const result = parseJsonTransactions(text, fileName, targetAccountId);
          setImportResult(result);
        } else {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = (e) => {
            const arrayBuf = e.target?.result as ArrayBuffer;
            const result = parseSpreadsheetTransactions(arrayBuf, fileName, targetAccountId);
            setImportResult(result);
            setIsParsing(false);
          };
          reader.onerror = () => {
            setIsParsing(false);
            setImportStatusMsg({
              type: 'error',
              text: 'Could not read spreadsheet file binary data.',
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
        text: `File pick error: ${err?.message || 'Could not access file'}`,
      });
    }
  };

  const handleParsePastedJson = () => {
    if (!jsonInputText.trim()) {
      setImportStatusMsg({ type: 'error', text: 'Please enter JSON transaction data first.' });
      return;
    }
    triggerSmoothLayout(280);
    const result = parseJsonTransactions(jsonInputText, 'pasted_data.json', targetAccountId);
    if (!result.success) {
      setImportStatusMsg({ type: 'error', text: result.error || 'Invalid JSON format' });
    } else {
      setImportResult(result);
      setImportStatusMsg(null);
    }
  };

  const handleConfirmImport = () => {
    if (!importResult || importResult.transactions.length === 0) return;
    const finalTx = importResult.transactions.map((tx) => ({
      ...tx,
      upiAccountId: targetAccountId,
    }));
    const count = importTransactions(finalTx);
    triggerNotification(NotificationType.Success);
    triggerSmoothLayout(280);
    setImportResult(null);
    setJsonInputText('');
    setShowJsonPaste(false);
    setImportStatusMsg({
      type: 'success',
      text: `Successfully imported ${count} transactions from ${importResult.sourceApp}!`,
    });
    setTimeout(() => {
      setImportStatusMsg(null);
    }, 3800);
  };

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
        <SparklesIcon
          size={14}
          color={isLiquidGlassEnabled ? activeText : mutedText}
        />
      ),
    },
    {
      value: 'matte',
      label: 'Matte Surface',
      icon: (
        <BoxIcon
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

            {/* Import Transactions from Different Apps */}
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
                    {showJsonPaste ? 'Hide Paste' : 'Paste JSON'}
                  </Text>
                </AnimatedPressable>
              </View>

              {/* Paste JSON Smooth Collapsible */}
              <SmoothCollapsible expanded={showJsonPaste && !importResult}>
                <View style={styles.jsonPasteWrap}>
                  <TextInput
                    style={[
                      styles.jsonTextInput,
                      { backgroundColor: chipBg, color: textColor },
                      Platform.OS === 'web' && ({ outline: 'none' } as any),
                    ]}
                    multiline
                    numberOfLines={4}
                    placeholder="Paste transaction JSON array here e.g. [{ 'title': 'Dinner', 'amount': 450, 'date': '2026-11-10' }]"
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
                      Parse JSON Data
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

            {/* Erase All Data Button (Fresh Start) */}
            <TouchableOpacity
              onPress={handleEraseAllData}
              style={[
                styles.eraseBtn,
                { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEE2E2' },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Erase all transactions for a fresh start"
            >
              <TrashBinTrashIcon size={18} color="#EF4444" />
              <View style={styles.eraseBtnTextWrap}>
                <Text style={styles.eraseBtnTitle}>Erase All Data (Fresh Start)</Text>
                <Text style={[styles.eraseBtnSubtitle, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                  Clears all transactions & resets balances to zero (cards remain)
                </Text>
              </View>
            </TouchableOpacity>

            {/* Reset Data Button */}
            <TouchableOpacity
              onPress={resetDemoData}
              style={[styles.resetBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]}
              activeOpacity={0.7}
            >
              <RefreshCircleIcon size={16} color={mutedText} />
              <Text style={[styles.resetBtnText, { color: mutedText }]}>
                Restore Default Sample Expenses
              </Text>
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
                <Logout2Icon size={16} color={textColor} />
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
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '90%',
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
  eraseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 0,
  },
  eraseBtnTextWrap: {
    flex: 1,
  },
  eraseBtnTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  eraseBtnSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
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
