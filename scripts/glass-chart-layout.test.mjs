import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const all = (node, predicate) => !React.isValidElement(node) ? [] : [
  ...(predicate(node) ? [node] : []),
  ...React.Children.toArray(node.props.children).flatMap(child => all(child, predicate)),
];
const parentOf = (tree, child) => all(tree, node => React.Children.toArray(node.props.children).some(item => React.isValidElement(item) && item.props === child.props))[0];

async function load(path, modules, exported) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { React, module, exports: module.exports, require(name) {
    if (Object.hasOwn(modules, name)) return modules[name];
    throw new Error(`Unexpected import ${name}`);
  } });
  return module.exports[exported];
}

async function harness(glass, width = 375, os = 'ios') {
  const mode = { themeMode: 'dark', isLiquidGlassEnabled: glass, selectionStyle: 'chips', formatAmount: amount => `₹${amount.toFixed(2)}` };
  const updates = [];
  class Value { constructor(value) { this.value = value; } interpolate() { return 0; } setValue(value) { this.value = value; } stopAnimation() {} }
  const hooks = { ...React, useEffect() {}, useLayoutEffect() {}, useMemo: callback => callback(), useCallback: callback => callback,
    useRef: current => ({ current }), useState: initial => [typeof initial === 'function' ? initial() : initial, value => updates.push(value)] };
  const native = { Platform: { OS: os }, StyleSheet: { create: styles => styles, flatten, absoluteFill: {} },
    ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'TouchableOpacity'].map(name => [name, name])),
    useWindowDimensions: () => ({ width }), Animated: { Value, View: 'AnimatedView', add: () => 0 } };
  const base = { react: hooks, 'react-native': native, '../../theme/LiquidGlassContext': { useLiquidGlass: () => mode },
    './AppleGlassPressable': { AppleGlassPressable: 'AppleGlassPressable' } };
  const Motion = await load('src/components/common/MotionPrimitives.tsx', base, 'AnimatedPressable');
  const Touchable = await load('src/components/common/GlassTouchable.tsx', base, 'GlassTouchable');
  const Selector = await load('src/components/common/AppleSlidingSelector.ios.tsx', {
    ...base, expo: { requireNativeView: () => 'NativeSelection' },
  }, 'AppleSlidingSelector');
  const Radio = await load('src/components/common/JellyRadio.tsx', {
    ...base, '../../utils/haptics': { triggerSelection() {} },
    './ScrollEdgeFade': { HorizontalEdgeFade: 'EdgeFade', useHorizontalScrollEdges: () => ({}) },
    './DropdownSelect': { DropdownSelect: 'DropdownSelect' }, './AppleSlidingSelector': { AppleSlidingSelector: 'AppleSlidingSelector' },
    '../../constants/buttonSizes': { COMPACT_BUTTON_HEIGHT: 36, COMPACT_BUTTON_HIT_SLOP: {} },
  }, 'JellyRadio');
  const shared = value => ({ get: () => value, set() {} });
  const modules = { ...base,
    'react-native-svg': { __esModule: true, ...Object.fromEntries(['default', 'Circle', 'Path', 'Defs', 'LinearGradient', 'Stop', 'Line'].map(name => [name, name === 'default' ? 'Svg' : name])) },
    'react-native-reanimated': { __esModule: true, default: { View: 'ReanimatedView', createAnimatedComponent: name => `Animated${name}` },
      Easing: { out: value => value, cubic: 'cubic' }, ReduceMotion: {}, FadeIn: { duration: () => ({ reduceMotion: () => ({}) }) },
      useSharedValue: shared, useAnimatedStyle: callback => callback(), useAnimatedProps: callback => callback(), withTiming: value => value },
    '@solar-icons/react-native/bold/calendar-date': { CalendarDateIcon: 'OriginalCalendarIcon' },
    '../../utils/haptics': { triggerSelection() {} }, '../../store/SplitTrackStore': { useSplitTrack: () => ({
      categoryMetrics: [{ id: 'food', name: 'Food', amount: 21 }], categories: [], transactions: [],
      chartData: [{ date: '2026-11-01', income: 0, expense: 21 }],
    }) },
    '../glass/GlassCard': { GlassCard: 'GlassCard' }, '../common/MotionPrimitives': { AnimatedPressable: 'AnimatedPressable' },
    '../common/GlassTouchable': { GlassTouchable: 'GlassTouchable' }, '../common/JellyRadio': { JellyRadio: 'JellyRadio' },
    '../common/CalendarDatePickerModal': { CalendarDatePickerModal: 'CalendarDatePickerModal', getTodayLocalISO: () => '2026-11-24', formatDisplayDate: value => value },
    '../../hooks/useDateMonthSwipeGesture': { shiftIsoDate: value => value, useDateMonthSwipeGesture: () => ({ gestureHandlers: {}, dragAnim: new Value(0), isMonthHoldReady: false }) },
    '../../hooks/useChartTransition': { useChartTransition: () => ({ runChartTransition: (_direction, callback) => callback(), opacity: 1, translateX: 0, revision: 0 }) },
    '../../hooks/useAnalytics': { useAnalytics: () => ({ loading: false, data: { points: [], categories: {} } }) },
    '../../hooks/useAsyncAction': { FormError: 'FormError' },
    '../../constants/buttonSizes': { COMPACT_ICON_BUTTON_STYLE: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, COMPACT_BUTTON_HIT_SLOP: {} },
  };
  return { updates, Motion, Touchable, Radio, Selector,
    Donut: await load('src/components/charts/DonutPieChart.tsx', modules, 'DonutPieChart'),
    Spline: await load('src/components/charts/SplineChart.tsx', modules, 'SplineChart') };
}

