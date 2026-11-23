export type PublicRelease = { latest_build: number; min_required_build: number; version_name: string; download_url: string; sha256: string; size?: number; sidestore_source_url?: string; changelog: { problem: string; action_taken: string } };
export function updatePolicy(value: unknown, platform: string, installed: number) {
  const raw = value as Record<string, PublicRelease>;
  const b = raw?.[platform];
  if (!b || !Number.isSafeInteger(installed) || installed < 1 || !Number.isSafeInteger(b.latest_build) || !Number.isSafeInteger(b.min_required_build) || b.min_required_build < 0 || b.min_required_build > b.latest_build) return null;
  if (installed >= b.latest_build || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(b.version_name) || !/^[a-f0-9]{64}$/.test(b.sha256)) return null;
  if (!b.download_url?.startsWith('https://github.com/AdityaRoy999/splittrack-releases/releases/download/') || !b.download_url.endsWith(platform === 'ios' ? '.ipa' : '.apk')) return null;
  if (!b.changelog || typeof b.changelog.problem !== 'string' || typeof b.changelog.action_taken !== 'string') return null;
  return { release: b, forced: installed < b.min_required_build };
}
