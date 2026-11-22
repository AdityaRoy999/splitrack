import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

// Keep actions outside the scroller so the keyboard viewport lifts them together.
export function SheetFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

const styles = StyleSheet.create({ footer: { flexShrink: 0, width: '100%', gap: 10, paddingTop: 10 } });
