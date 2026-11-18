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
