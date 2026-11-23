import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(await readFile(new URL('../src/services/updateProgress.ts', import.meta.url), 'utf8'), { mode: 'transform' });
const { parseUpdateProgress, progressLabel } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const sha256 = 'a'.repeat(64);
test('progress rejects stale artifacts, invalid percentages and unknown stages', () => {
  for (const value of [null, { sha256: 'b'.repeat(64), stage: 'downloading', percent: 10 }, { sha256, stage: 'downloading', percent: NaN }, { sha256, stage: 'downloading', percent: 101 }, { sha256, stage: 'LIVE', percent: 100 }]) assert.equal(parseUpdateProgress(value, sha256), null);
});
test('measured progress stays distinct from confirmation, failure and successful installation', () => {
  assert.equal(progressLabel(parseUpdateProgress({ sha256, stage: 'downloading', percent: 34.8 }, sha256)), 'Downloading 34%');
  assert.equal(progressLabel(parseUpdateProgress({ sha256, stage: 'installing', percent: 80 }, sha256)), 'Installing 80%');
  assert.equal(progressLabel(parseUpdateProgress({ sha256, stage: 'awaiting_confirmation', percent: 0 }, sha256)), 'Confirm installation in Android');
  assert.equal(progressLabel(parseUpdateProgress({ sha256, stage: 'failed', percent: 0 }, sha256)), 'Retry download & install');
  assert.equal(progressLabel(parseUpdateProgress({ sha256, stage: 'complete', percent: 100 }, sha256)), 'Installed');
});
