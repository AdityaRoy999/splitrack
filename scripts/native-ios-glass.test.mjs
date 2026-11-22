import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const nativeViews = Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable'].map(name => [name, name]));
nativeViews.StyleSheet = { create: styles => styles, absoluteFill: {}, flatten: styles => Object.assign({}, ...[].concat(styles)) };

async function component(path, modules, exportName, extraSource = '') {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code + extraSource, { React, module, exports: module.exports, require(name) {
    if (Object.hasOwn(modules, name)) return modules[name];
    if (name === 'react') return React;
    if (name === 'react-native') return nativeViews;
    throw new Error(`Unexpected import ${name}`);
  } });
  return module.exports[exportName];
}

function all(node, predicate) {
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props.children).flatMap(child => all(child, predicate))];
}

test('native material ignores custom tints and painted backing in cards and sheets', async () => {
  const mode = { isLiquidGlassEnabled: true, themeMode: 'dark' };
  const Surface = await component('src/components/glass/GlassSurface.ios.tsx', {
    'expo-blur': { BlurView: 'BlurView' },
    'expo-glass-effect': { GlassView: 'GlassView', isGlassEffectAPIAvailable: () => true, isLiquidGlassAvailable: () => true },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    '../common/BackdropSurfaceContext': { BackdropSurfaceContext: React.createContext(null) },
  }, 'GlassSurface');
  const props = { tintColor: 'rgba(18,18,24,0.88)', style: { backgroundColor: '#17171C' }, matteColor: '#111114', children: 'rows' };
  const card = Surface(props);
  assert.equal(nativeViews.StyleSheet.flatten(card.props.style).backgroundColor, 'transparent');
  const glass = all(card, node => node.type === 'GlassView')[0];
  assert.equal(glass.props.tintColor, undefined);
  assert.equal(glass.props.glassEffectStyle, 'regular');
  assert.equal(all(card, node => node.props.value === 'transparent').length, 1, 'rows inherit transparent backing');
  mode.isLiquidGlassEnabled = false;
  const matte = Surface(props);
  assert.equal(all(matte, node => node.type === 'GlassView').length, 0);
  assert.equal(nativeViews.StyleSheet.flatten(matte.props.style).backgroundColor, '#111114');
});

test('settled iOS Quick Send photos render outside SVG ForeignObject and still open the friend', async () => {
  const friend = { id: 'sai', name: 'Sai Ardhendu', avatar: 'https://photos.example.invalid/sai.jpg', netBalance: 0 };
  let selected;
  const Tray = await component('src/components/home/QuickSendTray.tsx', {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' } },
    'react-native-svg': { default: 'Svg', ClipPath: 'ClipPath', Defs: 'Defs', ForeignObject: 'ForeignObject', Path: 'Path' },
    '@solar-icons/react-native/bold/add-circle': { AddCircleIcon: 'AddCircle' },
    '@solar-icons/react-native/bold/check-circle': { CheckCircleIcon: 'CheckCircle' },
    '../../utils/haptics': { ImpactStyle: {}, triggerImpact() {} },
    '../../store/SplitTrackStore': { useSplitTrack: () => ({ friends: [friend] }) },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
    '../common/MotionPrimitives': { AnimatedPressable: 'AnimatedPressable' },
    '../common/ScrollEdgeFade': { HorizontalEdgeFade: 'EdgeFade', useHorizontalScrollEdges: () => ({}) },
    '../common/UserAvatar': { UserAvatar: 'UserAvatar' },
    '../../constants/buttonSizes': { COMPACT_ICON_BUTTON_STYLE: {}, COMPACT_BUTTON_HIT_SLOP: {} },
  }, 'QuickSendTray');
  const tree = Tray({ onSelectFriend: value => { selected = value; }, onAddFriend() {} });
  assert.equal(all(tree, node => node.type === 'ForeignObject').length, 0);
  const avatar = all(tree, node => node.type === 'UserAvatar')[0];
  assert.equal(avatar.props.avatarUri, friend.avatar);
  const friendButton = all(tree, node => node.type === 'AnimatedPressable' && all(node, item => item.type === 'UserAvatar').length)[0];
  friendButton.props.onPress();
  assert.equal(selected, friend);
});

test('native sheets preserve the system background and use the saved appearance', async () => {
  const calls = [];
  const Sheet = await component('src/components/common/AppleSheet.ios.tsx', {
    'react-native': { ...nativeViews, useWindowDimensions: () => ({ width: 390 }) },
    '@expo/ui/swift-ui': { BottomSheet: 'BottomSheet', Group: 'Group', Host: 'Host', RNHostView: 'RNHostView' },
    '@expo/ui/swift-ui/modifiers': Object.fromEntries(['preferredColorScheme', 'presentationDetents', 'presentationDragIndicator', 'ignoreSafeArea'].map(name => [name, value => { calls.push([name, value]); return { name, value }; }])),
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
  }, 'AppleSheet');
  let closed = 0, dismissed = 0;
  const tree = Sheet({ visible: true, children: 'draft', onRequestClose: () => closed++, onDismiss: () => dismissed++ });
  const sheet = all(tree, node => node.type === 'BottomSheet')[0];
  assert.equal(sheet.props.presentationBackground, undefined, 'system owns the sheet material');
  assert.ok(calls.some(([name, value]) => name === 'preferredColorScheme' && value === 'dark'));
  sheet.props.onIsPresentedChange(false);
  sheet.props.onDismiss();
  assert.equal(closed, 1); assert.equal(dismissed, 1);
});

