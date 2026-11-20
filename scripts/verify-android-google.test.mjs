import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAndroidGoogle } from './verify-android-google.mjs';

const sha1 = 'A'.repeat(40), sha256 = 'B'.repeat(64);
const input = {
  certificateOutput: `Signer #1 certificate SHA-1 digest: ${sha1.toLowerCase()}\nSigner #1 certificate SHA-256 digest: ${sha256.toLowerCase()}\n`,
  packageName: 'com.example.app', projectId: 'test-project', projectNumber: '12345',
  webClientId: '12345-webclient.apps.googleusercontent.com',
};
const registration = oauth_client => ({
  project_info: { project_id: input.projectId, project_number: input.projectNumber },
  client: [{ client_info: { android_client_info: { package_name: input.packageName } }, oauth_client }],
});
const web = { client_type: 3, client_id: input.webClientId };
const android = { client_type: 1, android_info: { package_name: input.packageName, certificate_hash: sha1 } };

test('matching registered APK signer and web client pass', () => {
  const result = verifyAndroidGoogle({ ...input, expectedSha1: sha1.match(/../g).join(':'), registration: registration([web, android]) });
  assert.equal(result.registered, true);
  assert.equal(result.sha1, sha1);
  assert.equal(result.sha256, sha256);
});
test('web-only registration identifies missing Android OAuth without blocking existing builds', () => {
  assert.equal(verifyAndroidGoogle({ ...input, registration: registration([web]) }).registered, false);
  assert.equal(verifyAndroidGoogle(input).registered, undefined);
});
test('changing APK signer or OAuth project cannot silently pass configured guards', () => {
  assert.throws(() => verifyAndroidGoogle({ ...input, expectedSha1: 'C'.repeat(40) }), /APK signer differs/);
  assert.throws(() => verifyAndroidGoogle({ ...input, webClientId: '99999-webclient.apps.googleusercontent.com' }), /Firebase project number/);
  assert.throws(() => verifyAndroidGoogle({ ...input, registration: registration([web, { ...android, android_info: { ...android.android_info, certificate_hash: 'C'.repeat(40) } }]) }), /absent/);
});
test('invalid certificate output, registration, or fingerprint fails clearly', () => {
  assert.throws(() => verifyAndroidGoogle({ ...input, certificateOutput: 'verified' }), /Could not read/);
  assert.throws(() => verifyAndroidGoogle({ ...input, expectedSha1: 'invalid' }), /must be a SHA-1/);
  assert.throws(() => verifyAndroidGoogle({ ...input, registration: { ...registration([web, android]), project_info: { project_id: 'another-project' } } }), /different Firebase/);
  assert.throws(() => verifyAndroidGoogle({ ...input, registration: registration([{ ...web, client_id: 'other' }, android]) }), /web client ID differs/);
});
test('iOS OAuth references must match the current native callback client and bundle', () => {
  const iosClientId = '12345-iosclient.apps.googleusercontent.com';
  const current = registration([web]);
  current.client[0].services = { appinvite_service: { other_platform_oauth_client: [{ client_type: 2, client_id: iosClientId, ios_info: { bundle_id: input.packageName } }] } };
  assert.equal(verifyAndroidGoogle({ ...input, registration: current, iosClientId }).iosRegistered, true);
  assert.throws(() => verifyAndroidGoogle({ ...input, registration: current, iosClientId, iosBundleId: 'com.other.app' }), /iOS OAuth reference differs/);
  assert.throws(() => verifyAndroidGoogle({ ...input, registration: current, iosClientId: '12345-oldclient.apps.googleusercontent.com' }), /iOS OAuth reference differs/);
});
test('Firebase project numbers cannot diverge from Google registration', () => {
  assert.throws(() => verifyAndroidGoogle({ ...input, registration: { ...registration([web]), project_info: { project_id: input.projectId, project_number: '99999' } } }), /different Firebase project number/);
});
test('iOS OAuth project and native callback remain consistent before building', () => {
  const iosClientId = '12345-iosclient.apps.googleusercontent.com';
  assert.throws(() => verifyAndroidGoogle({ ...input, iosClientId: '99999-iosclient.apps.googleusercontent.com' }), /iOS Google OAuth client must belong/);
  assert.throws(() => verifyAndroidGoogle({ ...input, iosClientId, iosUrlScheme: 'com.googleusercontent.apps.12345-oldclient' }), /native callback URL scheme differ/);
  assert.equal(verifyAndroidGoogle({ ...input, iosClientId, iosUrlScheme: 'com.googleusercontent.apps.12345-iosclient' }).registered, undefined);
});
