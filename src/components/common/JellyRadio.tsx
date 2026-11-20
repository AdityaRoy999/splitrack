import React, { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { triggerSelection } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { HorizontalEdgeFade, useHorizontalScrollEdges } from './ScrollEdgeFade';
import { DropdownSelect } from './DropdownSelect';
import { COMPACT_BUTTON_HEIGHT, COMPACT_BUTTON_HIT_SLOP } from '../../constants/buttonSizes';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface JellyRadioItem {
  value: string;
  label: string;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean;
}

export type JellyRadioInputItem = JellyRadioItem | string;

export interface JellyRadioProps {
  items: 'levels' | JellyRadioInputItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  chipColor?: string;
  activeColor?: string;
  textColor?: string;
  activeTextColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'chip' | 'tile' | 'swatch';
  gap?: number;
  radius?: number;
  columns?: number;
  noWrap?: boolean;
  swell?: number;
  barge?: number;
  shrink?: number;
  jelly?: number;
  bounce?: number;
  stagger?: number;
  stiffness?: number;
  disabled?: boolean;
  scrollable?: boolean;
  fadeColor?: string;
  blurWidth?: number;
  style?: StyleProp<ViewStyle>;
  presentation?: 'auto' | 'chips';
  dropdownHeight?: number;
}

const LEVELS_PRESET: JellyRadioItem[] = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

const SIZE_METRICS = {
  xs: { paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, minHeight: 28, iconGap: 4 },
  sm: { paddingHorizontal: 13, paddingVertical: 7, fontSize: 12, minHeight: 32, iconGap: 5 },
  md: { paddingHorizontal: 16, paddingVertical: 9, fontSize: 13, minHeight: 38, iconGap: 6 },
  lg: { paddingHorizontal: 19, paddingVertical: 11, fontSize: 14, minHeight: 44, iconGap: 7 },
};

interface JellyChipProps {
  item: JellyRadioItem;
  index: number;
  activeIndex: number;
  selectionSeq: number;
  isSelected: boolean;
  chipColor: string;
  activeColor: string;
  textColor: string;
  activeTextColor: string;
  size: 'xs' | 'sm' | 'md' | 'lg';
  variant: 'chip' | 'tile' | 'swatch';
  radius: number;
  swell: number;
  barge: number;
  shrink: number;
  jelly: number;
  bounce: number;
  stagger: number;
  stiffness: number;
  columns?: number;
  groupDisabled: boolean;
  onSelect: (index: number) => void;
}

const JellyChip: React.FC<JellyChipProps> = ({
  item,
  index,
  activeIndex,
  selectionSeq,
  isSelected,
  chipColor,
  activeColor,
  textColor,
  activeTextColor,
  size,
  variant,
  radius,
  swell,
  barge,
  shrink,
  jelly,
  bounce,
  stagger,
  stiffness,
  columns,
  groupDisabled,
  onSelect,
}) => {
  const [scaleX] = useState(() => new Animated.Value(1));
  const [scaleY] = useState(() => new Animated.Value(1));

  useEffect(() => () => {
    scaleX.stopAnimation();
    scaleY.stopAnimation();
  }, [scaleX, scaleY]);

  const metrics = SIZE_METRICS[size];
  const isDisabled = groupDisabled || !!item.disabled;

  useEffect(() => {
    if (selectionSeq === 0) return;

    scaleX.stopAnimation();
    scaleY.stopAnimation();

    if (index === activeIndex) {
      // Elastic Jelly Squash & Stretch (sweet-spot bounciness)
      const effectiveSwell = Math.max(0.12, Math.min(0.24, swell));
      const effectiveJelly = Math.max(0.8, Math.min(1.3, jelly));
      const xPeak = 1 + effectiveSwell * 0.58 * effectiveJelly;
      const yPeak = 1 - effectiveSwell * 0.32 * effectiveJelly;

      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleX, {
            toValue: xPeak,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
          Animated.spring(scaleX, {
            toValue: 1,
            stiffness: 350,
            damping: 14,
            mass: 0.75,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleY, {
            toValue: yPeak,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            stiffness: 350,
            damping: 14,
            mass: 0.75,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
        ]),
      ]).start();
      return;
    }

    // Neighbor chips: Gentle micro-ripple
    const distance = Math.abs(index - activeIndex);
    if (distance === 1) {
      const squash = 1 - shrink * 0.6;
      const stretch = 1 + shrink * 0.4;

      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleX, {
            toValue: squash,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
          Animated.spring(scaleX, {
            toValue: 1,
            stiffness: 350,
            damping: 16,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleY, {
            toValue: stretch,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            stiffness: 350,
            damping: 16,
            useNativeDriver: USE_NATIVE_DRIVER,
            isInteraction: false,
          }),
        ]),
      ]).start();
    }
  }, [
    selectionSeq,
    activeIndex,
    index,
    swell,
    shrink,
    jelly,
    scaleX,
    scaleY,
  ]);

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 1.04,
        stiffness: 650,
        damping: 24,
        useNativeDriver: USE_NATIVE_DRIVER,
        isInteraction: false,
      }),
      Animated.spring(scaleY, {
        toValue: 0.94,
        stiffness: 650,
        damping: 24,
        useNativeDriver: USE_NATIVE_DRIVER,
        isInteraction: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 1,
        stiffness: 350,
        damping: 18,
        useNativeDriver: USE_NATIVE_DRIVER,
        isInteraction: false,
      }),
      Animated.spring(scaleY, {
        toValue: 1,
        stiffness: 350,
        damping: 18,
        useNativeDriver: USE_NATIVE_DRIVER,
        isInteraction: false,
      }),
    ]).start();
  };

  const columnWrapStyle: ViewStyle | undefined =
    columns && columns > 1
      ? { flex: 1, minWidth: 0 }
      : undefined;
  const swatchSize = { xs: 22, sm: 26, md: 30, lg: 34 }[size];

  return (
    <Animated.View
      style={[
        columnWrapStyle,
        {
          transform: [{ scaleX }, { scaleY }],
          opacity: isDisabled ? 0.42 : 1,
        },
      ]}
    >
      <Pressable
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onSelect(index)}
        accessibilityRole="radio"
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityState={{ checked: isSelected, disabled: isDisabled }}
        aria-checked={isSelected}
        aria-disabled={isDisabled}
        hitSlop={variant === 'chip' ? COMPACT_BUTTON_HIT_SLOP : undefined}
        style={[
          styles.chip,
          columns && columns > 1 ? { width: '100%' } : null,
          {
            backgroundColor: variant === 'swatch' && item.color ? item.color : isSelected ? activeColor : chipColor,
            borderRadius: radius,
            paddingHorizontal: metrics.paddingHorizontal,
            paddingVertical: metrics.paddingVertical,
            minHeight: metrics.minHeight,
            gap: metrics.iconGap,
          },
          variant === 'tile' ? styles.tile : null,
          variant === 'chip' ? { minHeight: COMPACT_BUTTON_HEIGHT, paddingVertical: 0 } : null,
          variant === 'swatch' ? { width: swatchSize, height: swatchSize, minHeight: swatchSize, paddingHorizontal: 0, paddingVertical: 0, opacity: isSelected ? 1 : 0.65 } : null,
        ]}
      >
        {item.icon ? <View style={styles.iconSlot}>{item.icon}</View> : null}
        {item.label ? <Text
          numberOfLines={1}
          style={[
            styles.chipLabel,
            {
              color: isSelected ? activeTextColor : textColor,
              fontSize: variant === 'tile' ? Math.max(10, metrics.fontSize - 2) : metrics.fontSize,
              fontWeight: '500',
            },
          ]}
        >
          {item.label}
        </Text> : null}
      </Pressable>
    </Animated.View>
  );
};

