import type { CloudSettings } from './SplitTrackStore';

export function settingsFeedback(next: Partial<CloudSettings>): string {
  if (next.themeMode) return next.themeMode === 'dark' ? 'Dark theme enabled' : 'Light theme enabled';
  if (next.isLiquidGlassEnabled !== undefined) return next.isLiquidGlassEnabled ? 'Liquid Glass enabled' : 'Matte surfaces enabled';
  if (next.hideAmounts !== undefined) return next.hideAmounts ? 'Balances and amounts hidden' : 'Balances and amounts visible';
  if (next.selectionStyle) return next.selectionStyle === 'dropdown' ? 'Dropdown menus enabled' : 'Slide & Select menus enabled';
  if (next.notificationDirection) return `Notifications will appear from the ${next.notificationDirection}`;
  if (next.selectedAccountId) return 'Default payment profile updated';
  return 'Settings updated';
}

export function mutationFeedback(path: string, method: string, body: unknown, existed: boolean): string | undefined {
  if (path === '/api/settings') return settingsFeedback(body as Partial<CloudSettings>);
  if (path === '/state/erase') return 'Your fresh ledger is ready';
  if (/\/transactions\/.+\/restore$/.test(path)) return 'Transaction restored';
  if (/\/transactions\/.+/.test(path)) return method === 'DELETE' ? 'Transaction deleted. Restore it in Settings within 7 days.' : 'Transaction updated';
  if (/\/trips\/.+\/members\/.+/.test(path)) return method === 'DELETE' ? 'Member removed from the group' : 'Member added to the group';
  const entity = path.match(/^\/entities\/(accounts|friends|trips|categories)\//)?.[1];
  const label = { accounts: 'Payment profile', friends: 'Member', trips: 'Trip or group', categories: 'Category' }[entity ?? ''];
  return label ? `${label} ${method === 'DELETE' ? 'deleted' : existed ? 'updated' : 'added'}` : undefined;
}
