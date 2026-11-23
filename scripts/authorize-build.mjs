const platform = process.env.BUILD_LOG_PLATFORM, requestId = process.env.CONTROL_BUILD_REQUEST;
if (!['android', 'ios'].includes(platform) || !requestId) throw new Error('This build requires an approved request. Source commits do not authorize builds.');
const target = new URL(process.env.RELEASE_CONTROL_URL);
if (target.protocol !== 'https:' || !target.hostname.endsWith('.cloudfront.net')) throw new Error('Invalid release control address.');
const identityUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL); identityUrl.searchParams.set('audience', 'splittrack-releases');
const identity = await fetch(identityUrl, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(15000) });
if (!identity.ok) throw new Error('Workflow identity request failed.');
const { value } = await identity.json();
const response = await fetch(`${target.origin}/api/pipelines/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${value}` }, body: JSON.stringify({ platform, request_id: requestId, run_id: Number(process.env.GITHUB_RUN_ID), commit: process.env.GITHUB_SHA }), signal: AbortSignal.timeout(30000) });
if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message ?? 'This build request was not approved.'); }
console.log(`Approved ${platform} build request verified for this commit and run attempt.`);
