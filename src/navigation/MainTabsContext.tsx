import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type MainTab = 'home' | 'expenses' | 'trips' | 'analytics';
export const MainTabsContext = createContext<{
  render: Record<MainTab, () => ReactNode>;
  effectsActive: boolean;
  hidden: boolean;
  settingsVisible: boolean;
  openSplit(): void;
  navigate(tab: MainTab | 'split'): void;
} | null>(null);
export function useMainTabs() {
  const value = useContext(MainTabsContext);
  if (!value) throw new Error('Main tabs provider is missing.');
  return value;
}
