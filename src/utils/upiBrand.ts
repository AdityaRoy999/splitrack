import { UPI_APPS_CATALOG } from '../constants/upiAppsCatalog';
import type { BankBrand, UpiProvider } from '../types';

interface ReceivingBrandInput {
  provider?: UpiProvider;
  bankBrand?: BankBrand;
  upiId: string;
}

interface ReceivingBrand {
  provider: UpiProvider;
  bankBrand?: BankBrand;
}

const appsById = new Map(UPI_APPS_CATALOG.map(app => [app.id, app]));
const appsByHandle = new Map<string, Set<string>>();
for (const app of UPI_APPS_CATALOG) {
  for (const handle of app.supportedHandles) {
    const ids = appsByHandle.get(handle) ?? new Set<string>();
    ids.add(app.id);
    appsByHandle.set(handle, ids);
  }
}

/** Resolve display branding without changing any part of the payment identity. */
export function resolveReceivingUpiBrand({ provider, bankBrand, upiId }: ReceivingBrandInput): ReceivingBrand {
  const normalized = provider?.trim().toLowerCase();
  const appId = normalized === 'googlepay' ? 'gpay' : normalized;
  if (appId && appsById.has(appId)) return { provider: appId };

  // Old friend snapshots contain only the UPI ID. Infer a logo only when the
  // audited suffix belongs to one app; shared bank handles remain bank branded.
  const suffix = upiId.trim().toLowerCase().match(/@[a-z0-9][a-z0-9.-]*$/)?.[0];
  const matchingApps = suffix ? appsByHandle.get(suffix) : undefined;
  if (matchingApps?.size === 1) {
    const inferred = matchingApps.values().next().value;
    if (inferred) return { provider: inferred };
  }
  return { provider: 'bank', ...(bankBrand ? { bankBrand } : {}) };
}
