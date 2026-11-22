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

test('native tabs use system styling and Split opens the editor without selecting an empty screen', async () => {
  function Trigger() {}
  Trigger.Icon = 'NativeIcon'; Trigger.Label = 'NativeLabel';
  function NativeTabs() {}
  NativeTabs.Trigger = Trigger;
  let splitOpens = 0;
  const AppTabs = await component('src/app/(tabs)/_layout.tsx', {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' } },
    'expo-router': { useSegments: () => ['(tabs)', 'index'], Tabs: 'JSTabs' },
    'expo-router/native-tabs': { NativeTabs },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ isLiquidGlassEnabled: true }) },
    '../../navigation/MainTabsContext': { useMainTabs: () => ({ settingsVisible: false, openSplit: () => splitOpens++ }) },
    '../../components/glass/GlassDock': { GlassDock: 'CustomDock' },
  }, 'AppTabs', '\nmodule.exports.AppTabs = AppTabs;');
  const tree = AppTabs();
  assert.equal(tree.type, NativeTabs);
  assert.equal(tree.props.tintColor, undefined);
  assert.equal(tree.props.backgroundColor, undefined);
  assert.equal(tree.props.blurEffect, undefined);
  const tabs = all(tree, node => node.type === Trigger);
  assert.deepEqual(tabs.map(tab => tab.props.name), ['index', 'expenses', 'split', 'trips', 'analytics']);
  const split = tabs.find(tab => tab.props.name === 'split');
  assert.equal(split.props.disabled, true);
  split.props.listeners.tabPress();
  assert.equal(splitOpens, 1);
  assert.equal(all(tree, node => node.type === 'CustomDock').length, 0);
});
