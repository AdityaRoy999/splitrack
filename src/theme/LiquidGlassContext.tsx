import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CurrencyCode, ThemeMode, SelectionStyle, NotificationDirection, TransactionActionStyle } from '../types';
import { themePalettes, type ThemePalette } from './colors';
import { useAuth } from '../auth/AuthContext';
import { useSplitTrack, type CloudSettings } from '../store/SplitTrackStore';
import { errorMessage } from '../services/api';
import { BottomBubble, BubbleNoticeProvider, type BubbleNotice } from '../components/common/BottomBubble';
import { ActivityIndicator, Text, View } from 'react-native';

interface LiquidGlassContextType {
  isLiquidGlassEnabled: boolean; setIsLiquidGlassEnabled(enabled: boolean): void;
  themeMode: ThemeMode; setThemeMode(mode: ThemeMode): void; toggleTheme(): void;
  currency: CurrencyCode; setCurrency(currency: CurrencyCode): void;
  hideAmounts: boolean; setHideAmounts(hide: boolean): void; toggleHideAmounts(): void;
  selectionStyle: SelectionStyle; setSelectionStyle(style: SelectionStyle): void;
  notificationDirection: NotificationDirection; setNotificationDirection(direction: NotificationDirection): void;
  transactionActionStyle: TransactionActionStyle; setTransactionActionStyle(style: TransactionActionStyle): void;
  formatAmount(amount: number, showSign?: boolean): string; palette: ThemePalette;
}
const Context = createContext<LiquidGlassContextType | undefined>(undefined);
const actionStyles = new Map<string, TransactionActionStyle>();

