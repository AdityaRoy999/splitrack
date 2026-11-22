import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
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
import { pickedImageUri } from '../../utils/pickedImage';
import { File as ExpoFile } from 'expo-file-system';
import { useAuth } from '../../auth/AuthContext';
import { authenticationError } from '../../auth/authErrors';
import { api } from '../../services/api';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
import { SheetModal } from '../common/SheetModal';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { SheetHeader } from '../common/SheetHeader';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';
import { BottomBubble, type BubbleNotice } from '../common/BottomBubble';
import { useSettingsAvatarTransition } from '../common/SettingsAvatarTransition';
import type { ViewRefNode } from '../../utils/measureWindow';
import { GlassPill } from '../glass/GlassPill';
import { AddUpiProfileModal } from '../upi/AddUpiProfileModal';
import { ACTION_COLORS } from '../../theme/actionColors';
import { AltArrowLeftIcon } from '@solar-icons/react-native/bold/alt-arrow-left';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { CardSendIcon } from '@solar-icons/react-native/bold/card-send';
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react-native/bold/users-group-two-rounded';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { PieChart2Icon } from '@solar-icons/react-native/bold/pie-chart-2';
import { MoonIcon } from '@solar-icons/react-native/bold/moon';
import { Sun2Icon } from '@solar-icons/react-native/bold/sun-2';
import { Logout2Icon } from '@solar-icons/react-native/bold/logout-2';
import { SparklesIcon } from '@solar-icons/react-native/bold/sparkles';
import { BoxIcon } from '@solar-icons/react-native/bold/box';
import { DocumentAddIcon } from '@solar-icons/react-native/bold/document-add';
import { FileTextIcon } from '@solar-icons/react-native/bold/file-text';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { DangerCircleIcon } from '@solar-icons/react-native/bold/danger-circle';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { UserAvatar } from '../common/UserAvatar';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { SmoothCollapsible, triggerSmoothLayout } from '../common/SmoothCollapsible';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { CurrencyCode, ThemeMode, type SelectionStyle, type NotificationDirection } from '../../types';
import { useTransactionActions } from '../transactions/TransactionActions';
import { currencies } from '../../theme/colors';
import {
  ImportParseResult,
  parseAnyTextTransactions,
  parseJsonTransactions,
  parseSpreadsheetTransactions,
  parseGooglePayPdfTransactions,
} from '../../utils/importTransactions';
import { ImpactStyle, NotificationType, triggerImpact, triggerNotification } from '../../utils/haptics';

