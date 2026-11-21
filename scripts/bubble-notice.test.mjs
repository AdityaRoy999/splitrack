import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/components/common/BottomBubble.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

// The real components run against native animation callbacks and a deterministic
// clock. Separate hook frames model independently mounted publishers and hosts.
function notificationHarness(platform) {
  let frame, nextId = 0, now = 0, nextTimer = 0;
  const contextValues = new Map(), timers = new Map(), animations = [];
  const changed = (before, after) => !before || !after || before.length !== after.length || before.some((value, index) => !Object.is(value, after[index]));
  const hooks = { ...React,
    useState(initial) {
      const owner = frame, index = owner.cursor++;
      if (!owner.slots[index]) owner.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [owner.slots[index].value, update => {
        const next = typeof update === 'function' ? update(owner.slots[index].value) : update;
        if (!Object.is(next, owner.slots[index].value)) { owner.slots[index].value = next; owner.dirty = true; }
      }];
    },
    useRef(value) { return frame.slots[frame.cursor++] ??= { current: value }; },
    useMemo(factory, deps) {
      const index = frame.cursor++;
      if (!frame.slots[index] || changed(frame.slots[index].deps, deps)) frame.slots[index] = { value: factory(), deps };
      return frame.slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useId() { return hooks.useMemo(() => `notice-source-${++nextId}`, []); },
    useContext(context) { return contextValues.get(context) ?? context._currentValue; },
    useLayoutEffect(callback, deps) { effect(callback, deps, frame.layout); },
    useEffect(callback, deps) { effect(callback, deps, frame.passive); },
  };
  function effect(callback, deps, queue) {
    const owner = frame, index = owner.cursor++;
    if (!owner.slots[index] || changed(owner.slots[index].deps, deps)) {
      const previous = owner.slots[index];
      owner.slots[index] = { deps };
      queue.push(() => { previous?.cleanup?.(); owner.slots[index].cleanup = callback(); });
    }
  }
  class AnimatedValue {
    constructor(value) { this.value = value; this.animation = null; }
    setValue(value) { this.value = value; }
    interpolate(config) { return config; }
    stopAnimation() {
      if (this.animation && !this.animation.finished) this.animation.finish(false);
      this.animation = null;
    }
  }
  const animate = kind => (value, config) => ({ start(callback) {
    const animation = { kind, config, finished: false, finish(finished = true) {
      this.finished = true;
      if (finished) value.value = config.toValue;
      callback?.({ finished });
    } };
    value.animation = animation;
    animations.push(animation);
  } });
  const native = {
    Animated: { Value: AnimatedValue, View: 'AnimatedView', spring: animate('spring'), timing: animate('timing') },
    Easing: { in: value => value, cubic: 'cubic' }, Platform: { OS: platform },
    StyleSheet: { create: value => value }, Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View',
  };
  const mockRequire = name => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) };
    if (name.includes('check-circle')) return { CheckCircleIcon: 'CheckCircleIcon' };
    if (name.includes('close-circle')) return { CloseCircleIcon: 'CloseCircleIcon' };
    if (name.includes('info-circle')) return { InfoCircleIcon: 'InfoCircleIcon' };
    throw new Error(`Unexpected import ${name}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: mockRequire,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  function mount(Component, initialProps = {}) {
    const owner = { Component, props: initialProps, slots: [], cursor: 0, dirty: false, layout: [], passive: [], output: null };
    const instance = {
      update(props = {}) { owner.props = { ...owner.props, ...props }; return this.flush(); },
      flush() {
        for (let count = 0; count < 20; count++) {
          frame = owner; owner.cursor = 0; owner.dirty = false; owner.layout = []; owner.passive = [];
          owner.output = Component(owner.props);
          if (owner.output?.type?.$$typeof === Symbol.for('react.context')) contextValues.set(owner.output.type, owner.output.props.value);
          owner.layout.forEach(run => run()); owner.passive.forEach(run => run());
          if (!owner.dirty) return owner.output;
        }
        throw new Error('Notification component did not settle');
      },
      unmount() { owner.slots.forEach(slot => slot.cleanup?.()); owner.output = null; },
      get output() { return owner.output; },
    };
    instance.flush();
    return instance;
  }
  const provider = mount(module.exports.BubbleNoticeProvider, { themeMode: 'light', notificationDirection: 'top', children: null });
  return { ...module.exports, mount, provider, animations, timers,
    get context() { return provider.output.props.value; },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].callback();
      }
      now = target;
    },
  };
}

test('one queue serializes sources and ignores repeated or obsolete completions', () => {
  const h = notificationHarness('android');
  let firstDismissed = 0, replacementDismissed = 0, secondDismissed = 0;
  h.context.publish('first', { id: 1, message: 'First' }, () => firstDismissed++);
  h.context.publish('second', { id: 2, message: 'Second' }, () => secondDismissed++);
  h.provider.flush();
  const first = h.context.active;
  assert.equal(first.notice.message, 'First');
  h.context.finish(first); h.context.finish(first); h.provider.flush();
  assert.equal(firstDismissed, 1);
  assert.equal(h.context.active.notice.message, 'Second');
  const second = h.context.active;
  h.context.publish('second', { id: 3, message: 'Replacement' }, () => replacementDismissed++); h.provider.flush();
  const replacement = h.context.active;
  h.context.finish(first); h.context.finish(second); h.provider.flush();
  assert.equal(h.context.active, replacement);
  assert.equal(secondDismissed, 0);
  h.context.finish(replacement); h.provider.flush();
  assert.equal(replacementDismissed, 1);
  assert.equal(h.context.active, undefined);
});

test('publisher cleanup removes queued notices and dismissal uses the latest callback', () => {
  const h = notificationHarness('ios');
  const notice = { id: 1, message: 'Saved' };
  let oldCallback = 0, latestCallback = 0;
  const first = h.mount(h.BottomBubble, { notice, onDismiss: () => oldCallback++ });
  const queued = h.mount(h.BottomBubble, { notice: { id: 2, message: 'Offline' }, onDismiss() {} });
  h.provider.flush();
  first.update({ onDismiss: () => latestCallback++ });
  const entry = h.context.active;
  h.context.finish(entry); h.provider.flush();
  assert.equal(oldCallback, 0);
  assert.equal(latestCallback, 1);
  assert.equal(h.context.active.notice.message, 'Offline');
  queued.unmount(); first.unmount(); h.provider.flush();
  assert.equal(h.context.active, undefined);
});

test('a stale publisher callback cannot clear its newer notice', () => {
  const h = notificationHarness('android');
  let dismissed = 0;
  const publisher = h.mount(h.BottomBubble, { notice: { id: 1, message: 'Original' }, onDismiss: () => dismissed++ });
  h.provider.flush();
  const old = h.context.active;
  publisher.update({ notice: { id: 2, message: 'Newer' } }); h.provider.flush();
  old.onDismiss(); h.context.finish(old); h.provider.flush();
  assert.equal(dismissed, 0);
  assert.equal(h.context.active.notice.message, 'Newer');
});

test('one host follows nested native modals and returns to the root after cleanup', () => {
  const h = notificationHarness('ios');
  h.context.publish('source', { id: 1, message: 'Saved inside a sheet' }, () => {}); h.provider.flush();
  const root = h.mount(h.BubbleNoticeHost, { root: true });
  assert.ok(root.output);
  const outer = h.mount(h.BubbleNoticeHost); h.provider.flush(); outer.flush(); root.flush();
  assert.equal(root.output, null); assert.ok(outer.output);
  const inner = h.mount(h.BubbleNoticeHost); h.provider.flush(); inner.flush(); outer.flush(); root.flush();
  assert.equal(root.output, null); assert.equal(outer.output, null); assert.ok(inner.output);
  inner.unmount(); h.provider.flush(); outer.flush(); root.flush();
  assert.ok(outer.output); assert.equal(root.output, null);
  outer.unmount(); h.provider.flush(); root.flush();
  assert.ok(root.output);
});

test('moving a notice from a closing modal to the root does not replay its entrance or restart its lifetime', () => {
  const h = notificationHarness('ios');
  h.context.publish('save', { id: 1, message: 'Transaction saved', durationMs: 2600 }, () => {}); h.provider.flush();
  const modalHost = h.mount(h.BubbleNoticeHost); h.provider.flush(); modalHost.flush();
  const bubble = h.mount(modalHost.output.type, modalHost.output.props);
  assert.equal(h.animations.filter(animation => animation.kind === 'spring').length, 1);
  h.advance(800); bubble.unmount(); modalHost.unmount(); h.provider.flush();
  const root = h.mount(h.BubbleNoticeHost, { root: true });
  const moved = h.mount(root.output.type, root.output.props);
  assert.equal(h.animations.filter(animation => animation.kind === 'spring').length, 1);
  h.advance(1799);
  assert.equal(h.animations.filter(animation => animation.kind === 'timing').length, 0);
  h.advance(1);
  assert.equal(h.animations.filter(animation => animation.kind === 'timing').length, 1);
  moved.unmount();
});

for (const platform of ['android', 'ios', 'web']) {
  for (const direction of ['top', 'bottom']) {
    test(`${platform} ${direction} offline notice waits 10 seconds then exits fully toward its entry side`, () => {
      const h = notificationHarness(platform);
      h.context.publish('offline', { id: 1, message: 'Offline', durationMs: 10000, tone: 'info' }, () => {}); h.provider.flush();
      const root = h.mount(h.BubbleNoticeHost, { root: true });
      let dismissed = 0;
      const bubble = h.mount(root.output.type, { ...root.output.props, notificationDirection: direction, onDismiss: () => dismissed++ });
      bubble.output.props.onLayout({ nativeEvent: { layout: { height: 128 } } }); bubble.flush();
      bubble.update({ notificationDirection: direction === 'top' ? 'bottom' : 'top' });
      const placement = bubble.output.props.style[1];
      assert.ok(direction === 'top' ? placement.top : placement.bottom, 'direction remains fixed while the notice is active');
      const offset = placement.transform[0].translateY.outputRange[0];
      assert.ok(direction === 'top' ? placement.top + offset + 128 < 0 : offset > placement.bottom + 128, 'exit clears the entire safe-area edge');
      h.advance(9999);
      assert.equal(h.animations.filter(animation => animation.kind === 'timing').length, 0);
      h.advance(1);
      const exit = h.animations.at(-1);
      assert.equal(exit.kind, 'timing');
      assert.equal(exit.config.toValue, 0);
      assert.equal(exit.config.useNativeDriver, platform !== 'web');
      assert.equal(dismissed, 0, 'notice remains mounted until slide-out finishes');
      exit.finish(true);
      assert.equal(dismissed, 1);
    });
  }
  test(`${platform} manual dismissal is idempotent and cancelled animations cannot dismiss another notice`, () => {
    const h = notificationHarness(platform);
    h.context.publish('offline', { id: 1, message: 'Offline', durationMs: 10000 }, () => {}); h.provider.flush();
    const root = h.mount(h.BubbleNoticeHost, { root: true });
    let dismissed = 0;
    const bubble = h.mount(root.output.type, { ...root.output.props, onDismiss: () => dismissed++ });
    const press = React.Children.toArray(bubble.output.props.children.props.children).find(child => child?.type === 'TouchableOpacity').props.onPress;
    press(); press(); h.advance(10000);
    assert.equal(h.animations.filter(animation => animation.kind === 'timing').length, 1);
    assert.equal(h.timers.size, 0);
    const exit = h.animations.at(-1);
    bubble.unmount();
    exit.finish(true);
    assert.equal(dismissed, 0, 'native completion after unmount is ignored');
  });
}
