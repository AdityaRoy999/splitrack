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
  const props = { interactive: true, tintColor: 'rgba(18,18,24,0.88)', style: { backgroundColor: '#17171C', borderRadius: 22, borderTopLeftRadius: 10 }, matteColor: '#111114', children: 'rows', backdrop: React.createElement('CardGradient') };
  const card = Surface(props);
  assert.equal(nativeViews.StyleSheet.flatten(card.props.style).backgroundColor, 'transparent');
  const glass = all(card, node => node.type === 'GlassView')[0];
  assert.equal(glass.props.tintColor, undefined);
  assert.equal(glass.props.glassEffectStyle, 'clear');
  assert.equal(nativeViews.StyleSheet.flatten(glass.props.style).borderRadius, 22, 'native glass follows the visible card corners');
  assert.equal(nativeViews.StyleSheet.flatten(glass.props.style).borderTopLeftRadius, 10);
  assert.equal(nativeViews.StyleSheet.flatten(card.props.style).borderRadius, 22);
  assert.deepEqual(React.Children.toArray(card.props.children).slice(0, 2).map(child => child.type), ['CardGradient', 'GlassView'], 'the restored gradient sits behind clear native glass');
  assert.equal(glass.props.isInteractive, false, 'surface buttons do not stretch or merge on press');
  assert.equal(all(card, node => node.props.value === 'transparent').length, 1, 'rows inherit transparent backing');
  mode.isLiquidGlassEnabled = false;
  const matte = Surface(props);
  assert.equal(all(matte, node => node.type === 'GlassView').length, 0);
  assert.equal(nativeViews.StyleSheet.flatten(matte.props.style).backgroundColor, '#111114');
  assert.equal(all(matte, node => node.type === 'CardGradient').length, 1);
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
    '../common/AppleGlassButton': { AppleGlassButton: 'AppleGlassButton' },
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
    '../common/AppleGlassButton': { AppleGlassButton: 'AppleGlassButton' },
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
  assert.equal(footer.type, 'AppleGlassButton');
  const NativeButton = await component('src/components/common/AppleGlassButton.ios.tsx', {
    './AppleGlassPressable': { AppleGlassPressable: 'AppleGlassPressable' },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
    '../../theme/actionColors': { ACTION_COLORS: { danger: '#A92F3A', success: '#16734B' } },
  }, 'AppleGlassButton');
  const rendered = NativeButton(footer.props);
  const outer = nativeViews.StyleSheet.flatten(rendered.props.style);
  assert.equal(outer.width, '100%');
  const label = all(rendered, node => node.type === 'Text')[0];
  assert.equal(label.props.numberOfLines, 1);
  assert.equal(all(rendered, node => node.type === 'OriginalSolarIcon')[0].type, icon.type);
  const close = Pill({ label: 'Close', size: 'lg', variant: 'dark', onPress() {} });
  assert.equal(close.type, 'AppleGlassButton');
});

