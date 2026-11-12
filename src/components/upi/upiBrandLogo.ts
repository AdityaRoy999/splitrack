import { BankBrand, UpiAccount, UpiProvider } from '../../types';

export interface UpiBrandMeta {
  id: UpiProvider;
  label: string;
  primary: string;
  secondary: string;
  badgeFill: string;
  qrGradientStart: string;
  qrGradientEnd: string;
  eyeOuterColor: string;
  eyeInnerColor: string;
}

const PROVIDER_META: Record<UpiProvider, UpiBrandMeta> = {
  gpay: {
    id: 'gpay',
    label: 'Google Pay',
    primary: '#1A73E8',
    secondary: '#34A853',
    badgeFill: '#FFFFFF',
    qrGradientStart: '#0F172A',
    qrGradientEnd: '#1A73E8',
    eyeOuterColor: '#1A73E8',
    eyeInnerColor: '#0F172A',
  },
  phonepe: {
    id: 'phonepe',
    label: 'PhonePe',
    primary: '#5F259F',
    secondary: '#7C3AED',
    badgeFill: '#5F259F',
    qrGradientStart: '#181029',
    qrGradientEnd: '#5F259F',
    eyeOuterColor: '#5F259F',
    eyeInnerColor: '#181029',
  },
  paytm: {
    id: 'paytm',
    label: 'Paytm',
    primary: '#002970',
    secondary: '#00BAF2',
    badgeFill: '#FFFFFF',
    qrGradientStart: '#002970',
    qrGradientEnd: '#0082C8',
    eyeOuterColor: '#002970',
    eyeInnerColor: '#00A3E0',
  },
  slice: {
    id: 'slice',
    label: 'Slice UPI',
    primary: '#18181B',
    secondary: '#6D28D9',
    badgeFill: '#12141A',
    qrGradientStart: '#09090B',
    qrGradientEnd: '#5227FF',
    eyeOuterColor: '#5227FF',
    eyeInnerColor: '#09090B',
  },
  cred: {
    id: 'cred',
    label: 'CRED UPI',
    primary: '#18181B',
    secondary: '#F97316',
    badgeFill: '#111114',
    qrGradientStart: '#09090B',
    qrGradientEnd: '#27272A',
    eyeOuterColor: '#18181B',
    eyeInnerColor: '#EA580C',
  },
  bank: {
    id: 'bank',
    label: 'Bank UPI',
    primary: '#059669',
    secondary: '#0D9488',
    badgeFill: '#059669',
    qrGradientStart: '#064E3B',
    qrGradientEnd: '#09090B',
    eyeOuterColor: '#059669',
    eyeInnerColor: '#09090B',
  },
};

export const getUpiBrandMeta = (provider: UpiProvider, _bankBrand?: BankBrand): UpiBrandMeta => {
  return PROVIDER_META[provider] || PROVIDER_META.bank;
};

export const buildUpiPaymentUri = (account: UpiAccount): string => {
  const pa = encodeURIComponent(account.upiId.trim());
  const pn = encodeURIComponent(account.title.trim() || 'SplitTrack');
  return `upi://pay?pa=${pa}&pn=${pn}&cu=INR`;
};

