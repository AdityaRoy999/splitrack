import { Button, HStack, Host, RNHostView, Text } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled as disable, frame, tint } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { ACTION_COLORS } from '../../theme/actionColors';
import type { AppleGlassButtonProps } from './AppleGlassButton';

export function AppleGlassButton({ label, icon, onPress, disabled, active, role, variant, size, shape, style }: AppleGlassButtonProps) {
  const { themeMode } = useLiquidGlass();
  const semantic = variant === 'danger' || variant === 'success';
  const fillsWidth = style?.flex === 1 || style?.width === '100%' || (size === 'lg' && !style?.width && !style?.flex);
  const nativeStyle = semantic || active || variant === 'accent' ? 'glassProminent' : 'glass';
  return <Host matchContents={fillsWidth ? { vertical: true } : true} colorScheme={themeMode}
    style={[fillsWidth && !style?.flex ? { width: '100%' } : undefined, style, { backgroundColor: 'transparent' }]}>
    <Button label={icon ? undefined : label} onPress={onPress} role={role ?? (variant === 'danger' ? 'destructive' : 'default')}
      modifiers={[buttonStyle(nativeStyle), buttonBorderShape(shape === 'pill' ? 'capsule' : 'roundedRectangle'),
        ...(fillsWidth ? [frame({ maxWidth: Infinity })] : []),
        controlSize(size === 'lg' ? 'large' : 'regular'), ...(disabled ? [disable(true)] : []),
        ...(semantic ? [tint(ACTION_COLORS[variant])] : [])]}>
      {icon ? <HStack spacing={6}>
        <RNHostView matchContents><View pointerEvents="none" style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>{icon}</View></RNHostView>
        {label ? <Text>{label}</Text> : null}
      </HStack> : undefined}
    </Button>
  </Host>;
}