test('native glass actions use fixed layout and noninteractive untinted material without scaling', async () => {
  let bounds = { width: 0, height: 36 };
  const modifier = name => value => ({ name, value });
  const Native = await component('src/components/common/AppleGlassPressable.ios.tsx', {
    '../glass/GlassPanel': { GlassPanel: 'GlassPanel' },
    react: { ...React, useState: () => [bounds, update => { bounds = update(bounds); }] },
    '@expo/ui/swift-ui': Object.fromEntries(['Button', 'HStack', 'Host', 'RNHostView'].map(name => [name, name])),
    '@expo/ui/swift-ui/modifiers': { ...Object.fromEntries(['accessibilityLabel', 'buttonStyle', 'contentShape', 'disabled', 'frame', 'glassEffect', 'onLongPressGesture'].map(name => [name, modifier(name)])), shapes: { roundedRectangle: value => ({ type: 'roundedRectangle', ...value }) } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
    '../glass/GlassSurface': { GlassSurface: 'GlassSurface' },
    '../../theme/actionColors': { ACTION_COLORS: { danger: '#A92F3A', success: '#16734B' } },
  }, 'AppleGlassPressable');
  let pressed = 0;
  const props = { children: React.createElement('Text', { numberOfLines: 1 }, 'Save & Split Expense'), onPress: () => pressed++, style: { width: '100%' }, contentStyle: { height: 48 }, accessibilityLabel: 'Save expense' };
  const measuring = Native(props);
  all(measuring, node => node.props.onLayout)[0].props.onLayout({ nativeEvent: { layout: { width: 358, height: 48 } } });
  const tree = Native(props);
  const host = all(tree, node => node.type === 'Host')[0];
  assert.equal(host.props.matchContents, undefined);
  assert.equal(host.props.ignoreSafeArea, 'all', 'sheet keyboard avoidance owns movement');
  const frame = all(tree, node => node.type === 'HStack')[0].props.modifiers;
  assert.equal(frame[0].value.width, 358); assert.equal(frame[0].value.height, 48);
  assert.equal(frame[1].value.glass.interactive, false);
  assert.equal(frame[1].value.glass.variant, 'clear');
  assert.equal(frame[1].value.glass.tint, undefined);
  assert.equal(frame[2].name, 'contentShape', 'the full material area receives presses');
  assert.equal(all(tree, node => node.type === 'Text').length, 1, 'the label mounts exactly once');
  assert.equal(all(tree, node => node.type === 'RNHostView').length, 0, 'label layout stays in Yoga');
  const button = all(tree, node => node.type === 'Button')[0];
  assert.equal(button.props.modifiers[0].value, 'plain');
  button.props.onPress(); assert.equal(pressed, 1);
  all(Native({ ...props, disabled: true }), node => node.type === 'Button')[0].props.onPress();
  assert.equal(pressed, 1, 'disabled native action cannot submit');
  const disabledLabel = all(Native({ ...props, disabled: true }), node => node.props.accessibilityElementsHidden && all(node, child => child.type === 'Text').length)[0];
  assert.equal(nativeViews.StyleSheet.flatten(disabledLabel.props.style).opacity, 0.6, 'one readable disabled treatment');
  const icon = Native({ ...props, style: undefined, contentStyle: { width: 36, height: 36, marginLeft: 6, alignItems: 'center', justifyContent: 'center' }, children: React.createElement('OriginalIcon') });
  const outer = nativeViews.StyleSheet.flatten(icon.props.style);
  assert.equal(outer.width, 36); assert.equal(outer.height, 36); assert.equal(outer.marginLeft, 6);
  const labelBox = all(icon, node => node.props.accessibilityElementsHidden && all(node, child => child.type === 'OriginalIcon').length)[0];
  const inner = nativeViews.StyleSheet.flatten(labelBox.props.style);
  assert.equal(inner.width, '100%'); assert.equal(inner.height, 36);
  assert.equal(inner.marginLeft, undefined, 'outer spacing cannot shift the icon inside its material');
  assert.equal(inner.alignItems, 'center'); assert.equal(inner.justifyContent, 'center');
  const orb = Native({ ...props, style: { width: 64, height: 64 }, contentStyle: { height: 36, alignItems: undefined, justifyContent: undefined }, children: React.createElement('OriginalPlusIcon') });
  const orbLabel = all(orb, node => node.props.accessibilityElementsHidden && all(node, child => child.type === 'OriginalPlusIcon').length)[0];
  const orbContent = nativeViews.StyleSheet.flatten(orbLabel.props.style);
  assert.equal(orbContent.height, 64, 'the plus label fills the 64pt orb instead of keeping the default 36pt button height');
  assert.equal(orbContent.width, '100%');
  assert.equal(orbContent.alignItems, 'center'); assert.equal(orbContent.justifyContent, 'center');
});

test('iOS Glass restores both screen-edge blurs with safe-area coverage and no tint', async () => {
  const mode = { isLiquidGlassEnabled: true };
  const platform = { OS: 'ios' };
  const EdgeBlur = await component('src/components/common/ScreenEdgeBlur.tsx', {
    'react-native': { ...nativeViews, Platform: platform },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    '../effects/GradualBlur': { GradualBlur: 'GradualBlur' },
  }, 'ScreenEdgeBlur');
  const edges = all(EdgeBlur({}), node => node.type === 'GradualBlur');
  assert.equal(edges.length, 2);
  assert.equal(edges[0].props.position, 'top'); assert.equal(edges[0].props.height, 71);
  assert.equal(edges[1].props.position, 'bottom'); assert.equal(edges[1].props.height, 66);
  assert.ok(edges.every(edge => edge.props.tint === 'transparent' && edge.props.active));
  assert.ok(all(EdgeBlur({ active: false }), node => node.type === 'GradualBlur').every(edge => !edge.props.active));
  mode.isLiquidGlassEnabled = false;
  assert.equal(EdgeBlur({}), null, 'the shared Matte blur stays unchanged');
  mode.isLiquidGlassEnabled = true; platform.OS = 'android';
  assert.equal(EdgeBlur({}), null, 'Android retains its existing edge treatment');
});

test('tab content keeps fetching while effects pause, and edge blur stays inside the scene below the dock', async () => {
  const visibility = React.createContext(true), activity = React.createContext(true);
  let focused = true;
  const tabs = { effectsActive: true, settingsVisible: false, render: { analytics: () => React.createElement('Charts') } };
  const Screen = await component('src/navigation/MainTabScreen.tsx', {
    react: { ...React, useState: () => [focused, () => {}], useCallback: callback => callback },
    'expo-router': { useFocusEffect() {} },
    '../components/common/SceneActivityContext': { SceneVisibilityContext: visibility, SceneActivityContext: activity },
    '../components/common/ScreenEdgeBlur': { ScreenEdgeBlur: 'ScreenEdgeBlur' },
    './MainTabsContext': { useMainTabs: () => tabs },
  }, 'MainTabScreen');
  const tree = Screen({ tab: 'analytics' });
  const scene = all(tree, node => node.type === 'View')[0];
  assert.deepEqual(React.Children.toArray(scene.props.children).map(child => child.type), ['Charts', 'ScreenEdgeBlur']);
  tabs.effectsActive = false;
  const paused = Screen({ tab: 'analytics' });
  assert.equal(all(paused, node => node.type === visibility)[0].props.value, true, 'a sheet cannot disable analytics or photo loading');
  assert.equal(all(paused, node => node.type === activity)[0].props.value, false);
  tabs.settingsVisible = true;
  assert.equal(all(Screen({ tab: 'analytics' }), node => node.type === visibility)[0].props.value, false);
  tabs.settingsVisible = false; focused = false;
  assert.equal(all(Screen({ tab: 'analytics' }), node => node.type === visibility)[0].props.value, false);
});

test('Glass adapters preserve Matte styles, event and press feedback unchanged', async () => {
  const mode = { isLiquidGlassEnabled: false };
  const Touchable = await component('src/components/common/GlassTouchable.tsx', {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' }, TouchableOpacity: 'TouchableOpacity' },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    './AppleGlassPressable': { AppleGlassPressable: 'AppleGlassPressable' },
  }, 'GlassTouchable');
  const style = { backgroundColor: '#A92F3A', marginTop: 12, paddingHorizontal: 16 };
  const onPress = () => {};
  const matte = Touchable({ children: 'Reset', activeOpacity: 0.7, style, onPress });
  assert.equal(matte.type, 'TouchableOpacity'); assert.equal(matte.props.style, style);
  assert.equal(matte.props.onPress, onPress); assert.equal(matte.props.activeOpacity, 0.7);
  mode.isLiquidGlassEnabled = true;
  const row = Touchable({ children: 'Reset', style, onPress });
  assert.equal(row.type, 'TouchableOpacity', 'ordinary rows retain one content tree');
  assert.equal(row.props.onPress, onPress, 'ordinary rows preserve real responder events');
  assert.equal(Touchable({ nativeGlass: true, children: 'Reset', style, onPress }).type, 'AppleGlassPressable');
});

test('native selection retains original icons and ignores disabled or stale indices', async () => {
  const Selector = await component('src/components/common/AppleSlidingSelector.ios.tsx', {
    expo: { requireNativeView: () => 'NativeSelection' },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
  }, 'AppleSlidingSelector');
  const icon = React.createElement('OriginalSolarIcon', { color: '#fff' });
  const selected = [];
  const props = { items: [{ value: 'equal', label: 'Equal', icon }, { value: 'exact', label: 'Exact', disabled: true }], value: 'equal', onChange: value => selected.push(value) };
  const tree = Selector(props);
  assert.equal(all(tree, node => node.type === 'OriginalSolarIcon').length, 1);
  const native = all(tree, node => node.type === 'NativeSelection')[0];
  assert.equal(native.props.selection, 0);
  for (const index of [0, 1, 40]) native.props.onSelectionChange({ nativeEvent: { index } });
  assert.deepEqual(selected, ['equal']);
  all(Selector({ ...props, disabled: true }), node => node.type === 'NativeSelection')[0].props.onSelectionChange({ nativeEvent: { index: 0 } });
  assert.deepEqual(selected, ['equal']);
});

test('Glass swipe Edit runs immediately even when the swipe close callback does not fire', async () => {
  let editCount = 0, closeCount = 0;
  const rowRef = { current: { close: () => closeCount++ } };
  let refIndex = 0;
  const shared = () => ({ get: () => 0, set() {} });
  const Row = await component('src/components/transactions/TransactionSwipeRow.tsx', {
    react: { ...React, useRef: initial => refIndex++ === 0 ? rowRef : { current: initial }, useCallback: callback => callback, useContext: () => null, useEffect() {} },
    'react-native': { ...nativeViews, Platform: { OS: 'ios' } },
    '../common/GlassTouchable': { GlassPressable: 'GlassPressable' },
    '../../theme/actionColors': { ACTION_COLORS: { danger: '#A92F3A' } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ isLiquidGlassEnabled: true, themeMode: 'dark', transactionActionStyle: 'swipe' }) },
    '../common/BackdropSurfaceContext': { BackdropSurfaceContext: React.createContext(null) },
    '../../constants/buttonSizes': { COMPACT_BUTTON_HEIGHT: 36, COMPACT_BUTTON_HIT_SLOP: {} },
    './TransactionActions': { useTransactionActions: () => ({ canManage: () => true, edit: () => editCount++ }) },
    'react-native-gesture-handler/ReanimatedSwipeable': { default: 'Swipeable' },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, ReduceMotion: {}, useSharedValue: shared, useAnimatedStyle: () => ({}), interpolate() {}, interpolateColor() {}, Extrapolation: {} },
    '@solar-icons/react-native/bold/pen-2': { Pen2Icon: 'Pen2Icon' },
    '@solar-icons/react-native/bold/trash-bin-trash': { TrashBinTrashIcon: 'TrashBinTrashIcon' },
  }, 'TransactionSwipeRow');
  const tree = Row({ transaction: { id: 'synthetic', title: 'Dinner' }, children: 'row' });
  tree.props.renderLeftActions(shared(), shared()).props.requestAction('edit');
  assert.equal(closeCount, 1); assert.equal(editCount, 1);
  tree.props.onSwipeableClose(); assert.equal(editCount, 1, 'late close must not open a second editor');
});

