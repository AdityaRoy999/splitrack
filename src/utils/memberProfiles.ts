import type { Friend } from '../types';

export type MemberProfile = Omit<Friend, 'id' | 'netBalance'>;
export type MemberDraft = Pick<Friend, 'name'> & Partial<Omit<MemberProfile, 'name'>>;
export type DirectoryMember = MemberProfile & { friendId?: string };

export const normalizeUsername = (handle: string) => handle.trim().replace(/^@+/, '').toLowerCase();
const normalizeName = (name: string) => name.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export function buildMemberDirectory(friends: Friend[], profiles: MemberProfile[]): DirectoryMember[] {
  const byUsername = new Map<string, DirectoryMember>();
  for (const profile of [...friends, ...profiles]) {
    const username = normalizeUsername(profile.handle);
    if (!username || byUsername.has(username)) continue;
    byUsername.set(username, {
      name: profile.name,
      handle: `@${username}`,
      avatar: profile.avatar,
      upiId: profile.upiId,
      phone: profile.phone,
      friendId: 'id' in profile && typeof profile.id === 'string' ? profile.id : undefined,
    });
  }
  return [...byUsername.values()];
}

export function searchMembers(directory: DirectoryMember[], query: string): DirectoryMember[] {
  const cleanQuery = query.trim();
  if (!cleanQuery) return directory;
  const usernameQuery = normalizeUsername(cleanQuery);
  const usernameOnly = cleanQuery.startsWith('@');
  if (usernameOnly) {
    const exact = directory.find((profile) => normalizeUsername(profile.handle) === usernameQuery);
    if (exact) return [exact];
    return directory.filter((profile) => normalizeUsername(profile.handle).includes(usernameQuery));
  }
  const nameQuery = normalizeName(cleanQuery);
  return directory.filter((profile) =>
    normalizeName(profile.name).includes(nameQuery) || normalizeUsername(profile.handle).includes(usernameQuery)
  );
}

export function availableUsername(name: string, friends: Pick<Friend, 'handle'>[]): string {
  const base = normalizeName(name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'member';
  const taken = new Set(friends.map((friend) => normalizeUsername(friend.handle)));
  let username = base;
  for (let suffix = 2; taken.has(username); suffix += 1) username = `${base}_${suffix}`;
  return `@${username}`;
}

// Reuse an existing identity by username, never by a potentially shared name.
export function resolveMember(friends: Friend[], draft: MemberDraft, id: string): Friend | null {
  const name = draft.name.trim();
  if (!name) return null;
  const username = normalizeUsername(draft.handle ?? '');
  const existing = username ? friends.find((friend) => normalizeUsername(friend.handle) === username) : undefined;
  if (existing) return existing;
  return {
    id, name,
    handle: username ? `@${username}` : availableUsername(name, friends),
    avatar: draft.avatar ?? '',
    upiId: draft.upiId?.trim() || undefined,
    phone: draft.phone?.trim() || undefined,
    netBalance: 0,
  };
}
