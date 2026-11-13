import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ViewRefNode } from './src/utils/measureWindow';
import { CardReceiveIcon } from '@solar-icons/react-native/bold/card-receive';
import { CardSendIcon } from '@solar-icons/react-native/bold/card-send';
import { ShieldCheckIcon } from '@solar-icons/react-native/bold/shield-check';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { BillListIcon } from '@solar-icons/react-native/bold/bill-list';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react-native/bold/users-group-two-rounded';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import { InfoCircleIcon } from '@solar-icons/react-native/linear/info-circle';

// Providers & Context
import { LiquidGlassProvider, useLiquidGlass } from './src/theme/LiquidGlassContext';
import { SplitTrackProvider, useSplitTrack } from './src/store/SplitTrackStore';
import { renderSolarIcon } from './src/constants/solarIconsCatalog';

// Glass & Modern Nav Components
import { Aurora } from './src/components/effects/Aurora';
import { GradualBlur } from './src/components/effects/GradualBlur';
import { GlassDock, TabKey } from './src/components/glass/GlassDock';
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
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { PreloaderSplash } from './src/components/common/PreloaderSplash';
import { OnboardingAuthScreen, type AuthLogoRect } from './src/components/auth/OnboardingAuthScreen';
import { AnimatedPressable, FadeInSlide } from './src/components/common/MotionPrimitives';
import { JellyRadio } from './src/components/common/JellyRadio';
import { ExpenseCategory, Friend, Transaction } from './src/types';

