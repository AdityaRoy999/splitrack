import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/auth/profileCache.ts', import.meta.url), 'utf8');
const { profileCacheKey, readCachedProfile } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`);
const profile = { id: 'alice', username: 'alice.name', name: 'Alice', displayName: 'Alice', handle: '@alice.name', email: 'alice@example.invalid', avatar: '', avatarRef: '' };
for (const platform of ['android', 'ios']) {
  test(`${platform} offline startup accepts completed profiles and isolates the authenticated user`, () => {
    const disk = new Map([[profileCacheKey('alice'), JSON.stringify(profile)]]);
    assert.deepEqual(readCachedProfile(disk.get(profileCacheKey('alice')), 'alice'), profile);
    assert.equal(readCachedProfile(disk.get(profileCacheKey('alice')), 'bob'), null);
    assert.equal(readCachedProfile(disk.get(profileCacheKey('bob')) ?? null, 'bob'), null);
  });
}
test('unfinished onboarding and malformed cached profiles cannot unlock offline records', () => {
  for (const value of [{ ...profile, username: '' }, { ...profile, username: 'bad handle' }, { ...profile, email: null }, { ...profile, avatarRef: null }, null]) {
    assert.equal(readCachedProfile(JSON.stringify(value), 'alice'), null);
  }
  assert.equal(readCachedProfile('{broken json', 'alice'), null);
});