test('Glass chart calendars stay fixed while native selectors use the remaining row width', async () => {
  for (const width of [375, 390]) {
    const h = await harness(true, width);
    for (const Chart of [h.Donut, h.Spline]) {
      const tree = Chart();
      const radio = all(tree, node => node.type === 'JellyRadio')[0];
      const row = parentOf(tree, radio);
      assert.equal(flatten(row.props.style).width, '100%');
      const selector = h.Selector(h.Radio(radio.props).props);
      const layout = flatten(selector.props.style);
      assert.equal(layout.flex, 1);
      assert.equal(layout.minWidth, 0);
      assert.equal(layout.width, undefined, 'selector must not request 100% in addition to its calendar sibling');
      const calendar = all(row, node => node.props.accessibilityLabel?.startsWith('Open calendar'))[0];
      assert.equal(flatten(calendar.props.style).flexShrink, 0);
      const button = h.Motion(calendar.props);
      assert.equal(button.type, 'AppleGlassPressable');
      assert.equal(flatten(button.props.contentStyle).width, 36);
      assert.equal(all(button, node => node.type === 'OriginalCalendarIcon').length, 1);
      calendar.props.onPress();
      assert.equal(h.updates.at(-1), true, 'calendar action still opens its date picker');
      const native = all(selector, node => node.type === 'NativeSelection')[0];
      native.props.onSelectionChange({ nativeEvent: { index: radio.props.items.indexOf('Year') } });
      assert.ok(h.updates.includes('Year'), 'native selection still commits the chosen period');
    }
  }
});

test('Matte and Android keep their chart control geometry and ordinary calendar touchables', async () => {
  for (const [glass, os] of [[false, 'ios'], [true, 'android']]) {
    const h = await harness(glass, 375, os);
    for (const Chart of [h.Donut, h.Spline]) {
      const tree = Chart();
      const radio = all(tree, node => node.type === 'JellyRadio')[0];
      assert.equal(radio.props.style, undefined);
      const calendar = all(tree, node => node.props.accessibilityLabel?.startsWith('Open calendar'))[0];
      assert.equal(calendar.props.style, undefined);
      assert.equal(all(h.Motion(calendar.props), node => node.type === 'AppleGlassPressable').length, 0);
      if (Chart === h.Spline) assert.equal(flatten(parentOf(tree, parentOf(tree, radio)).props.style).flexDirection, 'row');
    }
  }
});

test('donut totals render once in an ordinary readout, with a bounded amount in Glass mode', async () => {
  for (const glass of [true, false]) {
    const h = await harness(glass);
    const tree = h.Donut();
    const center = all(tree, node => node.type === 'AnimatedPressable' && all(node, item => item.type === 'Text' && item.props.children === 'TOTAL SPEND').length)[0];
    const rendered = h.Motion(center.props);
    assert.equal(all(rendered, node => node.type === 'AppleGlassPressable').length, 0);
    const amount = all(rendered, node => node.type === 'Text' && node.props.children === '₹21.00');
    assert.equal(amount.length, 1);
    assert.equal(all(rendered, node => node.type === 'Text' && node.props.children === 'TOTAL SPEND').length, 1);
    assert.equal(amount[0].props.adjustsFontSizeToFit, glass);
    assert.equal(amount[0].props.numberOfLines, glass ? 1 : undefined);
    assert.equal(flatten(center.props.style).width, glass ? 146 : undefined);
    const badge = all(tree, node => node.type === 'AnimatedPressable' && all(node, item => item.type === 'Text' && item.props.children === '1 category').length)[0];
    assert.equal(all(h.Motion(badge.props), node => node.type === 'AppleGlassPressable').length, 0);
  }
});

test('Glass cash-flow month labels stay readable and use ordinary touch handling', async () => {
  const h = await harness(true);
  const tree = h.Spline();
  const labels = all(tree, node => node.type === 'GlassTouchable');
  assert.equal(labels.length, 6);
  for (const label of labels) {
    const rendered = h.Touchable(label.props);
    assert.equal(rendered.type, 'TouchableOpacity');
    assert.equal(rendered.props.onPress, label.props.onPress);
    const text = all(rendered, node => node.type === 'Text')[0];
    assert.equal(flatten(text.props.style).fontSize, 12);
    assert.ok(['#A1A1AA', '#FFFFFF'].includes(flatten(text.props.style).color));
  }
  labels[0].props.onPress();
  assert.equal(h.updates.at(-1), 0, 'the first month can still be selected');
});
