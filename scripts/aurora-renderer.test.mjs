import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`;
const shaderUrl = moduleUrl(await readFile(new URL('../src/components/effects/auroraShader.ts', import.meta.url), 'utf8'));
const settingsUrl = moduleUrl((await readFile(new URL('../src/components/effects/auroraSettings.ts', import.meta.url), 'utf8')).replaceAll("'./auroraShader'", `'${shaderUrl}'`));
const rendererUrl = moduleUrl((await readFile(new URL('../src/components/effects/auroraRenderer.ts', import.meta.url), 'utf8')).replaceAll("'./auroraShader'", `'${shaderUrl}'`).replaceAll("'./auroraSettings'", `'${settingsUrl}'`));
const { normalizeAuroraSettings } = await import(settingsUrl);
const { createNativeAuroraRenderer } = await import(rendererUrl);

function context() {
  const calls = { presentations: 0, draws: 0 };
  const gl = new Proxy({
    drawingBufferWidth: 400, drawingBufferHeight: 200, FRAMEBUFFER_COMPLETE: 1,
    getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (_program, name) => name,
    checkFramebufferStatus: () => 1,
    drawArrays: () => { calls.draws++; }, endFrameEXP: () => { calls.presentations++; },
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === 'string' && /^[A-Z_0-9]+$/.test(key)) return key;
      if (typeof key === 'string' && key.startsWith('create')) return () => ({});
      return () => {};
    },
  });
  return { gl, calls };
}

test('an unchanged parent render does not submit another GL frame between animation ticks', () => {
  const { gl, calls } = context(), renderer = createNativeAuroraRenderer(gl, 2, () => [1, 0, 0]);
  const settings = normalizeAuroraSettings({ colorStops: ['#f00', '#00f'] });
  renderer.update(settings); renderer.draw(1, 1);
  renderer.update({ ...settings, stops: [...settings.stops] }); renderer.draw(1, 1);
  assert.equal(calls.presentations, 1);
  assert.equal(calls.draws, 1);
  renderer.draw(1.033, 1);
  assert.equal(calls.presentations, 2);
  renderer.dispose();
});

test('reveal, palette, size and static-time changes still present the updated frame', () => {
  const { gl, calls } = context(), renderer = createNativeAuroraRenderer(gl, 2, () => [1, 0, 0]);
  const settings = normalizeAuroraSettings({});
  renderer.update(settings); renderer.draw(0, 0);
  renderer.draw(0, 0.5);
  renderer.update(normalizeAuroraSettings({ colorStops: ['#123', '#456'] })); renderer.draw(0, 0.5);
  gl.drawingBufferWidth = 600; renderer.draw(0, 0.5);
  renderer.update(normalizeAuroraSettings({ time: 10 })); renderer.draw(0, 0.5);
  assert.equal(calls.presentations, 5);
  renderer.dispose(); renderer.draw(1, 1);
  assert.equal(calls.presentations, 5);
});
