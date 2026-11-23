import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/components/common/SheetModal.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText + '\nmodule.exports.CustomSheetModal = CustomSheetModal; module.exports.NativeSheetModal = NativeSheetModal;';
const sheetSource = await readFile(new URL('../src/components/common/GlassModalSheet.tsx', import.meta.url), 'utf8');
const compiledSheet = ts.transpileModule(sheetSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const pageSource = await readFile(new URL('../src/components/common/ModalPage.tsx', import.meta.url), 'utf8');
const compiledPage = ts.transpileModule(pageSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const actionsSource = await readFile(new URL('../src/components/transactions/TransactionActions.tsx', import.meta.url), 'utf8');
const compiledActions = ts.transpileModule(actionsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const statusSource = await readFile(new URL('../src/components/common/CloudStatus.tsx', import.meta.url), 'utf8');
const compiledStatus = ts.transpileModule(statusSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

// Exercise the real component's commits and native callbacks without loading
// React Native in Node. Descendant views do not need to render for these tests.
function sheetHarness(platform, code = compiled, componentName = 'CustomSheetModal', extraModules = {}) {
  const slots = [];
  const memoBoundaries = new Map();
  let cursor = 0, dirty = false, rendering = false, renderStateUpdates = 0;
  let layout = [], passive = [], props = { visible: false }, output;
  const changed = (before, after) => !before || !after || before.length !== after.length || before.some((value, index) => !Object.is(value, after[index]));
  const hooks = {
    ...React,
    useContext: context => context?._currentValue,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      const set = value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) {
          if (rendering) renderStateUpdates++;
          slots[index].value = next;
          dirty = true;
        }
      };
      return [slots[index].value, set];
    },
    useRef(value) {
      const index = cursor++;
      return slots[index] ??= { current: value };
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useLayoutEffect(callback, deps) { effect(callback, deps, layout); },
    useEffect(callback, deps) { effect(callback, deps, passive); },
  };
  function effect(callback, deps, queue) {
    const index = cursor++;
    if (!slots[index] || changed(slots[index].deps, deps)) {
      const previous = slots[index];
      slots[index] = { deps };
      queue.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
    }
  }
  const mockRequire = name => {
    if (name === 'react') return hooks;
    if (Object.hasOwn(extraModules, name)) return extraModules[name];
    if (name === 'react-native') return { Platform: { OS: platform }, Keyboard: { dismiss() {} }, Modal: 'Modal', View: 'View', KeyboardAvoidingView: 'KeyboardView', StyleSheet: { create: value => value, flatten: value => Object.assign({}, ...value) }, useWindowDimensions: () => ({ width: 400, height: 800 }) };
    if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureRoot', GestureDetector: 'GestureDetector' };
    if (name === 'react-native-safe-area-context') return { SafeAreaProvider: 'SafeArea', useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) };
    if (name === './SceneActivityContext') return { SceneActivityContext: React.createContext(true) };
    if (name === './ModalVisualContext') return { ModalVisualContext: React.createContext(false) };
    if (name === './BottomBubble') return { BubbleNoticeHost: 'BubbleNoticeHost' };
    if (name === '../../theme/LiquidGlassContext') return { useLiquidGlass: () => ({ isLiquidGlassEnabled: false }) };
    if (name === './AppleSheet') return { AppleSheet: 'AppleSheet' };
    if (name === './NativeSheetPresentation') return { NativeSheetPresentationContext: React.createContext(false), NativeSheetSizingContext: React.createContext(null), useNativeSheetPresentation: () => false };
    if (name === './SheetKeyboardViewport') return { SheetKeyboardViewport: 'KeyboardViewport' };
    throw new Error(`Unexpected import ${name}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: mockRequire, React });
  const Component = module.exports[componentName];
  function flush() {
    for (let count = 0; count < 20; count++) {
      cursor = 0; dirty = false; layout = []; passive = []; rendering = true;
      output = Component(props);
      commitMemoBoundaries(output);
      rendering = false;
      layout.forEach(run => run());
      passive.forEach(run => run());
      if (!dirty) return output;
    }
    throw new Error('Sheet did not settle');
  }
  function commitMemoBoundaries(node) {
    if (!React.isValidElement(node)) return;
    if (node.type?.$$typeof === Symbol.for('react.memo')) {
      const previous = memoBoundaries.get(node.type);
      if (!previous || !node.type.compare?.(previous.props, node.props)) {
        memoBoundaries.set(node.type, { props: node.props, content: node.type.type(node.props) });
      }
      commitMemoBoundaries(memoBoundaries.get(node.type).content);
    } else React.Children.toArray(node.props.children).forEach(commitMemoBoundaries);
  }
  function visit(node, predicate) {
    if (!React.isValidElement(node)) return undefined;
    if (predicate(node)) return node;
    if (node.type?.$$typeof === Symbol.for('react.memo')) return visit(memoBoundaries.get(node.type)?.content, predicate);
    for (const child of React.Children.toArray(node.props.children)) {
      const match = visit(child, predicate);
      if (match) return match;
    }
  }
  return {
    update(next) { props = { ...props, ...next }; return flush(); },
    flush,
    get output() { return output; },
    get modal() { return output; },
    get controls() { return visit(output, node => Boolean(node.props.value?.finishExit))?.props.value; },
    get retainedContent() { return visit(output, node => node.type === React.Fragment)?.props.children; },
    get renderStateUpdates() { return renderStateUpdates; },
  };
}

function transactionHarness(platform = 'android', glass = false) {
  const tx = { id: 'expense-1', type: 'expense', title: 'Dinner', amount: -100, paidBy: 'user', date: '2026-11-21', splits: [] };
  const actions = sheetHarness(platform, compiledActions, 'TransactionActionsProvider', {
    '../../auth/AuthContext': { useAuth: () => ({ user: { uid: 'signed-in-user' } }) },
    '../../store/SplitTrackStore': { useSplitTrack: () => ({ transactions: [tx], friends: [], selectedAccountId: 'wallet', revision: 0, getTransactionBin: () => new Promise(() => {}) }) },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'light', isLiquidGlassEnabled: glass, formatAmount: amount => String(amount) }) },
    '../../services/api': { api: () => new Promise(() => {}), errorMessage: error => String(error) },
    '../../hooks/useAsyncAction': { useAsyncAction: () => ({ pending: false, error: '', setError() {} }), FormError: 'FormError' },
    '@solar-icons/react-native/bold/close-circle': { CloseCircleIcon: 'CloseCircleIcon' },
    '@solar-icons/react-native/bold/trash-bin-trash': { TrashBinTrashIcon: 'TrashBinTrashIcon' },
    '@solar-icons/react-native/bold/bill-list': { BillListIcon: 'BillListIcon' },
    '../common/SheetModal': { SheetModal: 'SheetModal' },
    '../common/SheetFooter': { SheetFooter: 'SheetFooter' },
    '../common/ModalBackdrop': { ModalBackdrop: 'ModalBackdrop' },
    '../common/GlassModalSheet': { GlassModalSheet: 'GlassModalSheet' },
    '../glass/GlassPill': { GlassPill: 'GlassPill' },
    '../glass/GlassPanel': { GlassPanel: 'GlassPanel' },
    '../split/AddExpenseModal': { AddExpenseModal: 'AddExpenseModal' },
    '../common/BottomBubble': { BottomBubble: 'BottomBubble' },
    '../common/ScrollEdgeFade': { ScrollEdgeFade: 'ScrollEdgeFade' },
    '../common/SheetHeader': { SheetHeader: 'SheetHeader' },
    '../common/UserAvatar': { UserAvatar: 'UserAvatar' },
  });
  actions.update({ children: null });
  return { actions, tx,
    get context() { return actions.output.props.value; },
    get sheets() { return React.Children.toArray(actions.output.props.children).filter(child => child.type === 'SheetModal'); },
    get editor() { return React.Children.toArray(actions.output.props.children).find(child => child.type === 'AddExpenseModal'); },
  };
}

test('Liquid Glass selects native presentation only for enabled iOS', () => {
  for (const platform of ['ios', 'android', 'web']) for (const enabled of [true, false]) {
    const sheet = sheetHarness(platform, compiled, 'SheetModal', {
      '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ isLiquidGlassEnabled: enabled }) },
    });
    sheet.update({ visible: true });
    assert.equal(sheet.output.type.name, platform === 'ios' && enabled ? 'NativeSheetModal' : 'CustomSheetModal');
  }
});

test('Liquid Glass expense Edit replaces details inside the same native sheet immediately', () => {
  const h = transactionHarness('ios', true);
  h.context.open(h.tx); h.actions.flush();
  const originalSheet = h.sheets[0];
  h.context.edit(h.tx); h.actions.flush();
  assert.equal(h.sheets[0].props.visible, true, 'no dismiss-and-present gap');
  const editor = h.sheets[0].props.children;
  assert.equal(editor.type, 'AddExpenseModal');
  assert.equal(editor.props.embedded, true);
  assert.equal(editor.props.transactionToEdit, h.tx);
  assert.equal(h.editor, undefined, 'no second native presentation');
  editor.props.onClose(); h.actions.flush();
  assert.equal(h.sheets[0].props.visible, false);
  originalSheet.props.onExitComplete(); h.actions.flush();
  assert.equal(h.context.modalVisible, false);
});

test('native sheet retains edits through dismissal and completes a handoff once', () => {
  const sheet = sheetHarness('ios', compiled, 'NativeSheetModal');
  let closed = 0, completed = 0;
  sheet.update({ visible: true, children: 'draft', onRequestClose: () => closed++, onExitComplete: () => completed++ });
  sheet.update({ children: 'edited draft' });
  sheet.modal.props.onRequestClose();
  assert.equal(closed, 1);
  sheet.update({ visible: false, children: 'cleared draft' });
  assert.equal(sheet.retainedContent, 'edited draft');
  assert.equal(completed, 0, 'wait for the SwiftUI transition before opening another sheet');
  sheet.modal.props.onDismiss();
  sheet.modal.props.onDismiss();
  assert.equal(completed, 1);
});

test('a delayed native dismissal cannot complete a reopened editor', () => {
  const sheet = sheetHarness('ios', compiled, 'NativeSheetModal');
  let completed = 0;
  sheet.update({ visible: true, children: 'draft', onExitComplete: () => completed++ });
  sheet.update({ visible: false });
  const dismissed = sheet.modal.props.onDismiss;
  sheet.update({ visible: true, children: 'new draft' });
  dismissed();
  assert.equal(completed, 0);
  assert.equal(sheet.retainedContent, 'new draft');
  sheet.update({ visible: false });
  sheet.modal.props.onDismiss();
  assert.equal(completed, 1);
});

test('sync failures never open an overhead banner or review sheet until Settings requests it', () => {
  const state = { pendingFailure: { requestId: 'failed-request', title: 'A saved entry', error: 'Review needed' }, queueReviewRequest: 0 };
  const sheet = sheetHarness('android', compiledStatus, 'CloudStatus', {
    '../../store/SplitTrackStore': { useSplitTrack: () => state },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
    '../../hooks/useAsyncAction': { useAsyncAction: () => ({ pending: false, error: '', setError() {} }), FormError: 'FormError' },
    '../glass/GlassPill': { GlassPill: 'GlassPill' },
    './SheetModal': { SheetModal: 'SheetModal' },
    './ModalBackdrop': { ModalBackdrop: 'ModalBackdrop' },
    './GlassModalSheet': { GlassModalSheet: 'GlassModalSheet' },
    './ScrollEdgeFade': { ScrollEdgeFade: 'ScrollEdgeFade' },
    './SheetHeader': { SheetHeader: 'SheetHeader' },
  });
  sheet.update({});
  assert.equal(sheet.output.type, 'SheetModal', 'no inline banner pushes the main screen down');
  assert.equal(sheet.output.props.visible, false);
  state.queueReviewRequest++;
  sheet.flush();
  assert.equal(sheet.output.props.visible, true);
  sheet.output.props.onRequestClose(); sheet.flush();
  assert.equal(sheet.output.props.visible, false);
  sheet.flush();
  assert.equal(sheet.output.props.visible, false, 'a retained failure cannot reopen itself');
});

test('transaction detail-to-edit handoff keeps scene effects paused through both retained exits', () => {
  const h = transactionHarness();
  assert.equal(h.context.modalVisible, false);
  h.context.open(h.tx); h.actions.flush();
  assert.equal(h.context.modalVisible, true);
  assert.equal(h.sheets[0].props.visible, true);
  h.context.edit(h.tx); h.actions.flush();
  assert.equal(h.context.modalVisible, true);
  assert.equal(h.sheets[0].props.visible, false);
  assert.equal(h.editor, undefined, 'native detail host exits before the editor mounts');
  h.sheets[0].props.onExitComplete(); h.actions.flush();
  assert.equal(h.context.modalVisible, true);
  assert.equal(h.editor.props.visible, true);
  h.editor.props.onClose(); h.actions.flush();
  assert.equal(h.editor.props.visible, false);
  assert.equal(h.context.modalVisible, true, 'scene stays paused through editor slide-out');
  h.editor.props.onExitComplete(); h.actions.flush();
  assert.equal(h.editor, undefined);
  assert.equal(h.context.modalVisible, false);
});

test('deleted-transaction bin remains a visible modal until its native host finishes exiting', () => {
  const h = transactionHarness();
  h.context.openDeleted(); h.actions.flush();
  assert.equal(h.context.modalVisible, true);
  h.sheets[1].props.onRequestClose(); h.actions.flush();
  assert.equal(h.sheets[1].props.visible, false);
  assert.equal(h.context.modalVisible, true);
  h.sheets[1].props.onExitComplete(); h.actions.flush();
  assert.equal(h.context.modalVisible, false);
});

test('offline and other-payer transactions cannot open the editor through swipe actions', () => {
  const h = transactionHarness();
  for (const tx of [{ ...h.tx, id: 'offline-intent' }, { ...h.tx, paidBy: 'another-person' }]) {
    assert.equal(h.context.canManage(tx), false);
    h.context.edit(tx); h.actions.flush();
    assert.equal(h.editor, undefined);
    assert.equal(h.context.modalVisible, false);
  }
});

for (const platform of ['android', 'ios', 'web']) {
  test(`${platform} retains the last edit draft until its exit and completes only after the host is gone`, () => {
    const sheet = sheetHarness(platform);
    let completed = 0;
    sheet.update({ visible: true, children: 'original draft', onExitComplete: () => completed++ });
    sheet.modal.props.onShow({}); sheet.flush();
    const beforeTyping = sheet.renderStateUpdates;
    sheet.update({ children: 'edited draft' });
    assert.equal(sheet.renderStateUpdates, beforeTyping, 'typing must not set state during render');
    sheet.update({ visible: false, children: 'cleared draft' });
    assert.equal(sheet.modal.props.visible, true, 'native host stays up through slide-out');
    assert.equal(sheet.retainedContent, 'edited draft');
    sheet.controls.finishExit(); sheet.flush();
    if (platform === 'ios') {
      assert.equal(sheet.modal.props.visible, false);
      assert.equal(completed, 0, 'editor handoff waits for native iOS dismissal');
      sheet.modal.props.onDismiss(); sheet.flush();
    }
    assert.equal(sheet.output, null);
    assert.equal(completed, 1);
    sheet.flush();
    assert.equal(completed, 1, 'completion is delivered once');
  });

  test(`${platform} an old animation completion cannot remove a reopened sheet`, () => {
    const sheet = sheetHarness(platform);
    let completed = 0;
    sheet.update({ visible: true, children: 'draft', onExitComplete: () => completed++ });
    sheet.modal.props.onShow({}); sheet.flush();
    const oldExit = sheet.controls.finishExit;
    sheet.update({ visible: false });
    sheet.update({ visible: true, children: 'reopened draft' });
    oldExit(); sheet.flush();
    assert.equal(sheet.modal.props.visible, true);
    assert.equal(sheet.controls.open, true);
    assert.equal(completed, 0);
  });

  test(`${platform} a laid-out editor opens even when its empty error and scroll sections never report`, () => {
    let motionReady;
    const sheet = sheetHarness(platform, compiledSheet, 'GlassModalSheet', {
      'react-native-reanimated': { default: { View: 'AnimatedView' } },
      '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'light' }) },
      '../glass/GlassSurface': { GlassSurface: 'GlassSurface' },
      './useSheetMotion': { useSheetMotion: (_distance, ready) => { motionReady = ready; return { animatedStyle: {}, gesture: {}, close() {} }; } },
      './SheetSizingContext': { SheetSizingContext: React.createContext(null) },
      './ScrollEdgeFade': { ScrollEdgeFade: 'ScrollEdgeFade' },
    });
    sheet.update({ children: [React.createElement('View', { key: 'header' }), React.createElement('ScrollEdgeFade', { key: 'scroll' }), React.createElement(() => null, { key: 'empty-error' })] });
    assert.equal(motionReady, false);
    assert.equal(sheet.output.props.style[1].height, 736, 'unmeasured content is bounded by the existing safe sheet maximum');
    sheet.output.props.onLayout({ nativeEvent: { layout: { height: 0 } } }); sheet.flush();
    assert.equal(motionReady, false);
    sheet.output.props.onLayout({ nativeEvent: { layout: { height: 736 } } }); sheet.flush();
    assert.equal(motionReady, true, 'missing zero-height measurements cannot lock the backdrop over the app');
  });

  test(`${platform} a hidden error section does not keep a short sheet at full height`, () => {
    const sheet = sheetHarness(platform, compiledSheet, 'GlassModalSheet', {
      'react-native-reanimated': { default: { View: 'AnimatedView' } },
      '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'light' }) },
      '../glass/GlassSurface': { GlassSurface: 'GlassSurface' },
      './useSheetMotion': { useSheetMotion: () => ({ animatedStyle: {}, gesture: {}, close() {} }) },
      './SheetSizingContext': { SheetSizingContext: React.createContext(null) },
      './ScrollEdgeFade': { ScrollEdgeFade: 'ScrollEdgeFade' },
    });
    sheet.update({ children: [React.createElement('View', { key: 'header' }), React.createElement('ScrollEdgeFade', { key: 'scroll' }), React.createElement(() => null, { key: 'empty-error' })] });
    const keyboard = React.Children.toArray(sheet.output.props.children)[0];
    const [headerGesture, scrollSections] = keyboard.props.children.props.children;
    const header = React.Children.toArray(headerGesture.props.children.props.children)[0];
    const scroll = scrollSections[0];
    header.props.report(header.props.id, 68);
    scroll.props.report(scroll.props.id, 180);
    sheet.flush();
    assert.equal(sheet.output.props.style[1].height, 282, 'only visible content, header and safe-area padding contribute to height');
  });
}

test('native app and modal surfaces each install their own Gesture Handler root', async () => {
  const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  const app = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const appFunction = app.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
  const returned = appFunction.body.statements.find(node => ts.isReturnStatement(node));
  const jsx = returned.expression.expression ?? returned.expression;
  assert.equal(jsx.openingElement.tagName.getText(app), 'GestureHandlerRootView', 'the app root must own native swipe handlers, not only modal hosts');
  for (const platform of ['android', 'ios']) {
    const sheet = sheetHarness(platform);
    sheet.update({ visible: true });
    assert.equal(sheet.output.props.children.type, 'GestureRoot', 'native Modal presents into a separate native tree');
  }
});

test('sheet title and handle share the pan detector while scroll and buttons stay outside it', () => {
  const gesture = { name: 'sheet-pan' };
  const sheet = sheetHarness('android', compiledSheet, 'GlassModalSheet', {
    'react-native-reanimated': { default: { View: 'AnimatedView' } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
    '../glass/GlassSurface': { GlassSurface: 'GlassSurface' },
    './useSheetMotion': { useSheetMotion: () => ({ animatedStyle: {}, gesture }) },
    './SheetSizingContext': { SheetSizingContext: React.createContext(null) },
    './ScrollEdgeFade': { ScrollEdgeFade: 'ScrollEdgeFade' },
  });
  sheet.update({ children: [React.createElement('View', { key: 'handle' }), React.createElement('View', { key: 'title' }), React.createElement('ScrollEdgeFade', { key: 'scroll' }), React.createElement('View', { key: 'save' })] });
  const [header, remaining] = sheet.output.props.children.props.children.props.children;
  assert.equal(header.type, 'GestureDetector');
  assert.equal(header.props.gesture, gesture);
  assert.equal(header.props.children.props.collapsable, false, 'Android must retain the gesture target as a native View');
  const headerSections = React.Children.toArray(header.props.children.props.children);
  assert.equal(headerSections.length, 2);
  assert.equal(headerSections[0].props.children.key, '.$handle');
  assert.equal(headerSections[1].props.children.key, '.$title');
  assert.equal(remaining[0].props.scrollable, true);
  assert.equal(remaining[1].props.children.key, '.$save');
});

test('full-page member menu has a usable handle/title drag target without covering edge controls', () => {
  const gesture = { name: 'page-pan' };
  const page = sheetHarness('android', compiledPage, 'ModalPage', {
    'react-native-reanimated': { default: { View: 'AnimatedView' } },
    './useSheetMotion': { useSheetMotion: () => ({ animatedStyle: {}, gesture, close() {} }) },
  });
  page.update({ children: React.createElement('View', { key: 'content' }) });
  const detector = page.output.props.children[1];
  const target = detector.props.children;
  assert.equal(detector.props.gesture, gesture);
  assert.equal(target.props.collapsable, false);
  const { left, right, height } = target.props.style[0];
  assert.ok(height >= 64, 'drags can start on the page title, not only the tiny handle');
  assert.ok(left >= 64 && right >= 64, 'header edge buttons keep their own touch regions');
});

test('native short sheets report content height and retain a separate footer', () => {
  let height;
  const sheet = sheetHarness('ios', compiledSheet, 'GlassModalSheet', {
    'react-native-reanimated': { default: { View: 'AnimatedView' } },
    '../../theme/LiquidGlassContext': { useLiquidGlass: () => ({ themeMode: 'dark' }) },
    '../glass/GlassSurface': { GlassSurface: 'GlassSurface' },
    './useSheetMotion': { useSheetMotion: () => ({ animatedStyle: {}, gesture: {} }) },
    './NativeSheetPresentation': { useNativeSheetPresentation: () => true, NativeSheetSizingContext: React.createContext(value => { height = value; }) },
    './SheetSizingContext': { SheetSizingContext: React.createContext(null) },
    './ScrollEdgeFade': { ScrollEdgeFade: 'ScrollEdgeFade' },
  });
  sheet.update({ children: [React.createElement('View', { key: 'header' }), React.createElement('ScrollEdgeFade', { key: 'scroll' }), React.createElement('SheetFooter', { key: 'footer' })] });
  const [header, scroll, footer] = sheet.output.props.children;
  assert.equal(height, undefined, 'do not collapse to zero before native layout reports');
  header.props.report(header.props.id, 68);
  scroll.props.report(scroll.props.id, 180);
  footer.props.report(footer.props.id, 58);
  sheet.flush();
  assert.equal(height, 356, 'short details use content height, rather than a full-screen empty sheet');
  assert.equal(footer.props.scrollable, false, 'bottom actions stay outside the content scroller');
});
