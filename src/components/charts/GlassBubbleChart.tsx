import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { CartLarge2Icon } from '@solar-icons/react-native/bold/cart-large-2';
import { TShirtIcon } from '@solar-icons/react-native/bold/t-shirt';
import { CupHotIcon } from '@solar-icons/react-native/bold/cup-hot';
import { DumbbellLargeIcon } from '@solar-icons/react-native/bold/dumbbell-large';
import { HeartIcon } from '@solar-icons/react-native/bold/heart';
import { BusIcon } from '@solar-icons/react-native/bold/bus';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { CategoryMetric } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getIcon = (iconName: string, color: string = '#FFFFFF', size: number = 20) => {
  switch (iconName) {
    case 'ShoppingCart':
      return <CartLarge2Icon size={size} color={color} />;
    case 'Shirt':
      return <TShirtIcon size={size} color={color} />;
    case 'Coffee':
      return <CupHotIcon size={size} color={color} />;
    case 'Dumbbell':
      return <DumbbellLargeIcon size={size} color={color} />;
    case 'Heart':
      return <HeartIcon size={size} color={color} />;
    case 'Bus':
    default:
      return <BusIcon size={size} color={color} />;
  }
};

export const GlassBubbleChart: React.FC = () => {
  const { categoryMetrics } = useSplitTrack();
  const { formatAmount, themeMode, palette } = useLiquidGlass();
  const [selectedCatId, setSelectedCatId] = useState<string>('cat-groceries');

  const selectedCategory = categoryMetrics.find((c) => c.id === selectedCatId) || categoryMetrics[0];
  const isDark = themeMode === 'dark';

  const handleSelect = (cat: CategoryMetric) => {
    triggerImpact(ImpactStyle.Light);
    setSelectedCatId(cat.id);
  };

  const chartAreaHeight = 320;

  return (
    <View style={styles.container}>
      {/* 3D Glass Spheres Canvas */}
      <View style={[styles.canvasArea, { height: chartAreaHeight }]}>
        {categoryMetrics.map((cat) => {
          const isSelected = cat.id === selectedCatId;
          const radius = (cat.size / 2) * (isSelected ? 1.08 : 1);
          const left = (cat.x / 100) * (SCREEN_WIDTH - 40) - radius;
          const top = (cat.y / 100) * (chartAreaHeight - 40) - radius;

          return (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.85}
              onPress={() => handleSelect(cat)}
              style={[
                styles.bubbleWrapper,
                {
                  width: radius * 2,
                  height: radius * 2,
                  left: Math.max(10, Math.min(SCREEN_WIDTH - 60 - radius * 2, left)),
                  top: Math.max(10, Math.min(chartAreaHeight - radius * 2, top)),
                  transform: [{ scale: isSelected ? 1.05 : 1 }],
                },
              ]}
            >
              {/* Spherical Radial Glass Shading */}
              <Svg width={radius * 2} height={radius * 2} style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient
                    id={`sphere-grad-${cat.id}`}
                    cx="35%"
                    cy="30%"
                    rx="65%"
                    ry="65%"
                    fx="25%"
                    fy="20%"
                  >
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isSelected ? 0.95 : 0.75} />
                    <Stop offset="25%" stopColor={cat.color} stopOpacity="0.8" />
                    <Stop offset="70%" stopColor={cat.color} stopOpacity="0.45" />
                    <Stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
                  </RadialGradient>
                  {/* Internal Refraction Highlight */}
                  <RadialGradient
                    id={`sheen-${cat.id}`}
                    cx="30%"
                    cy="25%"
                    rx="30%"
                    ry="30%"
                  >
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle
                  cx={radius}
                  cy={radius}
                  r={radius - 1}
                  fill={`url(#sphere-grad-${cat.id})`}
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="1.2"
                />
                <Circle
                  cx={radius * 0.7}
                  cy={radius * 0.6}
                  r={radius * 0.35}
                  fill={`url(#sheen-${cat.id})`}
                />
              </Svg>

              {/* Bubble Content */}
              <View style={styles.bubbleContent}>
                {getIcon(cat.icon, '#FFFFFF', radius > 50 ? 22 : 16)}
                {radius > 45 && (
                  <Text numberOfLines={1} style={styles.bubbleName}>
                    {cat.name}
                  </Text>
                )}
                <Text style={styles.bubblePercentage}>{cat.percentage}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Category Details Card */}
      <View
        style={[
          styles.detailsCard,
          isDark && {
            backgroundColor: palette.cardSolid,
            borderWidth: 0,
          },
        ]}
      >
        <View style={styles.detailsHeader}>
          <Text style={[styles.detailsTitle, isDark && { color: '#A1A1AA' }]}>Expenses</Text>
          <Text style={[styles.detailsTotal, isDark && { color: '#FFFFFF' }]}>$1,842.56</Text>
        </View>

        <View
          style={[
            styles.selectedRow,
            isDark && { backgroundColor: '#18181D' },
          ]}
        >
          <View style={styles.selectedLeft}>
            <View style={[styles.selectedIconBox, { backgroundColor: selectedCategory.color }]}>
              {getIcon(selectedCategory.icon, '#FFFFFF', 18)}
            </View>
            <View>
              <Text style={[styles.selectedName, isDark && { color: '#FFFFFF' }]}>
                {selectedCategory.name}
              </Text>
              <Text style={[styles.selectedPercent, isDark && { color: '#A1A1AA' }]}>
                {selectedCategory.percentage}% of total expenses
              </Text>
            </View>
          </View>
          <Text style={[styles.selectedAmount, isDark && { color: '#FFFFFF' }]}>
            {formatAmount(selectedCategory.amount)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  canvasArea: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  bubbleWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  bubbleContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bubbleName: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
    maxWidth: 80,
  },
  bubblePercentage: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginTop: 8,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  detailsTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedPercent: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  selectedAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
});
