import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
const source = await readFile(new URL('../src/hooks/useAnalytics.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function harness() {
  let cursor = 0, dirty = false, effects = [], output;
  const slots = [], requests = [];
  const state = { uid: 'analytics-user', revision: 1, visible: true, enabled: true, period: 'Month', month: 10, year: 2026, date: null };
  const changed = (before, after) => !before || before.some((value, index) => !Object.is(value, after[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => {
        const value = typeof update === 'function' ? update(slots[index].value) : update;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(callback, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || changed(previous.deps, deps)) {
        slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, AbortController, require(name) {
    if (name === 'react') return hooks;
    if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: state.uid ? { uid: state.uid } : null }) };
    if (name.endsWith('/SplitTrackStore')) return { useSplitTrack: () => ({ revision: state.revision }) };
    if (name.endsWith('/SceneActivityContext')) return { useSceneVisible: () => state.visible };
    if (name.endsWith('/api')) return { errorMessage: error => error.message, api(path, options) {
      return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
    } };
    throw new Error(`Unexpected module ${name}`);
  } });
  function flush() {
    for (let pass = 0; pass < 15; pass++) {
      cursor = 0; dirty = false; effects = [];
      output = module.exports.useAnalytics(state.period, state.year, state.month, state.date, state.enabled);
      effects.forEach(effect => effect());
      if (!dirty) return;
    }
    throw new Error('Analytics hook failed to settle');
  }
  flush();
  return { requests, get result() { return output; }, update(patch) { Object.assign(state, patch); flush(); }, flush,
    async settle() { await new Promise(resolve => setImmediate(resolve)); flush(); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

const analytics = value => ({ categories: { Other: value }, totalIncome: 0, totalExpenses: value, points: [] });

test('late cached analytics are displayed after leaving and returning to the same tab', async () => {
  const h = harness();
  assert.equal(h.result.loading, true);
  h.update({ visible: false });
  assert.equal(h.requests[0].options.signal.aborted, true);
  // A completed native fetch can win the abort race after the effect cleans up.
  h.requests[0].resolve(analytics(21)); await h.settle();
  h.update({ visible: true });
  assert.equal(h.requests.length, 1);
  assert.equal(h.result.loading, false);
  assert.equal(h.result.data.totalExpenses, 21);
});

test('token/profile object refreshes do not cancel the analytics request for the same user', async () => {
  const h = harness();
  for (let index = 0; index < 5; index++) h.flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.signal.aborted, false);
  h.requests[0].resolve(analytics(5)); await h.settle();
  assert.equal(h.result.data.totalExpenses, 5);
  assert.equal(h.result.loading, false);
});

test('new revisions cannot render an older response and cached periods become visible immediately', async () => {
  const h = harness();
  h.update({ revision: 2 });
  h.requests[1].resolve(analytics(9)); await h.settle();
  h.requests[0].resolve(analytics(3)); await h.settle();
  assert.equal(h.result.data.totalExpenses, 9);
  h.update({ month: 9 });
  h.requests[2].resolve(analytics(4)); await h.settle();
  h.update({ month: 10 });
  assert.equal(h.requests.length, 3);
  assert.equal(h.result.loading, false);
  assert.equal(h.result.data.totalExpenses, 9);
});

test('failed analytics stop loading and the retry action requests fresh data', async () => {
  const h = harness();
  h.requests[0].reject(new Error('Connection lost')); await h.settle();
  assert.equal(h.result.loading, false);
  assert.equal(h.result.error, 'Connection lost');
  h.result.retry(); h.flush();
  assert.equal(h.result.loading, true);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(analytics(7)); await h.settle();
  assert.equal(h.result.loading, false);
  assert.equal(h.result.error, '');
  assert.equal(h.result.data.totalExpenses, 7);
});

test('analytics are user-scoped and skip disabled or signed-out requests', async () => {
  const h = harness();
  h.requests[0].resolve(analytics(21)); await h.settle();
  h.update({ uid: 'other-user' });
  assert.equal(h.result.data, undefined);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].options.expectedUid, 'other-user');
  h.update({ enabled: false, month: 3 });
  assert.equal(h.result.loading, false);
  assert.equal(h.requests.length, 2);
  h.update({ enabled: true, uid: null });
  assert.equal(h.result.loading, false);
  assert.equal(h.requests.length, 2);
});
