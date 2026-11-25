import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReleaseRef } from './prepare-release-ref.mjs';

const repo = 'AdityaRoy999/splittrack-releases';
const token = 'test-release-token';
const repository = { private: false, default_branch: 'main' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

function harness(responses, overrides = {}) {
  const requests = [], waits = [];
  return {
    requests, waits,
    resolve: () => resolveReleaseRef({ repo, token, now: () => 1_800_000_000_000,
      wait: async milliseconds => { waits.push(milliseconds); },
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        assert.ok(responses.length, 'unexpected extra request');
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return typeof next === 'function' ? next(url, options) : next;
      }, ...overrides }),
  };
}

test('release discovery authenticates both requests and returns an existing public branch', async () => {
  const h = harness([json(repository), json({ name: 'main' })]);
  assert.equal(await h.resolve(), 'main');
  assert.deepEqual(h.requests.map(request => request.url), [
    `https://api.github.com/repos/${repo}`, `https://api.github.com/repos/${repo}/branches/main`,
  ]);
  for (const { options } of h.requests) {
    const headers = new Headers(options.headers);
    assert.equal(headers.get('authorization'), `Bearer ${token}`);
    assert.equal(headers.get('accept'), 'application/vnd.github+json');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
  }
  assert.notEqual(h.requests[0].options.signal, h.requests[1].options.signal, 'each HTTP operation needs a fresh timeout');
});

test('every request and retry receives a fresh 15 second deadline', async () => {
  const original = AbortSignal.timeout;
  const deadlines = [];
  AbortSignal.timeout = milliseconds => { deadlines.push(milliseconds); return original(milliseconds); };
  try {
    const h = harness([json({}, 503), json(repository), json({}, 502), json({ name: 'main' })]);
    assert.equal(await h.resolve(), 'main');
    assert.deepEqual(deadlines, [15000, 15000, 15000, 15000]);
    assert.equal(new Set(h.requests.map(request => request.options.signal)).size, 4);
  } finally {
    AbortSignal.timeout = original;
  }
});

test('network and transient server failures can recover within three attempts', async () => {
  const h = harness([new TypeError('private internal network detail'), json({}, 503), json(repository), json({ name: 'main' })]);
  assert.equal(await h.resolve(), 'main');
  assert.equal(h.requests.length, 4);
  assert.equal(h.waits.length, 2);
});

test('retry exhaustion stops after three network attempts without exposing the cause', async () => {
  const h = harness(Array.from({ length: 3 }, () => new Error('SENSITIVE_NETWORK_CAUSE')));
  await assert.rejects(h.resolve(), error => {
    assert.doesNotMatch(error.message, /SENSITIVE_NETWORK_CAUSE|test-release-token/);
    assert.match(error.message, /network|connect|request|reach|retry/i);
    return true;
  });
  assert.equal(h.requests.length, 3); assert.equal(h.waits.length, 2);
});

test('retry exhaustion preserves the HTTP status but never echoes a server response', async () => {
  const h = harness(Array.from({ length: 3 }, () => json({ message: 'SENSITIVE_SERVER_BODY' }, 503)));
  await assert.rejects(h.resolve(), error => {
    assert.match(error.message, /503/); assert.doesNotMatch(error.message, /SENSITIVE_SERVER_BODY|test-release-token/);
    return true;
  });
  assert.equal(h.requests.length, 3); assert.equal(h.waits.length, 2);
});

test('authorization failures and a non-rate-limit 403 are not retried', async () => {
  for (const status of [401, 403]) {
    const h = harness([json({ message: 'SENSITIVE_SERVER_BODY' }, status)]);
    await assert.rejects(h.resolve(), error => {
      assert.match(error.message, new RegExp(String(status)));
      assert.doesNotMatch(error.message, /SENSITIVE_SERVER_BODY|test-release-token/);
      return true;
    });
    assert.equal(h.requests.length, 1); assert.deepEqual(h.waits, []);
  }
});

test('missing repository and uninitialized default branch produce distinct actionable failures', async () => {
  const missing = harness([json({}, 404)]);
  await assert.rejects(missing.resolve(), /404.*(?:missing|inaccessible|access|exist)|(?:missing|inaccessible|access|exist).*404/i);
  assert.equal(missing.requests.length, 1); assert.deepEqual(missing.waits, []);
  const empty = harness([json(repository), json({}, 404)]);
  await assert.rejects(empty.resolve(), /initializ|one commit|first commit/i);
  assert.equal(empty.requests.length, 2); assert.deepEqual(empty.waits, []);
});

test('a short Retry-After rate limit waits before retrying', async () => {
  for (const status of [403, 429]) {
    const h = harness([json({}, status, { 'Retry-After': '2' }), json(repository), json({ name: 'main' })]);
    assert.equal(await h.resolve(), 'main');
    assert.deepEqual(h.waits, [2000]); assert.equal(h.requests.length, 3);
  }
});

test('a short GitHub rate-limit reset uses the injected clock with a safety buffer', async () => {
  const h = harness([json({}, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000012' }), json(repository), json({ name: 'main' })]);
  assert.equal(await h.resolve(), 'main');
  assert.deepEqual(h.waits, [13000]);
});

test('long rate limits fail promptly with an actionable status instead of sleeping', async () => {
  for (const [status, headers] of [[429, { 'Retry-After': '31' }], [403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000060' }]]) {
    const h = harness([json({ message: 'SENSITIVE_SERVER_BODY' }, status, headers)]);
    await assert.rejects(h.resolve(), error => {
      assert.match(error.message, new RegExp(String(status)));
      assert.match(error.message, /rate|retry|limit|later/i);
      assert.doesNotMatch(error.message, /SENSITIVE_SERVER_BODY/);
      return true;
    });
    assert.equal(h.requests.length, 1); assert.deepEqual(h.waits, []);
  }
});

test('rate-limit retries also stop after three attempts', async () => {
  const h = harness(Array.from({ length: 3 }, () => json({}, 429, { 'Retry-After': '1' })));
  await assert.rejects(h.resolve(), /429/);
  assert.equal(h.requests.length, 3); assert.deepEqual(h.waits, [1000, 1000]);
});

test('private release repositories are rejected before checking any branch', async () => {
  const h = harness([json({ ...repository, private: true })]);
  await assert.rejects(h.resolve(), /public/i);
  assert.equal(h.requests.length, 1);
});

test('invalid default branches cannot be written as workflow outputs', async () => {
  for (const ref of ['', 'main\r\nref=attacker', null, 123]) {
    const h = harness([json({ ...repository, default_branch: ref })]);
    await assert.rejects(h.resolve(), /branch|ref/i);
    assert.equal(h.requests.length, 1);
  }
});

test('valid branch names are encoded as one URL segment', async () => {
  const ref = 'release/ios-current';
  const h = harness([json({ ...repository, default_branch: ref }), json({ name: ref })]);
  assert.equal(await h.resolve(), ref);
  assert.equal(h.requests[1].url, `https://api.github.com/repos/${repo}/branches/release%2Fios-current`);
});

test('repository and token validation happen before making any network request', async () => {
  for (const overrides of [{ repo: 'attacker/other' }, { repo: undefined }, { token: '' }, { token: '  ' }, { token: undefined }]) {
    const h = harness([], overrides);
    await assert.rejects(h.resolve(), /repo|token/i);
    assert.equal(h.requests.length, 0);
  }
});