const getInnerBrandSvgMarkup = (provider: UpiProvider): string => {
  switch (provider) {
    case 'gpay':
      return [
        '<rect x="2" y="2" width="60" height="60" rx="16" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>',
        '<path d="M47.3 32.5c0-1.1-.1-2.2-.3-3.2H32v6.1h8.6c-.4 2-1.5 3.6-3.2 4.7v3.9h5.1c3-2.8 4.8-6.9 4.8-11.5z" fill="#4285F4"/>',
        '<path d="M32 48c4.3 0 7.9-1.4 10.5-3.9l-5.1-3.9c-1.4 1-3.2 1.5-5.4 1.5-4.1 0-7.7-2.8-8.9-6.6h-5.3v4.1C20.4 44.5 25.8 48 32 48z" fill="#34A853"/>',
        '<path d="M23.1 35.1c-.3-1-.5-2-.5-3.1s.2-2.1.5-3.1v-4.1h-5.3C16.7 27 16 29.4 16 32s.7 5 1.8 7.2l5.3-4.1z" fill="#FBBC05"/>',
        '<path d="M32 22.3c2.3 0 4.4.8 6.1 2.4l4.5-4.5C39.9 17.6 36.3 16 32 16c-6.2 0-11.6 3.5-14.2 8.8l5.3 4.1c1.2-3.8 4.8-6.6 8.9-6.6z" fill="#EA4335"/>',
      ].join('');
    case 'phonepe':
      return [
        '<rect x="2" y="2" width="60" height="60" rx="16" fill="#5F259F"/>',
        '<path d="M21 21h22v4H37v19h-4.4V25H29v10.2c0 2.5 1.1 3.8 3.2 3.8.8 0 1.4-.1 1.9-.3v3.8c-.8.3-1.8.5-2.9.5-4.3 0-6.6-2.5-6.6-7.2V25H21v-4z" fill="#FFFFFF"/>',
        '<path d="M26 16.5c2.2-1.8 4.8-1.5 6.8.5l2.5 2.5H31l-5-3z" fill="#FFFFFF"/>',
      ].join('');
    case 'paytm':
      return [
        '<rect x="2" y="2" width="60" height="60" rx="16" fill="#FFFFFF" stroke="#E0F2FE" stroke-width="2"/>',
        '<path d="M19 44V20h10.5c5.8 0 9.6 3.4 9.6 8.4s-3.8 8.4-9.6 8.4H24.6V44H19zm5.6-11.8h4.5c2.6 0 4.3-1.5 4.3-3.8s-1.7-3.8-4.3-3.8h-4.5v7.6z" fill="#002970"/>',
        '<rect x="33" y="34" width="13" height="10" rx="5" fill="#00BAF2"/>',
        '<path d="M37 39l2.2 2 3.8-3.8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      ].join('');
    case 'slice':
      return [
        '<rect x="2" y="2" width="60" height="60" rx="16" fill="#12141A"/>',
        '<path d="M40.5 22.5c-2.5-2-5.8-2.8-9.2-2.4-5.1.6-8.8 3.9-8.8 8 0 4.4 3.6 6.2 8.9 7.2 3.5.7 5.2 1.6 5.2 3.5 0 2.1-2.2 3.5-5.5 3.5-3.1 0-5.8-1.1-7.8-2.9l-2.8 4c2.6 2.3 6.3 3.6 10.6 3.6 6.4 0 10.7-3.4 10.7-8.4 0-4.6-3.3-6.6-9.1-7.7-3.4-.6-5-1.4-5-3.1 0-1.7 1.7-2.9 4.4-2.9 2.6 0 4.8.8 6.4 2.1l2-4.5z" fill="#FFFFFF"/>',
        '<circle cx="45.5" cy="18.5" r="4.5" fill="#7CFF67"/>',
      ].join('');
    case 'cred':
      return [
        '<rect x="2" y="2" width="60" height="60" rx="16" fill="#111114"/>',
        '<path d="M32 14l14 6v11c0 9.1-5.9 16.5-14 19-8.1-2.5-14-9.9-14-19V20l14-6z" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"/>',
        '<path d="M37 27.5c-1.2-1.4-2.9-2.2-4.8-2.2-3.7 0-6.4 2.8-6.4 6.7s2.7 6.7 6.4 6.7c2 0 3.7-.8 4.8-2.2" fill="none" stroke="#F97316" stroke-width="3.2" stroke-linecap="round"/>',
      ].join('');
    case 'bank':
    default:
      return [
        '<rect x="2" y="2" width="60" height="60" rx="16" fill="#059669"/>',
        '<path d="M18 26l14-8 14 8H18z" fill="#FFFFFF"/>',
        '<rect x="21" y="29" width="4" height="11" rx="1.5" fill="#FFFFFF"/>',
        '<rect x="30" y="29" width="4" height="11" rx="1.5" fill="#FFFFFF"/>',
        '<rect x="39" y="29" width="4" height="11" rx="1.5" fill="#FFFFFF"/>',
        '<rect x="17" y="42" width="30" height="4" rx="2" fill="#FFFFFF"/>',
      ].join('');
  }
};

export const getUpiCenterLogoDataUri = (provider: UpiProvider): string => {
  const inner = getInnerBrandSvgMarkup(provider);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="18" fill="#FFFFFF"/>${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