test('transaction hit areas stay transparent and retain card corners when closed or swiped', async () => {
  const mode = { isLiquidGlassEnabled: true, themeMode: 'dark', transactionActionStyle: 'swipe' };
  const platform = { OS: 'ios' };
  let drag = 0;
  const Row = await component('src/components/transactions/TransactionSwipeRow.tsx', {
    react: { ...React, useRef: initial => ({ current: initial }), useCallback: callback => callback, useEffect() {} },
    'react-native': { ...nativeViews, Platform: platform },
    '../common/GlassTouchable': { GlassPressable: 'GlassPressable' },
    '../../theme/actionColors': { ACTION_COLORS: { danger: '#A92F3A' } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    '../../constants/buttonSizes': { COMPACT_BUTTON_HEIGHT: 36, COMPACT_BUTTON_HIT_SLOP: {} },
    './TransactionActions': { useTransactionActions: () => ({ canManage: () => true }) },
    'react-native-gesture-handler/ReanimatedSwipeable': { default: 'Swipeable' },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, ReduceMotion: {}, Extrapolation: { CLAMP: 'clamp' },
      useSharedValue: () => ({ get: () => drag, set() {} }), useAnimatedStyle: callback => callback(),
      interpolate: value => Math.max(0, Math.min(1, value / 0.35)), interpolateColor: (_value, _range, colors) => colors[1] },
    '@solar-icons/react-native/bold/pen-2': { Pen2Icon: 'Pen2Icon' },
    '@solar-icons/react-native/bold/trash-bin-trash': { TrashBinTrashIcon: 'TrashBinTrashIcon' },
  }, 'TransactionSwipeRow');
  for (const os of ['ios', 'android']) for (const glass of [true, false]) for (const dark of [true, false]) for (const translation of [0, 0.001, 1, -1]) {
    platform.OS = os; mode.isLiquidGlassEnabled = glass; mode.themeMode = dark ? 'dark' : 'light'; drag = translation;
    const tree = Row({ transaction: { id: 'test', title: 'Test' }, borderRadius: 22, children: React.createElement('RoundedCard') });
    const container = nativeViews.StyleSheet.flatten(tree.props.containerStyle);
    const hitArea = nativeViews.StyleSheet.flatten(tree.props.children.props.style);
    assert.equal(container.backgroundColor, 'transparent');
    assert.equal(container.borderRadius, 22); assert.equal(hitArea.borderRadius, 22);
    assert.equal(hitArea.overflow, 'hidden');
    if (!translation || os === 'ios' && glass) assert.equal(hitArea.backgroundColor, 'transparent', 'closed rows and every Glass swipe must not paint a rectangle behind the card');
    else assert.equal(hitArea.backgroundColor, dark ? '#29292E' : '#E5E5EA', 'revealed Matte actions keep their existing color');
  }
});