test('surface changes keep the same navigator and dock action handlers', async () => {
  const mode = { isLiquidGlassEnabled: true };
  let opened = 0, navigated;
  const Tabs = Object.assign(function Tabs() {}, { Screen: 'Screen' });
  const AppTabs = await component('src/app/(tabs)/_layout.tsx', {
    'expo-router': { useSegments: () => ['(tabs)', 'expenses'], Tabs },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    '../../navigation/MainTabsContext': { useMainTabs: () => ({ hidden: false, openSplit: () => opened++, navigate: value => { navigated = value; } }) },
    '../../components/glass/GlassDock': { GlassDock: 'GlassDock' },
  }, 'AppTabs', '\nmodule.exports.AppTabs = AppTabs;');
  const glass = AppTabs();
  mode.isLiquidGlassEnabled = false;
  const matte = AppTabs();
  assert.equal(glass.type, matte.type, 'Glass/Matte does not replace the navigator or discard scroll positions');
  const dock = glass.props.tabBar();
  assert.equal(dock.type, 'GlassDock');
  assert.equal(dock.props.currentTab, 'expenses');
  dock.props.onQuickAdd(); dock.props.onTabChange('trips');
  assert.equal(opened, 1); assert.equal(navigated, 'trips');
  assert.equal(all(glass, node => node.type === 'Screen' && node.props.name === 'split')[0].props.options.href, null);
});

test('glass buttons retain the supplied icon, one-line label and full-width footer geometry', async () => {
  const Pill = await component('src/components/glass/GlassPill.tsx', {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark', isLiquidGlassEnabled: true }) },
    '../../utils/haptics': { triggerImpact() {}, ImpactStyle: {} },
    '../common/MotionPrimitives': { AnimatedPressable: 'AnimatedPressable' },
    './GlassSurface': { GlassSurface: 'GlassSurface' },
    '../common/ModalVisualContext': { useModalVisual: () => true },
    '../../constants/buttonSizes': { COMPACT_BUTTON_HEIGHT: 36, COMPACT_BUTTON_HIT_SLOP: {} },
    '../../theme/actionColors': { ACTION_COLORS: { danger: '#A92F3A', success: '#16734B', onAction: '#FFFFFF' } },
  }, 'GlassPill');
  const icon = React.createElement('OriginalSolarIcon');
  const footer = Pill({ label: 'Save & Split Expense', icon, size: 'lg', variant: 'accent', onPress() {} });
  const outer = nativeViews.StyleSheet.flatten(footer.props.style);
  assert.equal(outer.width, '100%');
  const label = all(footer, node => node.type === 'Text')[0];
  assert.equal(label.props.numberOfLines, 1);
  assert.equal(all(footer, node => node.type === 'OriginalSolarIcon')[0].type, icon.type);
  assert.equal(all(footer, node => node.type === 'Host').length, 0, 'button width no longer depends on SwiftUI intrinsic measurement');
  const close = Pill({ label: 'Close', size: 'lg', variant: 'dark', onPress() {} });
  assert.equal(all(close, node => node.type === 'GlassSurface').length, 1);
});

test('sheet viewport uses native keyboard progress and a single avoidance owner', async () => {
  const Viewport = await component('src/components/common/SheetKeyboardViewport.tsx', {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' } },
    'react-native-keyboard-controller': { KeyboardProvider: 'KeyboardProvider', KeyboardAvoidingView: 'KeyboardAvoidingView' },
  }, 'SheetKeyboardViewport');
  const tree = Viewport({ children: React.createElement('PinnedSaveButton') });
  assert.equal(tree.type, 'KeyboardProvider');
  const viewport = all(tree, node => node.type === 'KeyboardAvoidingView');
  assert.equal(viewport.length, 1);
  assert.equal(viewport[0].props.behavior, 'padding');
  assert.equal(viewport[0].props.automaticOffset, true, 'sheet position is measured in screen coordinates');
  assert.equal(all(viewport[0], node => node.type === 'PinnedSaveButton').length, 1);
});

