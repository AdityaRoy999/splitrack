import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentity } from './build-identity.mjs';
test('reruns create newer native builds and preserve earlier asset URLs', () => {
  for (const p of ['android', 'ios']) {
    const original = buildIdentity(p, 42, 1), retry = buildIdentity(p, 42, 2), lastAttempt = buildIdentity(p, 42, 99), nextRun = buildIdentity(p, 43, 1);
    assert.ok(retry.build > original.build);
    assert.notEqual(retry.tag, original.tag);
    assert.ok(nextRun.build > lastAttempt.build);
  }
});
test('invalid counters cannot silently create non-increasing or overflowing native versions', () => {
  for (const [run, attempt] of [[0, 1], [42, 0], [42, 100], [42.5, 1], [2147483647, 1]]) assert.throws(() => buildIdentity('android', run, attempt));
});
