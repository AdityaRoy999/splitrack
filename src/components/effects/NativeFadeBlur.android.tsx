import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaskedView } from '@expo/ui/community/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeFadeBlurProps } from './fadeBlurTypes';

export const NativeFadeBlur = ({ colors, locations, axis, intensity, dark, tint, blurTarget }: NativeFadeBlurProps) => (
  <MaskedView
    pointerEvents="none"
    style={StyleSheet.absoluteFill}
    maskElement={
      <LinearGradient colors={colors} locations={locations} start={axis.start} end={axis.end} style={StyleSheet.absoluteFill} />
    }
  >
    <BlurView
      pointerEvents="none"
      intensity={intensity}
      tint={dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
      blurTarget={blurTarget}
      blurMethod={blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
      style={StyleSheet.absoluteFill}
    />
    {tint !== 'transparent' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
  </MaskedView>
);
