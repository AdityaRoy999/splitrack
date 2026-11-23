import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildIdentity } from './build-identity.mjs';
const platform = process.env.BUILD_PLATFORM;
if (!['android', 'ios'].includes(platform)) throw new Error('Invalid platform.');
const app = JSON.parse(await readFile('app.json', 'utf8')).expo;
const file = platform === 'android' ? 'artifacts/Splittrack-release.apk' : 'Splittrack-unsigned.ipa';
const build = platform === 'android' ? app.android.versionCode : Number(process.env.BUILD_NUMBER);
const version = platform === 'android' ? app.version : process.env.APP_VERSION;
const { tag } = buildIdentity(platform, Number(process.env.GITHUB_RUN_NUMBER), Number(process.env.GITHUB_RUN_ATTEMPT));
const api = new URL(process.env.RELEASE_CONTROL_URL);
if (api.protocol !== 'https:' || !api.hostname.endsWith('.cloudfront.net')) throw new Error('RELEASE_CONTROL_URL must be the deployed HTTPS CloudFront address.');
if (process.env.GITHUB_REF !== `refs/heads/${platform}`) throw new Error('Only the matching platform branch can register a release.');
const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk);
const payload = { platform, build_number: build, version_name: version, sha256: hash.digest('hex'), size: (await stat(file)).size, download_url: `https://github.com/${process.env.PUBLIC_RELEASE_REPO}/releases/download/${tag}/${file.split('/').at(-1)}`, run_id: Number(process.env.GITHUB_RUN_ID), commit: process.env.GITHUB_SHA };
const tokenUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL); tokenUrl.searchParams.set('audience', 'splittrack-releases');
const oidc = await fetch(tokenUrl, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(15000) });
if (!oidc.ok) throw new Error('GitHub OIDC token request failed.');
const { value } = await oidc.json();
for (let attempt = 0; attempt < 3; attempt++) {
  const r = await fetch(`${api.origin}/api/builds/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(35000) });
  if (r.ok) { console.log(`Registered ${platform} ${version} (#${build}) for approval. No public manifest was changed.`); break; }
  const b = await r.json().catch(() => ({}));
  if (r.status < 500 || attempt === 2) throw new Error(`Build registration failed (${r.status}): ${b.message ?? 'Check the release API.'}`);
  await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
}
