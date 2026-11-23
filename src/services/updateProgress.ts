export type UpdateStage = 'downloading' | 'verifying' | 'preparing_install' | 'awaiting_confirmation' | 'installing' | 'complete' | 'failed';
export type UpdateProgress = { stage: UpdateStage; percent: number; sha256: string; message?: string };
export function parseUpdateProgress(value: unknown, expectedSha: string): UpdateProgress | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as UpdateProgress;
  if (item.sha256 !== expectedSha || !['downloading', 'verifying', 'preparing_install', 'awaiting_confirmation', 'installing', 'complete', 'failed'].includes(item.stage) || !Number.isFinite(item.percent) || item.percent < 0 || item.percent > 100) return null;
  return { stage: item.stage, percent: Math.floor(item.percent), sha256: item.sha256, ...(typeof item.message === 'string' ? { message: item.message } : {}) };
}
export function progressLabel(value: UpdateProgress | null) {
  if (!value) return 'Download & install';
  const labels: Record<UpdateStage, string> = { downloading: 'Downloading', verifying: 'Verifying', preparing_install: 'Preparing install', awaiting_confirmation: 'Confirm installation in Android', installing: 'Installing', complete: 'Installed', failed: 'Retry download & install' };
  return ['awaiting_confirmation', 'complete', 'failed'].includes(value.stage) ? labels[value.stage] : `${labels[value.stage]} ${value.percent}%`;
}
