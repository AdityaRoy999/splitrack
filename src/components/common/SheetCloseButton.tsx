import { Pressable, StyleSheet } from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useNativeSheetPresentation } from './NativeSheetPresentation';
import { AppleGlassButton } from './AppleGlassButton';

export function SheetCloseButton({ onClose, disabled }: { onClose(): void; disabled?: boolean }) {
  const native = useNativeSheetPresentation();
  const { themeMode } = useLiquidGlass();
  const dark = themeMode === 'dark';
  return native ? <AppleGlassButton role="close" onPress={onClose} disabled={disabled} variant="glass" size="md" shape="pill" />
    : <Pressable onPress={onClose} disabled={disabled} accessibilityRole="button" accessibilityLabel="Close sheet" hitSlop={6}
        style={[styles.close, { backgroundColor: dark ? '#1C1C22' : '#E5E5EA' }]}>
        <CloseCircleIcon size={20} color={dark ? '#F4F4F5' : '#18181B'} />
      </Pressable>;
}

const styles = StyleSheet.create({ close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' } });
