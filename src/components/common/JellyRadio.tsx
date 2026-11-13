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
import { GradualBlur } from '../effects/GradualBlur';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface JellyRadioItem {
  value: string;
  label: string;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
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
  style?: StyleProp<ViewStyle>;
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
  const [translateX] = useState(() => new Animated.Value(0));

  const metrics = SIZE_METRICS[size];
  const isDisabled = groupDisabled || !!item.disabled;

  useEffect(() => {
    if (selectionSeq === 0) return;

    scaleX.stopAnimation();
    scaleY.stopAnimation();
    translateX.stopAnimation();

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
          }),
          Animated.spring(scaleX, {
            toValue: 1,
            stiffness: 350,
            damping: 14,
            mass: 0.75,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleY, {
            toValue: yPeak,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            stiffness: 350,
            damping: 14,
            mass: 0.75,
            useNativeDriver: USE_NATIVE_DRIVER,
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
          }),
          Animated.spring(scaleX, {
            toValue: 1,
            stiffness: 350,
            damping: 16,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleY, {
            toValue: stretch,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            stiffness: 350,
            damping: 16,
            useNativeDriver: USE_NATIVE_DRIVER,
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
    translateX,
  ]);

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 1.04,
        stiffness: 650,
        damping: 24,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scaleY, {
        toValue: 0.94,
        stiffness: 650,
        damping: 24,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (isDisabled || isSelected) return;
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 1,
        stiffness: 350,
        damping: 18,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scaleY, {
        toValue: 1,
        stiffness: 350,
        damping: 18,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  };

  const columnWrapStyle: ViewStyle | undefined =
    columns && columns > 1
      ? { width: `${Math.floor(94 / columns)}%` as `${number}%`, flexGrow: 1 }
      : undefined;

  return (
    <Animated.View
      style={[
        columnWrapStyle,
        {
          transform: [{ translateX }, { scaleX }, { scaleY }],
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
        style={[
          styles.chip,
          columns && columns > 1 ? { width: '100%' } : null,
          {
            backgroundColor: isSelected ? activeColor : chipColor,
            borderRadius: radius,
            paddingHorizontal: metrics.paddingHorizontal,
            paddingVertical: metrics.paddingVertical,
            minHeight: metrics.minHeight,
            gap: metrics.iconGap,
          },
        ]}
      >
        {item.icon ? <View style={styles.iconSlot}>{item.icon}</View> : null}
        <Text
          numberOfLines={1}
          style={[
            styles.chipLabel,
            {
              color: isSelected ? activeTextColor : textColor,
              fontSize: metrics.fontSize,
              fontWeight: '500',
            },
          ]}
        >
          {item.label}
        </Text>
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
  style,
}) => {
  const { themeMode } = useLiquidGlass();
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

  const currentValue = value !== undefined ? value : innerValue;
  const activeIndex = Math.max(
    0,
    normalizedItems.findIndex((i) => i.value === currentValue)
  );

  const handleSelect = (index: number) => {
    const picked = normalizedItems[index];
    if (!picked || disabled || picked.disabled) return;
    triggerSelection();
    if (value === undefined) {
      setInnerValue(picked.value);
    }
    setSelectionSeq((s) => s + 1);
    onChange?.(picked.value, index);
  };

  const rowContent = (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.row,
        scrollable || noWrap ? styles.rowNoWrap : styles.rowWrap,
        { gap },
        !scrollable && style,
      ]}
    >
      {normalizedItems.map((item, idx) => (
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
          radius={radius}
          swell={swell}
          barge={barge}
          shrink={shrink}
          jelly={jelly}
          bounce={bounce}
          stagger={stagger}
          stiffness={stiffness}
          columns={columns}
          groupDisabled={disabled}
          onSelect={handleSelect}
        />
      ))}
    </View>
  );

  if (scrollable) {
    const resolvedFade = fadeColor || (isDark ? 'rgba(18, 18, 22, 0.85)' : 'rgba(255, 255, 255, 0.85)');
    return (
      <View style={[styles.scrollWrap, style]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {rowContent}
        </ScrollView>
        <GradualBlur position="left" width={16} strength={1.1} layers={5} tint={resolvedFade} />
        <GradualBlur position="right" width={18} strength={1.1} layers={5} tint={resolvedFade} />
      </View>
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
  scrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 10,
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
