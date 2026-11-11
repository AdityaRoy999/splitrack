import React, { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { triggerSelection } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassCard } from '../glass/GlassCard';
import { AnimatedPressable } from '../common/MotionPrimitives';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Modern balanced palette matching minimal financial surfaces
const SEGMENT_COLORS = [
  '#E2F163', // Soft lime yellow
  '#89F5A2', // Mint green
  '#C482FA', // Lavender violet
  '#64748B', // Cool slate
  '#65D8F7', // Sky cyan
  '#FFA06B', // Soft peach
];

export const DonutPieChart: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const { categoryMetrics } = useSplitTrack();
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sweepProgress, setSweepProgress] = useState<number>(() =>
    typeof requestAnimationFrame !== 'undefined' ? 0 : 1
  );
  const [entranceAnim] = useState(() => new Animated.Value(0));

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
  }, [entranceAnim]);

  const totalAmount = categoryMetrics.reduce((sum, c) => sum + c.amount, 0);
  const selectedItem = categoryMetrics.find((c) => c.id === selectedId);
  const selectedColor = selectedItem
    ? SEGMENT_COLORS[
        Math.max(
          0,
          categoryMetrics.findIndex((c) => c.id === selectedItem.id)
        ) % SEGMENT_COLORS.length
      ]
    : null;

  const size = Math.min(windowWidth - 108, 192);
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Add strokeWidth plus a tight 2px breather so rounded caps sit close together without touching
  const gap = strokeWidth + 2;
  const totalGaps = categoryMetrics.length * gap;
  const availableCircumference = Math.max(1, circumference - totalGaps);

  const segments = categoryMetrics.reduce<
    (typeof categoryMetrics[number] & {
      color: string;
      segmentLength: number;
      offset: number;
      pct: number;
    })[]
  >((acc, cat, index) => {
    const fraction =
      totalAmount > 0 ? cat.amount / totalAmount : 1 / categoryMetrics.length;
    const segmentLength = Math.max(8, fraction * availableCircumference);
    const prev = acc[acc.length - 1];
    const offset = prev ? prev.offset + prev.segmentLength + gap : 0;
    const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
    const pct = Math.round(fraction * 100);

    return [
      ...acc,
      {
        ...cat,
        color,
        segmentLength,
        offset,
        pct,
      },
    ];
  }, []);

  const handleSelect = (id: string) => {
    triggerSelection();
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const selectedSegment = segments.find((s) => s.id === selectedId);
  const centerDisplay = selectedSegment
    ? formatAmount(selectedSegment.amount)
    : formatAmount(totalAmount || 11300);
  const centerLabel = selectedSegment
    ? selectedSegment.name.split(' ')[0]
    : 'Total Spend';

  const textColor = isDark ? '#F4F4F5' : '#09090B';
  const mutedText = isDark ? '#8E8E93' : '#71717A';
  const surfacePill = isDark ? '#1B1B20' : '#F3F4F6';

  const animatedScale = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const currentSweepLength = sweepProgress * circumference;

  return (
    <GlassCard borderRadius={24} style={styles.card}>
      <View style={styles.container}>
        {/* Top Micro Summary Bar */}
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
                : `${segments.length} categories`}
            </Text>
          </AnimatedPressable>
        </View>

        {/* Animated Donut Ring */}
        <Animated.View
          style={[
            styles.chartWrapper,
            {
              opacity: entranceAnim,
              transform: [{ scale: animatedScale }],
            },
          ]}
        >
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {segments.map((seg) => {
                const isSelected = selectedId === seg.id;
                const availableInArc = currentSweepLength - seg.offset;
                if (availableInArc <= 0.6) return null;

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
                    strokeDasharray={`${visibleLen} ${Math.max(1, circumference - visibleLen)}`}
                    strokeDashoffset={-seg.offset}
                    strokeLinecap="round"
                    fill="none"
                    opacity={selectedId && !isSelected ? 0.28 : 1}
                  />
                );
              })}
            </Svg>
          </View>

          {/* Center Focus Readout */}
          <AnimatedPressable
            scaleTo={0.96}
            disabled={!selectedSegment}
            onPress={() => selectedSegment && handleSelect(selectedSegment.id)}
            style={styles.centerTouchable}
            contentStyle={styles.centerContainer}
          >
            <Text style={[styles.centerCaption, { color: mutedText }]}>
              {selectedSegment ? `${selectedSegment.pct}% OF SPEND` : 'TOTAL SPEND'}
            </Text>
            <Text style={[styles.centerAmount, { color: textColor }]}>
              {centerDisplay}
            </Text>
            <Text style={[styles.centerLabel, { color: mutedText }]}>
              {centerLabel}
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Interactive Legend Chips */}
        <View style={styles.legendGrid}>
          {segments.map((seg) => {
            const isSelected = selectedId === seg.id;
            return (
              <AnimatedPressable
                key={seg.id}
                scaleTo={0.94}
                onPress={() => handleSelect(seg.id)}
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
                    opacity: selectedId && !isSelected ? 0.58 : 1,
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
      </View>
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
    marginBottom: 14,
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
