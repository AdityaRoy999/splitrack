import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
const source = await readFile(new URL('../src/hooks/useChartTransition.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function harness() {
  const slots = [], animations = [], frames = new Map();
  let cursor = 0, dirty = false, effects = [], output, ready = true, nextFrame = 0;
  const changed = (before, after) => !before || !after || before.some((value, i) => !Object.is(value, after[i]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; dirty = true; }];
    },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useLayoutEffect: effect, useEffect: effect,
  };
  function effect(callback, deps) {
    const index = cursor++;
    if (!slots[index] || changed(slots[index].deps, deps)) {
      const previous = slots[index]; slots[index] = { deps };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
    }
  }
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} }
  const Animated = { Value,
    timing: (value, config) => ({ value, config }),
    parallel: children => {
      const animation = { children, start(callback) { this.callback = callback; animations.push(this); }, stop() {},
        complete(finished = true) { if (finished) children.forEach(({ value, config }) => value.setValue(config.toValue)); this.callback?.({ finished }); },
      }; return animation;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: name => name === 'react' ? hooks : { Animated, Easing: { out: value => value, cubic: 'cubic' }, Platform: { OS: 'android' } },
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
  });
  const h = { animations, frames,
    render(nextReady = ready) {
      ready = nextReady;
      for (let count = 0; count < 20; count++) {
        cursor = 0; dirty = false; effects = [];
        output = module.exports.useChartTransition(ready); effects.forEach(run => run());
        if (!dirty) return output;
      }
      throw new Error('Transition did not settle');
    },
    get output() { return output; },
    frame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(run => run()); },
  };
  h.render(); return h;
}

test('chart waits for loaded data and survives readiness changing before the reveal frame', () => {
  const h = harness(); let commits = 0;
  h.output.runChartTransition(1, () => commits++);
  h.animations[0].complete(); h.render();
  assert.equal(commits, 1);
  assert.equal(h.output.opacity.value, 0);
  assert.equal(h.frames.size, 1);
  h.render(false);
  assert.equal(h.frames.size, 0);
  h.render(true); h.frame();
  assert.equal(h.animations.length, 2, 'a cancelled reveal remains pending until a loaded frame can run');
  h.animations[1].complete();
  assert.equal(h.output.opacity.value, 1);
  assert.equal(h.output.translateX.value, 0);
});

test('only the latest chart request can commit and reveal its data', () => {
  const h = harness(), commits = [];
  h.output.runChartTransition(1, () => commits.push('old'));
  h.output.runChartTransition(-1, () => commits.push('new'));
  h.animations[0].complete(); h.render();
  assert.deepEqual(commits, []);
  h.animations[1].complete(); h.render(false);
  assert.deepEqual(commits, ['new']);
  assert.equal(h.frames.size, 0);
  h.render(true); h.frame(); h.animations[2].complete();
  assert.equal(h.output.opacity.value, 1);
});
