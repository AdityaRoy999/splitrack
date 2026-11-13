import React, { useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { MapPointIcon } from '@solar-icons/react-native/bold/map-point';
import { MagnifierIcon } from '@solar-icons/react-native/bold/magnifier';
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { currencies } from '../../theme/colors';
import { renderSolarIcon } from '../../constants/solarIconsCatalog';
import { GlassPill } from '../glass/GlassPill';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { AddCategoryModal } from '../categories/AddCategoryModal';
import { GradualBlur } from '../effects/GradualBlur';
import {
  CalendarDatePickerModal,
  formatDisplayDate,
  getTodayLocalISO,
} from '../common/CalendarDatePickerModal';
import { SplitMemberShare, SplitType } from '../../types';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  defaultTripId?: string;
  defaultFriendIds?: string[];
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible,
  onClose,
  defaultTripId,
  defaultFriendIds,
}) => {
  const { accounts, friends, trips, transactions, categories, addTransaction, selectedAccountId } =
    useSplitTrack();
  const { currency, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Food & Drinks');
  const [paidBy, setPaidBy] = useState<string>('user');
  const [tripId, setTripId] = useState<string | undefined>(defaultTripId);
  const [upiProfileId, setUpiProfileId] = useState<string>(selectedAccountId);
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayLocalISO());
  const [location, setLocation] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchExpandAnim] = useState(() => new Animated.Value(0));

  const [showPaidBySearch, setShowPaidBySearch] = useState(false);
  const [paidBySearchQuery, setPaidBySearchQuery] = useState('');
  const [paidBySearchExpandAnim] = useState(() => new Animated.Value(0));

  const toggleFriendSearch = () => {
    if (showFriendSearch) {
      Animated.timing(searchExpandAnim, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setShowFriendSearch(false);
          setFriendSearchQuery('');
        }
      });
    } else {
      setShowFriendSearch(true);
      searchExpandAnim.setValue(0);
      Animated.timing(searchExpandAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  };

  const togglePaidBySearch = () => {
    if (showPaidBySearch) {
      Animated.timing(paidBySearchExpandAnim, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setShowPaidBySearch(false);
          setPaidBySearchQuery('');
        }
      });
    } else {
      setShowPaidBySearch(true);
      paidBySearchExpandAnim.setValue(0);
      Animated.timing(paidBySearchExpandAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  };
  const [splitType] = useState<SplitType>('equal');
  const [splitWithMembers, setSplitWithMembers] = useState<string[]>(() => {
    if (defaultTripId) {
      const matchTrip = trips.find((t) => t.id === defaultTripId);
      if (matchTrip?.members?.length) return matchTrip.members;
    }
    if (defaultFriendIds && defaultFriendIds.length > 0) {
      return Array.from(new Set(['user', ...defaultFriendIds]));
    }
    return ['user', 'friend-1', 'friend-3'];
  });

  const selectedTrip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined),
    [tripId, trips]
  );

  const tripScopedFriends = useMemo(() => {
    if (!selectedTrip) return friends;
    return friends.filter((f) => selectedTrip.members.includes(f.id));
  }, [friends, selectedTrip]);

  const showUserInScope = !selectedTrip || selectedTrip.members.includes('user');

  const handleSelectTrip = (val: string) => {
    const nextTripId = val === 'none' ? undefined : val;
    setTripId(nextTripId);
    setFriendSearchQuery('');
    setPaidBySearchQuery('');
    if (!nextTripId) {
      setSplitWithMembers(['user', ...friends.slice(0, 2).map((f) => f.id)]);
      return;
    }
    const targetTrip = trips.find((t) => t.id === nextTripId);
    if (targetTrip && targetTrip.members.length > 0) {
      setSplitWithMembers(targetTrip.members);
      if (paidBy !== 'user' && !targetTrip.members.includes(paidBy)) {
        setPaidBy('user');
      }
    }
  };

  const handleMemberCheckedChange = (id: string, checked: boolean) => {
    if (checked) {
      if (!splitWithMembers.includes(id)) {
        setSplitWithMembers([...splitWithMembers, id]);
      }
    } else if (splitWithMembers.length > 1) {
      setSplitWithMembers(splitWithMembers.filter((m) => m !== id));
    }
  };

  const handleSave = () => {
    const amount = parseFloat(amountStr);
    if (!title.trim() || isNaN(amount) || amount <= 0) return;

    triggerNotification(NotificationType.Success);

    const perPerson = Math.round((amount / splitWithMembers.length) * 100) / 100;
    const splits: SplitMemberShare[] = splitWithMembers.map((memberId) => ({
      friendId: memberId,
      amount: perPerson,
      paidAmount: memberId === paidBy ? amount : 0,
    }));

    addTransaction({
      title: title.trim(),
      subtitle: tripId
        ? trips.find((t) => t.id === tripId)?.name
        : formatDisplayDate(selectedDate, true),
      amount: -amount,
      type: 'expense',
      category,
      categoryIcon: categories.find((c) => c.name === category)?.iconKey || 'tag',
      date: selectedDate,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      upiAccountId: upiProfileId || selectedAccountId,
      tripId,
      paidBy,
      splitType,
      splits,
      settled: false,
      location: location.trim() || undefined,
    });

    setTitle('');
    setAmountStr('');
    setLocation('');
    setSelectedDate(getTodayLocalISO());
    onClose();
  };

  const bgSheet = isDark ? '#09090B' : '#F4F4F8';
  const cardBg = isDark ? '#121216' : '#FFFFFF';
  const inputBg = isDark ? '#1B1B20' : '#F2F3F7';
  const chipBg = isDark ? '#1C1C22' : '#EFEFF4';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';

  const parsedAmount = parseFloat(amountStr) || 0;
  const perPersonShare = splitWithMembers.length > 0 ? parsedAmount / splitWithMembers.length : 0;
  const currSym = currencies[currency]?.symbol || '₹';

  const categoryItems = useMemo(
    () =>
      categories.map((cat) => ({
        value: cat.name,
        label: cat.name,
        icon: renderSolarIcon(cat.iconKey, 14, category === cat.name ? activeText : mutedText),
      })),
    [categories, category, activeText, mutedText]
  );

  const paidByItems = useMemo(
    () => [
      ...(showUserInScope ? [{ value: 'user', label: 'You' }] : []),
      ...tripScopedFriends.map((f) => ({ value: f.id, label: f.name })),
    ],
    [showUserInScope, tripScopedFriends]
  );

  const normalizedPaidByQuery = paidBySearchQuery.trim().toLowerCase();
  const visiblePaidByItems = useMemo(() => {
    if (!normalizedPaidByQuery) return paidByItems;
    return paidByItems.filter((item) =>
      item.label.toLowerCase().includes(normalizedPaidByQuery)
    );
  }, [paidByItems, normalizedPaidByQuery]);

  const normalizedQuery = friendSearchQuery.trim().toLowerCase();
  const visibleScopedFriends = useMemo(() => {
    if (!normalizedQuery) return tripScopedFriends;
    return tripScopedFriends.filter(
      (f) =>
        f.name.toLowerCase().includes(normalizedQuery) ||
        f.handle.toLowerCase().includes(normalizedQuery)
    );
  }, [tripScopedFriends, normalizedQuery]);
  const showUserFiltered =
    showUserInScope && (!normalizedQuery || 'you'.includes(normalizedQuery));

  const tripItems = [
    { value: 'none', label: 'None (General)' },
    ...trips.map((t) => ({ value: t.id, label: t.name })),
  ];

  const locationSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const results: string[] = [];
    const selectedTrip = tripId ? trips.find((t) => t.id === tripId) : undefined;
    if (selectedTrip?.name) {
      const cleanName = selectedTrip.name.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        results.push(cleanName);
      }
    }
    for (const tx of transactions) {
      const loc = tx.location?.trim();
      if (!loc) continue;
      const key = loc.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(loc);
        if (results.length >= 6) break;
      }
    }
    return results;
  }, [transactions, tripId, trips]);

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
              paddingTop: 18,
            },
          ]}
        >
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#27272A' : '#D4D4D8' }]} />
          </View>

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: textColor }]}>Add & Split Expense</Text>
              <Text style={[styles.subtitleText, { color: mutedText }]}>
                Instant equal split across selected people
              </Text>
            </View>
            <AnimatedPressable
              onPress={onClose}
              scaleTo={0.9}
              accessibilityLabel="Close expense modal"
              contentStyle={[styles.closeBtn, { backgroundColor: cardBg }]}
            >
              <CloseCircleIcon size={20} color={textColor} />
            </AnimatedPressable>
          </View>

          <View style={styles.scrollAreaWrap}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Amount, Description & Category */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <View style={[styles.amountInputBox, { backgroundColor: inputBg }]}>
                <Text style={[styles.currencySymbol, { color: textColor }]}>{currSym}</Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    { color: textColor },
                    Platform.OS === 'web' &&
                      ({
                        outlineStyle: 'none',
                        outlineWidth: 0,
                        outlineColor: 'transparent',
                        outline: 'none',
                        boxShadow: 'none',
                      } as any),
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={mutedText}
                  keyboardType="decimal-pad"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                DESCRIPTION
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: inputBg, color: textColor },
                  Platform.OS === 'web' &&
                    ({
                      outlineStyle: 'none',
                      outlineWidth: 0,
                      outlineColor: 'transparent',
                      outline: 'none',
                      boxShadow: 'none',
                    } as any),
                ]}
                placeholder="e.g. Seafood Dinner at Curlies"
                placeholderTextColor={mutedText}
                value={title}
                onChangeText={setTitle}
              />

              <View style={styles.catHeaderRow}>
                <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 0 }]}>
                  CATEGORY
                </Text>
                <AnimatedPressable
                  scaleTo={0.94}
                  onPress={() => setShowAddCategory(true)}
                  contentStyle={[styles.newCategoryMiniBtn, { backgroundColor: chipBg }]}
                >
                  <AddCircleIcon size={13} color={textColor} />
                  <Text style={[styles.newCategoryMiniText, { color: textColor }]}>
                    New Category
                  </Text>
                </AnimatedPressable>
              </View>
              <JellyRadio
                scrollable
                fadeColor={cardBg}
                items={categoryItems}
                value={category}
                onChange={(val) => setCategory(val)}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="sm"
                gap={8}
                radius={999}
              />

              <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                DATE
              </Text>
              <AnimatedPressable
                scaleTo={0.98}
                onPress={() => setShowDatePicker(true)}
                contentStyle={[styles.dateSelectorBtn, { backgroundColor: inputBg }]}
              >
                <View style={styles.dateLeft}>
                  <CalendarDateIcon size={16} color={textColor} />
                  <Text style={[styles.dateValueText, { color: textColor }]}>
                    {selectedDate === getTodayLocalISO()
                      ? `Today • ${formatDisplayDate(selectedDate, true)}`
                      : formatDisplayDate(selectedDate, true)}
                  </Text>
                </View>
                <View style={styles.dateRight}>
                  <Text style={[styles.dateChangeHint, { color: mutedText }]}>Change</Text>
                  <AltArrowRightIcon size={14} color={mutedText} />
                </View>
              </AnimatedPressable>

              <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                LOCATION (OPTIONAL)
              </Text>
              <View style={[styles.locationInputWrap, { backgroundColor: inputBg }]}>
                <MapPointIcon size={15} color={location.trim() ? textColor : mutedText} />
                <TextInput
                  style={[
                    styles.locationInput,
                    { color: textColor },
                    Platform.OS === 'web' &&
                      ({
                        outlineStyle: 'none',
                        outlineWidth: 0,
                        outlineColor: 'transparent',
                        outline: 'none',
                        boxShadow: 'none',
                      } as any),
                  ]}
                  placeholder="e.g. Curlies Beach Shack, Goa"
                  placeholderTextColor={mutedText}
                  value={location}
                  onChangeText={setLocation}
                />
                {location.length > 0 && (
                  <AnimatedPressable
                    scaleTo={0.9}
                    onPress={() => setLocation('')}
                    contentStyle={styles.clearLocationBtn}
                  >
                    <CloseCircleIcon size={14} color={mutedText} />
                  </AnimatedPressable>
                )}
              </View>
              {locationSuggestions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.locationChipsRow}
                  style={styles.locationChipsScroll}
                >
                  {locationSuggestions.map((locOption) => {
                    const isPicked = location.trim().toLowerCase() === locOption.toLowerCase();
                    return (
                      <AnimatedPressable
                        key={locOption}
                        scaleTo={0.95}
                        onPress={() => setLocation(isPicked ? '' : locOption)}
                        contentStyle={[
                          styles.locationChip,
                          { backgroundColor: isPicked ? activeBg : chipBg },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.locationChipText,
                            { color: isPicked ? activeText : textColor },
                          ]}
                        >
                          {locOption}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Paid By, UPI Profile & Trip Group */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.fieldLabel, { color: mutedText }]}>UPI OR CARD PROFILE</Text>
              <JellyRadio
                scrollable
                fadeColor={cardBg}
                items={accounts.map((acc) => ({
                  value: acc.id,
                  label:
                    acc.kind && acc.kind !== 'upi'
                      ? `${acc.bankName || acc.title} ••${acc.cardNumber.slice(-4)}`
                      : acc.upiId || acc.title,
                }))}
                value={upiProfileId}
                onChange={(val) => setUpiProfileId(val)}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="sm"
                gap={8}
                radius={999}
              />

              <View style={styles.paidByHeaderRow}>
                <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 0 }]}>PAID BY</Text>
                <AnimatedPressable
                  scaleTo={0.9}
                  onPress={togglePaidBySearch}
                  accessibilityLabel="Search payer"
                  contentStyle={[
                    styles.searchIconBtn,
                    { backgroundColor: showPaidBySearch ? activeBg : chipBg },
                  ]}
                >
                  <MagnifierIcon
                    size={14}
                    color={showPaidBySearch ? activeText : textColor}
                  />
                </AnimatedPressable>
              </View>

              {showPaidBySearch && (
                <Animated.View
                  style={{
                    overflow: 'hidden',
                    maxHeight: paidBySearchExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 52],
                    }),
                    marginBottom: paidBySearchExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10],
                    }),
                    opacity: paidBySearchExpandAnim,
                    transform: [
                      {
                        translateY: paidBySearchExpandAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <View style={[styles.friendSearchBox, { backgroundColor: inputBg, marginTop: 8 }]}>
                    <MagnifierIcon size={14} color={mutedText} />
                    <TextInput
                      style={[
                        styles.friendSearchInput,
                        { color: textColor },
                        Platform.OS === 'web' &&
                          ({
                            outlineStyle: 'none',
                            outlineWidth: 0,
                            outlineColor: 'transparent',
                            outline: 'none',
                            boxShadow: 'none',
                          } as any),
                      ]}
                      placeholder="Search payer by name..."
                      placeholderTextColor={mutedText}
                      value={paidBySearchQuery}
                      onChangeText={setPaidBySearchQuery}
                      autoFocus
                    />
                    {paidBySearchQuery.length > 0 && (
                      <AnimatedPressable
                        scaleTo={0.9}
                        onPress={() => setPaidBySearchQuery('')}
                        contentStyle={styles.clearLocationBtn}
                      >
                        <CloseCircleIcon size={14} color={mutedText} />
                      </AnimatedPressable>
                    )}
                  </View>
                </Animated.View>
              )}

              {visiblePaidByItems.length > 0 ? (
                <JellyRadio
                  scrollable
                  fadeColor={cardBg}
                  items={visiblePaidByItems}
                  value={paidBy}
                  onChange={(val) => setPaidBy(val)}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  gap={8}
                  radius={999}
                />
              ) : (
                <Text style={[styles.noPayerText, { color: mutedText }]}>
                  {`No payer matching "${paidBySearchQuery}"`}
                </Text>
              )}

              <Text style={[styles.fieldLabel, { color: mutedText, marginTop: 14 }]}>
                LINK TO TRIP / GROUP
              </Text>
              <JellyRadio
                scrollable
                fadeColor={cardBg}
                items={tripItems}
                value={tripId ?? 'none'}
                onChange={handleSelectTrip}
                chipColor={chipBg}
                activeColor={activeBg}
                textColor={textColor}
                activeTextColor={activeText}
                size="sm"
                gap={8}
                radius={999}
              />
            </View>

            {/* Split Among Whom using React Bits SpringCheck */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
              <View style={styles.splitHeaderRow}>
                <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 0 }]}>
                  SPLIT AMONG ({splitWithMembers.length})
                </Text>
                <View style={styles.splitHeaderActions}>
                  <AnimatedPressable
                    scaleTo={0.9}
                    onPress={toggleFriendSearch}
                    accessibilityLabel="Search friends"
                    contentStyle={[
                      styles.searchIconBtn,
                      { backgroundColor: showFriendSearch ? activeBg : chipBg },
                    ]}
                  >
                    <MagnifierIcon
                      size={14}
                      color={showFriendSearch ? activeText : textColor}
                    />
                  </AnimatedPressable>
                  <View style={[styles.splitSummaryBadge, { backgroundColor: chipBg }]}>
                    <Text style={[styles.splitPerPersonNote, { color: textColor }]}>
                      {parsedAmount > 0
                        ? `${currSym}${perPersonShare.toFixed(2)} / person`
                        : 'Equal Split'}
                    </Text>
                  </View>
                </View>
              </View>

              {showFriendSearch && (
                <Animated.View
                  style={{
                    overflow: 'hidden',
                    maxHeight: searchExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 52],
                    }),
                    marginBottom: searchExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10],
                    }),
                    opacity: searchExpandAnim,
                    transform: [
                      {
                        translateY: searchExpandAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <View style={[styles.friendSearchBox, { backgroundColor: inputBg }]}>
                    <MagnifierIcon size={14} color={mutedText} />
                    <TextInput
                      style={[
                        styles.friendSearchInput,
                        { color: textColor },
                        Platform.OS === 'web' &&
                          ({
                            outlineStyle: 'none',
                            outlineWidth: 0,
                            outlineColor: 'transparent',
                            outline: 'none',
                            boxShadow: 'none',
                          } as any),
                      ]}
                      placeholder={
                        selectedTrip
                          ? `Search in ${selectedTrip.name}...`
                          : 'Search friends by name...'
                      }
                      placeholderTextColor={mutedText}
                      value={friendSearchQuery}
                      onChangeText={setFriendSearchQuery}
                      autoFocus
                    />
                    {friendSearchQuery.length > 0 && (
                      <AnimatedPressable
                        scaleTo={0.9}
                        onPress={() => setFriendSearchQuery('')}
                        accessibilityLabel="Clear friend search"
                      >
                        <CloseCircleIcon size={16} color={mutedText} />
                      </AnimatedPressable>
                    )}
                  </View>
                </Animated.View>
              )}

              <View style={styles.splitMembersList}>
                {showUserFiltered && (
                  <View style={[styles.springCheckRow, { backgroundColor: inputBg }]}>
                    <SpringCheck
                      label="You"
                      checked={splitWithMembers.includes('user')}
                      onChange={(checked) => handleMemberCheckedChange('user', checked)}
                      color={textColor}
                      fillColor={activeBg}
                      checkColor={activeText}
                      boxSize={22}
                      boxRadius={999}
                      fontSize={14}
                      strike="none"
                      doneOpacity={1}
                      trailing={
                        splitWithMembers.includes('user') && parsedAmount > 0 ? (
                          <Text style={[styles.memberShareText, { color: mutedText }]}>
                            {currSym}{perPersonShare.toFixed(2)}
                          </Text>
                        ) : null
                      }
                    />
                  </View>
                )}

                {visibleScopedFriends.map((f) => {
                  const inSplit = splitWithMembers.includes(f.id);
                  return (
                    <View key={f.id} style={[styles.springCheckRow, { backgroundColor: inputBg }]}>
                      <SpringCheck
                        label={f.name}
                        checked={inSplit}
                        onChange={(checked) => handleMemberCheckedChange(f.id, checked)}
                        color={textColor}
                        fillColor={activeBg}
                        checkColor={activeText}
                        boxSize={22}
                        boxRadius={999}
                        fontSize={14}
                        strike="none"
                        doneOpacity={1}
                        trailing={
                          inSplit && parsedAmount > 0 ? (
                            <Text style={[styles.memberShareText, { color: mutedText }]}>
                              {currSym}{perPersonShare.toFixed(2)}
                            </Text>
                          ) : null
                        }
                      />
                    </View>
                  );
                })}

                {!showUserFiltered && visibleScopedFriends.length === 0 && (
                  <View style={[styles.springCheckRow, { backgroundColor: inputBg }]}>
                    <Text style={[styles.memberShareText, { color: mutedText, textAlign: 'center' }]}>
                      No matching members found
                    </Text>
                  </View>
                )}
              </View>
            </View>
            </ScrollView>
            <GradualBlur position="top" height={24} strength={1.3} layers={6} tint={bgSheet} />
            <GradualBlur position="bottom" height={28} strength={1.4} layers={6} tint={bgSheet} />
          </View>

          <GlassPill
            label="Save & Split Expense"
            variant="accent"
            size="lg"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </View>
      </View>

      <CalendarDatePickerModal
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          if (d) setSelectedDate(d);
        }}
        onClose={() => setShowDatePicker(false)}
        markedDates={transactions.map((t) => t.date)}
        allowClear={false}
        title="Expense Date"
      />

      <AddCategoryModal
        visible={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onCreated={(created) => setCategory(created.name)}
      />
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
  amountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderWidth: 0,
  },
  currencySymbol: {
    fontSize: 30,
    fontWeight: '500',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 34,
    fontWeight: '500',
    letterSpacing: -0.8,
    borderWidth: 0,
  },
  catHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  paidByHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  noPayerText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  newCategoryMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    borderWidth: 0,
  },
  newCategoryMiniText: {
    fontSize: 11,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 0,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  splitHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  friendSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 0,
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  splitSummaryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  splitPerPersonNote: {
    fontSize: 12,
    fontWeight: '500',
  },
  splitMembersList: {
    gap: 8,
  },
  springCheckRow: {
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 0,
  },
  memberShareText: {
    fontSize: 12,
    fontWeight: '400',
  },
  saveBtn: {
    marginTop: 8,
    borderWidth: 0,
  },
  dateSelectorBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateValueText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateChangeHint: {
    fontSize: 12,
    fontWeight: '400',
  },
  locationInputWrap: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 0,
  },
  locationInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: 0,
  },
  clearLocationBtn: {
    padding: 2,
  },
  locationChipsScroll: {
    marginTop: 8,
  },
  locationChipsRow: {
    gap: 6,
    paddingRight: 8,
  },
  locationChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
