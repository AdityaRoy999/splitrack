import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function resolveReleaseRef({ repo, token, fetchImpl = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now }) {
  if (repo !== 'AdityaRoy999/splittrack-releases') throw new Error('Unexpected public release repository.');
  if (!token?.trim()) throw new Error('RELEASE_TOKEN is required to check the binary repository without anonymous API rate limits.');
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${token}` };

  async function request(path, missingMessage) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, { headers, signal: AbortSignal.timeout(15000) });
      } catch {
        if (attempt === 2) throw new Error('GitHub binary repository check failed after 3 network attempts. Retry the build from the dashboard.');
        await wait(1000 * 2 ** attempt);
        continue;
      }
      if (response.ok) return response;
      if (response.status === 401) throw new Error('GitHub binary repository check failed (HTTP 401). Check PUBLIC_RELEASE_TOKEN validity.');
      if (response.status === 404) throw new Error(`${missingMessage} (HTTP 404). Check repository access for PUBLIC_RELEASE_TOKEN.`);
      const retryAfter = response.headers.get('retry-after');
      const rateLimited = response.status === 429 || response.status === 403 && (retryAfter !== null || response.headers.get('x-ratelimit-remaining') === '0');
      const transient = rateLimited || response.status >= 500 && response.status <= 599;
      if (!transient) throw new Error(`GitHub binary repository check failed (HTTP ${response.status}). Check PUBLIC_RELEASE_TOKEN repository permissions.`);
      let delay = 1000 * 2 ** attempt;
      if (retryAfter !== null) delay = Number(retryAfter) * 1000;
      else if (rateLimited) {
        const reset = Number(response.headers.get('x-ratelimit-reset'));
        delay = reset > 0 ? Math.max(1000, reset * 1000 - now() + 1000) : 60000;
      }
      if (attempt === 2 || !Number.isFinite(delay) || delay < 0 || delay > 30000) {
        throw new Error(`GitHub binary repository check failed (HTTP ${response.status})${rateLimited ? ' because its API rate limit was reached' : ' after 3 attempts'}. Retry the build from the dashboard later.`);
      }
      await wait(delay);
    }
  }

  const response = await request('', 'The public binary repository is missing or inaccessible');
  const data = await response.json();
  if (data.private !== false) throw new Error('The binary repository must be public.');
  const ref = data.default_branch;
  if (typeof ref !== 'string' || !ref.trim() || /[\r\n]/.test(ref)) throw new Error('Invalid release repository branch.');
  await request(`/branches/${encodeURIComponent(ref)}`, 'Initialize the public binary repository with one commit before building');
  return ref;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ref = await resolveReleaseRef({ repo: process.env.PUBLIC_RELEASE_REPO, token: process.env.RELEASE_TOKEN });
  await appendFile(process.env.GITHUB_OUTPUT, `ref=${ref}\n`);
}
