import { DarkTheme, DefaultTheme, Tabs, ThemeProvider, useSegments } from 'expo-router';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useMainTabs } from '../../navigation/MainTabsContext';
import { GlassDock } from '../../components/glass/GlassDock';

export default function TabLayout() {
  const { themeMode, palette } = useLiquidGlass();
  const systemTheme = themeMode === 'dark' ? DarkTheme : DefaultTheme;
  return <ThemeProvider value={{ ...systemTheme, colors: { ...systemTheme.colors, background: palette.background } }}>
    <AppTabs />
  </ThemeProvider>;
}

function AppTabs() {
  const tabs = useMainTabs();
  const segments = useSegments();
  const current = segments[segments.length - 1];
  const currentTab = current === 'expenses' || current === 'trips' || current === 'analytics' ? current : 'home';
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    tabBar={() => tabs.hidden ? null : <GlassDock currentTab={currentTab} onTabChange={tabs.navigate} onQuickAdd={tabs.openSplit} />}>
    <Tabs.Screen name="index" /><Tabs.Screen name="expenses" /><Tabs.Screen name="trips" /><Tabs.Screen name="analytics" />
    <Tabs.Screen name="split" options={{ href: null }} />
  </Tabs>;
}
