import React from 'react';
import { StyleSheet, View } from 'react-native';

// Android surfaces use static tints and gradients, so no capture target is needed.
export const useBackdropBlurTarget = () => undefined;

export function BackdropBlurTargetProvider({ children }: { children: React.ReactNode }) {
  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
