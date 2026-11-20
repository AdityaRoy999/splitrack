import type { UserProfile } from './AuthContext';

export const profileCacheKey = (uid: string) => `@splittrack_profile_v1_${uid}`;

/** Only a completed profile for the authenticated Firebase UID unlocks offline records. */
export function readCachedProfile(raw: string | null, uid: string): UserProfile | null {
  if (!raw) return null;
  try {
    const next = JSON.parse(raw) as UserProfile;
    return next.id === uid && typeof next.username === 'string' && /^[a-z0-9_.]{3,24}$/.test(next.username)
      && ['name', 'displayName', 'handle', 'email', 'avatar', 'avatarRef'].every(key => typeof next[key as keyof UserProfile] === 'string') ? next : null;
  } catch { return null; }
}
