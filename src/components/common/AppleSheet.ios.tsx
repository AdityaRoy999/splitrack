import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { ignoreSafeArea, preferredColorScheme, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

export function AppleSheet({ visible, height, children, onRequestClose, onDismiss }: {
  visible: boolean; height?: number; children: ReactNode; onRequestClose(): void; onDismiss(): void;
}) {
  const { themeMode } = useLiquidGlass();
  const { width } = useWindowDimensions();
  return <Host style={{ position: 'absolute', width }} pointerEvents="none" colorScheme={themeMode}>
    <BottomSheet isPresented={visible} onIsPresentedChange={open => { if (!open) onRequestClose(); }} onDismiss={onDismiss}>
      <Group modifiers={[presentationDetents(height ? [{ height }] : ['large']), presentationDragIndicator('visible'), preferredColorScheme(themeMode), ignoreSafeArea({ regions: 'keyboard' })]}>
        <RNHostView><View style={{ flexGrow: 1, height: 0, paddingTop: 16, backgroundColor: 'transparent' }}>{children}</View></RNHostView>
      </Group>
    </BottomSheet>
  </Host>;
}
