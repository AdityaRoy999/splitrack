import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../src/hooks/useAvatarPhoto.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

// Run the real hook against native activity events and a deterministic clock.
function harness(uri = 'https://photos.example.invalid/friend.jpg') {
  let cursor = 0, dirty = false, effects = [], now = 0, timerId = 0, result;
  const slots = [], timers = new Map();
  const activity = { foreground: true, sceneActive: true };
  const changed = (before, after) => !before || before.some((value, index) => !Object.is(value, after[index]));
  function effect(callback, deps) {
    const index = cursor++, previous = slots[index];
    if (!previous || changed(previous.deps, deps)) {
      slots[index] = { deps };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
    }
  }
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial() };
      return [slots[index].value, update => {
        const value = update(slots[index].value);
        if (value !== slots[index].value) { slots[index].value = value; dirty = true; }
      }];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useEffect: effect, useLayoutEffect: effect,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return hooks;
      if (name === './useVisualActivity') return { useVisualActivity: () => activity };
      if (name.endsWith('/SceneActivityContext')) return { useSceneVisible: () => activity.sceneActive };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  function flush() {
    for (let passes = 0; passes < 10; passes++) {
      cursor = 0; dirty = false; effects = [];
      result = exports.useAvatarPhoto(uri);
      effects.forEach(callback => callback());
      if (!dirty) return;
    }
    throw new Error('Hook did not settle');
  }
  flush();
  return {
    get photo() { return result; },
    get timerCount() { return timers.size; },
    flush,
    update(next) { Object.assign(activity, next); flush(); },
    source(next) { uri = next; flush(); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
      flush();
    },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

test('failed downloads recover at 1s, 4s, 15s and then a capped 60s delay', () => {
  const h = harness();
  assert.equal(h.photo.shouldLoad, true);
  assert.equal(h.photo.loaded, false, 'initials remain visible until native onLoad');
  for (const delay of [1000, 4000, 15000, 60000, 60000]) {
    const attempt = h.photo.attempt;
    h.photo.onError(); h.flush();
    assert.equal(h.photo.shouldLoad, false);
    h.advance(delay - 1);
    assert.equal(h.photo.attempt, attempt);
    h.advance(1);
    assert.equal(h.photo.shouldLoad, true);
    assert.equal(h.photo.attempt, attempt + 1);
  }
  h.photo.onLoad(); h.flush();
  assert.equal(h.photo.loaded, true);
  assert.equal(h.timerCount, 0);
});

test('background and hidden scenes stop retries and resume immediately on return', () => {
  for (const field of ['foreground', 'sceneActive']) {
    const h = harness();
    h.photo.onError(); h.flush();
    h.update({ [field]: false });
    assert.equal(h.timerCount, 0);
    h.advance(60000);
    assert.equal(h.photo.attempt, 0);
    h.update({ [field]: true });
    h.advance(0);
    assert.equal(h.photo.attempt, 1);
    assert.equal(h.photo.shouldLoad, true);
  }
});

test('fresh signed URLs reset failures and stale download callbacks cannot hide them', () => {
  const h = harness('https://photos.example.invalid/friend?signature=old');
  const old = h.photo;
  old.onError(); h.flush();
  h.source('https://photos.example.invalid/friend?signature=fresh');
  assert.equal(h.photo.attempt, 0);
  assert.equal(h.photo.shouldLoad, true);
  old.onError(); old.onLoad(); h.flush();
  assert.equal(h.photo.loaded, false);
  assert.equal(h.photo.shouldLoad, true);
  h.photo.onLoad(); h.flush();
  assert.equal(h.photo.loaded, true);
});

test('an earlier retry cannot overwrite a newer successful download', () => {
  const h = harness(), first = h.photo;
  first.onError(); h.flush(); h.advance(1000);
  h.photo.onLoad(); h.flush();
  first.onError(); h.flush();
  assert.equal(h.photo.loaded, true);
  assert.equal(h.timerCount, 0);
});

test('cartoon/canonical references never request photos and unmount clears retries', () => {
  for (const uri of ['cartoon:cat', 'media:app-media/alice/photo.png', '', null]) {
    const h = harness(uri);
    assert.equal(h.photo.shouldLoad, false);
    h.photo.onError(); h.flush();
    assert.equal(h.timerCount, 0);
  }
  const h = harness();
  h.photo.onError(); h.flush();
  assert.equal(h.timerCount, 1);
  h.unmount();
  assert.equal(h.timerCount, 0);
});

test('a stalled native download retries and a late callback from its abandoned attempt is ignored', () => {
  const h = harness(), first = h.photo;
  h.advance(12000);
  assert.equal(h.photo.shouldLoad, false);
  h.advance(1000);
  assert.equal(h.photo.attempt, 1);
  assert.equal(h.photo.shouldLoad, true);
  first.onLoad(); h.flush();
  assert.equal(h.photo.loaded, false);
  h.photo.onLoad(); h.flush();
  assert.equal(h.photo.loaded, true);
  assert.equal(h.timerCount, 0);
});
