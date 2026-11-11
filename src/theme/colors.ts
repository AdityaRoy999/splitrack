import { ThemeMode } from '../types';

export const currencies = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', exchangeRate: 1 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', exchangeRate: 0.012 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: 0.011 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', exchangeRate: 0.0095 },
} as const;

export interface ThemePalette {
  name: string;
  background: string;
  backgroundElevated: string;
  heroGradient: [string, string, string];
  heroSparkline: string;
  accent: string;
  accentSecondary: string;
  cardBackground: string;
  cardBorder: string;
  cardSolid: string;
  cardSolidBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  sheetBackground: string;
  sheetBorder: string;
  sheetTextPrimary: string;
  sheetTextSecondary: string;
  success: string;
  warning: string;
  danger: string;
}

export const themePalettes: Record<ThemeMode, ThemePalette> = {
  dark: {
    name: 'Dark Mode',
    background: '#000000',
    backgroundElevated: '#111114',
    heroGradient: ['#141418', '#111114', '#0B0B0D'],
    heroSparkline: '#FFFFFF',
    accent: '#FFFFFF',
    accentSecondary: '#8E8E93',
    cardBackground: '#111114',
    cardBorder: 'transparent',
    cardSolid: '#111114',
    cardSolidBorder: 'transparent',
    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E93',
    textMuted: '#52525B',
    sheetBackground: '#111114',
    sheetBorder: 'transparent',
    sheetTextPrimary: '#FFFFFF',
    sheetTextSecondary: '#8E8E93',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  light: {
    name: 'Light Mode',
    background: '#F2F2F7',
    backgroundElevated: '#FFFFFF',
    heroGradient: ['#FFFFFF', '#F8F9FA', '#E5E5EA'],
    heroSparkline: '#18181B',
    accent: '#18181B',
    accentSecondary: '#71717A',
    cardBackground: 'rgba(255, 255, 255, 0.85)',
    cardBorder: 'transparent',
    cardSolid: '#FFFFFF',
    cardSolidBorder: 'transparent',
    textPrimary: '#000000',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    sheetBackground: '#FFFFFF',
    sheetBorder: 'transparent',
    sheetTextPrimary: '#000000',
    sheetTextSecondary: '#6B7280',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
};

export const getGlassStyles = (isLiquidGlass: boolean, theme: ThemeMode) => {
  const isDark = theme === 'dark';
  const palette = themePalettes[theme];

  // Unified opaque React-Bits card styling across the app (no leaky background blur)
  const elevatedSurface = isDark
    ? (isLiquidGlass ? '#141418' : '#111114')
    : '#FFFFFF';

  return {
    card: {
      backgroundColor: elevatedSurface,
      borderColor: 'transparent',
      borderWidth: 0,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    specularHighlight: {
      display: 'none' as const,
      height: 0,
    },
    dock: {
      backgroundColor: isDark ? '#111115' : '#FFFFFF',
      borderColor: 'transparent',
      borderWidth: 0,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    blurTint: isDark ? ('dark' as const) : ('light' as const),
    nestedSurface: isDark ? '#18181D' : palette.background,
  };
};
