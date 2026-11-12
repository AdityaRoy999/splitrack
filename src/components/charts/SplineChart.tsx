import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
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

function computeSmoothCurve(points: PointCoord[]): {
  path: string;
  length: number;
} {
  if (points.length === 0) return { path: '', length: 0 };
  if (points.length === 1) {
    return { path: `M ${points[0].x} ${points[0].y}`, length: 1 };
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  let length = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cp1x = p1.x + (p2.x - p1.x) * 0.45;
    const cp1y = p1.y;
    const cp2x = p1.x + (p2.x - p1.x) * 0.55;
    const cp2y = p2.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;

    // Approximate cubic segment length with 8 sub-steps
    let prevX = p1.x;
    let prevY = p1.y;
    for (let s = 1; s <= 8; s++) {
      const t = s / 8;
      const omt = 1 - t;
      const sx =
        omt * omt * omt * p1.x +
        3 * omt * omt * t * cp1x +
        3 * omt * t * t * cp2x +
        t * t * t * p2.x;
      const sy =
        omt * omt * omt * p1.y +
        3 * omt * omt * t * cp1y +
        3 * omt * t * t * cp2y +
        t * t * t * p2.y;
      length += Math.hypot(sx - prevX, sy - prevY);
      prevX = sx;
      prevY = sy;
    }
  }

  return { path, length };
}