export const JellyRadio: React.FC<JellyRadioProps> = ({
  items,
  value,
  defaultValue,
  onChange,
  chipColor = '#27272a',
  activeColor = '#f5f5f5',
  textColor = '#f5f5f5',
  activeTextColor = '#18181b',
  size = 'md',
  variant = 'chip',
  gap = 8,
  radius = 999,
  columns,
  noWrap = false,
  swell = 0.20,
  barge = 0,
  shrink = 0.03,
  jelly = 1.0,
  bounce = 0.25,
  stagger = 0,
  stiffness = 350,
  disabled = false,
  scrollable = false,
  fadeColor,
  blurWidth = 24,
  style,
  presentation = 'auto',
  dropdownHeight,
}) => {
  const scrollEdges = useHorizontalScrollEdges();
  const { themeMode, selectionStyle } = useLiquidGlass();
  const isDark = themeMode === 'dark';
  const normalizedItems: JellyRadioItem[] =
    items === 'levels'
      ? LEVELS_PRESET
      : items.map((entry) =>
          typeof entry === 'string' ? { value: entry, label: entry } : entry
        );

  const initialValue =
    value ?? defaultValue ?? normalizedItems.find((i) => !i.disabled)?.value ?? '';
  const [innerValue, setInnerValue] = useState(initialValue);
  const [selectionSeq, setSelectionSeq] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  const currentValue = value !== undefined ? value : innerValue;

  const handleSelect = (index: number) => {
    const picked = normalizedItems[index];
    if (!picked || disabled || picked.disabled) return;
    triggerSelection();
    if (value === undefined) {
      setInnerValue(picked.value);
    }
    // Animate the tapped chip once, even if a controlled value commits later.
    setActiveIndex(index);
    setSelectionSeq((s) => s + 1);
    onChange?.(picked.value, index);
  };

  const gridColumns = !scrollable && columns && columns > 1 ? Math.floor(columns) : 0;
  const renderChip = (item: JellyRadioItem, idx: number) => (
    <JellyChip
      key={item.value}
      item={item}
      index={idx}
      activeIndex={activeIndex}
      selectionSeq={selectionSeq}
      isSelected={item.value === currentValue}
      chipColor={chipColor}
      activeColor={activeColor}
      textColor={textColor}
      activeTextColor={activeTextColor}
      size={size}
      variant={variant}
      radius={radius}
      swell={swell}
      barge={barge}
      shrink={shrink}
      jelly={jelly}
      bounce={bounce}
      stagger={stagger}
      stiffness={stiffness}
      columns={gridColumns || undefined}
      groupDisabled={disabled}
      onSelect={handleSelect}
    />
  );
  const rowContent = (
    <View
      accessibilityRole="radiogroup"
      style={[
        gridColumns ? styles.grid : styles.row,
        !gridColumns && (scrollable || noWrap ? styles.rowNoWrap : styles.rowWrap),
        { gap },
        !scrollable && style,
      ]}
    >
      {gridColumns ? Array.from({ length: Math.ceil(normalizedItems.length / gridColumns) }, (_, row) => (
        <View key={normalizedItems[row * gridColumns].value} style={[styles.row, { gap }]}>
          {Array.from({ length: gridColumns }, (_, col) => {
            const index = row * gridColumns + col;
            const item = normalizedItems[index];
            return item ? renderChip(item, index) : <View key={`empty-${col}`} style={{ flex: 1 }} />;
          })}
        </View>
      )) : normalizedItems.map(renderChip)}
    </View>
  );

  if (presentation === 'auto' && selectionStyle === 'dropdown' && normalizedItems.length > 1) {
    return <DropdownSelect
      items={normalizedItems.map(item => ({ ...item, label: item.label || item.accessibilityLabel || item.value }))}
      value={currentValue} onChange={(_, index) => handleSelect(index)} disabled={disabled}
      backgroundColor={chipColor} textColor={textColor} style={style}
      triggerHeight={dropdownHeight ?? SIZE_METRICS[size].minHeight}
    />;
  }

  if (scrollable) {
    const resolvedFade = fadeColor || (isDark ? 'rgba(18, 18, 22, 0.85)' : 'rgba(255, 255, 255, 0.85)');
    return (
      <HorizontalEdgeFade style={[styles.scrollWrap, style]} tint={resolvedFade} width={blurWidth} left={scrollEdges.left} right={scrollEdges.right}>
        <ScrollView
          horizontal
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onLayout={scrollEdges.onLayout}
          onContentSizeChange={scrollEdges.onContentSizeChange}
          onScroll={scrollEdges.onScroll}
          scrollEventThrottle={16}
          style={styles.scrollViewport}
          contentContainerStyle={styles.scrollContent}
        >
          {rowContent}
        </ScrollView>
      </HorizontalEdgeFade>
    );
  }

  return rowContent;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  grid: { width: '100%', flexDirection: 'column' },
  tile: { flexDirection: 'column', paddingHorizontal: 6, paddingVertical: 12, minHeight: 68, gap: 7 },
  rowWrap: {
    flexWrap: 'wrap',
  },
  rowNoWrap: {
    flexWrap: 'nowrap',
  },
  scrollWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  scrollViewport: {
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 6,
    // The surrounding form supplies the gutter, including on iOS.
    paddingHorizontal: 0,
    overflow: 'visible',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    letterSpacing: -0.1,
  },
});

export default JellyRadio;
