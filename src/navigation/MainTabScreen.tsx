import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SceneActivityContext } from '../components/common/SceneActivityContext';
import { useMainTabs, type MainTab } from './MainTabsContext';

export function MainTabScreen({ tab }: { tab: MainTab }) {
  const tabs = useMainTabs();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <SceneActivityContext.Provider value={focused && tabs.effectsActive}>
    {tabs.render[tab]()}
  </SceneActivityContext.Provider>;
}
