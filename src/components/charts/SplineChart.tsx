import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { triggerSelection } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassCard } from '../glass/GlassCard';
import { JellyRadio } from '../common/JellyRadio';

export const SplineChart: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const { chartData } = useSplitTrack();
  const { themeMode, formatAmount } = useLiquidGlass();
  const [selectedIndex, setSelectedIndex] = useState<number>(4);
  const [period, setPeriod] = useState<'Week' | 'Month' | 'Year'>('Month');

  const isDark = themeMode === 'dark';
  const width = Math.min(windowWidth - 68, 380);
  const height = 150;
  const paddingHorizontal = 20;
  const paddingTop = 30;
  const paddingBottom = 30;

  const activePoint = chartData[selectedIndex] || chartData[0];

  const handleSelectPoint = (idx: number) => {
    triggerSelection();
    setSelectedIndex(idx);
  };

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.income, d.expense))) * 1.25;
  const minVal = 0;

  const getCoordinates = (value: number, index: number) => {
    const x = paddingHorizontal + (index / (chartData.length - 1)) * (width - 2 * paddingHorizontal);
    const y = height - paddingBottom - ((value - minVal) / (maxVal - minVal)) * (height - paddingTop - paddingBottom);
    return { x, y };
  };

  const generateSmoothPath = (key: 'income' | 'expense') => {
    const points = chartData.map((d, i) => getCoordinates(d[key], i));
    if (points.length < 2) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const generateAreaPath = (key: 'income' | 'expense') => {
    const linePath = generateSmoothPath(key);
    if (!linePath) return '';
    const points = chartData.map((d, i) => getCoordinates(d[key], i));
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = height - paddingBottom;
    return `${linePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  };

  const incomePath = generateSmoothPath('income');
  const expensePath = generateSmoothPath('expense');
  const incomeArea = generateAreaPath('income');
  const activeExpenseCoord = getCoordinates(activePoint.expense, selectedIndex);

  return (
    <GlassCard borderRadius={24} intensity={20} style={styles.card}>
      {/* Header with Stats & Period */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.statSublabel, { color: isDark ? '#FFFFFF' : '#18181B' }]}>
            {formatAmount(activePoint.income)} Income
          </Text>
          <Text style={[styles.statSublabelExpense, { color: isDark ? '#A1A1AA' : '#71717A' }]}>
            {formatAmount(activePoint.expense)} Expenses
          </Text>
        </View>

        {/* Rounded JellyRadio Period Selector */}
        <JellyRadio
          items={['Week', 'Month', 'Year']}
          value={period}
          onChange={(val) => setPeriod(val as 'Week' | 'Month' | 'Year')}
          chipColor={isDark ? '#18181D' : '#F3F4F6'}
          activeColor={isDark ? '#F4F4F5' : '#18181B'}
          textColor={isDark ? '#8E8E93' : '#71717A'}
          activeTextColor={isDark ? '#18181B' : '#FFFFFF'}
          size="sm"
          gap={5}
          radius={999}
          swell={0.18}
          barge={5}
        />
      </View>

      {/* SVG Canvas with Modern Bezier Curves */}
      <View style={styles.chartContainer}>
        {/* Floating Tooltip Pin */}
        <View
          style={[
            styles.tooltipPin,
            {
              backgroundColor: isDark ? '#FFFFFF' : '#000000',
              left: Math.max(10, Math.min(width - 100, activeExpenseCoord.x - 45)),
              top: Math.max(0, activeExpenseCoord.y - 48),
            },
          ]}
        >
          <Text style={[styles.tooltipAmount, { color: isDark ? '#000000' : '#FFFFFF' }]}>
            {formatAmount(activePoint.expense)}
          </Text>
          <Text style={[styles.tooltipDate, { color: isDark ? '#71717A' : '#A1A1AA' }]}>
            {activePoint.label} 2026
          </Text>
        </View>

        <Svg width={width} height={height}>
          <Defs>
            {/* Amber golden gradient matching user reference image 2 */}
            <LinearGradient id="goldCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#F59E0B" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FCD34D" stopOpacity="0.9" />
            </LinearGradient>

            {/* Coral orange gradient for expense curve */}
            <LinearGradient id="coralCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#FB923C" stopOpacity="0.7" />
            </LinearGradient>

            {/* Area fill glow */}
            <LinearGradient id="goldAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Area fill under curve */}
          <Path
            d={incomeArea}
            fill="url(#goldAreaGrad)"
          />

          {/* Income trend - Vibrant gold line */}
          <Path
            d={incomePath}
            fill="none"
            stroke="url(#goldCurveGrad)"
            strokeWidth={2.8}
            strokeLinecap="round"
          />

          {/* Expense trend - Coral curve */}
          <Path
            d={expensePath}
            fill="none"
            stroke="url(#coralCurveGrad)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />

          {/* Active Node Pin */}
          <Circle
            cx={activeExpenseCoord.x}
            cy={activeExpenseCoord.y}
            r={5.5}
            fill="#FFFFFF"
            stroke="#F59E0B"
            strokeWidth={3}
          />
        </Svg>

        {/* Labels Row */}
        <View style={styles.labelsRow}>
          {chartData.map((d, i) => (
            <TouchableOpacity
              key={d.label}
              onPress={() => handleSelectPoint(i)}
              style={styles.labelBtn}
            >
              <Text
                style={[
                  styles.axisLabel,
                  {
                    color: selectedIndex === i
                      ? (isDark ? '#FFFFFF' : '#000000')
                      : (isDark ? '#52525B' : '#9CA3AF'),
                    fontWeight: selectedIndex === i ? '500' : '400',
                  },
                ]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statSublabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statSublabelExpense: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  chartContainer: {
    position: 'relative',
    marginTop: 10,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 8,
  },
  labelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  axisLabel: {
    fontSize: 12,
  },
});