test('expense form keeps its three cards, payment profiles and pinned save action in glass mode', async () => {
  const Animated = { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } interpolate() { return 0; } } };
  const hooks = { ...React, memo: value => value, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useMemo: callback => callback() };
  const Form = await component('src/components/split/AddExpenseModal.tsx', {
    react: hooks,
    'react-native': { ...nativeViews, Animated, Platform: { OS: 'ios' } },
    '../../store/SplitTrackStore': { useSplitTrack: () => ({ accounts: [{ id: 'bank', title: 'Bank UPI', upiId: 'synthetic@bank', kind: 'upi' }], selectedAccountId: 'bank', friends: [{ id: 'sai', name: 'Sai Ardhendu', handle: '@sai', avatar: '' }], trips: [], transactions: [], categories: [{ name: 'Food', iconKey: 'cup-hot' }] }) },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ currency: 'INR', themeMode: 'dark', isLiquidGlassEnabled: true }) },
    '../../auth/AuthContext': { useAuth: () => ({ profile: { handle: '@you', avatar: '' } }) },
    '../../hooks/useAsyncAction': { useAsyncAction: () => ({}), FormError: 'FormError' },
    '../../theme/colors': { currencies: { INR: { symbol: '₹' } } },
    '../../utils/splitAmounts': { allocateSplitAmounts: () => [0] },
    '../../constants/solarIconsCatalog': { renderSolarIcon: () => React.createElement('CategoryIcon') },
    '../../utils/haptics': {}, 'expo-location': {},
    'lucide-react-native': { LocateFixed: 'LocateFixed' },
    '../../constants/buttonSizes': {},
    '../common/CalendarDatePickerModal': { getTodayLocalISO: () => '2026-11-23', formatDisplayDate: value => value, CalendarDatePickerModal: 'CalendarDatePickerModal' },
    ...Object.fromEntries(['close-circle', 'check-circle', 'add-circle', 'calendar-date', 'alt-arrow-right', 'map-point', 'magnifier', 'pen-2'].map(name => [`@solar-icons/react-native/bold/${name}`, new Proxy({}, { get: (_, key) => String(key) })])),
    ...Object.fromEntries(['SheetFooter', 'SheetCloseButton', 'SheetHandle', 'SheetModal', 'ScrollEdgeFade', 'GlassModalSheet', 'ModalBackdrop', 'JellyRadio', 'SpringCheck', 'UserAvatar'].map(name => [`../common/${name}`, { [name]: name }])),
    '../common/MotionPrimitives': { AnimatedPressable: 'AnimatedPressable' },
    '../common/SmoothCollapsible': { SmoothCollapsible: 'SmoothCollapsible' },
    '../glass/GlassSurface': { GlassSurface: 'GlassSurface' }, '../glass/GlassPill': { GlassPill: 'GlassPill' },
    '../categories/AddCategoryModal': { AddCategoryModal: 'AddCategoryModal' },
  }, 'AddExpenseModal');
  const tree = Form({ visible: true, onClose() {} });
  assert.equal(all(tree, node => node.type === 'GlassSurface').length, 3);
  const profiles = all(tree, node => node.type === 'JellyRadio' && node.props.items?.some(item => item.value === 'bank'))[0];
  assert.equal(profiles.props.items[0].label, 'synthetic@bank');
  const footer = all(tree, node => node.type === 'SheetFooter')[0];
  assert.equal(all(footer, node => node.type === 'GlassPill' && node.props.label === 'Save & Split Expense').length, 1);
  const scroller = all(tree, node => node.type === 'ScrollEdgeFade')[0];
  assert.equal(all(scroller, node => node.type === 'GlassPill' && node.props.label === 'Save & Split Expense').length, 0);
});

test('iOS dock keeps four original tabs and a separate plus in both surface modes', async () => {
  const mode = { themeMode: 'dark', isLiquidGlassEnabled: true };
  const hooks = { ...React, memo: value => value, useEffect() {}, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: value => ({ current: value }) };
  const Dock = await component('src/components/glass/GlassDock.tsx', {
    react: hooks,
    'react-native': { ...nativeViews, Platform: { OS: 'ios' }, useWindowDimensions: () => ({ width: 390 }), Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    '../../utils/haptics': { triggerImpact() {}, ImpactStyle: {} },
    './GlassSurface': { GlassSurface: 'GlassSurface' },
    '../common/AppleNativeControls': { NativeGlassContainer: 'NativeGlassContainer' },
    '../../utils/measureWindow': {},
    ...Object.fromEntries(['home-2', 'bill-list', 'add-circle', 'users-group-two-rounded', 'pie-chart-2'].map(name => [`@solar-icons/react-native/bold/${name}`, new Proxy({}, { get: (_, key) => String(key) })])),
  }, 'GlassDock');
  for (const glass of [true, false]) {
    mode.isLiquidGlassEnabled = glass;
    let opened = 0, selected;
    const tree = Dock({ currentTab: 'home', onQuickAdd: () => opened++, onTabChange: tab => { selected = tab; } });
    const tabs = all(tree, node => node.props.item);
    assert.deepEqual(tabs.map(node => node.props.item.key), ['home', 'expenses', 'trips', 'analytics']);
    assert.deepEqual(tabs.map(node => node.props.item.icon('#fff').type), ['Home2Icon', 'BillListIcon', 'UsersGroupTwoRoundedIcon', 'PieChart2Icon']);
    tabs[1].props.onPress(); assert.equal(selected, 'expenses');
    const plus = all(tree, node => node.props.accessibilityLabel === 'Add split expense')[0];
    assert.equal(all(plus, node => node.type === 'AddCircleIcon').length, 1);
    plus.props.onPress(); assert.equal(opened, 1);
  }
});
