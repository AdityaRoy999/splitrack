import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';

// Keyboard Controller drives layout on the UI thread from native keyboard
// progress, including interactive dismissal. One viewport owns the adjustment.
export function SheetKeyboardViewport({ children, pointerEvents }: { children: ReactNode; pointerEvents?: 'auto' | 'none' }) {
  if (Platform.OS !== 'ios') return <View pointerEvents={pointerEvents} style={{ flex: 1 }}>{children}</View>;
  return <KeyboardProvider preload={false}>
    <KeyboardAvoidingView behavior="padding" automaticOffset pointerEvents={pointerEvents} style={{ flex: 1 }}>
      {children}
    </KeyboardAvoidingView>
  </KeyboardProvider>;
}
