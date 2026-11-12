import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  Button,
  DatePicker,
  GlassEffectContainer,
  HStack,
  Host,
  Picker,
  ScrollView as SwiftUIScrollView,
  Spacer,
  Text as SwiftUIText,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  datePickerStyle,
  disabled as disabledModifier,
  labelsHidden,
  pickerStyle,
  scrollIndicators,
  tag,
  tint,
  toggleStyle,
} from '@expo/ui/swift-ui/modifiers';
import { GlassContainer, isLiquidGlassAvailable } from 'expo-glass-effect';

export interface AppleRadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AppleGraphicalCalendarProps {
  title?: string;
  selectedDate: string | null;
  onSelectDate: (isoDate: string) => void;
  onToday: () => void;
  onClear?: () => void;
  allowClear?: boolean;
  isDark: boolean;
}

export interface AppleRadioControlProps {
  items: AppleRadioOption[];
  value: string;
  onChange: (value: string, index: number) => void;
  size?: 'sm' | 'md' | 'lg';
  gap?: number;
  columns?: number;
  scrollable?: boolean;
  disabled?: boolean;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface AppleToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isDark: boolean;
  tintColor?: string;
}

export interface NativeGlassContainerProps {
  spacing?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const parseISODateSafe = (isoDate: string | null): Date => {
  if (isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d, 12, 0, 0);
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
};

const dateToISOSafe = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const AppleGraphicalCalendar: React.FC<AppleGraphicalCalendarProps> = ({
  title = 'Select Date',
  selectedDate,
  onSelectDate,
  onToday,
  onClear,
  allowClear = true,
  isDark,
}) => {
  const hasGlass = isLiquidGlassAvailable();
  const selectionDate = parseISODateSafe(selectedDate);
  const secondaryStyle = buttonStyle(hasGlass ? 'glass' : 'bordered');
  const primaryStyle = buttonStyle(hasGlass ? 'glassProminent' : 'borderedProminent');

  const actionButtons = (
    <HStack spacing={10}>
      <Button
        label="Today"
        onPress={onToday}
        modifiers={[secondaryStyle, buttonBorderShape('capsule'), controlSize('regular')]}
      />
      <Spacer />
      {allowClear && onClear ? (
        <Button
          label="All Dates"
          onPress={onClear}
          modifiers={[primaryStyle, buttonBorderShape('capsule'), controlSize('regular')]}
        />
      ) : null}
    </HStack>
  );

  return (
    <Host matchContents={{ vertical: true }} colorScheme={isDark ? 'dark' : 'light'} style={{ width: '100%' }}>
      <VStack spacing={14}>
        <DatePicker
          title={title}
          selection={selectionDate}
          displayedComponents={['date']}
          onDateChange={(date) => onSelectDate(dateToISOSafe(date))}
          modifiers={[datePickerStyle('graphical'), tint('#10B981')]}
        />
        {hasGlass ? (
          <GlassEffectContainer spacing={10}>{actionButtons}</GlassEffectContainer>
        ) : (
          actionButtons
        )}
      </VStack>
    </Host>
  );
};

export const AppleRadioControl: React.FC<AppleRadioControlProps> = ({
  items,
  value,
  onChange,
  size = 'md',
  gap = 8,
  columns,
  scrollable = false,
  disabled = false,
  isDark,
  style,
}) => {
  const hasGlass = isLiquidGlassAvailable();
  const colorScheme = isDark ? 'dark' : 'light';
  const ctrlSize = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'regular';

  // Use Apple's native segmented control for compact non-grid radio groups (up to 4 items)
  if (!scrollable && !columns && items.length >= 2 && items.length <= 4) {
    const segHeight = size === 'sm' ? 32 : size === 'lg' ? 40 : 35;
    return (
      <View style={[{ width: '100%' }, style]}>
        <Host
          colorScheme={colorScheme}
          style={{ width: '100%', height: segHeight }}
        >
          <Picker
            label="Selection"
            selection={value}
            onSelectionChange={(selected) => {
              if (disabled || selected == null) return;
              const strVal = String(selected);
              const idx = items.findIndex((i) => i.value === strVal);
              if (idx >= 0 && !items[idx].disabled) {
                onChange(strVal, idx);
              }
            }}
            modifiers={[
              labelsHidden(),
              pickerStyle('segmented'),
              ...(disabled ? [disabledModifier(true)] : []),
            ]}
          >
            {items.map((item) => (
              <SwiftUIText key={item.value} modifiers={[tag(item.value)]}>
                {item.label}
              </SwiftUIText>
            ))}
          </Picker>
        </Host>
      </View>
    );
  }

  const renderChipButton = (item: AppleRadioOption, idx: number) => {
    const isSelected = item.value === value;
    const isDisabled = disabled || Boolean(item.disabled);
    const btnStyle = isSelected
      ? buttonStyle(hasGlass ? 'glassProminent' : 'borderedProminent')
      : buttonStyle(hasGlass ? 'glass' : 'bordered');

    return (
      <Button
        key={item.value}
        label={item.label}
        onPress={() => {
          if (!isDisabled) onChange(item.value, idx);
        }}
        modifiers={[
          btnStyle,
          buttonBorderShape('capsule'),
          controlSize(ctrlSize),
          ...(isDisabled ? [disabledModifier(true)] : []),
        ]}
      />
    );
  };

  if (columns && columns > 1) {
    const rows: AppleRadioOption[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      rows.push(items.slice(i, i + columns));
    }

    const gridNode = (
      <VStack spacing={gap}>
        {rows.map((rowItems, rIdx) => (
          <HStack key={`row-${rIdx}`} spacing={gap}>
            {rowItems.map((item) => {
              const globalIdx = items.findIndex((x) => x.value === item.value);
              return renderChipButton(item, globalIdx);
            })}
          </HStack>
        ))}
      </VStack>
    );

    return (
      <View style={[{ width: '100%' }, style]}>
        <Host matchContents={{ vertical: true }} colorScheme={colorScheme} style={{ width: '100%' }}>
          {hasGlass ? (
            <GlassEffectContainer spacing={gap}>{gridNode}</GlassEffectContainer>
          ) : (
            gridNode
          )}
        </Host>
      </View>
    );
  }

  const horizontalChips = <HStack spacing={gap}>{items.map(renderChipButton)}</HStack>;

  return (
    <View style={[{ width: '100%' }, style]}>
      <Host matchContents={{ vertical: true }} colorScheme={colorScheme} style={{ width: '100%' }}>
        <SwiftUIScrollView axes="horizontal" modifiers={[scrollIndicators('never')]}>
          {hasGlass ? (
            <GlassEffectContainer spacing={gap}>{horizontalChips}</GlassEffectContainer>
          ) : (
            horizontalChips
          )}
        </SwiftUIScrollView>
      </Host>
    </View>
  );
};

export const AppleToggleSwitch: React.FC<AppleToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  isDark,
  tintColor = '#10B981',
}) => (
  <Host
    matchContents
    colorScheme={isDark ? 'dark' : 'light'}
    style={{ width: 58, height: 32 }}
  >
    <Toggle
      isOn={checked}
      label=""
      onIsOnChange={(next) => {
        if (!disabled) onChange(next);
      }}
      modifiers={[
        labelsHidden(),
        toggleStyle('switch'),
        tint(tintColor),
        ...(disabled ? [disabledModifier(true)] : []),
      ]}
    />
  </Host>
);

export const NativeGlassContainer: React.FC<NativeGlassContainerProps> = ({
  spacing = 10,
  style,
  children,
}) => {
  if (!isLiquidGlassAvailable()) {
    return <View style={style}>{children}</View>;
  }
  return (
    <GlassContainer spacing={spacing} style={style}>
      {children}
    </GlassContainer>
  );
};
