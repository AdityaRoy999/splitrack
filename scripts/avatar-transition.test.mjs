import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/components/common/SettingsAvatarTransition.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

// Exercise delayed native measurements and animation completions against the
// real provider. No account, device, image loading or UI automation is needed.
function harness() {
  const slots = [], measurements = [], animations = [], timers = new Map();
  let cursor = 0, dirty = false, layout = [], passive = [], output, opened = 0, nextTimer = 0;
  const changed = (before, after) => !before || !after || before.some((value, index) => !Object.is(value, after[index]));
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => {
        const next = typeof update === 'function' ? update(slots[index].value) : update;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
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
      const previous = slots[index]; slots[index] = { deps };
      queue.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
    }
  }
  const reanimated = { default: { View: 'AnimatedView' }, ReduceMotion: { System: 'system' }, Easing: { bezier: () => 'ease' },
    useSharedValue(initial) { return hooks.useMemo(() => {
      const shared = { value: initial, get() { return this.value; }, set(next) {
        if (next && typeof next === 'object' && 'config' in next) { next.shared = shared; animations.push(next); }
        else this.value = next;
      } }; return shared;
    }, []); },
    useAnimatedStyle: callback => ({ evaluate: callback }),
    withTiming: (value, config, callback) => ({ value, config, callback }),
    cancelAnimation() {},
  };
  const mockRequire = name => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return { View: 'View', StyleSheet: { create: value => value } };
    if (name === 'react-native-reanimated') return reanimated;
    if (name === 'react-native-worklets') return { scheduleOnRN: (callback, ...args) => callback(...args), scheduleOnUI: (callback, ...args) => callback(...args) };
    if (name === '../../auth/AuthContext') return { useAuth: () => ({ profile: { displayName: 'Test' } }) };
    if (name === '../../theme/LiquidGlassContext') return { useLiquidGlass: () => ({ themeMode: 'dark' }) };
    if (name === '../../utils/measureWindow') return { measureNodeInWindow: (node, callback) => measurements.push({ node, callback }) };
    if (name === './UserAvatar') return { UserAvatar: 'Avatar' };
    throw new Error(`Unexpected import ${name}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: mockRequire,
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const onOpen = () => opened++;
  function flush() {
    for (let count = 0; count < 20; count++) {
      cursor = 0; dirty = false; layout = []; passive = [];
      output = module.exports.SettingsAvatarTransitionProvider({ children: null, onOpen });
      layout.forEach(run => run()); passive.forEach(run => run());
      if (!dirty) return;
    }
    throw new Error('Transition did not settle');
  }
  flush();
  return { measurements, animations, flush, get context() { return output.props.value; }, get opened() { return opened; },
    get frame() { return output.props.children.props.children[1]?.props.style[1].evaluate(); },
    fireFallback() { const entry = [...timers].find(([, timer]) => timer.ms === 120); timers.delete(entry[0]); entry[1].callback(); flush(); },
  };
}

const rootRect = { x: 20, y: 10, width: 400, height: 800 };
const sourceRect = { x: 36, y: 30, width: 42, height: 42 };
const targetRect = { x: 174, y: 120, width: 92, height: 92 };

test('avatar waits for source and root, opens once and lands in root coordinates', () => {
  const h = harness();
  h.context.open('source');
  h.measurements[1].callback(sourceRect); h.flush();
  assert.equal(h.opened, 0);
  h.measurements[0].callback(rootRect); h.flush();
  assert.equal(h.opened, 1);
  assert.equal(h.context.moving, true);
  assert.equal(h.frame.transform[0].translateX, -9);
  assert.equal(h.frame.transform[1].translateY, -5);
  assert.equal(h.frame.transform[2].scale, 42 / 92);
  h.context.destination('target'); h.measurements[2].callback(targetRect); h.flush();
  assert.equal(h.animations.length, 1);
  h.animations[0].shared.value = 1; h.flush();
  assert.equal(h.frame.transform[0].translateX, 154);
  assert.equal(h.frame.transform[1].translateY, 110);
  assert.equal(h.frame.transform[2].scale, 1);
  h.animations[0].callback(true); h.flush();
  assert.equal(h.context.moving, false);
});

test('measurement fallback ignores late callbacks and repeated destination layouts', () => {
  const h = harness();
  h.context.open('source'); h.fireFallback();
  assert.equal(h.opened, 1);
  h.measurements[0].callback(rootRect); h.measurements[1].callback(sourceRect); h.flush();
  assert.equal(h.opened, 1);
  assert.equal(h.context.moving, false);
  h.context.open('source');
  h.measurements[2].callback(rootRect); h.measurements[3].callback(sourceRect); h.flush();
  h.context.destination('target'); h.measurements[4].callback(targetRect); h.flush();
  h.context.destination('target'); h.measurements[5].callback(targetRect); h.flush();
  assert.equal(h.animations.length, 1);
});

test('an old animation completion cannot end a newer profile transition', () => {
  const h = harness();
  const start = () => {
    const index = h.measurements.length;
    h.context.open('source');
    h.measurements[index].callback(rootRect); h.measurements[index + 1].callback(sourceRect); h.flush();
    h.context.destination('target'); h.measurements[index + 2].callback(targetRect); h.flush();
  };
  start(); const old = h.animations[0]; old.callback(true); h.flush();
  start(); old.callback(true); h.flush();
  assert.equal(h.context.moving, true);
  h.animations[1].callback(true); h.flush();
  assert.equal(h.context.moving, false);
});

test('returning from Settings shrinks the photo to the original header and closes once', () => {
  const h = harness();
  h.context.open('header');
  h.measurements[0].callback(rootRect); h.measurements[1].callback(sourceRect); h.flush();
  h.context.destination('settings'); h.measurements[2].callback(targetRect); h.flush();
  h.animations[0].callback(true); h.flush();
  let closed = 0;
  const onClose = () => closed++;
  h.context.close('settings', onClose);
  h.context.close('settings', onClose);
  h.measurements[4].callback(targetRect); h.flush();
  assert.equal(closed, 0, 'Settings stays mounted until native measurements are available');
  h.measurements[3].callback(rootRect); h.flush();
  assert.equal(closed, 1);
  assert.equal(h.context.moving, true);
  assert.equal(h.frame.transform[0].translateX, 154);
  assert.equal(h.frame.transform[2].scale, 1);
  assert.equal(h.frame.borderRadius, 28);
  // A Settings layout callback received during exit must not retarget the flight.
  h.context.destination('settings'); h.measurements[5].callback(targetRect); h.flush();
  assert.equal(h.animations.length, 2);
  h.animations[1].shared.value = 1; h.flush();
  assert.equal(h.frame.transform[0].translateX, -9);
  assert.equal(h.frame.transform[1].translateY, -5);
  assert.equal(h.frame.transform[2].scale, 42 / 92);
  assert.equal(h.frame.borderRadius * h.frame.transform[2].scale, 14);
  h.animations[1].callback(true); h.flush();
  assert.equal(h.context.moving, false);
  assert.equal(closed, 1);
});

test('Back during the outward morph continues from the current photo position', () => {
  const h = harness();
  h.context.open('header');
  h.measurements[0].callback(rootRect); h.measurements[1].callback(sourceRect); h.flush();
  h.context.destination('settings'); h.measurements[2].callback(targetRect); h.flush();
  const outward = h.animations[0];
  outward.shared.value = 0.5; h.flush();
  const before = h.frame;
  let closed = 0;
  h.context.close('settings', () => closed++);
  h.measurements[3].callback(rootRect); h.measurements[4].callback(targetRect); h.flush();
  assert.equal(closed, 1);
  assert.equal(h.frame.transform[0].translateX, before.transform[0].translateX);
  assert.equal(h.frame.transform[1].translateY, before.transform[1].translateY);
  assert.equal(h.frame.transform[2].scale, before.transform[2].scale);
  outward.callback(true); h.flush();
  assert.equal(h.context.moving, true, 'the old completion cannot remove the returning photo');
  h.animations[1].callback(true); h.flush();
  assert.equal(h.context.moving, false);
});

test('a missing or offscreen Settings photo still navigates back without a stranded flight', () => {
  for (const offscreen of [false, true]) {
    const h = harness();
    h.context.open('header');
    h.measurements[0].callback(rootRect); h.measurements[1].callback(sourceRect); h.flush();
    h.context.destination('settings'); h.measurements[2].callback(targetRect); h.flush();
    h.animations[0].callback(true); h.flush();
    let closed = 0;
    h.context.close('settings', () => closed++);
    h.measurements[3].callback(rootRect);
    if (offscreen) { h.measurements[4].callback({ ...targetRect, y: -200 }); h.flush(); }
    else h.fireFallback();
    assert.equal(closed, 1);
    assert.equal(h.context.moving, false);
    h.measurements[4].callback(targetRect); h.flush();
    assert.equal(closed, 1, 'late measurements cannot navigate a second time');
  }
});

test('a second flight resets stale completion progress before its first painted frame', () => {
  const h = harness();
  const start = () => {
    const index = h.measurements.length;
    h.context.open('header');
    h.measurements[index].callback(rootRect); h.measurements[index + 1].callback(sourceRect); h.flush();
    h.context.destination('settings'); h.measurements[index + 2].callback(targetRect); h.flush();
  };
  start();
  h.animations[0].shared.value = 1;
  h.animations[0].callback(true); h.flush();
  assert.equal(h.frame.opacity, 0);
  start();
  assert.equal(h.frame.opacity, 1);
  assert.equal(h.frame.transform[0].translateX, -9);
  assert.equal(h.frame.transform[1].translateY, -5);
  assert.equal(h.frame.transform[2].scale, 42 / 92);
});