test('balance and payment cards keep their Aurora backdrop in Liquid Glass mode', async () => {
  class Value { interpolate() { return 0; } }
  const hooks = { ...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {} };
  const shared = {
    react: { ...hooks, useMemo: callback => callback() },
    'react-native': { ...nativeViews, Platform: { OS: 'ios' }, Animated: { Value, View: 'AnimatedView' }, TouchableOpacity: 'TouchableOpacity' },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ isLiquidGlassEnabled: true, themeMode: 'dark', currency: 'INR', formatAmount: String }) },
    '../../store/SplitTrackStore': { useSplitTrack: () => ({ accounts: [{ id: 'bank', balance: 12 }], selectedAccountId: 'bank', totalBalance: 12, monthlyExpenses: 2, netFriendBalance: 0 }) },
    '../../utils/haptics': { ImpactStyle: {}, NotificationType: {}, triggerImpact() {}, triggerNotification() {} },
    '../../hooks/useAsyncAction': { useAsyncAction: () => ({}), FormError: 'FormError' },
    '../effects/Aurora': { Aurora: 'Aurora' }, '../glass/GlassSurface': { GlassSurface: 'GlassSurface' },
    '../glass/GlassPanel': { GlassPanel: 'GlassPanel' }, '../glass/GlassPill': { GlassPill: 'GlassPill' },
    '../common/MotionPrimitives': { AnimatedPressable: 'AnimatedPressable' },
    '../common/GlassTouchable': { GlassPressable: 'Pressable' },
    '../common/ItemActionReveal': { ItemActionReveal: 'ItemActionReveal' },
    '../common/BrandEmblemIcon': { BrandEmblemIcon: 'BrandEmblemIcon' },
    '../../theme/colors': { currencies: { INR: { symbol: '₹' } } },
    '../../theme/actionColors': { ACTION_COLORS: {} },
    '../../constants/buttonSizes': {}, './AddUpiProfileModal': {}, './UpiQrModal': {},
    '../common/SheetModal': {}, '../common/GlassModalSheet': {}, '../common/ModalBackdrop': {},
    '../common/SheetHeader': {}, '../common/ScrollEdgeFade': {}, '../../../assets/card-chip.png': 'CardChipImage',
  };
  for (const name of ['eye', 'eye-closed', 'add-circle', 'check-circle', 'users-group-rounded', 'copy', 'qr-code', 'pen-2', 'trash-bin-trash', 'alt-arrow-down', 'alt-arrow-up', 'card', 'wallet']) {
    shared[`@solar-icons/react-native/bold/${name}`] = new Proxy({}, { get: () => 'OriginalIcon' });
  }
  for (const [path, exported] of [['src/components/home/HeroBalanceCard.tsx', 'HeroBalanceCard'], ['src/components/cards/StackedCardDeck.tsx', 'StackedCardDeck']]) {
    const Card = await component(path, shared, exported);
    const surface = all(Card({}), node => node.type === 'GlassSurface')[0];
    assert.equal(surface.props.backdrop.type, 'Aurora');
    assert.equal(surface.props.backdrop.props.style.borderRadius, 24);
    assert.ok(surface.props.backdrop.props.opacity > 0);
  }
  const ProfileCard = await component('src/components/upi/UpiProfilesSection.tsx', shared, 'ProfileDeckCard', '\nmodule.exports.ProfileDeckCard = ProfileDeckCard;');
  const profile = ProfileCard({ acc: { id: 'bank', kind: 'debit', provider: 'bank', title: 'Bank' }, mapIndex: 0, rank: 0, totalCount: 1,
    isDefault: true, isExpanded: false, isDark: true, formatAmount: String });
  const profileSurface = all(profile, node => node.type === 'GlassSurface')[0];
  assert.equal(profileSurface.props.backdrop.type, 'Aurora');
  assert.equal(profileSurface.props.backdrop.props.paused, false);
  assert.ok(profileSurface.props.backdrop.props.opacity > 0);
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
    '../common/GlassTouchable': { GlassTouchable: 'GlassTouchable' },
    '../glass/GlassPanel': { GlassPanel: 'GlassPanel' },
    '../common/SmoothCollapsible': { SmoothCollapsible: 'SmoothCollapsible' },
    '../glass/GlassSurface': { GlassSurface: 'GlassSurface' }, '../glass/GlassPill': { GlassPill: 'GlassPill' },
    '../categories/AddCategoryModal': { AddCategoryModal: 'AddCategoryModal' },
  }, 'AddExpenseModal');
  const tree = Form({ visible: true, onClose() {} });
  const groups = all(tree, node => node.type?.name === 'ExpenseSection');
  assert.equal(groups.length, 3, 'all form groups remain present');
  for (const group of groups) {
    const surface = group.type(group.props);
    assert.equal(surface.type, 'View', 'native sheet groups do not add another glass layer');
    assert.equal(group.type({ ...group.props, nativeGlass: false }).type, 'GlassSurface', 'Matte retains its card structure');
  }
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
    '../common/AppleSlidingSelector': { AppleSlidingSelector: 'AppleSlidingSelector' },
    './GlassPill': { GlassPill: 'GlassPill' },
    '../../utils/measureWindow': {},
    ...Object.fromEntries(['home-2', 'bill-list', 'add-circle', 'users-group-two-rounded', 'pie-chart-2'].map(name => [`@solar-icons/react-native/bold/${name}`, new Proxy({}, { get: (_, key) => String(key) })])),
  }, 'GlassDock');
  for (const glass of [true, false]) {
    mode.isLiquidGlassEnabled = glass;
    let opened = 0, selected;
    const tree = Dock({ currentTab: 'home', onQuickAdd: () => opened++, onTabChange: tab => { selected = tab; } });
    if (glass) {
      const selector = all(tree, node => node.type === 'AppleSlidingSelector')[0];
      assert.deepEqual(Array.from(selector.props.items, item => item.value), ['home', 'expenses', 'trips', 'analytics']);
      assert.deepEqual(Array.from(selector.props.items, item => item.icon.type), ['Home2Icon', 'BillListIcon', 'UsersGroupTwoRoundedIcon', 'PieChart2Icon']);
      selector.props.onChange('expenses'); assert.equal(selected, 'expenses');
      const plus = all(tree, node => node.type === 'GlassPill')[0];
      assert.equal(plus.props.icon.type, 'AddCircleIcon'); plus.props.onPress(); assert.equal(opened, 1);
      continue;
    }
    const tabs = all(tree, node => node.props.item);
    assert.deepEqual(tabs.map(node => node.props.item.key), ['home', 'expenses', 'trips', 'analytics']);
    assert.deepEqual(tabs.map(node => node.props.item.icon('#fff').type), ['Home2Icon', 'BillListIcon', 'UsersGroupTwoRoundedIcon', 'PieChart2Icon']);
    tabs[1].props.onPress(); assert.equal(selected, 'expenses');
    const plus = all(tree, node => node.props.accessibilityLabel === 'Add split expense')[0];
    assert.equal(all(plus, node => node.type === 'AddCircleIcon').length, 1);
    plus.props.onPress(); assert.equal(opened, 1);
  }
});