type ExpenseFilter = 'All' | 'Expenses' | 'Splits' | 'Income';

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
  userDisplayName = 'Jfiqw Alex',
  onSignOut,
  hideHeaderLogo = false,
  onHeaderLogoLayout,
  onHeaderLogoNode,
}: {
  userDisplayName?: string;
  onSignOut?: () => void;
  hideHeaderLogo?: boolean;
  onHeaderLogoLayout?: (rect: HeaderLogoRect) => void;
  onHeaderLogoNode?: (node: ViewRefNode | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { palette, themeMode, formatAmount, isLiquidGlassEnabled } = useLiquidGlass();
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
  } = useSplitTrack();

  const isDark = themeMode === 'dark';
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Separate Trip Page, Member Pages & Modals
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [homeView, setHomeView] = useState<'overview' | 'members' | 'member-detail'>('overview');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [expenseDefaultTripId, setExpenseDefaultTripId] = useState<string | undefined>(undefined);
  const [expenseDefaultFriendIds, setExpenseDefaultFriendIds] = useState<string[] | undefined>(
    undefined
  );
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ExpenseCategory | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalyticsInfo, setShowAnalyticsInfo] = useState(false);
  const [selectedFriendForSettle, setSelectedFriendForSettle] = useState<Friend | null>(null);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriendForSettle(friend);
    setShowSettle(true);
  };

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const chipBg = isDark ? '#18181D' : '#FFFFFF';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

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

  const renderHomeTab = () => {
    const activeMember = selectedMemberId
      ? friends.find((f) => f.id === selectedMemberId)
      : undefined;

    if (homeView === 'member-detail' && activeMember) {
      return (
        <ScrollView
          key={`member-detail-scroll-${activeMember.id}`}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
        >
          <FadeInSlide key={`member-detail-${activeMember.id}`} style={styles.contentConstrainer}>
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
                setShowAddExpense(true);
              }}
              onOpenTrip={(tripId) => {
                setSelectedTripId(tripId);
                setCurrentTab('trips');
              }}
            />
          </FadeInSlide>
        </ScrollView>
      );
    }

    if (homeView === 'members') {
      return (
        <ScrollView
          key="members-page-scroll"
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
        >
          <FadeInSlide key="members-page" style={styles.contentConstrainer}>
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
          </FadeInSlide>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        key="home-tab-scroll"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
      >
        <FadeInSlide key="home-tab" style={styles.contentConstrainer}>
          <HeaderBar
            onOpenSettings={() => setShowSettings(true)}
            userName={userDisplayName}
            hideLogo={hideHeaderLogo}
            onLogoLayout={onHeaderLogoLayout}
            onLogoNode={onHeaderLogoNode}
          />

          <HeroBalanceCard
            onAddExpense={() => setShowAddExpense(true)}
            onSettle={() => setShowSettle(true)}
            onOpenTrips={() => setCurrentTab('trips')}
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
              onPress={() => setCurrentTab('expenses')}
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
            onViewAll={() => setCurrentTab('expenses')}
          />
        </FadeInSlide>
      </ScrollView>
    );
  };

  const renderExpensesTab = () => {
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
      >
        <FadeInSlide key="expenses-tab" style={styles.contentConstrainer}>
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
                  onPress={() => setShowAddExpense(true)}
                />
              </View>
            </GlassCard>

            {/* Rounded JellyRadio Category Filter + Calendar Date Trigger */}
            <View style={styles.filterWrap}>
              <View style={styles.filterChipsCol}>
                <JellyRadio
                  scrollable
                  fadeColor={rootBg}
                  blurWidth={2}
                  items={['All', 'Expenses', 'Splits', 'Income']}
                  value={expenseFilter}
                  onChange={(val) => setExpenseFilter(val as ExpenseFilter)}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  gap={8}
                  radius={999}
                />
              </View>

              <AnimatedPressable
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
                  blurWidth={2}
                  items={categoryFilterItems}
                  value={selectedCategoryFilter}
                  onChange={(val) => setSelectedCategoryFilter(val)}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  gap={8}
                  radius={999}
                />
              </View>

              <View style={styles.catActionsRow}>
                {selectedCategoryFilter !== 'All' && (
                  <AnimatedPressable
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
                        <AnimatedPressable
                          scaleTo={0.985}
                          onPress={() => setShowSettle(true)}
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
                        </AnimatedPressable>

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

            {/* UPI Profiles — each profile rendered as a clean borderless card */}
            <UpiProfilesSection />
          </View>
        </FadeInSlide>
      </ScrollView>
    );
  };

  const renderTripsTab = () => {
    const activeTrip = selectedTripId ? trips.find((t) => t.id === selectedTripId) : undefined;
    if (activeTrip) {
      return (
        <ScrollView
          key={`trip-detail-scroll-${activeTrip.id}`}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
        >
          <FadeInSlide key={`trip-detail-${activeTrip.id}`} style={styles.contentConstrainer}>
            <HeaderBar
              onOpenSettings={() => setShowSettings(true)}
              userName="Trip Details"
            />
            <TripDetailView
              trip={activeTrip}
              onBack={() => setSelectedTripId(null)}
              onAddTripExpense={(tId) => {
                setExpenseDefaultTripId(tId);
                setShowAddExpense(true);
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
          </FadeInSlide>
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
      >
        <FadeInSlide key="trips-tab" style={styles.contentConstrainer}>
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
              <GlassPill
                label="New Trip"
                icon={<AddCircleIcon size={16} color={textColor} />}
                variant="dark"
                size="sm"
                onPress={() => setShowAddTrip(true)}
              />
            </View>

            {/* Clean Double-Surface Album Cover Trip Cards (tap to open dedicated Trip Page) */}
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onPress={() => setSelectedTripId(trip.id)}
              />
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
                        <AnimatedPressable
                          scaleTo={0.985}
                          onPress={() =>
                            tx.tripId ? setSelectedTripId(tx.tripId) : setShowSettle(true)
                          }
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
                        </AnimatedPressable>

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
        </FadeInSlide>
      </ScrollView>
    );
  };

  const renderAnalyticsTab = () => (
    <ScrollView
      key="analytics-tab-scroll"
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 108 }]}
    >
      <FadeInSlide key="analytics-tab" style={styles.contentConstrainer}>
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
      </FadeInSlide>
    </ScrollView>
  );

  const rootBg = isLiquidGlassEnabled
    ? isDark
      ? '#05050A'
      : '#E8EDF6'
    : palette.background;

  return (
    <View style={[styles.container, { backgroundColor: rootBg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {isLiquidGlassEnabled && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Aurora
            colorStops={
              isDark
                ? ['#3B28CC', '#0EA5E9', '#10B981']
                : ['#8B5CF6', '#38BDF8', '#34D399']
            }
            amplitude={0.85}
            blend={0.65}
            height={0.48}
            speed={0.5}
            glow={0.85}
            layers={2}
            direction="top"
            intro={false}
            opacity={isDark ? 0.28 : 0.32}
            lightMode={!isDark}
          />
          <Aurora
            colorStops={
              isDark
                ? ['#6366F1', '#06B6D4', '#4F46E5']
                : ['#60A5FA', '#A78BFA', '#6EE7B7']
            }
            amplitude={0.8}
            blend={0.65}
            height={0.38}
            speed={0.4}
            glow={0.8}
            layers={1}
            direction="bottom"
            intro={false}
            opacity={isDark ? 0.22 : 0.24}
            lightMode={!isDark}
          />
        </View>
      )}

      <View style={styles.mainViewport}>
        {showSettings ? (
          <FadeInSlide key="settings-page-view" style={[styles.contentConstrainer, { flex: 1, height: '100%' }]}>
            <SettingsPage
              onBack={() => setShowSettings(false)}
              onSignOut={onSignOut}
              userName="Jfiqw Alex"
              userHandle="@alex"
            />
          </FadeInSlide>
        ) : (
          <>
            {currentTab === 'home' && renderHomeTab()}
            {currentTab === 'expenses' && renderExpensesTab()}
            {currentTab === 'trips' && renderTripsTab()}
            {currentTab === 'analytics' && renderAnalyticsTab()}
          </>
        )}

        <GradualBlur
          position="top"
          height={30}
          strength={1.4}
          layers={7}
          tint={
            isLiquidGlassEnabled
              ? isDark
                ? 'rgba(5, 5, 10, 0.5)'
                : 'rgba(232, 237, 246, 0.5)'
              : isDark
                ? 'rgba(9, 9, 11, 0.78)'
                : 'rgba(242, 242, 247, 0.78)'
          }
          zIndex={45}
        />
        <GradualBlur
          position="bottom"
          height={52}
          strength={1.5}
          layers={8}
          tint={
            isLiquidGlassEnabled
              ? isDark
                ? 'rgba(5, 5, 10, 0.6)'
                : 'rgba(232, 237, 246, 0.6)'
              : isDark
                ? 'rgba(9, 9, 11, 0.84)'
                : 'rgba(242, 242, 247, 0.84)'
          }
          zIndex={45}
        />
      </View>

      <GlassDock
        currentTab={currentTab}
        onTabChange={(tab) => {
          setShowSettings(false);
          setCurrentTab(tab);
          setSelectedTripId(null);
          setHomeView('overview');
          setSelectedMemberId(null);
        }}
        onQuickAdd={() => {
          setShowSettings(false);
          setExpenseDefaultTripId(undefined);
          setExpenseDefaultFriendIds(undefined);
          setShowAddExpense(true);
        }}
      />

      <AddExpenseModal
        key={`${expenseDefaultTripId || 'general'}-${expenseDefaultFriendIds?.join(',') || 'all'}`}
        visible={showAddExpense}
        defaultTripId={expenseDefaultTripId}
        defaultFriendIds={expenseDefaultFriendIds}
        onClose={() => {
          setShowAddExpense(false);
          setExpenseDefaultTripId(undefined);
          setExpenseDefaultFriendIds(undefined);
        }}
      />

      <AddTripModal
        visible={showAddTrip}
        onClose={() => setShowAddTrip(false)}
      />

      <AddMemberModal
        key={editingFriend ? `${editingFriend.id}-${editingFriend.name}-${editingFriend.avatar || ''}` : 'new-member'}
        visible={showAddMember}
        editingFriend={editingFriend}
        onClose={() => {
          setShowAddMember(false);
          setEditingFriend(null);
        }}
      />

      <AddCategoryModal
        key={categoryToEdit ? `edit-${categoryToEdit.id}-${categoryToEdit.name}` : 'new-category'}
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
    </View>
  );
}

const AUTH_STORAGE_KEY = '@splittrack_auth_session_v1';

export default function App() {
  const [showPreloader, setShowPreloader] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState('Jfiqw Alex');
  const [hideHeaderLogo, setHideHeaderLogo] = useState(true);
  const [headerLogoRect, setHeaderLogoRect] = useState<HeaderLogoRect | null>(null);
  const headerLogoNodeRef = useRef<ViewRefNode | null>(null);
  const [hideOnboardingLogo, setHideOnboardingLogo] = useState(true);
  const [onboardingLogoRect, setOnboardingLogoRect] = useState<AuthLogoRect | null>(null);
  const onboardingLogoNodeRef = useRef<ViewRefNode | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.isAuthenticated) {
            setIsAuthenticated(true);
            if (parsed.userDisplayName) {
              setUserDisplayName(parsed.userDisplayName);
            }
          }
        }
      } catch {
        // Fallback to default state
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthenticate = async (payload: {
    provider: 'email' | 'google' | 'guest';
    mode: 'signin' | 'signup';
    name?: string;
    email?: string;
  }) => {
    const resolvedName =
      payload.name?.trim() ||
      (payload.email ? payload.email.split('@')[0] : 'Jfiqw Alex');
    setUserDisplayName(resolvedName);
    setIsAuthenticated(true);
    setHideHeaderLogo(false);
    try {
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          isAuthenticated: true,
          userDisplayName: resolvedName,
          provider: payload.provider,
          email: payload.email,
        })
      );
    } catch {
      // storage error
    }
  };

  const handleSignOut = async () => {
    setIsAuthenticated(false);
    setHideOnboardingLogo(false);
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // storage error
    }
  };

  const activeTargetRect = isAuthenticated ? headerLogoRect : onboardingLogoRect;
  const activeTargetNodeRef = isAuthenticated ? headerLogoNodeRef : onboardingLogoNodeRef;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LiquidGlassProvider>
          <SplitTrackProvider>
            <View style={styles.appRoot}>
              {isAuthenticated ? (
                <MainAppContent
                  userDisplayName={userDisplayName}
                  onSignOut={handleSignOut}
                  hideHeaderLogo={hideHeaderLogo}
                  onHeaderLogoLayout={setHeaderLogoRect}
                  onHeaderLogoNode={(node) => {
                    headerLogoNodeRef.current = node;
                  }}
                />
              ) : (
                <OnboardingAuthScreen
                  hideLogo={hideOnboardingLogo}
                  onLogoLayout={setOnboardingLogoRect}
                  onLogoNode={(node) => {
                    onboardingLogoNodeRef.current = node;
                  }}
                  onAuthenticate={handleAuthenticate}
                />
              )}
              {showPreloader ? (
                <PreloaderSplash
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
          </SplitTrackProvider>
        </LiquidGlassProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
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
  metricsSection: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    gap: 2,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
});
