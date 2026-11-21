import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';

export function SheetHeader({ title, subtitle, onClose, disabled }: { title: string; subtitle?: string; onClose(): void; disabled?: boolean }) {
  const { themeMode } = useLiquidGlass();
  const dark = themeMode === 'dark';
  return <View>
    <View style={styles.handleWrap}><View style={[styles.handle, { backgroundColor: dark ? '#52525B' : '#A1A1AA' }]} /></View>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={[styles.title, { color: dark ? '#F4F4F5' : '#18181B' }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: dark ? '#8E8E93' : '#71717A' }]}>{subtitle}</Text> : null}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} disabled={disabled} onPress={onClose} hitSlop={6} style={[styles.close, { backgroundColor: dark ? '#1C1C22' : '#E5E5EA' }]}>
        <CloseCircleIcon size={20} color={dark ? '#F4F4F5' : '#18181B'} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  handleWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 16 },
  handle: { width: 38, height: 4, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  copy: { flex: 1 }, title: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
});
