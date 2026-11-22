import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml');
const android = load(await readFile(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8'));
const ios = load(await readFile(new URL('../.github/workflows/ios-unsigned-ipa.yml', import.meta.url), 'utf8'));
const workflows = [android, ios];
const pushTargets = branch => workflows.map(workflow => workflow.on.push.branches.includes(branch));

test('each platform push starts only its own build; main and other branches start neither', () => {
  assert.deepEqual(pushTargets('android'), [true, false]);
  assert.deepEqual(pushTargets('ios'), [false, true]);
  for (const branch of ['main', 'feature/shared-fix', 'Android', 'IOS']) assert.deepEqual(pushTargets(branch), [false, false]);
  assert.deepEqual(android.on.push.branches, ['android']);
  assert.deepEqual(ios.on.push.branches, ['ios']);
  for (const workflow of workflows) {
    assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
    assert.deepEqual(Object.keys(workflow.on).sort(), ['push', 'workflow_dispatch']);
  }
});

test('manual dispatch and bot commits cannot build the wrong platform branch', () => {
  for (const [workflow, branch] of [[android, 'android'], [ios, 'ios']]) {
    const jobs = Object.values(workflow.jobs);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].if, `github.ref == 'refs/heads/${branch}' && github.actor != 'github-actions[bot]'`);
  }
});

test('isolated workflows retain their native platforms, artifacts and separate queues', () => {
  const apk = android.jobs['build-apk'], ipa = ios.jobs['build-unsigned-ios'];
  assert.equal(apk['runs-on'], 'ubuntu-latest');
  assert.equal(ipa['runs-on'], 'macos-latest');
  assert.notEqual(android.concurrency.group, ios.concurrency.group);
  assert.ok(apk.steps.some(step => step.run?.includes('expo prebuild --platform android')));
  assert.ok(ipa.steps.some(step => step.run?.includes('expo prebuild --platform ios')));
  assert.ok(apk.steps.some(step => step.uses === 'actions/upload-artifact@v4' && step.with.path.includes('Splittrack-release.apk')));
  assert.ok(ipa.steps.some(step => step.uses === 'actions/upload-artifact@v4' && step.with.path === 'Splittrack-unsigned.ipa'));
});

test('iOS preserves the existing main SideStore feed without updating Android', () => {
  const feed = ios.jobs['build-unsigned-ios'].steps.find(step => step.name === 'Update SideStore AltSource feed');
  assert.ok(feed);
  assert.match(feed.run, /git fetch origin main/);
  assert.match(feed.run, /git push origin HEAD:main/);
  assert.doesNotMatch(feed.run, /git push[^\n]*\bandroid\b/);
  assert.deepEqual(pushTargets('main'), [false, false]);
});
