import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const code = stripTypeScriptTypes(await readFile(new URL('../src/services/updatePolicy.ts', import.meta.url), 'utf8'), { mode: 'transform' });
const { updatePolicy } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const release = { latest_build: 42, min_required_build: 38, version_name: '1.0.42', download_url: 'https://github.com/AdityaRoy999/splittrack-releases/releases/download/android-42/app.apk', sha256: 'a'.repeat(64), size: 100, changelog: { problem: 'Sync failed.', action_taken: 'Added retries.' } };
test('Android update prompts distinguish optional updates from mandatory builds', () => {
  assert.equal(updatePolicy({ android: release }, 'android', 40).forced, false);
  assert.equal(updatePolicy({ android: release }, 'android', 37).forced, true);
  assert.equal(updatePolicy({ android: release }, 'android', 42), null);
  assert.equal(updatePolicy({ android: release }, 'android', 43), null);
});
test('invalid and untrusted manifests never launch an updater', () => {
  for (const patch of [{ sha256: 'short' }, { min_required_build: 43 }, { download_url: 'https://evil.invalid/app.apk' }, { changelog: null }, { latest_build: 1.5 }, { version_name: 'bad' }]) assert.equal(updatePolicy({ android: { ...release, ...patch } }, 'android', 40), null);
  assert.equal(updatePolicy({}, 'android', 40), null);
  assert.equal(updatePolicy({ android: release }, 'android', 0), null);
});
