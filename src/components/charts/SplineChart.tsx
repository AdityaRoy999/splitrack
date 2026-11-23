import { GlassTouchable as TouchableOpacity } from '../common/GlassTouchable';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import Reanimated, { Easing, FadeIn, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
import { useChartTransition } from '../../hooks/useChartTransition';
import { useAnalytics } from '../../hooks/useAnalytics';
import { FormError } from '../../hooks/useAsyncAction';
import { COMPACT_ICON_BUTTON_STYLE, COMPACT_BUTTON_HIT_SLOP } from '../../constants/buttonSizes';


type CashFlowGranularity = 'Date' | 'Month' | 'Year';

interface TrajectoryPoint {
  key: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
}

interface PointCoord {
  x: number;
  y: number;
}

const MONTH_SHORT = [
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

const AnimatedLine = Reanimated.createAnimatedComponent(Line);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const CURSOR_TIMING = { duration: 160, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const READOUT_ENTER = FadeIn.duration(140).reduceMotion(ReduceMotion.System);

function computeSmoothCurve(points: PointCoord[]): {
  path: string;
} {
  if (points.length === 0) return { path: '' };
  if (points.length === 1) {
    return { path: `M ${points[0].x} ${points[0].y}` };
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cp1x = p1.x + (p2.x - p1.x) * 0.45;
    const cp1y = p1.y;
    const cp2x = p1.x + (p2.x - p1.x) * 0.55;
    const cp2y = p2.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;

  }

  return { path };
}

export const SplineChart: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const { chartData, transactions } = useSplitTrack();
  const { themeMode, formatAmount } = useLiquidGlass();

  const [granularity, setGranularity] = useState<CashFlowGranularity>('Month');
  const [requestedGranularity, setRequestedGranularity] = useState<CashFlowGranularity>('Month');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [plotBoxWidth, setPlotBoxWidth] = useState<number>(() =>
    Math.max(240, Math.min(windowWidth - 64, 416))
  );
  const analytics = useAnalytics('Date', selectedYear, selectedMonth, selectedDate, granularity === 'Date');
  const { runChartTransition, opacity: swipeOpacity, translateX: swipeX, revision } = useChartTransition(!analytics.loading);

  const isDark = themeMode === 'dark';
  const width = plotBoxWidth;
  const height = 154;
  const paddingHorizontal = 22;
  const paddingTop = 34;
  const paddingBottom = 26;

  const stepDay = useCallback(
    (delta: -1 | 1) => {
      setRequestedGranularity('Date');
      runChartTransition(delta, () => {
        const base = selectedDate || getTodayLocalISO();
        const nextIso = shiftIsoDate(base, delta);
        const [yStr, mStr] = nextIso.split('-');
        setSelectedIndex(null);
        setSelectedDate(nextIso);
        setSelectedYear(Number(yStr) || selectedYear);
        setSelectedMonth(Math.max(0, Math.min(11, (Number(mStr) || 1) - 1)));
        setGranularity('Date');
      });
    },
    [runChartTransition, selectedDate, selectedYear]
  );

  const stepMonth = useCallback(
    (delta: -1 | 1) => {
      setRequestedGranularity('Month');
      runChartTransition(delta, () => {
        let nextMonth = selectedMonth + delta;
        let nextYear = selectedYear;
        if (nextMonth < 0) {
          nextMonth = 11;
          nextYear -= 1;
        } else if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
        setSelectedIndex(null);
        setSelectedMonth(nextMonth);
        setSelectedYear(nextYear);
        setGranularity('Month');
      });
    },
    [runChartTransition, selectedMonth, selectedYear]
  );

  const { gestureHandlers, isMonthHoldReady, dragAnim } = useDateMonthSwipeGesture({
    onStepDay: stepDay,
    onStepMonth: stepMonth,
    preserveDragOnCommit: true,
  });

  useLayoutEffect(() => {
    dragAnim.stopAnimation();
    dragAnim.setValue(0);
  }, [revision, dragAnim]);

  const combinedTranslateX = useMemo(
    () => Animated.add(dragAnim, swipeX),
    [dragAnim, swipeX]
  );

  const pointsData = useMemo<TrajectoryPoint[]>(() => {
    if (granularity === 'Date') return selectedDate ? analytics.data?.points ?? [] : (analytics.data?.points ?? []).slice(-7);
    if (granularity === 'Year') {
      const years = new Map<string, { income: number; expense: number }>();
      for (const point of chartData) {
        const year = point.date.slice(0, 4), total = years.get(year) ?? { income: 0, expense: 0 };
        total.income += point.income; total.expense += point.expense; years.set(year, total);
      }
      return [...years].sort(([a], [b]) => a.localeCompare(b)).map(([year, total]) => ({ key: year, label: year, fullLabel: 'Year ' + year, ...total }));
    }
    const months = new Map(chartData.map(point => [point.date.slice(0, 7), point]));
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(selectedYear, selectedMonth - 5 + i, 1);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const total = months.get(key);
      return { key, label: MONTH_SHORT[date.getMonth()], fullLabel: MONTH_SHORT[date.getMonth()] + ' ' + date.getFullYear(), income: total?.income ?? 0, expense: total?.expense ?? 0 };
    });
  }, [granularity, selectedDate, selectedMonth, selectedYear, chartData, analytics.data]);

  const defaultIndex = Math.max(0, pointsData.length - 1);
  const safeIndex =
    selectedIndex === null
      ? defaultIndex
      : Math.max(0, Math.min(selectedIndex, Math.max(0, pointsData.length - 1)));
  const activePoint = pointsData[safeIndex];

  const lastScrubIdxRef = useRef<number>(safeIndex);
  useEffect(() => {
    lastScrubIdxRef.current = safeIndex;
  }, [safeIndex]);

  const handleSelectPoint = useCallback((idx: number) => {
    if (idx === lastScrubIdxRef.current) return;
    lastScrubIdxRef.current = idx;
    triggerSelection();
    setSelectedIndex(idx);
  }, []);

  const scrubAtX = useCallback(
    (localX: number) => {
      if (pointsData.length <= 1) {
        if (pointsData.length === 1) handleSelectPoint(0);
        return;
      }
      const plotWidth = Math.max(40, width - paddingHorizontal * 2);
      const ratio = Math.min(1, Math.max(0, (localX - paddingHorizontal) / plotWidth));
      const nearestIdx = Math.round(ratio * (pointsData.length - 1));
      handleSelectPoint(nearestIdx);
    },
    [handleSelectPoint, paddingHorizontal, pointsData.length, width]
  );

  const handleWebGlide = useCallback(
    (e: any) => {
      const target = e?.currentTarget;
      const clientX =
        typeof e?.clientX === 'number'
          ? e.clientX
          : typeof e?.nativeEvent?.clientX === 'number'
            ? e.nativeEvent.clientX
            : null;
      if (target && typeof target.getBoundingClientRect === 'function' && clientX !== null) {
        const rect = target.getBoundingClientRect();
        scrubAtX(clientX - rect.left);
        return;
      }
      const locX = e?.nativeEvent?.locationX ?? e?.nativeEvent?.offsetX;
      if (typeof locX === 'number') {
        scrubAtX(locX);
      }
    },
    [scrubAtX]
  );

  const { expenseCoords, incomeCurve, expenseCurve, incomeArea } = useMemo(() => {
    const maxVal = Math.max(
      50,
      ...pointsData.map((d) => Math.max(d.income, d.expense))
    );

    const getCoordinates = (val: number, index: number, total: number): PointCoord => {
      const plotWidth = Math.max(40, width - paddingHorizontal * 2);
      const stepX = total > 1 ? plotWidth / (total - 1) : 0;
      const x =
        total > 1 ? paddingHorizontal + index * stepX : paddingHorizontal + plotWidth / 2;
      const plotHeight = height - paddingTop - paddingBottom;
      const ratio = val / (maxVal * 1.15);
      const y = paddingTop + plotHeight * (1 - Math.min(1, Math.max(0, ratio)));
      return { x, y };
    };

    const incomeCoords = pointsData.map((d, i) =>
      getCoordinates(d.income, i, pointsData.length)
    );
    const expenseCoords = pointsData.map((d, i) =>
      getCoordinates(d.expense, i, pointsData.length)
    );

    const incomeCurve = computeSmoothCurve(incomeCoords);
    const expenseCurve = computeSmoothCurve(expenseCoords);
    const incomeArea =
      incomeCoords.length >= 2
        ? `${incomeCurve.path} L ${incomeCoords[incomeCoords.length - 1].x} ${height - paddingBottom} L ${incomeCoords[0].x} ${height - paddingBottom} Z`
        : '';

    return { expenseCoords, incomeCurve, expenseCurve, incomeArea };
  }, [pointsData, width, height, paddingHorizontal, paddingTop, paddingBottom]);

  const activeExpenseCoord =
    expenseCoords[safeIndex] || { x: width / 2, y: height / 2 };
  const cursorX = useSharedValue(activeExpenseCoord.x);
  const cursorY = useSharedValue(activeExpenseCoord.y);
  useLayoutEffect(() => {
    cursorX.set(withTiming(activeExpenseCoord.x, CURSOR_TIMING));
    cursorY.set(withTiming(activeExpenseCoord.y, CURSOR_TIMING));
  }, [activeExpenseCoord.x, activeExpenseCoord.y, cursorX, cursorY]);
  const cursorLineProps = useAnimatedProps(() => ({ x1: cursorX.get(), x2: cursorX.get() }));
  const cursorDotProps = useAnimatedProps(() => ({ cx: cursorX.get(), cy: cursorY.get() }));
  const tooltipMotion = useAnimatedStyle(() => ({ transform: [
    { translateX: Math.max(10, Math.min(width - 108, cursorX.get() - 48)) },
    { translateY: Math.max(0, cursorY.get() - 48) },
  ] }));

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const surfacePill = isDark ? '#18181D' : '#F3F4F6';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';

  const activeScopeSubtitle = isMonthHoldReady
    ? 'Month Mode Ready • Swipe ↔'
    : granularity === 'Date'
      ? selectedDate
        ? formatDisplayDate(selectedDate, true)
        : 'All Dates'
      : granularity === 'Month'
        ? `${MONTH_SHORT[selectedMonth]} ${selectedYear}`
        : 'Multi-Year';

  return (
    <GlassCard borderRadius={24} intensity={20} style={styles.card}>
      <View>
      <FormError message={analytics.error} />
        {/* Header with Stats on left + Calendar Button & Date/Month/Year Selector on right */}
        <View style={styles.header} {...gestureHandlers}>
          <View style={styles.headerLeft}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.statSublabel, { color: isDark ? '#FFFFFF' : '#18181B' }]}
            >
              {activePoint ? `${formatAmount(activePoint.income)} Income` : `${formatAmount(0)} Income`}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.statSublabelExpense, { color: mutedText }]}
            >
              {activePoint ? `${formatAmount(activePoint.expense)} Expenses` : `${formatAmount(0)} Expenses`}
            </Text>
          </View>

          <View style={styles.headerRightControls}>
            <AnimatedPressable
              scaleTo={0.92}
              onPress={() => setShowCalendar(true)}
              accessibilityLabel="Open calendar date picker for cash flow"
              hitSlop={COMPACT_BUTTON_HIT_SLOP}
              contentStyle={[
                styles.calendarIconBtn,
                {
                  backgroundColor:
                    granularity === 'Date' && selectedDate ? activeBg : surfacePill,
                },
              ]}
            >
              <CalendarDateIcon
                size={14}
                color={
                  granularity === 'Date' && selectedDate ? activeText : textColor
                }
              />
            </AnimatedPressable>

            <JellyRadio
              items={['Date', 'Month', 'Year']}
              value={requestedGranularity}
              onChange={(val) => {
                const next = val as CashFlowGranularity;
                if (next === requestedGranularity) return;
                setRequestedGranularity(next);
                runChartTransition(0, () => {
                  setSelectedIndex(null);
                  setGranularity(next);
                });
              }}
              chipColor={surfacePill}
              activeColor={activeBg}
              textColor={mutedText}
              activeTextColor={activeText}
              size="xs"
              dropdownHeight={28}
              noWrap
              gap={4}
              radius={999}
              swell={0.14}
              barge={4}
            />
          </View>
        </View>

        {/* Quiet Context & Gesture Hint Line */}
        <View style={styles.contextLineRow} {...gestureHandlers}>
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
              numberOfLines={1}
              style={[
                styles.gestureHintText,
                { color: isMonthHoldReady ? '#10B981' : mutedText },
              ]}
            >
              {analytics.loading ? 'Loading cash flow…' : activeScopeSubtitle}
            </Text>
          </View>

          {granularity === 'Date' && selectedDate && (
            <AnimatedPressable
              scaleTo={0.94}
              onPress={() => {
                runChartTransition(-1, () => {
                  setSelectedIndex(null);
                  setSelectedDate(null);
                });
              }}
              contentStyle={[styles.clearChip, { backgroundColor: surfacePill }]}
            >
              <Text style={[styles.clearChipText, { color: mutedText }]}>All Dates</Text>
            </AnimatedPressable>
          )}
        </View>

        <Animated.View
          style={{
            width: '100%',
            minHeight: height + 40,
            opacity: swipeOpacity,
            transform: [{ translateX: combinedTranslateX }],
          }}
          onLayout={(e) => {
            const measured = Math.floor(e.nativeEvent.layout.width);
            if (measured > 100 && Math.abs(measured - plotBoxWidth) > 1) {
              setPlotBoxWidth(measured);
            }
          }}
        >
        {pointsData.length === 0 ? (
          <View style={[styles.emptyBox, { minHeight: height + 40 }]}>
            <Text style={[styles.emptyText, { color: mutedText }]}>
              No cash flow recorded on{' '}
              {selectedDate ? formatDisplayDate(selectedDate, true) : 'this selection'}.
            </Text>
            <AnimatedPressable
              scaleTo={0.95}
              onPress={() => {
                runChartTransition(-1, () => {
                  setSelectedIndex(null);
                  setSelectedDate(null);
                });
              }}
              contentStyle={[styles.clearChip, { backgroundColor: surfacePill, marginTop: 10, paddingHorizontal: 14, paddingVertical: 6 }]}
            >
              <Text style={[styles.clearChipText, { color: textColor }]}>Show All Dates</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            {/* Floating Tooltip Pin */}
            {activePoint && (
              <Reanimated.View
                pointerEvents="none"
                style={[
                  styles.tooltipPin,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#000000',
                    left: 0,
                    top: 0,
                  },
                  tooltipMotion,
                ]}
              >
                <Reanimated.View key={activePoint.key} entering={READOUT_ENTER} style={styles.tooltipContent}>
                <Text style={[styles.tooltipAmount, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  {formatAmount(activePoint.expense)}
                </Text>
                <Text style={[styles.tooltipDate, { color: isDark ? '#71717A' : '#A1A1AA' }]}>
                  {activePoint.fullLabel}
                </Text>
                </Reanimated.View>
              </Reanimated.View>
            )}

            <View style={{ width, height, position: 'relative' }}>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id="goldFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                    <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </LinearGradient>
                  <LinearGradient id="goldCurveGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor="#FDE047" />
                    <Stop offset="100%" stopColor="#F59E0B" />
                  </LinearGradient>
                  <LinearGradient id="coralCurveGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor="#F97316" />
                    <Stop offset="100%" stopColor="#EA580C" />
                  </LinearGradient>
                </Defs>

                <AnimatedLine
                    animatedProps={cursorLineProps}
                    y1={paddingTop - 6}
                    y2={height - paddingBottom + 6}
                    stroke={isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)'}
                    strokeWidth={1.25}
                    strokeDasharray="3 4"
                />

                {incomeArea ? (
                  <Path d={incomeArea} fill="url(#goldFillGrad)" />
                ) : null}

                {incomeCurve.path ? (
                  <Path
                    d={incomeCurve.path}
                    fill="none"
                    stroke="url(#goldCurveGrad)"
                    strokeWidth={2.8}
                    strokeLinecap="round"
                  />
                ) : null}

                {expenseCurve.path ? (
                  <Path
                    d={expenseCurve.path}
                    fill="none"
                    stroke="url(#coralCurveGrad)"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                ) : null}

                {activePoint ? <AnimatedCircle
                      animatedProps={cursorDotProps}
                      r={5.5}
                      fill="#FFFFFF"
                      stroke="#F59E0B"
                      strokeWidth={3}
                    /> : null}
              </Svg>

              {/* Transparent Glide / Scrub Overlay */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  Platform.OS === 'web' && ({ cursor: 'ew-resize' } as any),
                ]}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => true}
                onResponderGrant={(e: GestureResponderEvent) => {
                  e.stopPropagation?.();
                  scrubAtX(e.nativeEvent.locationX);
                }}
                onResponderMove={(e: GestureResponderEvent) => {
                  e.stopPropagation?.();
                  scrubAtX(e.nativeEvent.locationX);
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onPointerMove: handleWebGlide,
                      onMouseMove: handleWebGlide,
                      onMouseDown: (e: any) => {
                        e.stopPropagation?.();
                        handleWebGlide(e);
                      },
                      onTouchStart: (e: any) => {
                        e.stopPropagation?.();
                        const touch = e?.nativeEvent?.touches?.[0] || e?.nativeEvent;
                        if (touch?.locationX !== undefined) scrubAtX(touch.locationX);
                      },
                      onTouchMove: (e: any) => {
                        e.stopPropagation?.();
                        const touch = e?.nativeEvent?.touches?.[0] || e?.nativeEvent;
                        if (touch?.locationX !== undefined) scrubAtX(touch.locationX);
                      },
                    } as any)
                  : {})}
              />
            </View>

            {/* Labels Row aligned precisely to each point's X coordinate */}
            <View style={[styles.labelsRow, { width }]}>
              {pointsData.map((d, i) => {
                const ptX =
                  expenseCoords[i]?.x ??
                  (pointsData.length > 1
                    ? paddingHorizontal +
                      i * (Math.max(40, width - paddingHorizontal * 2) / (pointsData.length - 1))
                    : width / 2);
                const labelW = 46;
                const left = Math.max(0, Math.min(width - labelW, ptX - labelW / 2));

                return (
                  <TouchableOpacity
                    key={`${d.key}-${i}`}
                    onPress={() => handleSelectPoint(i)}
                    {...(Platform.OS === 'web'
                      ? ({ onMouseEnter: () => handleSelectPoint(i) } as any)
                      : {})}
                    style={[styles.labelBtnPositioned, { left, width: labelW }]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.axisLabel,
                        {
                          textAlign: 'center',
                          color:
                            safeIndex === i
                              ? isDark
                                ? '#FFFFFF'
                                : '#000000'
                              : isDark
                                ? '#52525B'
                                : '#9CA3AF',
                          fontWeight: safeIndex === i ? '600' : '400',
                        },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        </Animated.View>
      </View>

      <CalendarDatePickerModal
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelectDate={(iso) => {
          if (iso) setRequestedGranularity('Date');
          const dir: -1 | 1 =
            iso && selectedDate ? (iso >= selectedDate ? 1 : -1) : iso ? 1 : -1;
          runChartTransition(dir, () => {
            setSelectedIndex(null);
            setSelectedDate(iso);
            if (iso) {
              const [yStr, mStr] = iso.split('-');
              const yr = Number(yStr);
              const mn = (Number(mStr) || 1) - 1;
              if (!isNaN(yr)) setSelectedYear(yr);
              if (!isNaN(mn) && mn >= 0 && mn <= 11) setSelectedMonth(mn);
              setGranularity('Date');
            }
          });
        }}
        onClose={() => setShowCalendar(false)}
        markedDates={transactions.map((t) => t.date)}
        allowClear={true}
        title="Cash Flow Date"
      />
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 16,
    marginVertical: 10,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    columnGap: 6,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerRightControls: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  calendarIconBtn: {
    ...COMPACT_ICON_BUTTON_STYLE,
    borderRadius: 18,
    borderWidth: 0,
  },
  statSublabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statSublabelExpense: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  contextLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  gestureHintPill: {
    flexShrink: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  gestureHintText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  clearChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 0,
  },
  clearChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyBox: {
    paddingVertical: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  chartContainer: {
    position: 'relative',
    marginTop: 8,
  },
  tooltipPin: {
    position: 'absolute',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    zIndex: 20,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
  },
  tooltipContent: { alignItems: 'center' },
  tooltipAmount: {
    fontSize: 12,
    fontWeight: '500',
  },
  tooltipDate: {
    fontSize: 9,
    fontWeight: '400',
  },
  labelsRow: {
    position: 'relative',
    height: 24,
    marginTop: 8,
  },
  labelBtnPositioned: {
    position: 'absolute',
    top: 0,
    paddingVertical: 4,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 11,
  },
});

export default SplineChart;
