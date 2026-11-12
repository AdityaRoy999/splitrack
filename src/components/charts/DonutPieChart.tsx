import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CalendarDateIcon } from '@solar-icons/react-native/bold/calendar-date';
import { triggerSelection } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassCard } from '../glass/GlassCard';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { JellyRadio } from '../common/JellyRadio';
import {
  CalendarDatePickerModal,
  formatDisplayDate,
  getTodayLocalISO,
} from '../common/CalendarDatePickerModal';
import {
  shiftIsoDate,
  useDateMonthSwipeGesture,
} from '../../hooks/useDateMonthSwipeGesture';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type DistributionGranularity = 'All' | 'Date' | 'Month' | 'Year';

const SEGMENT_COLORS = [
  '#E2F163',
  '#89F5A2',
  '#C482FA',
  '#64748B',
  '#65D8F7',
  '#FFA06B',
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DonutPieChart: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const { categoryMetrics, transactions } = useSplitTrack();
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [granularity, setGranularity] = useState<DistributionGranularity>('All');
  const [selectedDate, setSelectedDate] = useState<string | null>(() => getTodayLocalISO());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [showCalendar, setShowCalendar] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sweepProgress, setSweepProgress] = useState<number>(() =>
    typeof requestAnimationFrame !== 'undefined' ? 0 : 1
  );
  const [entranceAnim] = useState(() => new Animated.Value(0));
  const lastGlidedSegRef = useRef<string | null>(null);

  const stepDay = useCallback(
    (delta: -1 | 1) => {
      const base = selectedDate || getTodayLocalISO();
      const nextIso = shiftIsoDate(base, delta);
      const [yStr, mStr] = nextIso.split('-');
      setSelectedId(null);
      setSelectedDate(nextIso);
      setSelectedYear(Number(yStr) || selectedYear);
      setSelectedMonth(Math.max(0, Math.min(11, (Number(mStr) || 1) - 1)));
      setGranularity('Date');
    },
    [selectedDate, selectedYear]
  );

  const stepMonth = useCallback(
    (delta: -1 | 1) => {
      let nextMonth = selectedMonth + delta;
      let nextYear = selectedYear;
      if (nextMonth < 0) {
        nextMonth = 11;
        nextYear -= 1;
      } else if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      setSelectedId(null);
      setSelectedMonth(nextMonth);
      setSelectedYear(nextYear);
      setGranularity('Month');
    },
    [selectedMonth, selectedYear]
  );

  const { gestureHandlers, isMonthHoldReady } = useDateMonthSwipeGesture({
    onStepDay: stepDay,
    onStepMonth: stepMonth,
  });

  const filteredMetrics = useMemo(() => {
    if (granularity === 'All') {
      return categoryMetrics;
    }

    const matchingExpenses = transactions.filter((tx) => {
      if (tx.amount >= 0 || tx.type !== 'expense') return false;
      const [yStr, mStr] = tx.date.split('-');
      const txYear = Number(yStr);
      const txMonthIdx = (Number(mStr) || 1) - 1;

      if (granularity === 'Date') {
        return !selectedDate || tx.date === selectedDate;
      }
      if (granularity === 'Month') {
        return txYear === selectedYear && txMonthIdx === selectedMonth;
      }
      return txYear === selectedYear;
    });

    if (matchingExpenses.length === 0) return [];

    const byCat = new Map<string, number>();
    matchingExpenses.forEach((tx) => {
      byCat.set(tx.category, (byCat.get(tx.category) || 0) + Math.abs(tx.amount));
    });

    const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
    return Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([catName, amount], idx) => ({
        id: `filtered-${catName}-${idx}`,
        name: catName,
        percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
        amount,
        color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
        icon: 'Tag',
        size: 80,
        x: 50,
        y: 50,
      }));
  }, [granularity, selectedDate, selectedMonth, selectedYear, transactions, categoryMetrics]);

  useEffect(() => {
    let rafId = 0;
    const duration = 560;
    let startTime: number | null = null;

    entranceAnim.setValue(0);
    Animated.spring(entranceAnim, {
      toValue: 1,
      friction: 8,
      tension: 65,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    const tick = (now: number) => {
      if (startTime === null) {
        startTime = now;
      }
      const elapsed = now - startTime;
      const raw = Math.min(1, Math.max(0, elapsed / duration));
      const eased = 1 - Math.pow(1 - raw, 3);
      setSweepProgress(eased);
      if (raw < 1 && typeof requestAnimationFrame !== 'undefined') {
        rafId = requestAnimationFrame(tick);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [granularity, selectedDate, selectedMonth, selectedYear, entranceAnim]);

  const totalAmount = filteredMetrics.reduce((sum, item) => sum + item.amount, 0);
  const activeId = hoveredId ?? selectedId;
  const selectedItem = filteredMetrics.find((c) => c.id === activeId) || null;
  const selectedColor = selectedItem
    ? SEGMENT_COLORS[
        Math.max(
          0,
          filteredMetrics.findIndex((c) => c.id === selectedItem.id)
        ) % SEGMENT_COLORS.length
      ]
    : null;

  const size = Math.min(windowWidth - 108, 192);
  const strokeWidth = 17;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Round caps add strokeWidth total (strokeWidth/2 on each end).
  // Adding +9px margin guarantees >=6px visual separation even when an arc is selected (+3px strokeWidth).
  const count = filteredMetrics.length;
  const gap = count > 1 ? strokeWidth + 9 : 0;
  const availableCircumference = Math.max(count * 3, circumference - count * gap);
  const minSegLen = count > 1 ? Math.min(4.5, availableCircumference / (count * 2.5)) : availableCircumference;

  // Allocate exact non-overlapping segment lengths whose sum === availableCircumference.
  const segments = useMemo(() => {
    if (count === 0) return [];
    const rawLengths = filteredMetrics.map((cat) => {
      const fraction = totalAmount > 0 ? cat.amount / totalAmount : 1 / count;
      return fraction * availableCircumference;
    });

    const isSmall = rawLengths.map((len) => len < minSegLen);
    const lockedTotal = isSmall.reduce((acc, small) => (small ? acc + minSegLen : acc), 0);
    const largeRawTotal = rawLengths.reduce(
      (acc, len, i) => (isSmall[i] ? acc : acc + len),
      0
    );
    const remainingBudget = Math.max(0, availableCircumference - lockedTotal);

    const normalizedLengths = rawLengths.map((len, i) => {
      if (isSmall[i]) return minSegLen;
      if (largeRawTotal <= 0) return remainingBudget / count;
      return (len / largeRawTotal) * remainingBudget;
    });

    let runningOffset = 0;
    return filteredMetrics.map((cat, index) => {
      const segLen = normalizedLengths[index];
      const offset = runningOffset;
      runningOffset += segLen + gap;
      const fraction = totalAmount > 0 ? cat.amount / totalAmount : 1 / count;
      return {
        ...cat,
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
        segmentLength: segLen,
        offset,
        pct: Math.round(fraction * 100),
      };
    });
  }, [availableCircumference, count, filteredMetrics, gap, minSegLen, totalAmount]);

  const handleSelect = (id: string) => {
    triggerSelection();
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const findSegmentAtRingPoint = useCallback(
    (lx: number, ly: number): string | null => {
      if (segments.length === 0) return null;
      const cx = size / 2;
      const cy = size / 2;
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius - strokeWidth * 1.15 || dist > radius + strokeWidth * 1.15) {
        return null;
      }
      // Ring starts rotated -90deg (12 o'clock) and sweeps clockwise.
      const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
      const arcPos = (angleDeg / 360) * circumference;
      const halfGap = gap / 2;
      const matched = segments.find(
        (seg) => arcPos >= seg.offset - halfGap && arcPos <= seg.offset + seg.segmentLength + halfGap
      );
      return matched?.id || null;
    },
    [circumference, gap, radius, segments, size, strokeWidth]
  );

  const handleRingWebMove = useCallback(
    (e: any) => {
      const target = e?.currentTarget;
      const clientX =
        typeof e?.clientX === 'number'
          ? e.clientX
          : typeof e?.nativeEvent?.clientX === 'number'
            ? e.nativeEvent.clientX
            : null;
      const clientY =
        typeof e?.clientY === 'number'
          ? e.clientY
          : typeof e?.nativeEvent?.clientY === 'number'
            ? e.nativeEvent.clientY
            : null;
      if (
        target &&
        typeof target.getBoundingClientRect === 'function' &&
        clientX !== null &&
        clientY !== null
      ) {
        const rect = target.getBoundingClientRect();
        const segId = findSegmentAtRingPoint(clientX - rect.left, clientY - rect.top);
        if (segId !== lastGlidedSegRef.current) {
          lastGlidedSegRef.current = segId;
          if (segId) triggerSelection();
        }
        setHoveredId(segId);
      }
    },
    [findSegmentAtRingPoint]
  );

  const selectedSegment = segments.find((s) => s.id === activeId);
  const centerDisplay = selectedSegment
    ? formatAmount(selectedSegment.amount)
    : formatAmount(totalAmount);
  const centerLabel = selectedSegment
    ? selectedSegment.name.split(' ')[0]
    : granularity === 'All'
      ? 'Total Spend'
      : granularity === 'Date'
        ? selectedDate
          ? formatDisplayDate(selectedDate, true)
          : 'All Dates'
        : granularity === 'Month'
          ? `${MONTH_NAMES_SHORT[selectedMonth]} ${selectedYear}`
          : String(selectedYear);

  const activePeriodLabel =
    granularity === 'All'
      ? 'All time'
      : granularity === 'Date'
        ? selectedDate
          ? formatDisplayDate(selectedDate, true)
          : 'All Dates'
        : granularity === 'Month'
          ? `${MONTH_NAMES_SHORT[selectedMonth]} ${selectedYear}`
          : `Year ${selectedYear}`;

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const surfacePill = isDark ? '#1B1B20' : '#F3F4F6';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';

  const animatedScale = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const currentSweepLength = sweepProgress * circumference;

  return (
    <GlassCard borderRadius={24} style={styles.card}>
      <View style={styles.container} {...gestureHandlers}>
        {/* Top Summary Bar */}
        <View style={styles.topRow}>
          <Text style={[styles.topLabel, { color: mutedText }]}>
            Category distribution
          </Text>
          <AnimatedPressable
            scaleTo={0.94}
            disabled={!selectedSegment}
            onPress={() => selectedSegment && handleSelect(selectedSegment.id)}
            contentStyle={[
              styles.shareBadge,
              {
                backgroundColor:
                  selectedSegment && selectedColor
                    ? `${selectedColor}26`
                    : surfacePill,
              },
            ]}
          >
            <Text
              style={[
                styles.shareBadgeText,
                {
                  color:
                    selectedSegment && selectedColor ? textColor : mutedText,
                },
              ]}
            >
              {selectedSegment
                ? `${selectedSegment.pct}% share • Clear`
                : `${segments.length} ${segments.length === 1 ? 'category' : 'categories'}`}
            </Text>
          </AnimatedPressable>
        </View>

        {/* Inline Calendar Icon Button + Granularity JellyRadio */}
        <View style={styles.filterSection}>
          <View style={styles.filterInlineRow}>
            <AnimatedPressable
              scaleTo={0.92}
              onPress={() => setShowCalendar(true)}
              accessibilityLabel="Open calendar date picker for category distribution"
              contentStyle={[
                styles.calendarIconBtn,
                {
                  backgroundColor:
                    granularity === 'Date' && selectedDate ? activeBg : surfacePill,
                },
              ]}
            >
              <CalendarDateIcon
                size={15}
                color={
                  granularity === 'Date' && selectedDate ? activeText : textColor
                }
              />
            </AnimatedPressable>

            <JellyRadio
              items={['All', 'Date', 'Month', 'Year']}
              value={granularity}
              onChange={(val) => {
                setSelectedId(null);
                setGranularity(val as DistributionGranularity);
              }}
              chipColor={surfacePill}
              activeColor={activeBg}
              textColor={mutedText}
              activeTextColor={activeText}
              size="sm"
              gap={4}
              radius={999}
              swell={0.16}
              barge={4}
            />
          </View>

          <View
            style={[
              styles.gestureHintPill,
              {
                backgroundColor: isMonthHoldReady
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(16, 185, 129, 0.14)'
                  : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.gestureHintText,
                { color: isMonthHoldReady ? '#10B981' : mutedText },
              ]}
            >
              {isMonthHoldReady ? 'Month Mode Ready • Swipe Left/Right' : activePeriodLabel}
            </Text>
          </View>
        </View>

        {segments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: mutedText }]}>
              No expenses recorded for {centerLabel}.
            </Text>
            <AnimatedPressable
              scaleTo={0.95}
              onPress={() => {
                setSelectedId(null);
                setGranularity('All');
              }}
              contentStyle={[styles.periodPill, { backgroundColor: surfacePill, marginTop: 10 }]}
            >
              <Text style={[styles.periodPillText, { color: textColor }]}>Show All Spend</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            {/* Animated Non-Overlapping Donut Ring */}
            <Animated.View
              style={[
                styles.chartWrapper,
                {
                  opacity: entranceAnim,
                  transform: [{ scale: animatedScale }],
                },
              ]}
            >
              <View
                style={{ width: size, height: size, position: 'relative' }}
                onStartShouldSetResponder={(e: GestureResponderEvent) =>
                  findSegmentAtRingPoint(e.nativeEvent.locationX, e.nativeEvent.locationY) !== null
                }
                onMoveShouldSetResponder={(e: GestureResponderEvent) =>
                  findSegmentAtRingPoint(e.nativeEvent.locationX, e.nativeEvent.locationY) !== null
                }
                onResponderTerminationRequest={() => false}
                onResponderGrant={(e: GestureResponderEvent) => {
                  const segId = findSegmentAtRingPoint(
                    e.nativeEvent.locationX,
                    e.nativeEvent.locationY
                  );
                  if (segId) {
                    e.stopPropagation?.();
                    if (segId !== lastGlidedSegRef.current) {
                      lastGlidedSegRef.current = segId;
                      triggerSelection();
                    }
                    setSelectedId(segId);
                  }
                }}
                onResponderMove={(e: GestureResponderEvent) => {
                  const segId = findSegmentAtRingPoint(
                    e.nativeEvent.locationX,
                    e.nativeEvent.locationY
                  );
                  if (segId) {
                    e.stopPropagation?.();
                    if (segId !== lastGlidedSegRef.current) {
                      lastGlidedSegRef.current = segId;
                      triggerSelection();
                    }
                    setSelectedId(segId);
                  }
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onPointerMove: handleRingWebMove,
                      onMouseMove: handleRingWebMove,
                      onMouseLeave: () => {
                        lastGlidedSegRef.current = null;
                        setHoveredId(null);
                      },
                      onClick: (e: any) => {
                        const target = e?.currentTarget;
                        if (target && typeof target.getBoundingClientRect === 'function') {
                          const rect = target.getBoundingClientRect();
                          const segId = findSegmentAtRingPoint(
                            e.clientX - rect.left,
                            e.clientY - rect.top
                          );
                          if (segId) handleSelect(segId);
                        }
                      },
                    } as any)
                  : {})}
              >
                <View pointerEvents="none" style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {segments.map((seg) => {
                      const isSelected = activeId === seg.id;
                      const availableInArc = currentSweepLength - seg.offset;
                      if (availableInArc <= 0.4) return null;

                      const visibleLen = Math.min(seg.segmentLength, availableInArc);
                      const activeStrokeWidth = isSelected
                        ? strokeWidth + 3
                        : strokeWidth;

                      return (
                        <Circle
                          key={seg.id}
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          stroke={seg.color}
                          strokeWidth={activeStrokeWidth}
                          strokeDasharray={
                            segments.length === 1 && sweepProgress >= 0.999
                              ? undefined
                              : `${visibleLen} ${Math.max(1, circumference - visibleLen)}`
                          }
                          strokeDashoffset={-seg.offset}
                          strokeLinecap={segments.length === 1 ? 'butt' : 'round'}
                          fill="none"
                          opacity={activeId && !isSelected ? 0.28 : 1}
                        />
                      );
                    })}
                  </Svg>
                </View>
              </View>

              {/* Center Focus Readout */}
              <AnimatedPressable
                scaleTo={0.96}
                disabled={!selectedSegment}
                onPress={() => {
                  setHoveredId(null);
                  if (selectedId) setSelectedId(null);
                }}
                style={styles.centerTouchable}
                contentStyle={styles.centerContainer}
              >
                <Text style={[styles.centerCaption, { color: mutedText }]}>
                  {selectedSegment ? `${selectedSegment.pct}% OF SPEND` : 'TOTAL SPEND'}
                </Text>
                <Text style={[styles.centerAmount, { color: textColor }]}>
                  {centerDisplay}
                </Text>
                <Text style={[styles.centerLabel, { color: mutedText }]} numberOfLines={1}>
                  {centerLabel}
                </Text>
              </AnimatedPressable>
            </Animated.View>

            {/* Interactive Legend Chips */}
            <View style={styles.legendGrid}>
              {segments.map((seg) => {
                const isSelected = activeId === seg.id;
                return (
                  <AnimatedPressable
                    key={seg.id}
                    scaleTo={0.94}
                    onPress={() => handleSelect(seg.id)}
                    onHoverIn={() => {
                      if (seg.id !== lastGlidedSegRef.current) {
                        lastGlidedSegRef.current = seg.id;
                        triggerSelection();
                      }
                      setHoveredId(seg.id);
                    }}
                    onHoverOut={() => {
                      lastGlidedSegRef.current = null;
                      setHoveredId(null);
                    }}
                    contentStyle={[
                      styles.legendChip,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#27272E'
                            : '#E5E7EB'
                          : isDark
                            ? '#18181D'
                            : '#F3F4F6',
                        opacity: activeId && !isSelected ? 0.58 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: seg.color }]} />
                    <Text
                      style={[
                        styles.legendName,
                        { color: isDark ? '#E4E4E7' : '#374151' },
                      ]}
                    >
                      {seg.name.split(' ')[0]}
                    </Text>
                    <Text style={[styles.legendPct, { color: mutedText }]}>
                      {seg.pct}%
                    </Text>
                    <Text style={[styles.legendAmount, { color: textColor }]}>
                      {formatAmount(seg.amount)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <CalendarDatePickerModal
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelectDate={(iso) => {
          setSelectedId(null);
          setSelectedDate(iso);
          if (iso) {
            const [yStr, mStr] = iso.split('-');
            const y = Number(yStr);
            const m = (Number(mStr) || 1) - 1;
            if (!isNaN(y)) setSelectedYear(y);
            if (!isNaN(m) && m >= 0 && m <= 11) setSelectedMonth(m);
            setGranularity('Date');
          }
        }}
        onClose={() => setShowCalendar(false)}
        markedDates={transactions.map((t) => t.date)}
        allowClear={true}
        title="Category Breakdown Date"
      />
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 18,
    marginVertical: 6,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  shareBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 0,
  },
  shareBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  filterSection: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  filterInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  calendarIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  gestureHintPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gestureHintText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: '400',
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTouchable: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  centerCaption: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  centerAmount: {
    fontSize: 25,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  centerLabel: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    maxWidth: 120,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 2,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 6,
    borderWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '400',
  },
  legendPct: {
    fontSize: 11,
    fontWeight: '400',
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DonutPieChart;