test('closed Glass swipe panels are invisible and only the revealed side shows actions', async () => {
  const shared = value => ({ get: () => value, set() {} });
  const modules = {
    react: { ...React, useAnimatedReaction() {} },
    'react-native': { ...nativeViews, Platform: { OS: 'ios' } },
    '../common/GlassTouchable': { GlassPressable: 'GlassPressable' },
    './GlassTouchable': { GlassPressable: 'GlassPressable' },
    '../../theme/actionColors': { ACTION_COLORS: { danger: '#A92F3A' } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ isLiquidGlassEnabled: true, themeMode: 'dark' }) },
    '../common/BackdropSurfaceContext': { BackdropSurfaceContext: React.createContext(null) },
    '../../constants/buttonSizes': { COMPACT_BUTTON_HEIGHT: 36, COMPACT_BUTTON_HIT_SLOP: {} },
    './TransactionActions': { useTransactionActions: () => ({}) },
    'react-native-gesture-handler/ReanimatedSwipeable': { default: 'Swipeable' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, ReduceMotion: {}, useAnimatedStyle: callback => callback(), useAnimatedReaction() {} },
    '@solar-icons/react-native/bold/pen-2': { Pen2Icon: 'Pen2Icon' },
    '@solar-icons/react-native/bold/trash-bin-trash': { TrashBinTrashIcon: 'TrashBinTrashIcon' },
  };
  const Actions = await component('src/components/transactions/TransactionSwipeRow.tsx', modules, 'SwipeActions', '\nmodule.exports.SwipeActions = SwipeActions;');
  const ItemButton = await component('src/components/common/ItemActionReveal.tsx', modules, 'RevealedButton', '\nmodule.exports.RevealedButton = RevealedButton;');
  const ItemPanel = await component('src/components/common/ItemActionReveal.tsx', modules, 'ItemSwipeActions', '\nmodule.exports.ItemSwipeActions = ItemSwipeActions;');
  for (const side of ['left', 'right']) {
    for (const progress of [0, 1]) {
      const tree = Actions({ progress: shared(progress), translation: shared(side === 'left' ? 180 * progress : -180 * progress), rowProgress: shared(0), side, dark: true, transaction: { title: 'Dinner' }, requestAction() {} });
      const buttons = all(tree, node => node.type === 'AnimatedView' && node.props.style.opacity !== undefined);
      assert.equal(buttons.length, 2);
      const panel = all(tree, node => node.type === 'AnimatedView' && Array.isArray(node.props.style))[0];
      const translation = nativeViews.StyleSheet.flatten(panel.props.style).transform[0].translateX;
      assert.equal(translation, (side === 'left' ? -1 : 1) * 180 * (1 - progress), 'only the physically exposed strip can contain actions');
      for (const button of buttons) {
        assert.equal(button.props.style.opacity, progress, `${side} panel visibility follows its own progress`);
        assert.ok(button.props.style.transform.every(value => !('scale' in value)), 'Glass actions do not stretch');
        assert.equal(button.props.children.props.nativeGlass, false, 'revealed actions are flat and can fade safely');
      }
      const item = ItemButton({ progress: shared(progress), label: 'Edit', name: 'Bank card', onPress() {} });
      assert.equal(item.props.style.opacity, progress);
      assert.equal(item.props.children.props.nativeGlass, false);
      const itemPanel = ItemPanel({ progress: shared(progress), translation: shared((side === 'left' ? 1 : -1) * 104 * progress), side, width: 104, compact: true, name: 'Bank card', disabled: false, onEdit() {} });
      assert.equal(itemPanel.props.style.overflow, 'hidden');
      assert.equal(nativeViews.StyleSheet.flatten(itemPanel.props.children.props.style).transform[0].translateX, (side === 'left' ? -1 : 1) * 104 * (1 - progress));
    }
  }
});

