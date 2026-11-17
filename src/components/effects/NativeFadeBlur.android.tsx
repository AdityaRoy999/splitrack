import React, { useMemo } from 'react';
import { Platform, processColor, StyleSheet, View } from 'react-native';
import { MaskedView } from '@expo/ui/community/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import type { GradualBlurLayer } from './blurFalloff';
import type { NativeFadeBlurProps } from './fadeBlurTypes';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

function BlurLayer({ layer, axis, opacity, reveal, dark, blurTarget }: Pick<NativeFadeBlurProps, 'axis' | 'opacity' | 'reveal' | 'dark' | 'blurTarget'> & { layer: GradualBlurLayer }) {
  // Android targets the original content explicitly, so each surface needs its
  // cumulative radius rather than the incremental radius of a backdrop stack.
  const animatedProps = useAnimatedProps(() => ({
    intensity: Math.min(100, layer.level / 24 * 100 * reveal.value),
  }));
  return (
    <MaskedView
      pointerEvents="none" style={StyleSheet.absoluteFill}
      maskElement={<LinearGradient colors={['transparent', 'rgba(0,0,0,' + opacity + ')']} locations={[layer.from, layer.to]} start={axis.start} end={axis.end} style={StyleSheet.absoluteFill} />}
    >
      <AnimatedBlurView
        pointerEvents="none" tint={dark ? 'systemChromeMaterialDark' : 'extraLight'} blurTarget={blurTarget}
        blurMethod={blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
        animatedProps={animatedProps} style={StyleSheet.absoluteFill}
      />
    </MaskedView>
  );
}

export const NativeFadeBlur = ({ stack, falloff, locations, axis, opacity, reveal, dark, tint, blurTarget }: NativeFadeBlurProps) => {
  const washStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));
  const colors = useMemo(() => {
    const color = processColor(tint);
    const value = typeof color === 'number' ? color >>> 0 : 0;
    return falloff.map(alpha => 'rgba(' + [value >>> 16 & 255, value >>> 8 & 255, value & 255, alpha * (value >>> 24) / 255].join(',') + ')') as [string, string, ...string[]];
  }, [falloff, tint]);

  // The SDK's older-Android fallback paints a colour instead of blurring.
  // Avoid that replacement layer when the efficient native blur is unavailable.
  if (Number(Platform.Version) < 31 || !blurTarget) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stack.map((layer, index) => <BlurLayer key={index} layer={layer} axis={axis} opacity={opacity} reveal={reveal} dark={dark} blurTarget={blurTarget} />)}
      {tint !== 'transparent' ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, washStyle]}><LinearGradient colors={colors} locations={locations} start={axis.start} end={axis.end} style={StyleSheet.absoluteFill} /></Animated.View> : null}
    </View>
  );
};