export const SplineChart: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const { chartData, transactions } = useSplitTrack();
  const { themeMode, formatAmount } = useLiquidGlass();

  const [granularity, setGranularity] = useState<CashFlowGranularity>('Month');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [drawProgress, setDrawProgress] = useState<number>(() =>
    typeof requestAnimationFrame !== 'undefined' ? 0 : 1
  );
  const [plotBoxWidth, setPlotBoxWidth] = useState<number>(() =>
    Math.max(240, Math.min(windowWidth - 64, 416))
  );
  const [swipeX] = useState(() => new Animated.Value(0));
  const [swipeOpacity] = useState(() => new Animated.Value(1));
  const [combinedTranslateX] = useState(() => new Animated.Value(0));
  const transitionBusyRef = useRef(false);

  const isDark = themeMode === 'dark';
  const width = plotBoxWidth;
  const height = 154;
  const paddingHorizontal = 22;
  const paddingTop = 34;
  const paddingBottom = 26;

  const runSwipeTransition = useCallback(
    (delta: -1 | 1, commit: () => void) => {
      if (transitionBusyRef.current) return;
      transitionBusyRef.current = true;
      Animated.parallel([
        Animated.timing(swipeOpacity, {
          toValue: 0,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(swipeX, {
          toValue: -delta * 26,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(() => {
        setDrawProgress(0);
        commit();
        swipeX.setValue(delta * 30);
        Animated.parallel([
          Animated.timing(swipeOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swipeX, {
            toValue: 0,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]).start(() => {
          transitionBusyRef.current = false;
        });
      });
    },
    [swipeOpacity, swipeX]
  );

  const stepDay = useCallback(
    (delta: -1 | 1) => {
      runSwipeTransition(delta, () => {
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
    [runSwipeTransition, selectedDate, selectedYear]
  );

  const stepMonth = useCallback(
    (delta: -1 | 1) => {
      runSwipeTransition(delta, () => {
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
    [runSwipeTransition, selectedMonth, selectedYear]
  );

  const { gestureHandlers, isMonthHoldReady, dragAnim } = useDateMonthSwipeGesture({
    onStepDay: stepDay,
    onStepMonth: stepMonth,
  });

  useEffect(() => {
    const id = swipeX.addListener(({ value }) => {
      combinedTranslateX.setValue(value);
    });
    const dragId = dragAnim.addListener(({ value }) => {
      if (!transitionBusyRef.current) {
        combinedTranslateX.setValue(value);
      }
    });
    return () => {
      swipeX.removeListener(id);
      dragAnim.removeListener(dragId);
    };
  }, [combinedTranslateX, dragAnim, swipeX]);

  const pointsData = useMemo<TrajectoryPoint[]>(() => {
    if (granularity === 'Date') {
      if (selectedDate) {
        const dayTx = transactions
          .filter((tx) => tx.date === selectedDate)
          .sort((a, b) => a.time.localeCompare(b.time));

        if (dayTx.length === 0) return [];
        if (dayTx.length === 1) {
          const single = dayTx[0];
          const inc = single.amount > 0 ? single.amount : 0;
          const exp = single.amount < 0 ? Math.abs(single.amount) : 0;
          return [
            {
              key: 'start',
              label: 'Start',
              fullLabel: formatDisplayDate(selectedDate, true),
              income: 0,
              expense: 0,
            },
            {
              key: single.id,
              label: single.time || 'Recorded',
              fullLabel: `${single.title} • ${formatDisplayDate(selectedDate, true)}`,
              income: inc,
              expense: exp,
            },
          ];
        }

        let runIncome = 0;
        let runExpense = 0;
        return dayTx.map((tx) => {
          if (tx.amount > 0) runIncome += tx.amount;
          else runExpense += Math.abs(tx.amount);
          return {
            key: tx.id,
            label: tx.time || tx.title.slice(0, 6),
            fullLabel: `${tx.title} • ${tx.time}`,
            income: runIncome,
            expense: runExpense,
          };
        });
      }

      // Daily trajectory across unique recorded dates
      const byDate = new Map<string, { income: number; expense: number }>();
      transactions.forEach((tx) => {
        const entry = byDate.get(tx.date) || { income: 0, expense: 0 };
        if (tx.amount > 0) entry.income += tx.amount;
        else entry.expense += Math.abs(tx.amount);
        byDate.set(tx.date, entry);
      });

      return Array.from(byDate.entries())
        .sort(([dA], [dB]) => dA.localeCompare(dB))
        .slice(-7)
        .map(([iso, vals]) => {
          const [, m, d] = iso.split('-');
          const mLabel = MONTH_SHORT[(Number(m) || 1) - 1] || m;
          return {
            key: iso,
            label: `${Number(d)} ${mLabel}`,
            fullLabel: formatDisplayDate(iso, true),
            income: vals.income,
            expense: vals.expense,
          };
        });
    }

    if (granularity === 'Year') {
      const yearsMap = new Map<number, { income: number; expense: number }>([
        [2024, { income: 3420, expense: 2180 }],
        [2025, { income: 4860, expense: 2940 }],
        [2026, { income: 0, expense: 0 }],
      ]);

      chartData.forEach((pt) => {
        const y = Number(pt.date.split('-')[0]) || 2026;
        const curr = yearsMap.get(y) || { income: 0, expense: 0 };
        curr.income += pt.income;
        curr.expense += pt.expense;
        yearsMap.set(y, curr);
      });

      transactions.forEach((tx) => {
        const y = Number(tx.date.split('-')[0]) || 2026;
        const curr = yearsMap.get(y) || { income: 0, expense: 0 };
        if (tx.amount > 0) curr.income += tx.amount;
        else curr.expense += Math.abs(tx.amount);
        yearsMap.set(y, curr);
      });

      return Array.from(yearsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([yr, vals]) => ({
          key: String(yr),
          label: String(yr),
          fullLabel: `Year ${yr}`,
          income: vals.income,
          expense: vals.expense,
        }));
    }

    // 6-month sliding trajectory ending at (selectedYear, selectedMonth)
    const totalsByYm = new Map<string, { income: number; expense: number }>();
    chartData.forEach((pt) => {
      const [yStr, mStr] = pt.date.split('-');
      const key = `${Number(yStr)}-${(Number(mStr) || 1) - 1}`;
      totalsByYm.set(key, { income: pt.income, expense: pt.expense });
    });

    transactions.forEach((tx) => {
      const [yStr, mStr] = tx.date.split('-');
      const y = Number(yStr);
      const mIdx = (Number(mStr) || 1) - 1;
      if (isNaN(y) || mIdx < 0 || mIdx > 11) return;
      const key = `${y}-${mIdx}`;
      const existing = totalsByYm.get(key) || { income: 0, expense: 0 };
      if (tx.amount > 0) existing.income += tx.amount;
      else existing.expense += Math.abs(tx.amount);
      totalsByYm.set(key, existing);
    });

    const windowPoints: TrajectoryPoint[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const dt = new Date(selectedYear, selectedMonth - offset, 1);
      const y = dt.getFullYear();
      const mIdx = dt.getMonth();
      const key = `${y}-${mIdx}`;
      const vals = totalsByYm.get(key) || { income: 0, expense: 0 };
      windowPoints.push({
        key,
        label: MONTH_SHORT[mIdx],
        fullLabel: `${MONTH_SHORT[mIdx]} ${y}`,
        income: vals.income,
        expense: vals.expense,
      });
    }
    return windowPoints;
  }, [granularity, selectedDate, selectedMonth, selectedYear, chartData, transactions]);

  const defaultIndex = Math.max(0, pointsData.length - 1);
  const safeIndex =
    selectedIndex === null
      ? defaultIndex
      : Math.max(0, Math.min(selectedIndex, Math.max(0, pointsData.length - 1)));
  const activePoint = pointsData[safeIndex];

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') {
      return;
    }

    let rafId = 0;
    const duration = 640;
    let startTime: number | null = null;

    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const raw = Math.min(1, Math.max(0, elapsed / duration));
      const eased = 1 - Math.pow(1 - raw, 3);
      setDrawProgress(eased);
      if (raw < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [granularity, selectedDate, selectedMonth, selectedYear, pointsData.length]);

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

  const activeExpenseCoord =
    expenseCoords[safeIndex] || { x: width / 2, y: height / 2 };

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const surfacePill = isDark ? '#18181D' : '#F3F4F6';
  const activeBg = isDark ? '#F4F4F5' : '#18181B';
  const activeText = isDark ? '#18181B' : '#FFFFFF';

  const incomeDrawLen = Math.max(0.01, drawProgress * incomeCurve.length);
  const expenseDrawLen = Math.max(0.01, drawProgress * expenseCurve.length);

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
      <View {...gestureHandlers}>
        {/* Header with Stats on left + Calendar Button & Date/Month/Year Selector on right */}
        <View style={styles.header}>
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
              value={granularity}
              onChange={(val) => {
                setSelectedIndex(null);
                setDrawProgress(0);
                setGranularity(val as CashFlowGranularity);
              }}
              chipColor={surfacePill}
              activeColor={activeBg}
              textColor={mutedText}
              activeTextColor={activeText}
              size="xs"
              noWrap
              gap={4}
              radius={999}
              swell={0.14}
              barge={4}
            />
          </View>
        </View>

        {/* Quiet Context & Gesture Hint Line */}
        <View style={styles.contextLineRow}>
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
              {activeScopeSubtitle}
            </Text>
          </View>

          {granularity === 'Date' && selectedDate && (
            <AnimatedPressable
              scaleTo={0.94}
              onPress={() => {
                setSelectedIndex(null);
                setSelectedDate(null);
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
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: mutedText }]}>
              No cash flow recorded on{' '}
              {selectedDate ? formatDisplayDate(selectedDate, true) : 'this selection'}.
            </Text>
            <AnimatedPressable
              scaleTo={0.95}
              onPress={() => {
                setSelectedIndex(null);
                setDrawProgress(0);
                setSelectedDate(null);
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
              <View
                pointerEvents="none"
                style={[
                  styles.tooltipPin,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#000000',
                    left: Math.max(10, Math.min(width - 108, activeExpenseCoord.x - 48)),
                    top: Math.max(0, activeExpenseCoord.y - 48),
                    opacity: drawProgress > 0.35 ? 1 : 0,
                  },
                ]}
              >
                <Text style={[styles.tooltipAmount, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  {formatAmount(activePoint.expense)}
                </Text>
                <Text style={[styles.tooltipDate, { color: isDark ? '#71717A' : '#A1A1AA' }]}>
                  {activePoint.fullLabel}
                </Text>
              </View>
            )}

            <View style={{ width, height, position: 'relative' }}>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id="goldFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25 * drawProgress} />
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

                {drawProgress > 0.35 && (
                  <Line
                    x1={activeExpenseCoord.x}
                    y1={paddingTop - 6}
                    x2={activeExpenseCoord.x}
                    y2={height - paddingBottom + 6}
                    stroke={isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)'}
                    strokeWidth={1.25}
                    strokeDasharray="3 4"
                  />
                )}

                {incomeArea ? (
                  <Path d={incomeArea} fill="url(#goldFillGrad)" opacity={drawProgress} />
                ) : null}

                {incomeCurve.path ? (
                  <Path
                    d={incomeCurve.path}
                    fill="none"
                    stroke="url(#goldCurveGrad)"
                    strokeWidth={2.8}
                    strokeLinecap="round"
                    strokeDasharray={
                      incomeCurve.length > 0 && drawProgress < 0.999
                        ? `${incomeDrawLen} ${incomeCurve.length + 20}`
                        : undefined
                    }
                  />
                ) : null}

                {expenseCurve.path ? (
                  <Path
                    d={expenseCurve.path}
                    fill="none"
                    stroke="url(#coralCurveGrad)"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeDasharray={
                      expenseCurve.length > 0 && drawProgress < 0.999
                        ? `${expenseDrawLen} ${expenseCurve.length + 20}`
                        : undefined
                    }
                  />
                ) : null}

                {expenseCoords.map((pt, idx) => {
                  const isActive = idx === safeIndex;
                  if (!isActive) return null;
                  return (
                    <Circle
                      key={`dot-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(1.5, 5.5 * drawProgress)}
                      fill="#FFFFFF"
                      stroke="#F59E0B"
                      strokeWidth={3}
                      opacity={drawProgress > 0.2 ? 1 : 0}
                    />
                  );
                })}
              </Svg>

              {/* Transparent Glide / Scrub Overlay */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  Platform.OS === 'web' && ({ cursor: 'ew-resize' } as any),
                ]}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
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
          setSelectedIndex(null);
          setDrawProgress(0);
          setSelectedDate(iso);
          if (iso) {
            const [yStr, mStr] = iso.split('-');
            const yr = Number(yStr);
            const mn = (Number(mStr) || 1) - 1;
            if (!isNaN(yr)) setSelectedYear(yr);
            if (!isNaN(mn) && mn >= 0 && mn <= 11) setSelectedMonth(mn);
            setGranularity('Date');
          }
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
