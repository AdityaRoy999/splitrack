import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
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
  const { isLiquidGlassEnabled } = useLiquidGlass();
  const tabs = useMainTabs();
  const segments = useSegments();
  const current = segments[segments.length - 1];
  const currentTab = current === 'expenses' || current === 'trips' || current === 'analytics' ? current : 'home';
  if (Platform.OS !== 'ios' || !isLiquidGlassEnabled) return <Tabs screenOptions={{ headerShown: false }}
    tabBar={() => tabs.hidden ? null : <GlassDock currentTab={currentTab} onTabChange={tabs.navigate} onQuickAdd={tabs.openSplit} />}>
    <Tabs.Screen name="index" /><Tabs.Screen name="expenses" /><Tabs.Screen name="trips" /><Tabs.Screen name="analytics" />
    <Tabs.Screen name="split" options={{ href: null }} />
  </Tabs>;
  return <NativeTabs hidden={tabs.settingsVisible} activityEnabled>
    <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="expenses" disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" />
      <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="split" disabled listeners={{ tabPress: tabs.openSplit }}>
      <NativeTabs.Trigger.Icon sf="plus.circle.fill" />
      <NativeTabs.Trigger.Label>Split</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="trips" disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon sf="person.3.fill" />
      <NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="analytics" disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon sf="chart.pie.fill" />
      <NativeTabs.Trigger.Label>Analytics</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>;
}
