import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

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

test('iOS publishes its SideStore feed only to the iOS branch', () => {
  const feed = ios.jobs['build-unsigned-ios'].steps.find(step => step.name === 'Update SideStore AltSource feed');
  assert.ok(feed);
  assert.match(feed.run, /git fetch origin ios/);
  assert.match(feed.run, /git switch -C ios origin\/ios/);
  assert.match(feed.run, /git push origin HEAD:ios/);
  assert.doesNotMatch(feed.run, /git (?:fetch|switch|push)[^\n]*\b(?:main|android)\b/);
  assert.doesNotMatch(feed.run, /raw\.githubusercontent\.com\/[^\n]*\/main\//);
  assert.deepEqual(pushTargets('main'), [false, false]);
});

test('SideStore generation migrates the feed URL to iOS and preserves release history', async () => {
  const feed = ios.jobs['build-unsigned-ios'].steps.find(step => step.name === 'Update SideStore AltSource feed');
  const script = feed.run.match(/node <<'NODE'\n([\s\S]*?)\nNODE/)[1];
  const previous = { version: '1.0.47', buildVersion: '47', downloadURL: 'https://example.invalid/previous.ipa', size: 100 };
  const bundle = 'com.AdiSai.fintrack';
  const seed = { sourceURL: 'https://raw.githubusercontent.com/AdityaRoy999/splitrack/main/apps.json', apps: [{ name: 'Splittrack', bundleIdentifier: bundle, versions: [previous] }] };
  const result = await new Promise((resolve, reject) => {
    vm.runInNewContext(script, {
      require(name) {
        assert.equal(name, 'fs');
        return {
          existsSync: () => true,
          readFileSync: () => JSON.stringify(seed),
          writeFileSync(file, content) { assert.equal(file, 'apps.json'); resolve(JSON.parse(content)); },
        };
      },
      process: {
        env: { REPOSITORY: 'AdityaRoy999/splitrack', RELEASE_TAG: 'splittrack-ios-50', BUNDLE_ID: bundle, APP_VERSION: '1.0.50', BUILD_NUMBER: '50', COMMIT_MESSAGE: 'iOS update', FALLBACK_URL: 'https://example.invalid/fresh.ipa', FALLBACK_SIZE: '200', RELEASE_DATE: '2026-11-22T12:00:00Z' },
        exit: code => reject(new Error(`Feed script exited with ${code}`)),
      },
      fetch: async () => ({ ok: false }),
      console: { log() {}, warn() {}, error: reject },
    });
  });
  assert.equal(result.sourceURL, 'https://raw.githubusercontent.com/AdityaRoy999/splitrack/ios/apps.json');
  assert.equal(result.apps[0].iconURL, 'https://raw.githubusercontent.com/AdityaRoy999/splitrack/ios/assets/icon-light.png');
  assert.equal(result.apps[0].versions[0].buildVersion, '50');
  assert.deepEqual(result.apps[0].versions[1], previous);
  assert.equal(result.apps[0].downloadURL, 'https://example.invalid/fresh.ipa');
});
