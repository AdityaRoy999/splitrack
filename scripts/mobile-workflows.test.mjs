import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { load } = createRequire(import.meta.url)('js-yaml');
const docs = await Promise.all(['android-apk.yml', 'ios-unsigned-ipa.yml'].map(async name => load(await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'))));
test('only approved manual builds run on the matching platform branch', () => {
  for (const [i, platform] of ['android', 'ios'].entries()) {
    const doc = docs[i], job = Object.values(doc.jobs)[0];
    assert.deepEqual(Object.keys(doc.on), ['workflow_dispatch']);
    assert.equal(doc.on.workflow_dispatch.inputs.control_request.required, true);
    assert.equal(doc.on.workflow_dispatch.inputs.control_request.type, 'string');
    assert.equal(job.if, `github.ref == 'refs/heads/${platform}' && github.actor != 'github-actions[bot]'`);
    assert.doesNotMatch(job.if, /main/);
    assert.equal(doc.permissions['id-token'], 'write');
    assert.equal(doc.permissions.contents, 'read');
  }
});
test('commits to android, ios and main never start a build', () => {
  const targets = branch => docs.map(doc => doc.on.push?.branches?.includes(branch) ?? false);
  assert.deepEqual(targets('android'), [false, false]);
  assert.deepEqual(targets('ios'), [false, false]);
  assert.deepEqual(targets('main'), [false, false]);
});
test('platform builds use native runners and separate queues', () => {
  assert.equal(Object.values(docs[0].jobs)[0]['runs-on'], 'ubuntu-latest');
  assert.equal(Object.values(docs[1].jobs)[0]['runs-on'], 'macos-latest');
  assert.notEqual(docs[0].concurrency.group, docs[1].concurrency.group);
});
test('configuration fails early and release uploads precede pending registration', () => {
  for (const doc of docs) {
    const steps = Object.values(doc.jobs)[0].steps;
    const setup = steps.findIndex(s => s.name === 'Validate release control configuration');
    const install = steps.findIndex(s => /Install.*dependencies/.test(s.name));
    assert.ok(setup >= 0 && setup < install);
    const approval = steps.findIndex(s => s.name === 'Authorize build request');
    assert.ok(approval >= 0 && approval < setup && approval < install);
    assert.equal(steps[approval].env.CONTROL_BUILD_REQUEST, '${{ inputs.control_request }}');
    const release = steps.findIndex(s => s.uses?.startsWith('softprops/action-gh-release'));
    const register = steps.findIndex(s => s.name === 'Register build for release approval');
    assert.ok(release >= 0 && register > release);
    assert.equal(steps[release].with.repository, '${{ vars.PUBLIC_RELEASE_REPO }}');
    assert.equal(steps[release].with.token, '${{ secrets.PUBLIC_RELEASE_TOKEN }}');
    assert.equal(steps[release].with.make_latest, false);
    assert.ok(!steps.some(s => /Update SideStore AltSource feed/.test(s.name)));
    assert.ok(!steps.some(s => /git push/.test(s.run ?? '')));
  }
});
