import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GradualBlur } from '../effects/GradualBlur';

// Keep scene blur inside the navigator's content layer, below its floating
// dock. It samples the scroll content without blurring the controls above it.
export function ScreenEdgeBlur({ active = true }: { active?: boolean }) {
  const insets = useSafeAreaInsets();
  const { isLiquidGlassEnabled } = useLiquidGlass();
  if (Platform.OS !== 'ios' || !isLiquidGlassEnabled) return null;
  return <>
    <GradualBlur active={active} position="top" height={Math.max(32, insets.top + 12)}
      tint="transparent" strength={0.6} layers={6} curve="bezier" zIndex={45} />
    <GradualBlur active={active} position="bottom" height={Math.max(48, insets.bottom + 32)}
      tint="transparent" strength={0.6} layers={6} curve="bezier" zIndex={45} />
  </>;
}
