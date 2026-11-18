import type { UpiAccount } from '../types';

export interface UpiPaymentDetails {
  /** Amount in INR, before any display-currency conversion. */
  amount?: number;
  note?: string;
}

export const isValidUpiId = (value: string): boolean =>
  /^[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9.-]*$/i.test(value.trim());

export const formatUpiAmount = (amount: number): string => {
  const paise = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(paise) || paise < 1) {
    throw new RangeError('A UPI payment needs a positive amount in rupees.');
  }
  return (paise / 100).toFixed(2);
};

export const getReceivingUpiAccount = (
  accounts: UpiAccount[],
  selectedAccountId: string,
): UpiAccount | null => {
  const canReceive = (account: UpiAccount) =>
    (!account.kind || account.kind === 'upi') && isValidUpiId(account.upiId);

  return accounts.find((account) => account.id === selectedAccountId && canReceive(account))
    ?? accounts.find((account) => account.isReceivingDefault && canReceive(account))
    ?? accounts.find((account) => account.isDefault && canReceive(account))
    ?? accounts.find(canReceive)
    ?? null;
};

/** Interoperable UPI payment link; the receiving app authorizes the payment. */
export const buildUpiPaymentUri = (
  account: UpiAccount,
  { amount, note }: UpiPaymentDetails = {},
): string => {
  if (!isValidUpiId(account.upiId)) {
    throw new Error('Enter the full UPI ID from your payment app.');
  }
  const params = [
    `pa=${encodeURIComponent(account.upiId.trim())}`,
    `pn=${encodeURIComponent(account.title.trim() || 'SplitTrack')}`,
    'cu=INR',
  ];
  if (amount !== undefined) params.push(`am=${formatUpiAmount(amount)}`);
  if (note?.trim()) params.push(`tn=${encodeURIComponent(Array.from(note.trim()).slice(0, 80).join(''))}`);
  return `upi://pay?${params.join('&')}`;
};
