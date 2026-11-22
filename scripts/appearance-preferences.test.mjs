import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), React = require('react'), ts = require('typescript');
const source = await readFile(new URL('../src/theme/LiquidGlassContext.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

function harness() {
  let cursor = 0, dirty = false, tree;
  const slots = [], writes = [];
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => {
        const next = typeof update === 'function' ? update(slots[index].value) : update;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback: callback => callback, useMemo: callback => callback(), useEffect() {}, useLayoutEffect() {},
  };
  const store = { settings: { isLiquidGlassEnabled: true, themeMode: 'dark', hideAmounts: false }, preferencesReady: true,
    saveSettings(next) { return new Promise((resolve, reject) => writes.push({ next, resolve, reject })); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react-native') return { ActivityIndicator: 'Spinner', Text: 'Text', View: 'View' };
    if (name === '@react-native-async-storage/async-storage') return { getItem: async () => 'swipe', setItem: async () => {} };
    if (name === './colors') return { themePalettes: { dark: {}, light: {} } };
    if (name === '../auth/AuthContext') return { useAuth: () => ({ user: { uid: 'synthetic-user' }, profile: { username: 'synthetic' } }) };
    if (name === '../store/SplitTrackStore') return { useSplitTrack: () => store };
    if (name === '../services/api') return { errorMessage: error => error.message };
    if (name.endsWith('/BottomBubble')) return { BottomBubble: 'Notice', BubbleNoticeProvider: 'NoticeProvider' };
    throw new Error(name);
  } });
  const flush = () => {
    for (let pass = 0; pass < 12; pass++) {
      cursor = 0; dirty = false; tree = module.exports.LiquidGlassProvider({ children: 'screens' });
      if (!dirty) return;
    }
    throw new Error('Appearance did not settle');
  };
  flush();
  return { flush, writes, get preferences() { return tree.props.value; },
    publish(next) { store.settings = { ...store.settings, ...next }; flush(); },
    async finish(index) { writes[index].resolve(); await Promise.resolve(); await Promise.resolve(); flush(); },
    async fail(index) { writes[index].reject(new Error('Offline')); await Promise.resolve(); await Promise.resolve(); flush(); },
  };
}

test('Glass/Matte updates on tap while the cloud request remains pending', () => {
  const h = harness();
  h.preferences.setIsLiquidGlassEnabled(false); h.flush();
  assert.equal(h.preferences.isLiquidGlassEnabled, false);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].next.isLiquidGlassEnabled, false);
});

test('rapid Glass/Matte taps survive older replies and delayed snapshot publication', async () => {
  const h = harness();
  h.preferences.setIsLiquidGlassEnabled(false); h.flush();
  h.preferences.setIsLiquidGlassEnabled(true); h.flush();
  h.preferences.setIsLiquidGlassEnabled(false); h.flush();
  h.publish({ hideAmounts: true });
  await h.finish(0);
  h.publish({ isLiquidGlassEnabled: true });
  await h.finish(1);
  assert.equal(h.preferences.isLiquidGlassEnabled, false, 'an old response cannot reset the last tap');
  await h.finish(2);
  assert.equal(h.preferences.isLiquidGlassEnabled, false, 'keep the override until its snapshot is actually published');
  h.publish({ isLiquidGlassEnabled: false });
  assert.equal(h.preferences.isLiquidGlassEnabled, false);
  h.publish({ isLiquidGlassEnabled: true });
  assert.equal(h.preferences.isLiquidGlassEnabled, true, 'once saved, later device changes can be applied');
});

test('failed saves leave the chosen appearance visible instead of silently flipping back', async () => {
  const h = harness();
  h.preferences.setIsLiquidGlassEnabled(false); h.flush();
  await h.fail(0);
  assert.equal(h.preferences.isLiquidGlassEnabled, false);
});