interface SettingsPageProps {
  onBack: () => void;
  onSignOut?: () => void;
  userName?: string;
  userHandle?: string;
  onNavigateTab?: (tab: 'home' | 'expenses' | 'trips' | 'analytics') => void;
  onOpenAddExpense?: () => void;
  onOpenAddTrip?: () => void;
  onOpenAddMember?: () => void;
  onManageCards?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  onSignOut,
  userName = '',
  userHandle = '',
  onNavigateTab,
  onOpenAddExpense,
  onOpenAddTrip,
  onOpenAddMember,
  onManageCards,
}) => {
  const insets = useSafeAreaInsets();
  const avatarTarget = useRef<ViewRefNode>(null);
  const avatarTransition = useSettingsAvatarTransition();
  const reportAvatar = avatarTransition?.destination;
  const measureAvatar = useCallback(() => reportAvatar?.(avatarTarget.current), [reportAvatar]);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measureAvatar);
    return () => cancelAnimationFrame(frame);
  }, [measureAvatar]);
  const {
    isLiquidGlassEnabled,
    setIsLiquidGlassEnabled,
    hideAmounts,
    toggleHideAmounts,
    themeMode,
    setThemeMode,
    currency,
    formatAmount,
    setCurrency,
    selectionStyle,
    setSelectionStyle,
    notificationDirection,
    setNotificationDirection,
    transactionActionStyle,
    setTransactionActionStyle,
  } = useLiquidGlass();
  const transactionActions = useTransactionActions();

  const {
    eraseAllData,
    accounts,
    selectedAccountId,
    importTransactions,
    trips,
    friends,
    syncing, syncError, isOffline, queuedTransactionCount, pendingFailure, refresh, reviewQueuedTransactions,
  } = useSplitTrack();
  const { user, profile, completeProfile, googleLinked, linkGoogle, cancelGoogleLink } = useAuth();
  const { run: runGoogle, pending: googlePending, error: googleError, setError: setGoogleError } = useAsyncAction();
  const [showGoogleLink, setShowGoogleLink] = useState(false);
  const [googlePassword, setGooglePassword] = useState('');
  const [googleNeedsPassword, setGoogleNeedsPassword] = useState(false);
  const [googleNotice, setGoogleNotice] = useState('');
  const [profileNotice, setProfileNotice] = useState<BubbleNotice | null>(null);
  const { run, pending, error } = useAsyncAction();
  const { run: runImport, pending: importPending, error: importError, setError: setImportError } = useAsyncAction();
  const [showImportProfile, setShowImportProfile] = useState(false);

  const [chosenAccountId, setTargetAccountId] = useState<string>(
    selectedAccountId || accounts[0]?.id || ''
  );
  const targetAccountId = accounts.some(account => account.id === chosenAccountId) ? chosenAccountId
    : accounts.some(account => account.id === selectedAccountId) ? selectedAccountId : accounts[0]?.id || '';
  const [importResult, setImportResult] = useState<ImportParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');
  const avatarUri = profile?.avatar ?? null;
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isDark = themeMode === 'dark';
  const currSym = currencies[currency]?.symbol || '₹';

  const rootBg = isDark ? '#09090B' : '#F4F4F6';
  const cardBg = isDark ? '#111114' : '#FFFFFF';
  const chipBg = isDark ? '#1C1C22' : '#F4F4F6';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  const openGoogleLink = () => {
    if (googleLinked || googlePending || pending) return;
    setGoogleError(''); setGooglePassword(''); setGoogleNeedsPassword(false); setGoogleNotice(''); setShowGoogleLink(true);
  };
  const closeGoogleLink = () => {
    if (googlePending) return;
    cancelGoogleLink(); setShowGoogleLink(false); setGooglePassword(''); setGoogleNeedsPassword(false); setGoogleError('');
  };
  const performGoogleLink = () => {
    if (googleNeedsPassword && !googlePassword) { setGoogleError('Enter your current password.'); return; }
    void runGoogle(async () => {
      try {
        if (await linkGoogle(googleNeedsPassword ? googlePassword : undefined)) {
          setShowGoogleLink(false); setGooglePassword('');
          setGoogleNotice('Google is synced. Continue with Google now opens this account and its saved records.');
          setProfileNotice({ id: Date.now(), message: 'Google sign-in connected' });
          triggerNotification(NotificationType.Success);
        }
      } catch (failure) {
        if ((failure as { code?: string })?.code === 'auth/requires-recent-login') {
          setGoogleNeedsPassword(true); setGoogleError('Confirm your current password to sync Google.');
        } else throw new Error(authenticationError(failure));
      }
    });
  };

  const handlePickAvatar = async () => {
    void run(async () => {
      triggerImpact(ImpactStyle.Light);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const pickedUri = await pickedImageUri(asset);
        if (profile) await completeProfile({ displayName: profile.displayName, username: profile.username, avatar: pickedUri });
        triggerNotification(NotificationType.Success);
        setProfileNotice({ id: Date.now(), message: 'Profile photo updated' });
      }
    });
  };

  const performErase = () => {
    void run(async () => {
    const cleared = await eraseAllData();
    setImportResult(null);
    setImportStatusMsg({
      type: 'success',
      text: `${cleared.removedTransactions} settled ${cleared.removedTransactions === 1 ? 'entry' : 'entries'} cleared. ${cleared.retainedTransactions} ${cleared.retainedTransactions === 1 ? 'entry' : 'entries'} tied to unpaid balances kept. Your debts and members are unchanged.`,
    });
    triggerNotification(NotificationType.Success);
    triggerSmoothLayout(240);
    setShowEraseConfirm(false);
    });
  };

  const handleEraseAllData = () => {
    setShowEraseConfirm(true);
  };

  const applyImportResult = (result: ImportParseResult) => {
    setImportResult(result);
    if (!result.success) {
      const problems = result.report?.issues.slice(0, 3).map(problem => `${problem.location}: ${problem.reason}`).join(' ') ?? '';
      const skipped = result.report?.skipped ? `${result.report.skipped} entries skipped. ` : '';
      setImportStatusMsg({ type: 'error', text: `${result.error || 'No valid transaction entries found.'} ${skipped}${problems}`.trim() });
    }
  };

  const handlePickFile = async () => {
    if (isParsing || pending || importPending) return;
    try {
      setIsParsing(true);
      setImportResult(null);
      setImportStatusMsg(null);
      setImportError('');
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const fileName = asset.name || 'statement';
      const isPdf = /\.pdf$/i.test(fileName) || asset.mimeType === 'application/pdf';
      const isJson = /\.json$/i.test(fileName) || Boolean(asset.mimeType?.includes('json'));
      const webFile = Platform.OS === 'web' ? asset.file : undefined;
      const nativeFile = webFile ? null : new ExpoFile(asset.uri);
      const size = asset.size ?? webFile?.size ?? nativeFile?.size ?? 0;
      if (size > (isPdf ? 3 : 10) * 1024 * 1024) throw new Error(isPdf ? 'PDF imports must be 3 MB or smaller. Export a shorter date range.' : 'Statement imports must be 10 MB or smaller. Export a shorter date range.');
      // Yield once so the parsing indicator paints before XLSX decoding begins.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      let result: ImportParseResult;
      if (isPdf) {
        const base64 = webFile ? await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = () => reject(new Error('Could not read this PDF. Choose the original statement again.'));
          reader.readAsDataURL(webFile);
        }) : await nativeFile!.base64();
        const extracted = await api<{ pages: string[] }>('/api/import/statement/pdf', { method: 'POST', body: { base64 }, attempts: 1, timeoutMs: 30000 });
        result = parseGooglePayPdfTransactions(extracted.pages, fileName, targetAccountId);
      } else if (isJson) {
        result = parseJsonTransactions(await (webFile ? webFile.text() : nativeFile!.text()), fileName, targetAccountId);
      } else {
        result = parseSpreadsheetTransactions(await (webFile ? webFile.arrayBuffer() : nativeFile!.arrayBuffer()), fileName, targetAccountId);
      }
      triggerSmoothLayout(280);
      applyImportResult(result);
    } catch (err) {
      setImportStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error selecting or parsing document.' });
    } finally { setIsParsing(false); }
  };

  const handleParsePastedJson = () => {
    if (importPending || !jsonInputText.trim()) return;
    triggerSmoothLayout(260);
    const result = parseAnyTextTransactions(jsonInputText, 'pasted_statement.csv', targetAccountId);
    setImportStatusMsg(null);
    setImportError('');
    applyImportResult(result);
  };

  const handleConfirmImport = () => {
    if (pending || importPending || !importResult || !importResult.success || importResult.transactions.length === 0) {
      return;
    }
    if (!targetAccountId) {
      setImportError('Add a UPI/card profile, then confirm this import. Your preview will stay here.');
      setShowImportProfile(true);
      return;
    }
    setImportStatusMsg(null);
    void runImport(async () => {
      // Paint the saving state before validating a large statement batch.
      await new Promise<void>(resolve => setTimeout(resolve, 16));
      const count = await importTransactions(importResult.transactions.map(tx => ({ ...tx, upiAccountId: targetAccountId })));
      triggerNotification(NotificationType.Success);
      triggerSmoothLayout(260);
      setImportStatusMsg({
        type: 'success',
        text: `${count} transactions saved on this device. They will sync automatically.`,
      });
      setImportResult(null);
      setJsonInputText('');
      setShowJsonPaste(false);
    });
  };

  return (
    <View style={[styles.pageContainer, { backgroundColor: rootBg }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(16, insets.top + 10),
            paddingBottom: Math.max(128, insets.bottom + 88),
          },
        ]}
      >
        {/* Natural Scrolling Header Bar (not stuck) */}
        <View style={styles.headerRow}>
          <AnimatedPressable
            scaleTo={0.92}
            onPress={() => {
              triggerImpact(ImpactStyle.Light);
              if (avatarTransition) avatarTransition.close(avatarTarget.current, onBack);
              else onBack();
            }}
            accessibilityLabel="Back to previous screen"
            contentStyle={[styles.backBtn, { backgroundColor: cardBg }]}
          >
            <AltArrowLeftIcon size={18} color={textColor} />
            <Text style={[styles.backBtnText, { color: textColor }]}>Back</Text>
          </AnimatedPressable>

          <View pointerEvents="none" style={styles.headerTitlePosition}><Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text></View>
        </View>

        {/* User Profile Card Header */}
        <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickAvatar}
            style={styles.profileAvatarWrap}
            accessibilityLabel="Change profile photo"
          >
            <View ref={avatarTarget} collapsable={false} onLayout={measureAvatar} style={{ width: 92, height: 92, opacity: avatarTransition?.moving ? 0 : 1 }}><UserAvatar
              avatarUri={avatarUri}
              name={userName}
              size={92}
              borderRadius={28}
              isDark={isDark}
            /></View>
          </TouchableOpacity>

          <Text style={[styles.profileName, { color: textColor }]}>{userName}</Text>
          <Text style={[styles.profileHandle, { color: mutedText }]}>{userHandle}</Text>
        </View>

        <View style={[styles.joinedCard, { backgroundColor: cardBg }]}>
          <View style={styles.joinedSection}><Text style={[styles.sectionHeader, { color: mutedText }]}>ACCOUNT SIGN-IN</Text></View>
          <TouchableOpacity activeOpacity={0.7} style={styles.navRowItem} onPress={openGoogleLink}
            disabled={googleLinked || googlePending || pending} accessibilityRole="button" accessibilityLabel={googleLinked ? 'Google account synced' : 'Sync with Google'}>
            <View style={[styles.navIconBox, { backgroundColor: chipBg }]}>
              <Image source={require('../../../assets/auth/google-g.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navRowTitle, { color: textColor }]}>{googleLinked ? 'Google synced' : 'Sync with Google'}</Text>
              <Text style={[styles.navRowSubtitle, { color: mutedText }]}>{googleLinked ? 'Continue with Google opens this account' : 'Use Google to sign in to your existing account'}</Text>
            </View>
            {googleLinked ? <CheckCircleIcon size={18} color="#10B981" /> : <AltArrowRightIcon size={14} color={mutedText} />}
          </TouchableOpacity>
          {googleNotice ? <Text accessibilityLiveRegion="polite" style={[styles.surfaceCaption, { color: '#10B981', paddingHorizontal: 20, paddingBottom: 16 }]}>{googleNotice}</Text> : null}
        </View>

        {/* Quick Management & Navigation Stack Card */}
        <View style={[styles.joinedCard, { backgroundColor: cardBg }]}>
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>SYNC STATUS</Text>
            <Text style={[styles.surfaceCaption, { color: mutedText }]}>{pendingFailure ? 'A saved entry needs review. Your other entries can still sync.' : isOffline ? 'Offline. Saved entries will sync when you reconnect.' : syncing ? 'Syncing saved entries…' : queuedTransactionCount ? `${queuedTransactionCount} entries waiting to sync` : syncError ? 'Sync paused. Your saved entries are retained.' : 'Your ledger is up to date'}</Text>
            {syncError ? <Text style={[styles.surfaceCaption, { color: mutedText }]}>{syncError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {pendingFailure ? <GlassPill label="Review saved entry" variant="dark" disabled={pending} onPress={reviewQueuedTransactions} /> : null}
              <GlassPill label={syncing ? 'Syncing…' : 'Sync now'} variant="dark" disabled={syncing || pending} onPress={() => { void run(refresh); }} />
            </View>
          </View>
        </View>
        <View style={[styles.joinedCard, { backgroundColor: cardBg }]}>
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>QUICK NAVIGATION</Text>
          </View>

          {/* Row 1: Manage Cards & UPI Profiles */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerImpact(ImpactStyle.Light);
              if (onManageCards) onManageCards();
              else if (onNavigateTab) onNavigateTab('expenses');
            }}
            style={styles.navRowItem}
          >
            <View style={[styles.navIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)' }]}>
              <CardSendIcon size={18} color="#10B981" />
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navRowTitle, { color: textColor }]}>Manage Cards &amp; UPI Profiles</Text>
              <Text style={[styles.navRowSubtitle, { color: mutedText }]}>
                {accounts.length} active cards &amp; UPI accounts
              </Text>
            </View>
            <AltArrowRightIcon size={14} color={mutedText} />
          </TouchableOpacity>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Row 2: Trips & Shared Groups */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerImpact(ImpactStyle.Light);
              if (onNavigateTab) onNavigateTab('trips');
            }}
            style={styles.navRowItem}
          >
            <View style={[styles.navIconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
              <UsersGroupTwoRoundedIcon size={18} color="#3B82F6" />
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navRowTitle, { color: textColor }]}>Trips &amp; Shared Groups</Text>
              <Text style={[styles.navRowSubtitle, { color: mutedText }]}>
                {trips.length} active trips &amp; group ledgers
              </Text>
            </View>
            <AltArrowRightIcon size={14} color={mutedText} />
          </TouchableOpacity>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Row 3: People & Members */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerImpact(ImpactStyle.Light);
              if (onOpenAddMember) onOpenAddMember();
              else if (onNavigateTab) onNavigateTab('trips');
            }}
            style={styles.navRowItem}
          >
            <View style={[styles.navIconBox, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.1)' }]}>
              <UsersGroupTwoRoundedIcon size={18} color="#A855F7" />
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navRowTitle, { color: textColor }]}>People &amp; Members</Text>
              <Text style={[styles.navRowSubtitle, { color: mutedText }]}>
                {friends.length} split members &amp; friends
              </Text>
            </View>
            <AltArrowRightIcon size={14} color={mutedText} />
          </TouchableOpacity>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Row 4: Split & Record Expense */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerImpact(ImpactStyle.Light);
              if (onOpenAddExpense) onOpenAddExpense();
              else if (onNavigateTab) onNavigateTab('expenses');
            }}
            style={styles.navRowItem}
          >
            <View style={[styles.navIconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)' }]}>
              <AddCircleIcon size={18} color="#F59E0B" />
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navRowTitle, { color: textColor }]}>Split &amp; Record Expense</Text>
              <Text style={[styles.navRowSubtitle, { color: mutedText }]}>
                Record a shared bill or log payment
              </Text>
            </View>
            <AltArrowRightIcon size={14} color={mutedText} />
          </TouchableOpacity>

          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Row 5: Expense Ledger & Analytics */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerImpact(ImpactStyle.Light);
              if (onNavigateTab) onNavigateTab('analytics');
            }}
            style={styles.navRowItem}
          >
            <View style={[styles.navIconBox, { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.1)' }]}>
              <PieChart2Icon size={18} color="#06B6D4" />
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navRowTitle, { color: textColor }]}>Expense Ledger &amp; Analytics</Text>
              <Text style={[styles.navRowSubtitle, { color: mutedText }]}>
                Spending breakdown, charts &amp; categories
              </Text>
            </View>
            <AltArrowRightIcon size={14} color={mutedText} />
          </TouchableOpacity>
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

          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>SELECTION MENUS</Text>
            <JellyRadio
              presentation="chips"
              items={[{ value: 'chips', label: 'Slide & Select' }, { value: 'dropdown', label: 'Dropdown' }]}
              value={selectionStyle} onChange={value => setSelectionStyle(value as SelectionStyle)}
              chipColor={chipBg} activeColor={activeBg} textColor={textColor} activeTextColor={activeText}
              size="sm" gap={10}
            />
            <Text style={[styles.surfaceCaption, { color: mutedText }]}>Use this selection style throughout the app.</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>IN-APP NOTIFICATIONS</Text>
            <JellyRadio
              presentation="chips"
              items={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }]}
              value={notificationDirection} onChange={value => setNotificationDirection(value as NotificationDirection)}
              chipColor={chipBg} activeColor={activeBg} textColor={textColor} activeTextColor={activeText}
              size="sm" gap={10}
            />
            <Text style={[styles.surfaceCaption, { color: mutedText }]}>Choose where notification bubbles appear.</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />

          {/* Currency Settings */}
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>EDIT & DELETE ACTIONS</Text>
            <JellyRadio presentation="chips" items={[{ value: 'swipe', label: 'Swipe & Select' }, { value: 'buttons', label: 'Show Buttons' }]}
              value={transactionActionStyle} onChange={value => setTransactionActionStyle(value as 'swipe' | 'buttons')}
              chipColor={chipBg} activeColor={activeBg} textColor={textColor} activeTextColor={activeText} size="sm" gap={10} />
            <Text style={[styles.surfaceCaption, { color: mutedText }]}>Use swipes or buttons for editable and removable items throughout the app.</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />
          <View style={styles.joinedSection}>
            <Text style={[styles.sectionHeader, { color: mutedText }]}>CURRENCY</Text>
            <JellyRadio
              items={[
                { value: 'INR', label: '₹ INR' },
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
            Import Paytm or Slice XLSX, CSV/JSON transaction exports, or an original Google Pay text PDF. Review the totals before saving.
          </Text>

          <Text style={[styles.importDesc, { color: mutedText, marginTop: 6 }]}>PDFs are sent securely to your existing SplitTrack backend only for text extraction. Scanned/encrypted PDFs and other PDF layouts are not supported. Spreadsheet parsing stays on this device.</Text>

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
              disabled={isParsing || pending || importPending}
              contentStyle={[styles.importActionBtn, { backgroundColor: cardBg }]}
            >
              {isParsing ? (
                <ActivityIndicator size="small" color={textColor} />
              ) : (
                <>
                  <DocumentAddIcon size={16} color={textColor} />
                  <Text style={[styles.importActionBtnText, { color: textColor }]}>
                    Import Statement
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
              disabled={importPending}
              contentStyle={[styles.importSecondaryBtn, { backgroundColor: cardBg }]}
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
                placeholder="Paste CSV with Date, Description and Amount/Type columns, or JSON transactions with date, title, amount and type."
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

                {importResult.report ? <View style={{ gap: 6, marginBottom: 10 }}>
                  <Text style={{ color: textColor, fontSize: 12 }}>Paid: {formatAmount(importResult.report.expenseTotal)} · Received: {formatAmount(importResult.report.incomeTotal)}</Text>
                  <Text style={{ color: mutedText, fontSize: 12 }}>{importResult.report.imported} valid · {importResult.report.skipped} skipped · {importResult.report.ignored} header/summary rows ignored</Text>
                  {importResult.report.warnings.map((warning, index) => <Text key={`warning-${index}`} style={{ color: mutedText, fontSize: 12 }}>{warning}</Text>)}
                  {importResult.report.issues.map((problem, index) => <Text key={`issue-${index}`} style={{ color: '#E5898F', fontSize: 12 }}>{problem.location}: {problem.reason}</Text>)}
                </View> : null}

                {/* Target Profile Selector */}
                <Text style={[styles.accountPickLabel, { color: mutedText }]}>
                  LINK TO UPI / CARD PROFILE:
                </Text>
                {accounts.length ? <JellyRadio scrollable fadeColor={cardBg} items={accounts.map(account => ({ value: account.id, label: account.title }))} value={targetAccountId} onChange={id => { setTargetAccountId(id); setImportError(''); }} disabled={importPending} chipColor={chipBg} activeColor={activeBg} textColor={textColor} activeTextColor={activeText} size="sm" />
                  : <View style={styles.importProfileEmpty}>
                    <Text style={{ color: mutedText, fontSize: 12, lineHeight: 18 }}>Add a UPI/card profile to link these transactions before saving.</Text>
                    <GlassPill label="Add payment profile" onPress={() => setShowImportProfile(true)} />
                  </View>}

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
                        {item.type === 'income' ? '+' : '−'}{currSym}{Math.abs(item.amount).toFixed(2)}
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
                <FormError message={importError} />
                <View style={styles.confirmActionRow}>
                  <AnimatedPressable
                    scaleTo={0.96}
                    onPress={handleConfirmImport}
                    disabled={pending || importPending}
                    accessibilityLabel={`Confirm and import ${importResult.transactions.length} transactions`}
                    accessibilityState={{ busy: importPending }}
                    style={styles.confirmImportWrap}
                    contentStyle={[styles.confirmImportBtn, { backgroundColor: ACTION_COLORS.success }]}
                  >
                    {importPending ? <ActivityIndicator size="small" color={ACTION_COLORS.onAction} /> : <CheckCircleIcon size={16} color={ACTION_COLORS.onAction} />}
                    <Text style={styles.confirmImportBtnText}>
                      {importPending ? 'Saving on this device…' : `Confirm & Import (${importResult.transactions.length})`}
                    </Text>
                  </AnimatedPressable>

                  <AnimatedPressable
                    scaleTo={0.96}
                    onPress={() => {
                      triggerSmoothLayout(240);
                      setImportResult(null);
                      setImportError('');
                    }}
                    disabled={importPending}
                    contentStyle={[styles.cancelImportBtn, { backgroundColor: cardBg }]}
                  >
                    <Text style={[styles.cancelImportBtnText, { color: mutedText }]}>Cancel</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}
          </SmoothCollapsible>
        </View>

        <FormError message={error} />
        {/* Data Management Section */}
        <View style={styles.dataActionsSection}>
          <TouchableOpacity
            onPress={transactionActions.openDeleted}
            style={[styles.resetBtn, { backgroundColor: cardBg }]}
            activeOpacity={0.7} accessibilityRole="button"
          >
            <TrashBinTrashIcon size={16} color={textColor} />
            <Text style={[styles.resetBtnText, { color: textColor }]}>Deleted transactions</Text>
            <AltArrowRightIcon size={16} color={mutedText} />
          </TouchableOpacity>
          {/* Erase All Data Button */}
          <TouchableOpacity
            onPress={handleEraseAllData}
            style={[
              styles.eraseBtn,
              {
                backgroundColor: ACTION_COLORS.danger,
              },
            ]}
            activeOpacity={0.7}
            accessibilityLabel="Start a fresh ledger and keep unpaid balances"
            disabled={pending || importPending}
          >
            <TrashBinTrashIcon size={16} color={ACTION_COLORS.onAction} />
            <Text style={[styles.eraseBtnTitle, { color: ACTION_COLORS.onAction }]}>Start a Fresh Ledger</Text>
          </TouchableOpacity>

          {onSignOut && (
            <TouchableOpacity
              onPress={onSignOut}
              disabled={googlePending}
              style={[styles.resetBtn, { backgroundColor: cardBg }]}
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



      <SheetModal visible={showEraseConfirm} onRequestClose={() => !pending && setShowEraseConfirm(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <ModalBackdrop onClose={() => !pending && setShowEraseConfirm(false)} />
          <GlassModalSheet>
            <SheetHeader title="Start a fresh ledger?" subtitle="Clear settled history and keep unpaid balances" onClose={() => !pending && setShowEraseConfirm(false)} disabled={pending} />
            <ScrollEdgeFade><ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
              <View style={{ padding: 18, borderRadius: 22, gap: 12, backgroundColor: isDark ? '#111114' : '#EDEDF1' }}>
                <TrashBinTrashIcon size={28} color="#E5484D" />
                <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>Only settled history will be cleared</Text>
                <Text style={{ color: mutedText, fontSize: 13, lineHeight: 20 }}>Entries tied to money you owe or are owed will stay, including payment history needed for those balances. Your members, groups and payment profiles stay too. Saved rules and templates will be cleared. Removing settled history cannot be undone.</Text>
                <Text style={{ color: textColor, fontSize: 13, lineHeight: 20 }}>{friends.filter(friend => friend.netBalance !== 0).length} {friends.filter(friend => friend.netBalance !== 0).length === 1 ? 'member has' : 'members have'} an unpaid balance with you. Those balances will not change.</Text>
              </View>
              <FormError message={error} />
              <GlassPill label={pending ? 'Clearing settled history…' : 'Clear settled history'} size="lg" variant="danger" disabled={pending || isOffline} onPress={performErase} />
              <GlassPill label="Cancel" size="lg" variant="dark" disabled={pending} onPress={() => setShowEraseConfirm(false)} />
            </ScrollView></ScrollEdgeFade>
          </GlassModalSheet>
        </View>
      </SheetModal>
      <AddUpiProfileModal visible={showImportProfile} onClose={() => { setShowImportProfile(false); setImportError(''); }} />
      <BottomBubble notice={profileNotice} onDismiss={() => setProfileNotice(null)} />
      <SheetModal visible={showGoogleLink} onRequestClose={closeGoogleLink}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <ModalBackdrop onClose={closeGoogleLink} />
          <GlassModalSheet>
            <SheetHeader title="Sync with Google" subtitle="Connect Google to your existing account" onClose={closeGoogleLink} disabled={googlePending} />
            <ScrollEdgeFade><ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
              <View style={{ padding: 18, borderRadius: 22, gap: 12, backgroundColor: isDark ? '#111114' : '#EDEDF1' }}>
                <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>{user?.email || profile?.email || 'Your account'}</Text>
                <Text style={{ color: mutedText, fontSize: 13, lineHeight: 20 }}>Your transactions, groups and password sign-in stay with this account.</Text>
                {googleNeedsPassword ? <TextInput accessibilityLabel="Current account password" value={googlePassword} onChangeText={setGooglePassword}
                  placeholder="Current password" placeholderTextColor={mutedText} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  editable={!googlePending} style={{ backgroundColor: chipBg, color: textColor, fontSize: 14, borderRadius: 14, paddingHorizontal: 14, height: 48 }} /> : null}
              </View>
              <FormError message={googleError} />
              <GlassPill label={googlePending ? 'Syncing…' : googleNeedsPassword ? 'Confirm password and sync' : 'Continue with Google'} size="lg" variant="dark" disabled={googlePending} onPress={performGoogleLink} />
              <GlassPill label="Cancel" size="lg" variant="dark" disabled={googlePending} onPress={closeGoogleLink} />
            </ScrollView></ScrollEdgeFade>
          </GlassModalSheet>
        </View>
      </SheetModal>
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
  stickyHeaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
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
  headerTitlePosition: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
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
  navRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 14,
  },
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextCol: {
    flex: 1,
    gap: 2,
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  navRowSubtitle: {
    fontSize: 12,
    fontWeight: '400',
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
    paddingHorizontal: 22,
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
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 8,
    flexWrap: 'wrap',
  },
  importProfileEmpty: { gap: 12, paddingVertical: 12 },
  confirmImportWrap: { flexGrow: 1, flexBasis: 210, minWidth: 0 },
  confirmImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: 999,
  },
  confirmImportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  cancelImportBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    minHeight: 48,
    justifyContent: 'center',
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
    borderRadius: 14,
    minHeight: 48,
    borderWidth: 0,
  },
  eraseBtnTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    minHeight: 48,
    borderWidth: 0,
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
    borderWidth: 0,
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
