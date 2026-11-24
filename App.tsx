import { ACTION_COLORS } from './src/theme/actionColors';
import { BackdropBlurTargetProvider } from './src/components/common/BackdropBlurTarget';
import { TransactionSwipeRow } from './src/components/transactions/TransactionSwipeRow';
import { ItemActionReveal } from './src/components/common/ItemActionReveal';
import { SettingsAvatarTransitionProvider } from './src/components/common/SettingsAvatarTransition';
import { MainTabsContext } from './src/navigation/MainTabsContext';
import { router, useSegments } from 'expo-router';
import React, { startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { errorMessage } from './src/services/api';
import * as SplashScreen from 'expo-splash-screen';
import {
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { ViewRefNode } from './src/utils/measureWindow';
import { CardReceiveIcon } from '@solar-icons/react-native/bold/card-receive';
import { CardSendIcon } from '@solar-icons/react-native/bold/card-send';
import { ShieldCheckIcon } from '@solar-icons/react-native/bold/shield-check';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { BillListIcon } from '@solar-icons/react-native/bold/bill-list';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { TrashBinTrashIcon } from '@solar-icons/react-native/bold/trash-bin-trash';
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react-native/bold/users-group-two-rounded';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { InfoCircleIcon } from '@solar-icons/react-native/linear/info-circle';

// Providers & Context
import { LiquidGlassProvider, useLiquidGlass } from './src/theme/LiquidGlassContext';
import { SplitTrackProvider, useSplitTrack } from './src/store/SplitTrackStore';
import { renderSolarIcon } from './src/constants/solarIconsCatalog';

// Glass & Modern Nav Components
import { GradualBlur } from './src/components/effects/GradualBlur';
import type { TabKey } from './src/components/glass/GlassDock';
import { GlassCard } from './src/components/glass/GlassCard';
import { GlassPill } from './src/components/glass/GlassPill';
import { GlassMetricTile } from './src/components/glass/GlassMetricTile';

// Screen Components
import { HeaderBar, type HeaderLogoRect } from './src/components/home/HeaderBar';
import { HeroBalanceCard } from './src/components/home/HeroBalanceCard';
import { QuickSendTray } from './src/components/home/QuickSendTray';
import { RecentTransactions } from './src/components/home/RecentTransactions';
import { DonutPieChart } from './src/components/charts/DonutPieChart';
import { SplineChart } from './src/components/charts/SplineChart';
import { AnalyticsInfoModal } from './src/components/charts/AnalyticsInfoModal';
import { TripCard } from './src/components/trips/TripCard';
import { TripDetailView } from './src/components/trips/TripDetailView';
import { UpiProfilesSection } from './src/components/upi/UpiProfilesSection';
import { ManageMembersSection } from './src/components/members/ManageMembersSection';
import { MembersPageView } from './src/components/members/MembersPageView';
import { MemberDetailView } from './src/components/members/MemberDetailView';

// Modals & Primitives
import { AddExpenseModal } from './src/components/split/AddExpenseModal';
import { AddTripModal } from './src/components/trips/AddTripModal';
import { AddMemberModal } from './src/components/trips/AddMemberModal';
import { AddCategoryModal } from './src/components/categories/AddCategoryModal';
import { SettleModal } from './src/components/trips/SettleModal';
import { SettingsPage } from './src/components/settings/SettingsPage';
import { CalendarDatePickerModal, formatDisplayDate } from './src/components/common/CalendarDatePickerModal';
import { FormError } from './src/hooks/useAsyncAction';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { PreloaderSplash, hasCompletedStartupPreloader } from './src/components/common/PreloaderSplash';
import { OnboardingAuthScreen, type AuthLogoRect } from './src/components/auth/OnboardingAuthScreen';
import { OnboardingUsernameScreen } from './src/components/auth/OnboardingUsernameScreen';
import { GoogleLinkRecovery } from './src/components/auth/GoogleLinkRecovery';
import { AnimatedPressable } from './src/components/common/MotionPrimitives';
import { TabScene } from './src/components/common/TabScene';
import { JellyRadio } from './src/components/common/JellyRadio';
import { CloudStatus } from './src/components/common/CloudStatus';
import { TransactionActionsProvider, useTransactionActions } from './src/components/transactions/TransactionActions';
import { ExpenseCategory, Friend, Transaction } from './src/types';
import { COMPACT_ICON_BUTTON_STYLE, COMPACT_BUTTON_HIT_SLOP } from './src/constants/buttonSizes';

type ExpenseFilter = 'All' | 'Expenses' | 'Splits' | 'Income';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function getLedgerIcon(
  tx: Transaction,
  isDark: boolean,
  categories: ExpenseCategory[]
) {
  const iconColor = isDark ? '#F4F4F5' : '#18181B';
  if (tx.type === 'income') return <CardReceiveIcon size={18} color="#10B981" />;
  if (tx.type === 'settlement') return <CheckCircleIcon size={18} color="#10B981" />;
  const catMatch = categories.find((c) => c.name.toLowerCase() === tx.category.toLowerCase());
  return renderSolarIcon(catMatch?.iconKey || tx.categoryIcon, 18, iconColor);
}

function MainAppContent({
  userDisplayName = '',
  userHandle = '',
  onSignOut,
  hideHeaderLogo = false,
  onHeaderLogoLayout,
  onHeaderLogoNode,
  routedScreens,
}: {
  userDisplayName?: string;
  userHandle?: string;
  onSignOut?: () => void;
  hideHeaderLogo?: boolean;
  onHeaderLogoLayout?: (rect: HeaderLogoRect) => void;
  onHeaderLogoNode?: (node: ViewRefNode | null) => void;
  routedScreens?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const transactionActions = useTransactionActions();
  const { palette, themeMode, formatAmount, transactionActionStyle, isLiquidGlassEnabled } = useLiquidGlass();
  const nativeTabs = Platform.OS === 'ios' && isLiquidGlassEnabled;
  const {
    totalIncome,
    totalExpenses,
    totalOwedToYou,
    totalYouOwe,
    trips,
    friends,
    transactions,
    categories,
    getSimplifiedDebts,
    hasMoreTransactions,
    loadMoreTransactions,
    deleteTrip,
  } = useSplitTrack();

  const isDark = themeMode === 'dark';
  const rootBg = palette.background;
  const segments = useSegments();
  const lastSegment = segments[segments.length - 1];
  const currentTab: TabKey = lastSegment === 'expenses' || lastSegment === 'trips' || lastSegment === 'analytics' ? lastSegment : 'home';

  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Separate Trip Page, Member Pages & Modals
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [removingTrips, setRemovingTrips] = useState(false);
  const [tripRemovalError, setTripRemovalError] = useState('');
  const removableTrips = trips.filter(trip => trip.ownerId === user?.uid);
  const removalMode = transactionActionStyle === 'buttons' && removingTrips && removableTrips.length > 0;
  const removeTrip = useCallback(async (id: string, name: string) => {
    try {
      await deleteTrip(id);
      setTripRemovalError('');
    } catch (failure) {
      setTripRemovalError(errorMessage(failure));
      throw failure;
    }
  }, [deleteTrip]);
  const [homeView, setHomeView] = useState<'overview' | 'members' | 'member-detail'>('overview');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [expenseDefaultTripId, setExpenseDefaultTripId] = useState<string | undefined>(undefined);
  const [expenseDefaultFriendIds, setExpenseDefaultFriendIds] = useState<string[] | undefined>(
    undefined
  );
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [retainExpenseEditor, setRetainExpenseEditor] = useState(false);
  const openExpenseEditor = useCallback(() => {
    setRetainExpenseEditor(true);
    setShowAddExpense(true);
  }, []);
  const finishExpenseExit = useCallback(() => setRetainExpenseEditor(false), []);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ExpenseCategory | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalyticsInfo, setShowAnalyticsInfo] = useState(false);
  const [selectedFriendForSettle, setSelectedFriendForSettle] = useState<Friend | null>(null);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);
  const expenseEditorMounted = showAddExpense || retainExpenseEditor;
  const effectsActive = !(expenseEditorMounted || transactionActions.modalVisible || showAddTrip || showAddMember || showAddCategory || showSettle || showAnalyticsInfo || showCalendarModal);

  const navigateTab = useCallback((tab: TabKey) => {
    if (tab === 'split') {
      setExpenseDefaultTripId(undefined);
      setExpenseDefaultFriendIds(undefined);
      openExpenseEditor();
      return;
    }
    // Mount the destination and select it in one commit, without a blank frame.
    startTransition(() => {
      router.navigate(tab === 'home' ? '/' : `/${tab}`);
    });
  }, [openExpenseEditor]);

  const openQuickExpense = useCallback(() => {
    setShowSettings(false);
    setExpenseDefaultTripId(undefined);
    setExpenseDefaultFriendIds(undefined);
    openExpenseEditor();
  }, [openExpenseEditor]);

  const closeExpense = useCallback(() => {
    setShowAddExpense(false);
  }, []);

  const handleDockTabChange = useCallback((tab: TabKey) => {
    setShowSettings(false);
    if (tab !== currentTab) {
      startTransition(() => {
        navigateTab(tab);
        setSelectedTripId(null);
        setHomeView('overview');
        setSelectedMemberId(null);
      });
    }
  }, [currentTab, navigateTab]);

  const handleSelectFriend = useCallback((friend: Friend) => {
    setSelectedFriendForSettle(friend);
    setShowSettle(true);
  }, []);

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const chipBg = isDark ? '#18181D' : '#FFFFFF';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  const dynamicScrollContent = useMemo(
    () => [
      styles.scrollContent,
      {
        paddingTop: nativeTabs ? 10 : insets.top + 10,
        paddingBottom: 114,
      },
    ],
    [insets.top, nativeTabs]
  );

  const categoryFilterItems = useMemo(
    () => [
      { value: 'All', label: 'All Categories' },
      ...categories.map((cat) => ({
        value: cat.name,
        label: cat.name,
        icon: renderSolarIcon(
          cat.iconKey,
          13,
          selectedCategoryFilter === cat.name ? activeText : mutedText
        ),
      })),
    ],
    [categories, selectedCategoryFilter, activeText, mutedText]
  );

  const renderHomeTab = useCallback(() => {
    const activeMember = selectedMemberId
      ? friends.find((f) => f.id === selectedMemberId)
      : undefined;

    if (homeView === 'member-detail' && activeMember) {
      return (
        <ScrollView
          key={`member-detail-scroll-${activeMember.id}`}
          style={styles.scrollView}
          automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
          contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dynamicScrollContent}
        >
          <View key={`member-detail-${activeMember.id}`} style={styles.contentConstrainer}>
            <HeaderBar
              onOpenSettings={() => setShowSettings(true)}
              userName={activeMember.name}
            />
            <MemberDetailView
              friend={activeMember}
              onBack={() => setHomeView('members')}
              onEditFriend={(friend) => {
                setEditingFriend(friend);
                setShowAddMember(true);
              }}
              onSettleFriend={handleSelectFriend}
              onSplitWithFriend={(f) => {
                setExpenseDefaultTripId(undefined);
                setExpenseDefaultFriendIds([f.id]);
                openExpenseEditor();
              }}
              onOpenTrip={(tripId) => {
                setSelectedTripId(tripId);
                navigateTab('trips');
              }}
            />
          </View>
        </ScrollView>
      );
    }

    if (homeView === 'members') {
      return (
        <ScrollView
          key="members-page-scroll"
          style={styles.scrollView}
          automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
          contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dynamicScrollContent}
        >
          <View key="members-page" style={styles.contentConstrainer}>
            <HeaderBar
              onOpenSettings={() => setShowSettings(true)}
              userName="Manage Members"
            />
            <MembersPageView
              onBack={() => {
                setSelectedMemberId(null);
                setHomeView('overview');
              }}
              onSelectMember={(friend) => {
                setSelectedMemberId(friend.id);
                setHomeView('member-detail');
              }}
              onEditMember={(friend) => {
                setEditingFriend(friend);
                setShowAddMember(true);
              }}
              onAddMember={() => {
                setEditingFriend(null);
                setShowAddMember(true);
              }}
            />
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        key="home-tab-scroll"
        style={styles.scrollView}
        automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
        contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicScrollContent}
      >
        <View key="home-tab" style={[styles.contentConstrainer, styles.homeSections]}>
          <HeaderBar
            onOpenSettings={() => setShowSettings(true)}
            userName={userDisplayName}
            hideLogo={hideHeaderLogo}
            onLogoLayout={onHeaderLogoLayout}
            onLogoNode={onHeaderLogoNode}
          />

          <HeroBalanceCard
            onAddExpense={openQuickExpense}
            onSettle={() => setShowSettle(true)}
            onOpenTrips={() => navigateTab('trips')}
          />

          <QuickSendTray
            onSelectFriend={handleSelectFriend}
            onAddFriend={() => {
              setEditingFriend(null);
              setShowAddMember(true);
            }}
          />

          <View style={styles.metricsSection}>
            <GlassMetricTile
              label="Income"
              sublabel="This month"
              amount={totalIncome}
              icon={<CardReceiveIcon size={18} color="#10B981" />}
              iconBgColor="rgba(16, 185, 129, 0.12)"
            />
            <GlassMetricTile
              label="Expenses"
              sublabel="This month"
              amount={totalExpenses}
              icon={<CardSendIcon size={18} color="#EF4444" />}
              iconBgColor="rgba(239, 68, 68, 0.12)"
              onPress={() => navigateTab('expenses')}
            />
            <GlassMetricTile
              label="Net Friend Balance"
              sublabel={`+${formatAmount(totalOwedToYou)} owed to you`}
              amount={totalOwedToYou - totalYouOwe}
              icon={<ShieldCheckIcon size={18} color={textColor} />}
              iconBgColor={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
              onPress={() => setShowSettle(true)}
            />
          </View>

          <ManageMembersSection onOpenMembersPage={() => setHomeView('members')} />

          <RecentTransactions
            onSelectTransaction={() => setShowSettle(true)}
            onViewAll={() => navigateTab('expenses')}
          />
        </View>
      </ScrollView>
    );
  }, [dynamicScrollContent, formatAmount, friends, handleSelectFriend, hideHeaderLogo,
    homeView, isDark, nativeTabs, navigateTab, onHeaderLogoLayout, onHeaderLogoNode, openQuickExpense, openExpenseEditor,
    selectedMemberId, textColor, totalExpenses, totalIncome, totalOwedToYou,
    totalYouOwe, userDisplayName]);

  const renderExpensesTab = useCallback(() => {
    const filteredTransactions = transactions.filter((tx) => {
      if (selectedExpenseDate && tx.date !== selectedExpenseDate) return false;
      if (
        selectedCategoryFilter !== 'All' &&
        tx.category.toLowerCase() !== selectedCategoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (expenseFilter === 'Expenses') return tx.type === 'expense';
      if (expenseFilter === 'Splits') return tx.splits && tx.splits.length > 0;
      if (expenseFilter === 'Income') return tx.type === 'income' || tx.type === 'settlement';
      return true;
    });

    return (
      <ScrollView
        key="expenses-tab-scroll"
        style={styles.scrollView}
        automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
        contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicScrollContent}
      >
        <View key="expenses-tab" style={styles.contentConstrainer}>
          <HeaderBar
            onOpenSettings={() => setShowSettings(true)}
            userName="Expenses & Ledger"
          />

          <View style={styles.tabContentContainer}>
            {/* Clean Summary Banner */}
            <GlassCard borderRadius={22} intensity={25} style={styles.debtSummaryBanner}>
              <View style={styles.bannerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerSubtitle, { color: mutedText }]}>
                    Monthly Spending Tracked
                  </Text>
                  <Text style={[styles.bannerNetOwed, { color: textColor }]}>
                    {formatAmount(totalExpenses)}
                  </Text>
                  <Text style={[styles.bannerBreakdown, { color: mutedText }]}>
                    {transactions.length} recorded entries • All settled balances synced
                  </Text>
                </View>
                <GlassPill
                  label="Add"
                  icon={<AddCircleIcon size={15} color={activeText} />}
                  variant="accent"
                  size="sm"
                  onPress={openQuickExpense}
                />
              </View>
            </GlassCard>

            {/* Rounded JellyRadio Category Filter + Calendar Date Trigger */}
            <View style={styles.filterWrap}>
              <View style={styles.filterChipsCol}>
                <JellyRadio
                  scrollable={!nativeTabs}
                  fadeColor={rootBg}
                  items={['All', 'Expenses', 'Splits', 'Income']}
                  value={expenseFilter}
                  onChange={(val) => setExpenseFilter(val as ExpenseFilter)}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  dropdownHeight={36}
                  gap={8}
                  radius={999}
                />
              </View>

              <AnimatedPressable
                nativeGlass
                scaleTo={0.92}
                onPress={() => setShowCalendarModal(true)}
                accessibilityLabel="Open calendar date filter"
                contentStyle={[
                  selectedExpenseDate ? styles.calendarTriggerBtn : styles.iconOnlyCircleBtn,
                  { backgroundColor: selectedExpenseDate ? activeBg : chipBg },
                ]}
              >
                <CalendarDateIcon
                  size={16}
                  color={selectedExpenseDate ? activeText : textColor}
                />
                {selectedExpenseDate ? (
                  <Text
                    style={[
                      styles.calendarTriggerText,
                      { color: selectedExpenseDate ? activeText : textColor },
                    ]}
                  >
                    {formatDisplayDate(selectedExpenseDate)}
                  </Text>
                ) : null}
              </AnimatedPressable>
            </View>

            {/* Spend Category Filter Strip + New Category Icon Menu Trigger */}
            <View style={styles.categoryFilterRow}>
              <View style={styles.filterChipsCol}>
                <JellyRadio
                  scrollable
                  fadeColor={rootBg}
                  items={categoryFilterItems}
                  value={selectedCategoryFilter}
                  onChange={(val) => setSelectedCategoryFilter(val)}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  dropdownHeight={36}
                  gap={8}
                  radius={999}
                />
              </View>

              <View style={styles.catActionsRow}>
                {selectedCategoryFilter !== 'All' && (
                  <AnimatedPressable
                    nativeGlass
                    scaleTo={0.92}
                    onPress={() => {
                      const match = categories.find(
                        (c) => c.name.toLowerCase() === selectedCategoryFilter.toLowerCase()
                      );
                      if (match) {
                        setCategoryToEdit(match);
                        setShowAddCategory(true);
                      }
                    }}
                    accessibilityLabel="Edit category"
                    contentStyle={[styles.iconOnlyCircleBtn, { backgroundColor: chipBg }]}
                  >
                    <Pen2Icon size={15} color={textColor} />
                  </AnimatedPressable>
                )}
                <AnimatedPressable
                  nativeGlass
                  scaleTo={0.92}
                  onPress={() => {
                    setCategoryToEdit(null);
                    setShowAddCategory(true);
                  }}
                  accessibilityLabel="Create custom category"
                  contentStyle={[styles.iconOnlyCircleBtn, { backgroundColor: chipBg }]}
                >
                  <AddCircleIcon size={17} color={textColor} />
                </AnimatedPressable>
              </View>
            </View>

            {selectedExpenseDate && (
              <View style={styles.activeDateRow}>
                <Text style={[styles.activeDateLabel, { color: mutedText }]}>
                  Filtered to {formatDisplayDate(selectedExpenseDate, true)} ({filteredTransactions.length})
                </Text>
                <AnimatedPressable
                  nativeGlass
                  scaleTo={0.94}
                  onPress={() => setSelectedExpenseDate(null)}
                  accessibilityLabel="Clear date filter"
                  contentStyle={[styles.clearDatePill, { backgroundColor: chipBg }]}
                >
                  <CloseCircleIcon size={13} color={mutedText} />
                  <Text style={[styles.clearDateText, { color: textColor }]}>All Dates</Text>
                </AnimatedPressable>
              </View>
            )}

            {/* Grouped Ledger Stream (single container with hairline dividers) */}
            <View style={styles.ledgerList}>
              {filteredTransactions.length === 0 ? (
                <GlassCard borderRadius={24} style={styles.emptyLedgerCard}>
                  <BillListIcon size={28} color={mutedText} />
                  <Text style={[styles.emptyLedgerText, { color: mutedText }]}>
                    {selectedExpenseDate
                      ? `No entries on ${formatDisplayDate(selectedExpenseDate, true)}`
                      : 'No entries in this filter yet'}
                  </Text>
                </GlassCard>
              ) : (
                <GlassCard borderRadius={24} style={styles.groupedCard}>
                  <View style={styles.groupedCardHeader}>
                    <Text style={[styles.groupedCardTitle, { color: textColor }]}>
                      Ledger Entries
                    </Text>
                    <Text style={[styles.groupedCardCount, { color: mutedText }]}>
                      {filteredTransactions.length}{' '}
                      {filteredTransactions.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>

                  {filteredTransactions.map((tx, idx, visibleList) => {
                    const isPositive = tx.amount > 0;
                    const showDivider = idx < visibleList.length - 1;
                    return (
                      <React.Fragment key={tx.id}>
                        <TransactionSwipeRow transaction={tx}><AnimatedPressable
                          scaleTo={0.985}
                          onPress={() => transactionActions.open(tx)}
                          contentStyle={styles.groupedRow}
                        >
                          <View style={styles.tripExpenseRow}>
                            <View style={styles.tripExpenseLeft}>
                              <View
                                style={[
                                  styles.tripExpenseIconWrap,
                                  { backgroundColor: isDark ? '#1B1B20' : '#F3F4F6' },
                                ]}
                              >
                                {getLedgerIcon(tx, isDark, categories)}
                              </View>
                              <View style={styles.ledgerInfoCol}>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.tripExpenseTitle, { color: textColor }]}
                                >
                                  {tx.title}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.tripExpenseSub, { color: mutedText }]}
                                >
                                  {[tx.category, tx.subtitle || tx.date, tx.location]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.ledgerRightCol}>
                              <Text
                                style={[
                                  styles.tripExpenseAmount,
                                  { color: isPositive ? '#10B981' : textColor },
                                ]}
                              >
                                {isPositive ? '+' : '-'}
                                {formatAmount(Math.abs(tx.amount))}
                              </Text>
                              {tx.splits.length > 0 && (
                                <Text style={[styles.tripExpenseSplits, { color: mutedText }]}>
                                  {tx.splits.length} split
                                </Text>
                              )}
                            </View>
                          </View>
                        </AnimatedPressable></TransactionSwipeRow>

                        {showDivider && (
                          <View
                            style={[
                              styles.rowDivider,
                              { marginLeft: 48, backgroundColor: dividerColor },
                            ]}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </GlassCard>
              )}
            </View>

            {hasMoreTransactions ? <GlassPill label="Load older transactions" onPress={() => { void loadMoreTransactions().catch(() => {}); }} /> : null}
            {/* UPI Profiles — each profile rendered as a clean borderless card */}
            <UpiProfilesSection />
          </View>
        </View>
      </ScrollView>
    );
  }, [activeBg, activeText, categories, categoryFilterItems, chipBg, dividerColor,
    dynamicScrollContent, expenseFilter, formatAmount, isDark, mutedText, nativeTabs, openQuickExpense, rootBg,
    selectedCategoryFilter, selectedExpenseDate, textColor, totalExpenses, transactions, hasMoreTransactions, loadMoreTransactions, transactionActions]);

  const renderTripsTab = useCallback(() => {
    const activeTrip = selectedTripId ? trips.find((t) => t.id === selectedTripId) : undefined;
    if (activeTrip) {
      return (
        <ScrollView
          key={`trip-detail-scroll-${activeTrip.id}`}
          style={styles.scrollView}
          automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
          contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dynamicScrollContent}
        >
          <View key={`trip-detail-${activeTrip.id}`} style={styles.contentConstrainer}>
            <HeaderBar
              onOpenSettings={() => setShowSettings(true)}
              userName="Trip Details"
            />
            <TripDetailView
              trip={activeTrip}
              onBack={() => setSelectedTripId(null)}
              onAddTripExpense={(tId) => {
                setExpenseDefaultTripId(tId);
                setExpenseDefaultFriendIds(undefined);
                openExpenseEditor();
              }}
              onOpenSettle={() => setShowSettle(true)}
              onSelectTransaction={(tx) => {
                const targetId =
                  tx.paidBy !== 'user'
                    ? tx.paidBy
                    : tx.splits?.find((s) => s.friendId !== 'user')?.friendId;
                const matched = targetId
                  ? friends.find((f) => f.id === targetId) || null
                  : null;
                setSelectedFriendForSettle(matched);
                setShowSettle(true);
              }}
            />
          </View>
        </ScrollView>
      );
    }

    const tripTransactions = transactions.filter(
      (t) => t.tripId || (t.splits && t.splits.length > 0)
    );
    const debts = getSimplifiedDebts();
    const netBalance = totalOwedToYou - totalYouOwe;

    return (
      <ScrollView
        key="trips-hub-scroll"
        style={styles.scrollView}
        automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
        contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicScrollContent}
      >
        <View key="trips-tab" style={styles.contentConstrainer}>
          <HeaderBar
            onOpenSettings={() => setShowSettings(true)}
            userName="Trips & Group Hub"
          />

          <View style={styles.tabContentContainer}>
            {/* Settlement Summary Banner */}
            <GlassCard borderRadius={22} intensity={25} style={styles.debtSummaryBanner}>
              <View style={styles.bannerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerSubtitle, { color: mutedText }]}>
                    Net Balance with Friends
                  </Text>
                  <Text
                    style={[
                      styles.bannerNetOwed,
                      { color: netBalance >= 0 ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {netBalance >= 0 ? '+' : '-'}
                    {formatAmount(Math.abs(netBalance))}
                  </Text>
                  <Text style={[styles.bannerBreakdown, { color: mutedText }]}>
                    You are owed {formatAmount(totalOwedToYou)} • You owe{' '}
                    {formatAmount(totalYouOwe)}
                  </Text>
                </View>

                <GlassPill
                  label="Settle Up"
                  variant="accent"
                  size="md"
                  onPress={() => setShowSettle(true)}
                />
              </View>
            </GlassCard>

            {/* Active Trips Header */}
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={[styles.sectionTitleText, { color: textColor }]}>
                  Your Trips & Groups
                </Text>
                <Text style={[styles.sectionSubtitleText, { color: mutedText }]}>
                  Track who paid for what on trips
                </Text>
              </View>
              <View style={styles.tripActions}>
                {transactionActionStyle === 'buttons' && removableTrips.length > 0 ? <AnimatedPressable
                  nativeGlass
                  onPress={() => { setRemovingTrips(!removalMode); setTripRemovalError(''); }}
                  accessibilityLabel={removalMode ? 'Finish removing trips' : 'Remove trips'}
                  accessibilityState={{ selected: removalMode }}
                  contentStyle={[styles.tripRemoveToggle, { backgroundColor: removalMode ? (isDark ? '#18181D' : '#EFEFF4') : ACTION_COLORS.danger }]}
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
                >
                  {removalMode ? <CheckCircleIcon size={20} color="#10B981" /> : <TrashBinTrashIcon size={20} color="#FFFFFF" />}
                </AnimatedPressable> : null}
                <AnimatedPressable
                  nativeGlass
                  accessibilityLabel="Add a trip or group"
                  contentStyle={[styles.tripRemoveToggle, { backgroundColor: isDark ? '#242428' : '#EFEFF4' }]}
                  hitSlop={COMPACT_BUTTON_HIT_SLOP}
                  onPress={() => { setRemovingTrips(false); setShowAddTrip(true); }}
                ><AddCircleIcon size={20} color={textColor} /></AnimatedPressable>
              </View>
            </View>

            {removalMode ? <Text style={[styles.tripRemovalHint, { color: mutedText }]}>Tap a delete button to remove a trip. Its expenses and balances stay in your ledger.</Text> : null}
            <FormError message={tripRemovalError} />

            {/* Clean Double-Surface Album Cover Trip Cards (tap to open dedicated Trip Page) */}
            {trips.map((trip) => (
              <ItemActionReveal key={trip.id} name={trip.name} buttons={false} onDelete={trip.ownerId === user?.uid ? () => { void removeTrip(trip.id, trip.name).catch(() => {}); } : undefined}>
              <TripCard
                key={trip.id}
                trip={trip}
                onPress={() => setSelectedTripId(trip.id)}
                onRemove={removalMode && trip.ownerId === user?.uid ? () => removeTrip(trip.id, trip.name) : undefined}
              /></ItemActionReveal>
            ))}

            {/* Pending Debt Simplification Stream — grouped inside one card */}
            {debts.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <View style={styles.sectionTitleRow}>
                  <View>
                    <Text style={[styles.sectionTitleText, { color: textColor }]}>
                      Who Needs to Pay Whom
                    </Text>
                    <Text style={[styles.sectionSubtitleText, { color: mutedText }]}>
                      Minimized cash flow settlements
                    </Text>
                  </View>
                </View>

                <GlassCard borderRadius={24} style={styles.groupedCard}>
                  {debts.slice(0, 3).map((debt, idx, visibleDebts) => {
                    const showDivider = idx < visibleDebts.length - 1;
                    const debtSubtitle =
                      debt.fromId === 'user'
                        ? `You owe ${debt.toName}`
                        : debt.toId === 'user'
                          ? `${debt.fromName} owes you`
                          : `${debt.fromName} owes ${debt.toName}`;
                    return (
                      <React.Fragment key={`${debt.fromId}-${debt.toId}-${idx}`}>
                        <View style={styles.groupedRow}>
                          <View style={styles.debtStreamRow}>
                            <View style={styles.debtStreamLeft}>
                              <View
                                style={[
                                  styles.tripExpenseIconWrap,
                                  { backgroundColor: isDark ? '#1B1B20' : '#F3F4F6' },
                                ]}
                              >
                                <UsersGroupTwoRoundedIcon size={18} color={mutedText} />
                              </View>
                              <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.debtStreamTitle, { color: textColor }]}
                                >
                                  {debt.fromName} → {debt.toName}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.debtStreamSub, { color: mutedText }]}
                                >
                                  {debtSubtitle}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.debtStreamRight}>
                              <Text
                                style={[
                                  styles.debtStreamAmount,
                                  { color: debt.fromId === 'user' ? '#EF4444' : '#10B981' },
                                ]}
                              >
                                {formatAmount(debt.amount)}
                              </Text>
                              <AnimatedPressable
                                onPress={() => setShowSettle(true)}
                                scaleTo={0.92}
                                contentStyle={[
                                  styles.settleMiniBtn,
                                  { backgroundColor: isDark ? '#1B1B20' : '#F3F4F6' },
                                ]}
                              >
                                <Text style={[styles.settleMiniBtnText, { color: textColor }]}>
                                  {debt.toId === 'user' ? 'Remind' : 'Settle'}
                                </Text>
                              </AnimatedPressable>
                            </View>
                          </View>
                        </View>

                        {showDivider && (
                          <View
                            style={[
                              styles.rowDivider,
                              { marginLeft: 48, backgroundColor: dividerColor },
                            ]}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </GlassCard>
              </View>
            )}

            {/* Shared Trip Expenses Stream — grouped inside one card */}
            {tripTransactions.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <View style={styles.sectionTitleRow}>
                  <View>
                    <Text style={[styles.sectionTitleText, { color: textColor }]}>
                      Recent Group Expenses
                    </Text>
                    <Text style={[styles.sectionSubtitleText, { color: mutedText }]}>
                      Shared splits across groups
                    </Text>
                  </View>
                </View>

                <GlassCard borderRadius={24} style={styles.groupedCard}>
                  {tripTransactions.slice(0, 4).map((tx, idx, visibleTrips) => {
                    const showDivider = idx < visibleTrips.length - 1;
                    return (
                      <React.Fragment key={tx.id}>
                        <TransactionSwipeRow transaction={tx}><AnimatedPressable
                          scaleTo={0.985}
                          onPress={() => transactionActions.open(tx)}
                          contentStyle={styles.groupedRow}
                        >
                          <View style={styles.tripExpenseRow}>
                            <View style={styles.tripExpenseLeft}>
                              <View
                                style={[
                                  styles.tripExpenseIconWrap,
                                  { backgroundColor: isDark ? '#1B1B20' : '#F3F4F6' },
                                ]}
                              >
                                {getLedgerIcon(tx, isDark, categories)}
                              </View>
                              <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.tripExpenseTitle, { color: textColor }]}
                                >
                                  {tx.title}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.tripExpenseSub, { color: mutedText }]}
                                >
                                  {[tx.subtitle || 'Shared group split', tx.location]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </Text>
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                              <Text style={[styles.tripExpenseAmount, { color: textColor }]}>
                                {formatAmount(Math.abs(tx.amount))}
                              </Text>
                              <Text style={[styles.tripExpenseSplits, { color: '#10B981' }]}>
                                {tx.splits.length > 0 ? `${tx.splits.length} split` : 'Recorded'}
                              </Text>
                            </View>
                          </View>
                        </AnimatedPressable></TransactionSwipeRow>

                        {showDivider && (
                          <View
                            style={[
                              styles.rowDivider,
                              { marginLeft: 48, backgroundColor: dividerColor },
                            ]}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </GlassCard>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }, [categories, dividerColor, dynamicScrollContent, formatAmount, friends,
    getSimplifiedDebts, isDark, mutedText, nativeTabs, selectedTripId, textColor,
    totalOwedToYou, totalYouOwe, transactions, trips, removalMode, removableTrips.length,
    removeTrip, tripRemovalError, user?.uid, transactionActions, transactionActionStyle, openExpenseEditor]);

  const renderAnalyticsTab = useCallback(() => (
    <ScrollView
      key="analytics-tab-scroll"
      style={styles.scrollView}
      automaticallyAdjustContentInsets={nativeTabs ? false : undefined}
      contentInsetAdjustmentBehavior={nativeTabs ? 'never' : undefined}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={dynamicScrollContent}
    >
      <View key="analytics-tab" style={styles.contentConstrainer}>
        <HeaderBar
          onOpenSettings={() => setShowSettings(true)}
          userName="Visual Analytics"
        />

        <View style={styles.tabContentContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitleText, { color: textColor }]}>
              Expense Breakdown
            </Text>
            <AnimatedPressable
              nativeGlass
              scaleTo={0.9}
              onPress={() => setShowAnalyticsInfo(true)}
              accessibilityLabel="Analytics instructions"
              contentStyle={[
                styles.infoIconBtn,
                { backgroundColor: chipBg },
              ]}
            >
              <InfoCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <DonutPieChart />

          <View style={[styles.sectionTitleRow, { marginTop: 14 }]}>
            <Text style={[styles.sectionTitleText, { color: textColor }]}>
              Cash Flow Trajectory
            </Text>
          </View>

          <SplineChart />
        </View>
      </View>
    </ScrollView>
  ), [chipBg, dynamicScrollContent, nativeTabs, textColor]);

  return (
    <SettingsAvatarTransitionProvider onOpen={() => setShowSettings(true)}>
    <MainTabsContext.Provider value={{ render: { home: renderHomeTab, expenses: renderExpensesTab, trips: renderTripsTab, analytics: renderAnalyticsTab },
      effectsActive: effectsActive && !showSettings, hidden: showSettings || expenseEditorMounted || showAddTrip || showAddMember,
      settingsVisible: showSettings,
      openSplit: openQuickExpense, navigate: handleDockTabChange }}>
    <View style={[styles.container, { backgroundColor: rootBg, paddingTop: 0 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <CloudStatus />

      {/* The page viewport starts below the status bar. Scrolling content cannot
          cross into the system area or require another blur/material overlay. */}
      <View collapsable={false} style={[styles.mainViewport, { backgroundColor: rootBg, paddingTop: nativeTabs ? insets.top : 0 }]}>
        <View style={[styles.tabPagesContainer, { backgroundColor: rootBg }, nativeTabs && { height: undefined }]}>
          <View style={styles.nativeTabsHost}>{routedScreens}</View>
          {showSettings ? (
            <View style={styles.settingsOverlay}><TabScene active duration={340} offsetY={0}><View key="settings-page-view" style={[styles.contentConstrainer, { flex: 1, height: '100%' }]}>
              <SettingsPage
                onBack={() => setShowSettings(false)}
                onSignOut={onSignOut}
                userName={userDisplayName}
                userHandle={userHandle}
                onNavigateTab={(tab) => {
                  setShowSettings(false);
                  navigateTab(tab);
                }}
                onOpenAddExpense={openQuickExpense}
                onOpenAddTrip={() => {
                  setShowSettings(false);
                  setShowAddTrip(true);
                }}
                onOpenAddMember={() => {
                  setShowSettings(false);
                  setShowAddMember(true);
                }}
                onManageCards={() => {
                  setShowSettings(false);
                  navigateTab('expenses');
                }}
              />
            </View></TabScene></View>
          ) : null}

        </View>
        {!nativeTabs ? <GradualBlur
          active={effectsActive}
          tint={Platform.OS === 'android' ? rootBg : 'transparent'}
          position="top"
          height={Math.max(32, insets.top + 12)}
          strength={0.6}
          layers={6}
          curve="bezier"
          zIndex={45}
        /> : null}
        {!nativeTabs ? <GradualBlur
          active={effectsActive}
          tint={Platform.OS === 'android' ? rootBg : 'transparent'}
          position="bottom"
          height={Math.max(48, insets.bottom + 32)}
          strength={0.6}
          layers={6}
          curve="bezier"
          zIndex={45}
        /> : null}
      </View>



      {expenseEditorMounted ? <AddExpenseModal
        key={`${expenseDefaultTripId || 'general'}-${expenseDefaultFriendIds?.join(',') || 'all'}`}
        visible={showAddExpense}
        defaultTripId={expenseDefaultTripId}
        defaultFriendIds={expenseDefaultFriendIds}
        onClose={closeExpense}
        onExitComplete={finishExpenseExit}
      /> : null}

      <AddTripModal
        visible={showAddTrip}
        onClose={() => setShowAddTrip(false)}
      />

      <AddMemberModal
        visible={showAddMember}
        editingFriend={editingFriend}
        onClose={() => {
          setShowAddMember(false);
          setEditingFriend(null);
        }}
      />

      <AddCategoryModal
        visible={showAddCategory}
        categoryToEdit={categoryToEdit}
        onClose={() => {
          setShowAddCategory(false);
          setCategoryToEdit(null);
        }}
        onCreated={(cat) => setSelectedCategoryFilter(cat.name)}
        onUpdated={(cat) => setSelectedCategoryFilter(cat.name)}
        onDeleted={() => setSelectedCategoryFilter('All')}
      />

      <SettleModal
        visible={showSettle}
        onClose={() => {
          setShowSettle(false);
          setSelectedFriendForSettle(null);
        }}
        targetFriendId={selectedFriendForSettle?.id}
      />

      <AnalyticsInfoModal
        visible={showAnalyticsInfo}
        onClose={() => setShowAnalyticsInfo(false)}
      />

      <CalendarDatePickerModal
        visible={showCalendarModal}
        selectedDate={selectedExpenseDate}
        onSelectDate={setSelectedExpenseDate}
        onClose={() => setShowCalendarModal(false)}
        markedDates={transactions.map((t) => t.date)}
        allowClear={true}
        title="Filter Ledger by Date"
      />
    </View></MainTabsContext.Provider></SettingsAvatarTransitionProvider>
  );
}

export default function App({ children }: { children?: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={styles.appRoot}><SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent routedScreens={children} />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider></GestureHandlerRootView>
  );
}

function AppContent({ routedScreens }: { routedScreens?: React.ReactNode }) {
  const { user, profile, loading, profileError, authenticate, completeProfile, refreshProfile, logout } = useAuth();
  const isAuthenticated = Boolean(user && profile?.username);
  const userDisplayName = profile?.displayName ?? user?.displayName ?? '';
  const userHandle = profile?.handle ?? '';
  const uid = user?.uid ?? '';
  const [appearanceStatus, setAppearanceStatus] = useState({ uid: '', ready: false });
  const reportPreferencesReady = useCallback((ready: boolean) => setAppearanceStatus(previous => previous.uid === uid && previous.ready === ready ? previous : { uid, ready }), [uid]);
  const [sessionError, setSessionError] = useState('');
  const [showPreloader, setShowPreloader] = useState(() => !hasCompletedStartupPreloader());
  const [hideHeaderLogo, setHideHeaderLogo] = useState(() => !hasCompletedStartupPreloader());
  const [headerLogoRect, setHeaderLogoRect] = useState<HeaderLogoRect | null>(null);
  const headerLogoNodeRef = useRef<ViewRefNode | null>(null);
  const handleHeaderLogoNode = useCallback((node: ViewRefNode | null) => {
    headerLogoNodeRef.current = node;
  }, []);
  const [hideOnboardingLogo, setHideOnboardingLogo] = useState(() => !hasCompletedStartupPreloader());
  const [onboardingLogoRect, setOnboardingLogoRect] = useState<AuthLogoRect | null>(null);
  const onboardingLogoNodeRef = useRef<ViewRefNode | null>(null);
  const handleSignOut = async () => {
    try { await logout(); setSessionError(''); setHideOnboardingLogo(false); }
    catch (error) { setSessionError(errorMessage(error)); }
  };

  const activeTargetRect = isAuthenticated ? headerLogoRect : onboardingLogoRect;
  const activeTargetNodeRef = isAuthenticated ? headerLogoNodeRef : onboardingLogoNodeRef;

  return (
            <View style={styles.appRoot} onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }}>
              <SplitTrackProvider><LiquidGlassProvider onPreferencesReady={reportPreferencesReady}>
              {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090B' }}><ActivityIndicator color="#FFFFFF" /><Text style={{ color: '#A1A1AA', marginTop: 16 }}>Loading your account…</Text></View>
              ) : user && profileError ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18, backgroundColor: '#09090B' }}>
                  <Text style={{ color: '#F4F4F5', textAlign: 'center' }}>{profileError}</Text>
                  <GlassPill label="Retry connection" onPress={() => { void refreshProfile().catch(error => setSessionError(errorMessage(error))); }} />
                  <GlassPill label="Sign out" onPress={handleSignOut} />
                </View>
              ) : isAuthenticated ? (
                <BackdropBlurTargetProvider><TransactionActionsProvider><MainAppContent
                  key={user?.uid}
                  userDisplayName={userDisplayName}
                  userHandle={userHandle}
                  onSignOut={handleSignOut}
                  hideHeaderLogo={hideHeaderLogo}
                  onHeaderLogoLayout={showPreloader ? setHeaderLogoRect : undefined}
                  onHeaderLogoNode={handleHeaderLogoNode}
                  routedScreens={routedScreens}
                /></TransactionActionsProvider></BackdropBlurTargetProvider>
              ) : user ? (
                <OnboardingUsernameScreen
                  initialDisplayName={user.displayName || profile?.displayName}
                  initialEmail={user.email ?? ''}
                  onComplete={completeProfile}
                  onSignOut={handleSignOut}
                />
              ) : (
                <OnboardingAuthScreen
                  hideLogo={hideOnboardingLogo}
                  onLogoLayout={setOnboardingLogoRect}
                  onLogoNode={(node) => {
                    onboardingLogoNodeRef.current = node;
                  }}
                  onAuthenticate={authenticate}
                />
              )}
              {sessionError ? <Text accessibilityLiveRegion="polite" style={{ color: '#F87171', padding: 12 }}>{sessionError}</Text> : null}
              <GoogleLinkRecovery />
              </LiquidGlassProvider></SplitTrackProvider>
              {showPreloader ? (
                <PreloaderSplash
                  ready={!loading && (!isAuthenticated || (appearanceStatus.uid === uid && appearanceStatus.ready))}
                  targetLogoRect={activeTargetRect}
                  targetLogoNodeRef={activeTargetNodeRef}
                  onRevealHeaderLogo={() => {
                    if (isAuthenticated) {
                      setHideHeaderLogo(false);
                    } else {
                      setHideOnboardingLogo(false);
                    }
                  }}
                  onFinish={() => {
                    setHideHeaderLogo(false);
                    setHideOnboardingLogo(false);
                    setShowPreloader(false);
                  }}
                />
              ) : null}
            </View>
  );
}

const styles = StyleSheet.create({
  nativeTabsHost: { flex: 1 },
  settingsOverlay: { ...StyleSheet.absoluteFill, zIndex: 5 },
  tripActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripRemoveToggle: { ...COMPACT_ICON_BUTTON_STYLE, borderRadius: 18, borderWidth: 0 },
  tripRemovalHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  appRoot: {
    flex: 1,
    position: 'relative',
  },
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  mainViewport: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  tabPagesContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  contentConstrainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    minWidth: 0,
  },
  scrollContent: {
    paddingTop: 8,
    width: '100%',
  },
  tabContentContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  homeSections: { gap: 16 },
  metricsSection: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  sectionSubtitleText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  debtSummaryBanner: {
    padding: 18,
    marginVertical: 8,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  bannerNetOwed: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  bannerBreakdown: {
    fontSize: 11,
    fontWeight: '400',
  },
  filterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  categoryFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  catActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconOnlyCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderWidth: 0,
  },
  newCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    marginLeft: 8,
    gap: 5,
    borderWidth: 0,
  },
  newCategoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipsCol: {
    flex: 1,
    minWidth: 0,
  },
  calendarTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    height: 36,
    borderRadius: 999,
    marginLeft: 8,
    gap: 6,
    borderWidth: 0,
  },
  calendarTriggerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  activeDateLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  clearDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  clearDateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ledgerList: {
    width: '100%',
  },
  groupedCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  groupedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupedCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  groupedCardCount: {
    fontSize: 12,
    fontWeight: '400',
  },
  groupedRow: {
    paddingVertical: 10,
  },
  rowDivider: {
    height: 1,
    marginVertical: 1,
  },
  ledgerInfoCol: {
    marginLeft: 12,
    flex: 1,
  },
  ledgerRightCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  emptyLedgerCard: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0,
  },
  emptyLedgerText: {
    fontSize: 13,
    fontWeight: '400',
  },
  debtStreamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtStreamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debtStreamTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  debtStreamSub: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  debtStreamRight: {
    alignItems: 'flex-end',
    gap: 5,
    marginLeft: 10,
  },
  debtStreamAmount: {
    fontSize: 15,
    fontWeight: '500',
  },
  settleMiniBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 0,
  },
  settleMiniBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tripExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripExpenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripExpenseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  tripExpenseTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  tripExpenseSub: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  tripExpenseAmount: {
    fontSize: 15,
    fontWeight: '500',
  },
  tripExpenseSplits: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  infoIconBtn: {
    ...COMPACT_ICON_BUTTON_STYLE,
    borderRadius: 18,
    borderWidth: 0,
  },
});
