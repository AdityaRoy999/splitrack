import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { AltArrowRightIcon } from '@solar-icons/react-native/bold/alt-arrow-right';
import { MapPointIcon } from '@solar-icons/react-native/bold/map-point';
import { MagnifierIcon } from '@solar-icons/react-native/bold/magnifier';
import { Pen2Icon } from '@solar-icons/react-native/bold/pen-2';
import {
  ImpactStyle,
  NotificationType,
  triggerImpact,
  triggerNotification,
} from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { currencies } from '../../theme/colors';
import { renderSolarIcon } from '../../constants/solarIconsCatalog';
import { GlassPill } from '../glass/GlassPill';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import { SpringCheck } from '../common/SpringCheck';
import { SmoothCollapsible, triggerSmoothLayout } from '../common/SmoothCollapsible';
import { AddCategoryModal } from '../categories/AddCategoryModal';
import {
  CalendarDatePickerModal,
  formatDisplayDate,
  getTodayLocalISO,
} from '../common/CalendarDatePickerModal';
import { ExpenseCategory, SplitMemberShare, SplitType } from '../../types';

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
  const [isLocating, setIsLocating] = useState(false);

  const handleAutoLocate = async () => {
    try {
      setIsLocating(true);
      triggerImpact(ImpactStyle.Light);

      // Web fallback
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const res = await Location.reverseGeocodeAsync({ latitude, longitude });
              if (res && res.length > 0) {
                const item = res[0];
                const parts = [item.name, item.street, item.subregion || item.district, item.city || item.region].filter(Boolean);
                const placeName = parts.slice(0, 2).join(', ') || item.city || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                setLocation(placeName);
                triggerNotification(NotificationType.Success);
              } else {
                setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
              }
            } catch {
              try {
                const r = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
                );
                const data = await r.json();
                const name =
                  data.address?.amenity ||
                  data.address?.road ||
                  data.address?.neighbourhood ||
                  data.address?.suburb ||
                  data.address?.city ||
                  data.display_name?.split(',')[0];
                const city = data.address?.city || data.address?.town || data.address?.state;
                setLocation(
                  name
                    ? city && !name.toLowerCase().includes(city.toLowerCase())
                      ? `${name}, ${city}`
                      : name
                    : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                );
                triggerNotification(NotificationType.Success);
              } catch {
                setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
              }
            } finally {
              setIsLocating(false);
            }
          },
          () => {
            setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
        return;
      }

      // Native iOS & Android via expo-location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLocating(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (places && places.length > 0) {
        const p = places[0];
        const primary = p.name || p.street || p.subregion;
        const city = p.city || p.region;
        const formatted = primary
          ? city && !primary.toLowerCase().includes(city.toLowerCase())
            ? `${primary}, ${city}`
            : primary
          : (city || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setLocation(formatted);
        triggerNotification(NotificationType.Success);
      } else {
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (err) {
      console.warn('Auto locate error:', err);
    } finally {
      setIsLocating(false);
    }
  };

  const toggleFriendSearch = () => {
    triggerSmoothLayout(240);
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
    triggerSmoothLayout(240);
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
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});
  const [customShares, setCustomShares] = useState<Record<string, number>>({});
  const [categoryToEdit, setCategoryToEdit] = useState<ExpenseCategory | null>(null);
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


  const parsedAmount = parseFloat(amountStr) || 0;
  const perPersonShare = splitWithMembers.length > 0 ? parsedAmount / splitWithMembers.length : 0;
  const currSym = currencies[currency]?.symbol || '₹';

  const splitTypeItems = [
    { value: 'equal', label: '= Equal' },
    { value: 'exact', label: `${currSym} Exact` },
    { value: 'percentage', label: '% Percent' },
    { value: 'shares', label: '# Shares' },
  ];

  const handleSplitTypeChange = (val: string) => {
    triggerSmoothLayout(280);
    const next = val as SplitType;
    setSplitType(next);
    triggerImpact(ImpactStyle.Light);
    const total = parsedAmount;
    const count = splitWithMembers.length;
    if (next === 'exact') {
      const per = count > 0 ? (total / count).toFixed(2) : '0';
      const amounts: Record<string, string> = {};
      splitWithMembers.forEach((id) => {
        amounts[id] = customAmounts[id] || per;
      });
      setCustomAmounts(amounts);
    } else if (next === 'percentage') {
      const perPct = count > 0 ? Math.floor(100 / count).toString() : '0';
      const pcts: Record<string, string> = {};
      splitWithMembers.forEach((id) => {
        pcts[id] = customPercentages[id] || perPct;
      });
      setCustomPercentages(pcts);
    } else if (next === 'shares') {
      const shs: Record<string, number> = {};
      splitWithMembers.forEach((id) => {
        shs[id] = customShares[id] ?? 1;
      });
      setCustomShares(shs);
    }
  };

  const splitCalculations = useMemo(() => {
    const total = parsedAmount;
    const count = splitWithMembers.length;
    if (count === 0) {
      return {
        memberAmounts: {} as Record<string, number>,
        allocated: 0,
        remaining: total,
        isBalanced: true,
        totalShares: 0,
        totalPct: 0,
      };
    }

    if (splitType === 'equal') {
      const per = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
      const memberAmounts: Record<string, number> = {};
      splitWithMembers.forEach((id) => {
        memberAmounts[id] = per;
      });
      return {
        memberAmounts,
        allocated: Math.round(per * count * 100) / 100,
        remaining: 0,
        isBalanced: true,
        totalShares: count,
        totalPct: 100,
      };
    }

    if (splitType === 'exact') {
      let allocated = 0;
      const memberAmounts: Record<string, number> = {};
      splitWithMembers.forEach((id) => {
        const val = parseFloat(customAmounts[id]) || 0;
        memberAmounts[id] = val;
        allocated += val;
      });
      allocated = Math.round(allocated * 100) / 100;
      const remaining = Math.round((total - allocated) * 100) / 100;
      return {
        memberAmounts,
        allocated,
        remaining,
        isBalanced: Math.abs(remaining) < 0.01,
        totalShares: count,
        totalPct: total > 0 ? Math.round((allocated / total) * 100) : 100,
      };
    }

    if (splitType === 'percentage') {
      let totalPct = 0;
      const memberAmounts: Record<string, number> = {};
      splitWithMembers.forEach((id) => {
        const pct = parseFloat(customPercentages[id]) || 0;
        totalPct += pct;
        memberAmounts[id] = Math.round(((pct / 100) * total) * 100) / 100;
      });
      const allocated = Math.round(((totalPct / 100) * total) * 100) / 100;
      const remaining = Math.round((total - allocated) * 100) / 100;
      return {
        memberAmounts,
        allocated,
        remaining,
        isBalanced: Math.abs(100 - totalPct) < 0.01,
        totalShares: count,
        totalPct: Math.round(totalPct * 100) / 100,
      };
    }

    if (splitType === 'shares') {
      let totalShares = 0;
      splitWithMembers.forEach((id) => {
        totalShares += Math.max(1, customShares[id] ?? 1);
      });
      const memberAmounts: Record<string, number> = {};
      splitWithMembers.forEach((id) => {
        const sh = Math.max(1, customShares[id] ?? 1);
        memberAmounts[id] = totalShares > 0 ? Math.round(((sh / totalShares) * total) * 100) / 100 : 0;
      });
      return {
        memberAmounts,
        allocated: total,
        remaining: 0,
        isBalanced: true,
        totalShares,
        totalPct: 100,
      };
    }

    return {
      memberAmounts: {} as Record<string, number>,
      allocated: 0,
      remaining: 0,
      isBalanced: true,
      totalShares: 0,
      totalPct: 0,
    };
  }, [parsedAmount, splitWithMembers, splitType, customAmounts, customPercentages, customShares]);

  const handleShiftExact = (memberId: string, delta: number) => {
    triggerImpact(ImpactStyle.Light);
    const curr = parseFloat(customAmounts[memberId]) || 0;
    const nextVal = Math.max(0, Math.round((curr + delta) * 100) / 100);
    setCustomAmounts((prev) => ({
      ...prev,
      [memberId]: nextVal.toString(),
    }));
  };

  const handleShiftPercentage = (memberId: string, deltaPct: number) => {
    triggerImpact(ImpactStyle.Light);
    const curr = parseFloat(customPercentages[memberId]) || 0;
    const nextVal = Math.max(0, Math.min(100, Math.round((curr + deltaPct) * 100) / 100));
    setCustomPercentages((prev) => ({
      ...prev,
      [memberId]: nextVal.toString(),
    }));
  };

  const handleShiftShare = (memberId: string, deltaShares: number) => {
    triggerImpact(ImpactStyle.Light);
    const curr = customShares[memberId] ?? 1;
    const nextVal = Math.max(1, curr + deltaShares);
    setCustomShares((prev) => ({
      ...prev,
      [memberId]: nextVal,
    }));
  };

  const handleDistributeRemaining = () => {
    triggerNotification(NotificationType.Success);
    const count = splitWithMembers.length;
    if (count === 0) return;

    if (splitType === 'exact') {
      const rem = splitCalculations.remaining;
      const perDelta = Math.round((rem / count) * 100) / 100;
      const nextAmounts: Record<string, string> = { ...customAmounts };
      splitWithMembers.forEach((id, index) => {
        const curr = parseFloat(nextAmounts[id]) || 0;
        const add = index === count - 1 ? rem - perDelta * (count - 1) : perDelta;
        nextAmounts[id] = Math.max(0, Math.round((curr + add) * 100) / 100).toString();
      });
      setCustomAmounts(nextAmounts);
    } else if (splitType === 'percentage') {
      const remPct = Math.round((100 - splitCalculations.totalPct) * 100) / 100;
      const perDeltaPct = Math.floor(remPct / count);
      const nextPcts: Record<string, string> = { ...customPercentages };
      splitWithMembers.forEach((id, index) => {
        const curr = parseFloat(nextPcts[id]) || 0;
        const add = index === count - 1 ? remPct - perDeltaPct * (count - 1) : perDeltaPct;
        nextPcts[id] = Math.max(0, Math.round((curr + add) * 100) / 100).toString();
      });
      setCustomPercentages(nextPcts);
    }
  };

  const handleMemberCheckedChange = (id: string, checked: boolean) => {
    triggerSmoothLayout(280);
    if (checked) {
      if (!splitWithMembers.includes(id)) {
        const next = [...splitWithMembers, id];
        setSplitWithMembers(next);
        if (splitType === 'exact' && !customAmounts[id]) {
          const per = (parsedAmount / next.length).toFixed(2);
          setCustomAmounts((prev) => ({ ...prev, [id]: per }));
        } else if (splitType === 'percentage' && !customPercentages[id]) {
          const perPct = Math.floor(100 / next.length).toString();
          setCustomPercentages((prev) => ({ ...prev, [id]: perPct }));
        } else if (splitType === 'shares' && !customShares[id]) {
          setCustomShares((prev) => ({ ...prev, [id]: 1 }));
        }
      }
    } else if (splitWithMembers.length > 1) {
      setSplitWithMembers(splitWithMembers.filter((m) => m !== id));
    }
  };

  const handleSave = () => {
    const amount = parseFloat(amountStr);
    if (!title.trim() || isNaN(amount) || amount <= 0) return;

    triggerNotification(NotificationType.Success);

    const splits: SplitMemberShare[] = splitWithMembers.map((memberId) => ({
      friendId: memberId,
      amount: splitCalculations.memberAmounts[memberId] ?? Math.round((amount / splitWithMembers.length) * 100) / 100,
      share: splitType === 'shares' ? customShares[memberId] : undefined,
      percentage:
        splitType === 'percentage'
          ? parseFloat(customPercentages[memberId]) || undefined
          : undefined,
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

  const renderParticipantRow = (id: string, name: string) => {
    const inSplit = splitWithMembers.includes(id);
    const assignedAmount = splitCalculations.memberAmounts[id] ?? 0;

    return (
      <View
        key={id}
        style={[
          splitType === 'equal' ? styles.springCheckRow : styles.memberSplitCard,
          { backgroundColor: inputBg },
        ]}
      >
        <SpringCheck
          label={name}
          checked={inSplit}
          onChange={(checked) => handleMemberCheckedChange(id, checked)}
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
              <Text
                style={[
                  styles.memberShareText,
                  {
                    color: splitType === 'equal' ? mutedText : textColor,
                    fontWeight: splitType === 'equal' ? '400' : '600',
                  },
                ]}
              >
                {currSym}{assignedAmount.toFixed(2)}
              </Text>
            ) : null
          }
        />

        <SmoothCollapsible expanded={inSplit && splitType !== 'equal'}>
          {splitType === 'exact' && (
            <View style={styles.dynamicControlsWrap}>
              <View style={styles.exactInputRow}>
                <View style={[styles.exactInputBox, { backgroundColor: cardBg }]}>
                  <Text style={[styles.exactCurrPrefix, { color: mutedText }]}>{currSym}</Text>
                  <TextInput
                    style={[
                      styles.exactTextInput,
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
                    keyboardType="decimal-pad"
                    value={customAmounts[id] ?? ''}
                    placeholder="0.00"
                    placeholderTextColor={mutedText}
                    onChangeText={(txt) => {
                      setCustomAmounts((prev) => ({ ...prev, [id]: txt }));
                    }}
                  />
                </View>

                <View style={styles.marginChipsRow}>
                  {[-50, -10, 10, 50].map((delta) => (
                    <AnimatedPressable
                      key={delta}
                      scaleTo={0.92}
                      onPress={() => handleShiftExact(id, delta)}
                      contentStyle={[styles.marginChip, { backgroundColor: chipBg }]}
                    >
                      <Text style={[styles.marginChipText, { color: textColor }]}>
                        {delta > 0 ? `+${delta}` : `${delta}`}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {splitType === 'percentage' && (
            <View style={styles.dynamicControlsWrap}>
              <View style={styles.exactInputRow}>
                <View style={[styles.exactInputBox, { backgroundColor: cardBg }]}>
                  <TextInput
                    style={[
                      styles.exactTextInput,
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
                    keyboardType="decimal-pad"
                    value={customPercentages[id] ?? ''}
                    placeholder="0"
                    placeholderTextColor={mutedText}
                    onChangeText={(txt) => {
                      setCustomPercentages((prev) => ({ ...prev, [id]: txt }));
                    }}
                  />
                  <Text style={[styles.exactCurrPrefix, { color: mutedText }]}>%</Text>
                </View>

                <View style={styles.marginChipsRow}>
                  {[-10, -5, 5, 10].map((delta) => (
                    <AnimatedPressable
                      key={delta}
                      scaleTo={0.92}
                      onPress={() => handleShiftPercentage(id, delta)}
                      contentStyle={[styles.marginChip, { backgroundColor: chipBg }]}
                    >
                      <Text style={[styles.marginChipText, { color: textColor }]}>
                        {delta > 0 ? `+${delta}%` : `${delta}%`}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {splitType === 'shares' && (
            <View style={styles.dynamicControlsWrap}>
              <View style={styles.sharesRow}>
                <View style={styles.sharesStepperWrap}>
                  <AnimatedPressable
                    scaleTo={0.9}
                    onPress={() => handleShiftShare(id, -1)}
                    contentStyle={[styles.shareStepBtn, { backgroundColor: chipBg }]}
                  >
                    <Text style={[styles.shareStepBtnText, { color: textColor }]}>−</Text>
                  </AnimatedPressable>
                  <View style={[styles.shareCountBox, { backgroundColor: cardBg }]}>
                    <Text style={[styles.shareCountText, { color: textColor }]}>
                      {customShares[id] ?? 1} {(customShares[id] ?? 1) === 1 ? 'share' : 'shares'}
                    </Text>
                  </View>
                  <AnimatedPressable
                    scaleTo={0.9}
                    onPress={() => handleShiftShare(id, 1)}
                    contentStyle={[styles.shareStepBtn, { backgroundColor: chipBg }]}
                  >
                    <Text style={[styles.shareStepBtnText, { color: textColor }]}>+</Text>
                  </AnimatedPressable>
                </View>

                <Text style={[styles.computedShareText, { color: mutedText }]}>
                  = {currSym}{assignedAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </SmoothCollapsible>
      </View>
    );
  };

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
              <Text style={[styles.title, { color: textColor }]}>Add & Split Expense</Text>
              <Text style={[styles.subtitleText, { color: mutedText }]}>
                {splitType === 'equal'
                  ? 'Instant equal split across selected people'
                  : splitType === 'exact'
                  ? 'Dynamic exact split with custom margin shifting'
                  : splitType === 'percentage'
                  ? 'Dynamic percentage split by custom ratio'
                  : 'Dynamic share-based expense split'}
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
                <View style={styles.catActionsRow}>
                  {category ? (
                    <AnimatedPressable
                      scaleTo={0.94}
                      onPress={() => {
                        const match = categories.find(
                          (c) => c.name.toLowerCase() === category.toLowerCase()
                        );
                        if (match) {
                          setCategoryToEdit(match);
                          setShowAddCategory(true);
                        }
                      }}
                      accessibilityLabel="Edit category"
                      contentStyle={[styles.newCategoryMiniBtn, { backgroundColor: chipBg }]}
                    >
                      <Pen2Icon size={12} color={textColor} />
                      <Text style={[styles.newCategoryMiniText, { color: textColor }]}>
                        Edit
                      </Text>
                    </AnimatedPressable>
                  ) : null}
                  <AnimatedPressable
                    scaleTo={0.94}
                    onPress={() => {
                      setCategoryToEdit(null);
                      setShowAddCategory(true);
                    }}
                    contentStyle={[styles.newCategoryMiniBtn, { backgroundColor: chipBg }]}
                  >
                    <AddCircleIcon size={13} color={textColor} />
                    <Text style={[styles.newCategoryMiniText, { color: textColor }]}>
                      New Category
                    </Text>
                  </AnimatedPressable>
                </View>
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
                    accessibilityLabel="Clear location"
                  >
                    <CloseCircleIcon size={14} color={mutedText} />
                  </AnimatedPressable>
                )}
                <AnimatedPressable
                  scaleTo={0.88}
                  onPress={handleAutoLocate}
                  disabled={isLocating}
                  contentStyle={styles.locateBtn}
                  accessibilityLabel="Auto-detect current location"
                >
                  {isLocating ? (
                    <ActivityIndicator
                      size="small"
                      color={isDark ? '#60A5FA' : '#2563EB'}
                      style={{ transform: [{ scale: 0.75 }] }}
                    />
                  ) : (
                    <LocateFixed size={16} color={isDark ? '#60A5FA' : '#2563EB'} />
                  )}
                </AnimatedPressable>
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
                      {splitType === 'equal'
                        ? parsedAmount > 0
                          ? `${currSym}${perPersonShare.toFixed(2)} / person`
                          : 'Equal Split'
                        : splitType === 'exact'
                        ? `${currSym}${splitCalculations.allocated.toFixed(2)} allocated`
                        : splitType === 'percentage'
                        ? `${splitCalculations.totalPct}% allocated`
                        : `${splitCalculations.totalShares} total shares`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Split Method Segmented Radio */}
              <View style={styles.splitMethodWrap}>
                <Text style={[styles.fieldLabel, { color: mutedText, marginBottom: 8 }]}>
                  SPLIT METHOD
                </Text>
                <JellyRadio
                  items={splitTypeItems}
                  value={splitType}
                  onChange={handleSplitTypeChange}
                  chipColor={chipBg}
                  activeColor={activeBg}
                  textColor={textColor}
                  activeTextColor={activeText}
                  size="sm"
                  gap={6}
                  radius={999}
                />
              </View>

              {/* Dynamic Allocation & Balance Indicator */}
              <SmoothCollapsible expanded={splitType !== 'equal'}>
                <View style={[styles.balanceCard, { backgroundColor: inputBg }]}>
                  <View style={styles.balanceHeaderRow}>
                    <View style={styles.balanceHeaderLeft}>
                      <Text style={[styles.balanceSmallLabel, { color: mutedText }]}>
                        {splitType === 'exact'
                          ? 'TOTAL ALLOCATED'
                          : splitType === 'percentage'
                          ? 'PERCENTAGE SPLIT'
                          : 'TOTAL SHARES'}
                      </Text>
                      <Text style={[styles.balanceTotalText, { color: textColor }]}>
                        {currSym}{splitCalculations.allocated.toFixed(2)} / {currSym}{parsedAmount.toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.balanceStatusPill,
                        {
                          backgroundColor: splitCalculations.isBalanced
                            ? 'rgba(16, 185, 129, 0.16)'
                            : splitCalculations.remaining > 0
                            ? 'rgba(245, 158, 11, 0.16)'
                            : 'rgba(239, 68, 68, 0.16)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.balanceStatusText,
                          {
                            color: splitCalculations.isBalanced
                              ? '#10B981'
                              : splitCalculations.remaining > 0
                              ? '#F59E0B'
                              : '#EF4444',
                          },
                        ]}
                      >
                        {splitCalculations.isBalanced
                          ? '✓ Balanced'
                          : splitCalculations.remaining > 0
                          ? `${currSym}${splitCalculations.remaining.toFixed(2)} left`
                          : `${currSym}${Math.abs(splitCalculations.remaining).toFixed(2)} over`}
                      </Text>
                    </View>
                  </View>

                  {!splitCalculations.isBalanced && splitCalculations.remaining !== 0 && (
                    <AnimatedPressable
                      scaleTo={0.96}
                      onPress={handleDistributeRemaining}
                      contentStyle={[styles.distributeBtn, { backgroundColor: activeBg }]}
                    >
                      <Text style={[styles.distributeBtnText, { color: activeText }]}>
                        {splitCalculations.remaining > 0
                          ? `Distribute Remaining ${currSym}${splitCalculations.remaining.toFixed(2)} Evenly`
                          : `Auto-Balance ${currSym}${Math.abs(splitCalculations.remaining).toFixed(2)} Difference`}
                      </Text>
                    </AnimatedPressable>
                  )}
                </View>
              </SmoothCollapsible>

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
                {showUserFiltered && renderParticipantRow('user', 'You')}

                {visibleScopedFriends.map((f) => renderParticipantRow(f.id, f.name))}

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
        key={categoryToEdit ? `edit-${categoryToEdit.id}` : 'new-cat'}
        visible={showAddCategory}
        categoryToEdit={categoryToEdit}
        onClose={() => {
          setShowAddCategory(false);
          setCategoryToEdit(null);
        }}
        onCreated={(created) => setCategory(created.name)}
        onUpdated={(updated) => setCategory(updated.name)}
        onDeleted={() => setCategory(categories[0]?.name || 'Food & Drinks')}
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
  locateBtn: {
    padding: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  catActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitMethodWrap: {
    marginTop: 4,
    marginBottom: 12,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceHeaderLeft: {
    gap: 2,
  },
  balanceSmallLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
  },
  balanceTotalText: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  balanceStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  distributeBtn: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  distributeBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  memberSplitCard: {
    borderRadius: 16,
    padding: 12,
    gap: 6,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)' } as any)
      : {}),
  },
  dynamicControlsWrap: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  exactInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  exactInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    height: 34,
  },
  exactCurrPrefix: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
  },
  exactTextInput: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 55,
    paddingVertical: 0,
  },
  marginChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  marginChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  marginChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  computedShareText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sharesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sharesStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareStepBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
  shareCountBox: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
