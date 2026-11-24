import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SceneActivityContext, SceneVisibilityContext } from '../components/common/SceneActivityContext';
import { ScreenEdgeBlur } from '../components/common/ScreenEdgeBlur';
import { useMainTabs, type MainTab } from './MainTabsContext';

export function MainTabScreen({ tab }: { tab: MainTab }) {
  const tabs = useMainTabs();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return (
    <SceneVisibilityContext.Provider value={focused && !tabs.settingsVisible}>
      <SceneActivityContext.Provider value={focused && tabs.effectsActive}>
        <View style={{ flex: 1 }}>
          {tabs.render[tab]()}
          <ScreenEdgeBlur active={focused && tabs.effectsActive} />
        </View>
      </SceneActivityContext.Provider>
    </SceneVisibilityContext.Provider>
  );
}
