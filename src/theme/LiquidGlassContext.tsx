import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrencyCode, ThemeMode } from '../types';
import { currencies, themePalettes, ThemePalette } from './colors';

interface LiquidGlassContextType {
  isLiquidGlassEnabled: boolean;
  setIsLiquidGlassEnabled: (enabled: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  currency: CurrencyCode;
  setCurrency: (curr: CurrencyCode) => void;
  hideAmounts: boolean;
  setHideAmounts: (hide: boolean) => void;
  toggleHideAmounts: () => void;
  formatAmount: (amount: number, showSign?: boolean) => string;
  palette: ThemePalette;
}

const STORAGE_KEYS = {
  LIQUID_GLASS: '@splittrack_liquid_glass',
  THEME_MODE: '@splittrack_theme_mode_v2',
  CURRENCY: '@splittrack_currency_v2',
  HIDE_AMOUNTS: '@splittrack_hide_amounts',
};

const LiquidGlassContext = createContext<LiquidGlassContextType | undefined>(undefined);

export const LiquidGlassProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLiquidGlassEnabled, setIsLiquidGlassEnabledState] = useState<boolean>(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR');
  const [hideAmounts, setHideAmountsState] = useState<boolean>(false);

  useEffect(() => {
    // Load persisted settings
    const loadSettings = async () => {
      try {
        const storedLiquid = await AsyncStorage.getItem(STORAGE_KEYS.LIQUID_GLASS);
        if (storedLiquid !== null) {
          setIsLiquidGlassEnabledState(storedLiquid === 'true');
        }

        const storedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
        if (storedTheme === 'dark' || storedTheme === 'light') {
          setThemeModeState(storedTheme);
        }

        const storedCurr = await AsyncStorage.getItem(STORAGE_KEYS.CURRENCY);
        if (storedCurr && storedCurr in currencies) {
          setCurrencyState(storedCurr as CurrencyCode);
        }

        const storedHide = await AsyncStorage.getItem(STORAGE_KEYS.HIDE_AMOUNTS);
        if (storedHide !== null) {
          setHideAmountsState(storedHide === 'true');
        }
      } catch (e) {
        console.warn('Failed to load settings from storage', e);
      }
    };
    loadSettings();
  }, []);

  const setIsLiquidGlassEnabled = (enabled: boolean) => {
    setIsLiquidGlassEnabledState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.LIQUID_GLASS, String(enabled)).catch(console.warn);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode).catch(console.warn);
  };

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  };

  const setCurrency = (curr: CurrencyCode) => {
    setCurrencyState(curr);
    AsyncStorage.setItem(STORAGE_KEYS.CURRENCY, curr).catch(console.warn);
  };

  const setHideAmounts = (hide: boolean) => {
    setHideAmountsState(hide);
    AsyncStorage.setItem(STORAGE_KEYS.HIDE_AMOUNTS, String(hide)).catch(console.warn);
  };

  const toggleHideAmounts = () => {
    setHideAmounts(!hideAmounts);
  };

  const formatAmount = (amount: number, showSign: boolean = false): string => {
    if (hideAmounts) return '••••••';

    const currConfig = currencies[currency] || currencies.INR;
    const converted = amount * (currency === 'INR' ? 1 : currConfig.exchangeRate);
    const absVal = Math.abs(converted);
    const formattedNum = absVal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const sign = showSign ? (amount > 0 ? '+' : amount < 0 ? '-' : '') : '';
    return `${sign}${currConfig.symbol}${formattedNum}`;
  };

  const palette = themePalettes[themeMode] || themePalettes.dark;

  return (
    <LiquidGlassContext.Provider
      value={{
        isLiquidGlassEnabled,
        setIsLiquidGlassEnabled,
        themeMode,
        setThemeMode,
        toggleTheme,
        currency,
        setCurrency,
        hideAmounts,
        setHideAmounts,
        toggleHideAmounts,
        formatAmount,
        palette,
      }}
    >
      {children}
    </LiquidGlassContext.Provider>
  );
};

export const useLiquidGlass = () => {
  const context = useContext(LiquidGlassContext);
  if (!context) {
    throw new Error('useLiquidGlass must be used within a LiquidGlassProvider');
  }
  return context;
};
