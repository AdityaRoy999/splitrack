import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { CurrencyCode, ThemeMode, SelectionStyle, NotificationDirection } from '../types';
import { themePalettes, type ThemePalette } from './colors';
import { useAuth } from '../auth/AuthContext';
import { useSplitTrack, type CloudSettings } from '../store/SplitTrackStore';
import { errorMessage } from '../services/api';
import { BottomBubble, type BubbleNotice } from '../components/common/BottomBubble';
import { ActivityIndicator, Text, View } from 'react-native';

interface LiquidGlassContextType {
  isLiquidGlassEnabled: boolean; setIsLiquidGlassEnabled(enabled: boolean): void;
  themeMode: ThemeMode; setThemeMode(mode: ThemeMode): void; toggleTheme(): void;
  currency: CurrencyCode; setCurrency(currency: CurrencyCode): void;
  hideAmounts: boolean; setHideAmounts(hide: boolean): void; toggleHideAmounts(): void;
  selectionStyle: SelectionStyle; setSelectionStyle(style: SelectionStyle): void;
  notificationDirection: NotificationDirection; setNotificationDirection(direction: NotificationDirection): void;
  formatAmount(amount: number, showSign?: boolean): string; palette: ThemePalette;
}
const Context = createContext<LiquidGlassContextType | undefined>(undefined);

export function LiquidGlassProvider({ children, onPreferencesReady }: { children: React.ReactNode; onPreferencesReady?: (ready: boolean) => void }) {
  const { profile } = useAuth(), { settings, saveSettings, preferencesReady, syncError, refresh } = useSplitTrack();
  const [overrides, setOverrides] = useState<Partial<CloudSettings>>({});
  const themeMode = overrides.themeMode ?? settings.themeMode;
  const hideAmounts = overrides.hideAmounts ?? settings.hideAmounts;
  const isLiquidGlassEnabled = overrides.isLiquidGlassEnabled ?? settings.isLiquidGlassEnabled;
  const selectionStyle = overrides.selectionStyle ?? settings.selectionStyle ?? 'chips';
  const notificationDirection = overrides.notificationDirection ?? settings.notificationDirection ?? 'bottom';
  // Let a failed first sync reveal the retry screen instead of trapping the
  // startup animation; application content still waits for saved preferences.
  useLayoutEffect(() => { onPreferencesReady?.(preferencesReady || Boolean(syncError)); }, [onPreferencesReady, preferencesReady, syncError]);
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);
  const persist = useCallback((next: Partial<CloudSettings>) => {
    setOverrides(current => ({ ...current, ...next }));
    if (!profile?.username) return;
    const clearSaved = () => setOverrides(current => Object.fromEntries(Object.entries(current).filter(([key, value]) => !(key in next) || next[key as keyof CloudSettings] !== value)));
    void saveSettings(next).then(clearSaved).catch(error => { clearSaved(); setNotice(previous => ({ id: (previous?.id ?? 0) + 1, message: errorMessage(error) })); });
  }, [profile?.username, saveSettings]);
  const setThemeMode = useCallback((mode: ThemeMode) => persist({ themeMode: mode }), [persist]);
  const setHideAmounts = useCallback((hide: boolean) => persist({ hideAmounts: hide }), [persist]);
  const setIsLiquidGlassEnabled = useCallback((enabled: boolean) => persist({ isLiquidGlassEnabled: enabled }), [persist]);
  const setSelectionStyle = useCallback((style: SelectionStyle) => persist({ selectionStyle: style }), [persist]);
  const setNotificationDirection = useCallback((direction: NotificationDirection) => persist({ notificationDirection: direction }), [persist]);
  const setCurrency = useCallback((currency: CurrencyCode) => { if (currency !== 'INR') setNotice(previous => ({ id: (previous?.id ?? 0) + 1, message: 'Balances and UPI payments are recorded in INR.' })); }, []);
  const toggleTheme = useCallback(() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark'), [themeMode, setThemeMode]);
  const toggleHideAmounts = useCallback(() => setHideAmounts(!hideAmounts), [hideAmounts, setHideAmounts]);
  const formatAmount = useCallback((value: number, showSign = false) => {
    if (hideAmounts) return '••••••';
    const sign = showSign ? value > 0 ? '+' : value < 0 ? '-' : '' : '';
    return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [hideAmounts]);
  const value = useMemo(() => ({ themeMode, setThemeMode, toggleTheme, hideAmounts, setHideAmounts, toggleHideAmounts, isLiquidGlassEnabled, setIsLiquidGlassEnabled, selectionStyle, setSelectionStyle, notificationDirection, setNotificationDirection, currency: 'INR' as const, setCurrency, formatAmount, palette: themePalettes[themeMode] }), [themeMode, setThemeMode, toggleTheme, hideAmounts, setHideAmounts, toggleHideAmounts, isLiquidGlassEnabled, setIsLiquidGlassEnabled, selectionStyle, setSelectionStyle, notificationDirection, setNotificationDirection, setCurrency, formatAmount]);
  return <Context.Provider value={value}>
    {profile?.username && !preferencesReady ? <View style={{ flex: 1, backgroundColor: themePalettes[themeMode].background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <ActivityIndicator color={themeMode === 'dark' ? '#FFFFFF' : '#18181B'} />
      {syncError ? <Text accessibilityRole="button" onPress={() => { void refresh().catch(() => {}); }} style={{ color: themeMode === 'dark' ? '#F4F4F5' : '#18181B', textAlign: 'center' }}>{syncError} Tap to retry.</Text> : null}
    </View> : children}
    <BottomBubble notice={notice} onDismiss={dismiss} />
  </Context.Provider>;
}
export function useLiquidGlass() { const value = useContext(Context); if (!value) throw new Error('LiquidGlassProvider is missing.'); return value; }
