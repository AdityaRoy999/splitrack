import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Buffer } from 'node:buffer';

const load = async path => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'), { mode: 'transform' })).toString('base64')}`);
const { isEffectVisible } = await load('../src/components/effects/effectVisibility.ts');
const { androidBlurFallbackTint, combineAndroidGlassTints } = await load('../src/components/glass/androidGlassTint.ts');

test('Android decorative rendering stops offscreen and resumes within overscan', () => {
  const rect = { pageX: 16, pageY: 200, width: 360, height: 152 };
  assert.equal(isEffectVisible(rect, 400, 800), true);
  assert.equal(isEffectVisible({ ...rect, pageY: 864 }, 400, 800), false);
  assert.equal(isEffectVisible({ ...rect, pageY: 840 }, 400, 800), true);
  assert.equal(isEffectVisible({ ...rect, pageY: -216 }, 400, 800), false);
  assert.equal(isEffectVisible({ ...rect, pageX: 800 }, 400, 800), false);
  assert.equal(isEffectVisible({ ...rect, width: 0 }, 400, 800), false);
  assert.equal(isEffectVisible(null, 400, 800), false);
});

const parse = value => value.match(/[\d.]+/g).map(Number);
const over = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));

test('one Android material tint preserves two-layer appearance over light and dark content', () => {
  for (const dark of [true, false]) {
    const lower = androidBlurFallbackTint(dark, dark ? 75 : 85);
    const upper = dark ? 'rgba(22, 22, 28, 0.62)' : 'rgba(255, 255, 255, 0.74)';
    const combined = parse(combineAndroidGlassTints(lower, upper));
    for (const background of [[0, 0, 0], [255, 255, 255], [45, 67, 200]]) {
      const previous = over(parse(upper), over(parse(lower), background));
      const current = over(combined, background);
      current.forEach((channel, index) => assert.ok(Math.abs(channel - previous[index]) <= 0.5));
    }
  }
});

test('Android tint helper retains Expo fallback alpha rounding and unsupported colors', () => {
  assert.equal(androidBlurFallbackTint(true, 100), `rgba(25,25,25,${175 / 255})`);
  assert.equal(androidBlurFallbackTint(false, 100), `rgba(249,249,249,${198 / 255})`);
  assert.equal(combineAndroidGlassTints('rgba(0,0,0,0)', 'rgba(0,0,0,0)'), 'transparent');
  assert.equal(combineAndroidGlassTints('rgba(0,0,0,0.5)', '#FFFFFF'), 'rgba(255,255,255,1)');
  assert.equal(combineAndroidGlassTints('rgba(0,0,0,0.5)', 'rebeccapurple'), null);
});
