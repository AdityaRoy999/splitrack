import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AltArrowDownIcon } from '@solar-icons/react-native/bold/alt-arrow-down';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { measureNodeInWindow, type WindowRect } from '../../utils/measureWindow';
import { AppleRadioControl } from './AppleNativeControls';

export interface DropdownOption {
  value: string; label: string; icon?: React.ReactNode; color?: string; disabled?: boolean; accessibilityLabel?: string;
}

interface DropdownSelectProps {
  items: DropdownOption[]; value: string; onChange(value: string, index: number): void;
  disabled?: boolean; label?: string; backgroundColor?: string; textColor?: string; style?: StyleProp<ViewStyle>;
  triggerHeight?: number;
}

export function DropdownSelect({ items, value, onChange, disabled, label = 'Choose an option', backgroundColor, textColor, style, triggerHeight = 38 }: DropdownSelectProps) {
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const dark = themeMode === 'dark';
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchor = useRef<React.ComponentRef<typeof View>>(null);
  const [rect, setRect] = useState<WindowRect | null>(null);
  const [open, setOpen] = useState(false);
  const [retained, setRetained] = useState(false);
  const [query, setQuery] = useState('');
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const chosen = items.find(item => item.value === value);
  const color = textColor ?? (dark ? '#F4F4F5' : '#18181B');
  const surface = dark ? '#1C1C22' : '#FFFFFF';
  const optionIcon = (item: DropdownOption) => item.color
    ? <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: item.color }} />
    : React.isValidElement<{ color?: string }>(item.icon) && 'color' in item.icon.props
      ? React.cloneElement(item.icon, { color }) : item.icon;
  const filtered = useMemo(() => items.map((item, index) => ({ item, index })).filter(({ item }) => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, query]);

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: open ? 150 : 120, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(({ finished }) => { if (finished && !open) setRetained(false); });
    return () => animation.stop();
  }, [open, progress]);
  useEffect(() => {
    if (!retained) return;
    const shown = Keyboard.addListener('keyboardDidShow', event => setKeyboardTop(event.endCoordinates.screenY));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => { shown.remove(); hidden.remove(); };
  }, [retained]);
  const close = () => { Keyboard.dismiss(); setOpen(false); };
  const show = () => {
    if (disabled || !items.length) return;
    Keyboard.dismiss();
    measureNodeInWindow(anchor.current, measured => {
      setRect(measured); setQuery(''); setKeyboardTop(null); setRetained(true); setOpen(true);
    });
  };
  const menuWidth = Math.min(Math.max(rect?.width ?? 220, 220), width - 24);
  const menuHeight = Math.min(352, Math.max(96, items.length * 48 + (items.length >= 8 ? 58 : 12)));
  const bottomEdge = Math.min(height - insets.bottom, keyboardTop ?? height);
  const below = bottomEdge - (rect ? rect.y + rect.height + 8 : 0);
  const above = Math.max(0, (rect?.y ?? 0) - insets.top - 12);
  const opensBelow = below >= Math.min(menuHeight, 180) || below >= above;
  const maxHeight = Math.min(menuHeight, Math.max(96, opensBelow ? below - 12 : Math.min(above, bottomEdge - insets.top - 24)));
  const left = Math.max(12, Math.min(rect?.x ?? 12, width - menuWidth - 12));
  const top = Math.max(insets.top + 8, Math.min(bottomEdge - maxHeight - 12, opensBelow ? (rect?.y ?? 0) + (rect?.height ?? 0) + 8 : (rect?.y ?? 0) - maxHeight - 8));

  if (Platform.OS === 'ios' && isLiquidGlassEnabled) return <AppleRadioControl menu items={items} value={value}
    onChange={onChange} disabled={disabled} isDark={dark} style={style} />;

  return (
    <View ref={anchor} collapsable={false} style={[styles.anchor, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${chosen?.label ?? 'None selected'}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={show} style={[styles.trigger, { height: triggerHeight, borderRadius: 12, backgroundColor: backgroundColor ?? (dark ? '#1C1C22' : '#EFEFF4'), opacity: disabled ? 0.5 : 1 }]}>
        {chosen?.icon || chosen?.color ? <View pointerEvents="none">{optionIcon(chosen)}</View> : null}
        <Text numberOfLines={1} style={[styles.triggerLabel, { color }]}>{chosen?.label || label}</Text>
        <View pointerEvents="none" style={styles.arrow}><AltArrowDownIcon size={16} color={color} /></View>
      </Pressable>
      {retained && rect ? <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close selection menu" onPress={close} />
          <Animated.View accessibilityViewIsModal onAccessibilityEscape={close} style={[styles.menu, { left, top, width: menuWidth, maxHeight, backgroundColor: surface, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [opensBelow ? -6 : 6, 0] }) }] }]}>
            {items.length >= 8 ? <TextInput style={[styles.search, { color, backgroundColor: dark ? '#27272D' : '#F4F4F6' }]} accessibilityLabel="Search options" placeholder="Search options" placeholderTextColor={dark ? '#8E8E93' : '#71717A'} value={query} onChangeText={setQuery} autoCorrect={false} /> : null}
            <FlatList keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} data={filtered} keyExtractor={({ item }) => item.value} extraData={value} style={{ flexGrow: 0 }} ListEmptyComponent={<Text style={[styles.empty, { color }]}>No matching options</Text>} renderItem={({ item: { item, index } }) => <Pressable accessibilityRole="radio" accessibilityLabel={item.accessibilityLabel ?? item.label} accessibilityState={{ checked: value === item.value, disabled: Boolean(item.disabled) }} disabled={item.disabled} onPress={() => { onChange(item.value, index); close(); }} style={[styles.option, { backgroundColor: value === item.value ? (dark ? '#2C2C34' : '#F4F4F6') : 'transparent', opacity: item.disabled ? 0.45 : 1 }]}>
              {item.icon || item.color ? <View pointerEvents="none">{optionIcon(item)}</View> : null}
              <Text style={[styles.label, { color }]}>{item.label}</Text>
              {value === item.value ? <CheckCircleIcon size={18} color="#10B981" /> : null}
            </Pressable>} />
          </Animated.View>
        </View>
      </Modal> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flexShrink: 0, minWidth: 96 },
  trigger: { paddingLeft: 12, paddingRight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 0 },
  triggerLabel: { flexShrink: 1, minWidth: 0, fontSize: 13, fontWeight: '500' },
  arrow: { position: 'absolute', top: 0, bottom: 0, right: 8, width: 20, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 13, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)' },
  menu: { position: 'absolute', borderRadius: 18, padding: 6, overflow: 'hidden', borderWidth: 0 },
  option: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12 },
  search: { height: 42, borderRadius: 12, marginBottom: 6, paddingHorizontal: 12, borderWidth: 0 },
  empty: { padding: 16, fontSize: 13 },
});