export function LiquidGlassProvider({ children, onPreferencesReady }: { children: React.ReactNode; onPreferencesReady?: (ready: boolean) => void }) {
  const { user, profile } = useAuth(), { settings, saveSettings, preferencesReady, syncError, refresh, actionNotice, dismissActionNotice } = useSplitTrack();
  const [overrides, setOverrides] = useState<Partial<CloudSettings>>({});
  const preferenceWrites = useRef(0);
  const [pendingPreferences, setPendingPreferences] = useState<Record<string, number>>({});
  const [observedSettings, setObservedSettings] = useState(settings);
  if (observedSettings !== settings) {
    setObservedSettings(settings);
    // A completed older write cannot undo a newer local selection.
    const remaining = Object.entries(overrides).filter(([key, value]) => key in pendingPreferences || settings[key as keyof CloudSettings] !== value);
    if (remaining.length !== Object.keys(overrides).length) setOverrides(Object.fromEntries(remaining));
  }
  const themeMode = overrides.themeMode ?? settings.themeMode;
  const hideAmounts = overrides.hideAmounts ?? settings.hideAmounts;
  const isLiquidGlassEnabled = overrides.isLiquidGlassEnabled ?? settings.isLiquidGlassEnabled;
  const selectionStyle = overrides.selectionStyle ?? settings.selectionStyle ?? 'chips';
  const notificationDirection = overrides.notificationDirection ?? settings.notificationDirection ?? 'bottom';
  const actionStyleKey = `@splittrack_transaction_actions_v1_${user?.uid ?? 'signed-out'}`;
  const [actionStyleState, setActionStyleState] = useState(() => ({ key: actionStyleKey, style: actionStyles.get(actionStyleKey) ?? 'swipe', ready: actionStyles.has(actionStyleKey) }));
  const transactionActionStyle = actionStyleState.key === actionStyleKey ? actionStyleState.style : actionStyles.get(actionStyleKey) ?? 'swipe';
  const actionStyleReady = actionStyleState.key === actionStyleKey ? actionStyleState.ready : actionStyles.has(actionStyleKey);
  const actionStyleChanged = useRef(false);
  useEffect(() => {
    let active = true;
    actionStyleChanged.current = false;
    void AsyncStorage.getItem(actionStyleKey).then(saved => {
      if (active && !actionStyleChanged.current) {
        const style = saved === 'buttons' ? 'buttons' : 'swipe';
        actionStyles.set(actionStyleKey, style);
        setActionStyleState({ key: actionStyleKey, style, ready: true });
      }
    }).catch(() => {
      if (active && !actionStyleChanged.current) setActionStyleState({ key: actionStyleKey, style: actionStyles.get(actionStyleKey) ?? 'swipe', ready: true });
    });
    return () => { active = false; };
  }, [actionStyleKey]);
  // Let a failed first sync reveal the retry screen instead of trapping the
  // startup animation; application content still waits for saved preferences.
  const allPreferencesReady = preferencesReady && actionStyleReady;
  useLayoutEffect(() => { onPreferencesReady?.(allPreferencesReady || Boolean(syncError)); }, [onPreferencesReady, allPreferencesReady, syncError]);
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);
  const persist = useCallback((next: Partial<CloudSettings>) => {
    const write = ++preferenceWrites.current;
    const keys = Object.keys(next);
    setPendingPreferences(current => ({ ...current, ...Object.fromEntries(keys.map(key => [key, write])) }));
    setOverrides(current => ({ ...current, ...next }));
    if (!profile?.username) return;
    void saveSettings(next).then(() => {
      setPendingPreferences(current => Object.fromEntries(Object.entries(current).filter(([key, value]) => !keys.includes(key) || value !== write)));
      // Re-check against the next committed settings, even if publishing was coalesced.
      setObservedSettings(previous => ({ ...previous }));
    }).catch(error => { setNotice(previous => ({ id: (previous?.id ?? 0) + 1, message: errorMessage(error) })); });
  }, [profile?.username, saveSettings]);
  const setThemeMode = useCallback((mode: ThemeMode) => persist({ themeMode: mode }), [persist]);
  const setHideAmounts = useCallback((hide: boolean) => persist({ hideAmounts: hide }), [persist]);
  const setIsLiquidGlassEnabled = useCallback((enabled: boolean) => persist({ isLiquidGlassEnabled: enabled }), [persist]);
  const setSelectionStyle = useCallback((style: SelectionStyle) => persist({ selectionStyle: style }), [persist]);
  const setNotificationDirection = useCallback((direction: NotificationDirection) => persist({ notificationDirection: direction }), [persist]);
  const setTransactionActionStyle = useCallback((style: TransactionActionStyle) => {
    actionStyleChanged.current = true;
    actionStyles.set(actionStyleKey, style);
    setActionStyleState({ key: actionStyleKey, style, ready: true });
    void AsyncStorage.setItem(actionStyleKey, style).catch(() => {});
    setNotice(previous => ({ id: (previous?.id ?? 0) + 1, message: style === 'swipe' ? 'Swipe edit and delete actions enabled' : 'Edit and delete buttons enabled' }));
  }, [actionStyleKey]);
  const setCurrency = useCallback((currency: CurrencyCode) => { if (currency !== 'INR') setNotice(previous => ({ id: (previous?.id ?? 0) + 1, message: 'Balances and UPI payments are recorded in INR.' })); }, []);
  const toggleTheme = useCallback(() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark'), [themeMode, setThemeMode]);
  const toggleHideAmounts = useCallback(() => setHideAmounts(!hideAmounts), [hideAmounts, setHideAmounts]);
  const formatAmount = useCallback((value: number, showSign = false) => {
    if (hideAmounts) return '••••••';
    const sign = showSign ? value > 0 ? '+' : value < 0 ? '-' : '' : '';
    return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [hideAmounts]);
  const value = useMemo(() => ({ themeMode, setThemeMode, toggleTheme, hideAmounts, setHideAmounts, toggleHideAmounts, isLiquidGlassEnabled, setIsLiquidGlassEnabled, selectionStyle, setSelectionStyle, notificationDirection, setNotificationDirection, transactionActionStyle, setTransactionActionStyle, currency: 'INR' as const, setCurrency, formatAmount, palette: themePalettes[themeMode] }), [themeMode, setThemeMode, toggleTheme, hideAmounts, setHideAmounts, toggleHideAmounts, isLiquidGlassEnabled, setIsLiquidGlassEnabled, selectionStyle, setSelectionStyle, notificationDirection, setNotificationDirection, transactionActionStyle, setTransactionActionStyle, setCurrency, formatAmount]);
  return <Context.Provider value={value}>
    <BubbleNoticeProvider themeMode={themeMode} notificationDirection={notificationDirection}>
    {profile?.username && !allPreferencesReady ? <View style={{ flex: 1, backgroundColor: themePalettes[themeMode].background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <ActivityIndicator color={themeMode === 'dark' ? '#FFFFFF' : '#18181B'} />
      {syncError ? <Text accessibilityRole="button" onPress={() => { void refresh().catch(() => {}); }} style={{ color: themeMode === 'dark' ? '#F4F4F5' : '#18181B', textAlign: 'center' }}>{syncError} Tap to retry.</Text> : null}
    </View> : children}
    <BottomBubble notice={notice} onDismiss={dismiss} />
    <BottomBubble notice={actionNotice} onDismiss={dismissActionNotice} />
    </BubbleNoticeProvider>
  </Context.Provider>;
}
export function useLiquidGlass() { const value = useContext(Context); if (!value) throw new Error('LiquidGlassProvider is missing.'); return value; }