test('long dynamic Glass selections keep full labels while short fixed groups slide natively', async () => {
  const Value = class { stopAnimation() {} setValue() {} };
  const mode = { isLiquidGlassEnabled: true, themeMode: 'dark', selectionStyle: 'chips' };
  const modules = {
    react: { ...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {} },
    'react-native': { ...nativeViews, Platform: { OS: 'ios' }, Animated: { Value } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    '../../utils/haptics': { triggerSelection() {} },
    './ScrollEdgeFade': { HorizontalEdgeFade: 'EdgeFade', useHorizontalScrollEdges: () => ({}) },
    './DropdownSelect': { DropdownSelect: 'Dropdown' },
    './AppleSlidingSelector': { AppleSlidingSelector: 'SlidingSelector' },
    '../../constants/buttonSizes': { COMPACT_BUTTON_HEIGHT: 36, COMPACT_BUTTON_HIT_SLOP: {} },
  };
  const Radio = await component('src/components/common/JellyRadio.tsx', modules, 'JellyRadio');
  let selected;
  const name = 'Sai Ardhendu Kar';
  const dynamic = Radio({ scrollable: true, items: ['You', name, 'Pranjal'], value: 'You', onChange: value => { selected = value; } });
  assert.equal(all(dynamic, node => node.type === 'SlidingSelector').length, 0, 'dynamic labels never share equal-width native slots');
  const chips = all(dynamic, node => node.props.item);
  const chip = chips[1].type(chips[1].props);
  assert.equal(all(chip, node => node.type === 'Text')[0].props.children, name);
  assert.equal(nativeViews.StyleSheet.flatten(chip.props.style).width, undefined, 'chip width follows its label');
  chip.props.onPress(); assert.equal(selected, name);
  const periods = Radio({ items: ['All', 'Date', 'Month', 'Year'], value: 'All' });
  assert.equal(periods.type, 'SlidingSelector');
  const preferences = Radio({ presentation: 'chips', items: ['Liquid Glass', 'Matte Surface'], value: 'Liquid Glass', onChange: value => { selected = value; } });
  preferences.props.onChange('Matte Surface', 1); assert.equal(selected, 'Matte Surface', 'surface preference commits on native selection');
  mode.selectionStyle = 'dropdown';
  assert.equal(Radio({ scrollable: true, items: ['You', name], value: 'You' }).type, 'Dropdown');
});
