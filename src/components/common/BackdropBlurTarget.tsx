import React, { createContext, useContext, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';

const Context = createContext<React.RefObject<React.ComponentRef<typeof View> | null> | undefined>(undefined);
export const useBackdropBlurTarget = () => useContext(Context);

export function BackdropBlurTargetProvider({ children }: { children: React.ReactNode }) {
  const target = useRef<React.ComponentRef<typeof View>>(null);
  return <Context.Provider value={target}>
    <BlurTargetView ref={target} collapsable={false} style={styles.fill}>{children}</BlurTargetView>
  </Context.Provider>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
