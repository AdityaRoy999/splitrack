import React, { type CSSProperties } from 'react';
import { StyleSheet } from 'react-native';
import ReactBitsGradualBlur from '../../vendor/react-bits/GradualBlur';
import type { GradualBlurProps } from './gradualBlurTypes';
import { useSceneActive } from '../common/SceneActivityContext';

export type { GradualBlurProps, GradualBlurPosition } from './gradualBlurTypes';
export type { GradualBlurCurve } from './blurFalloff';

// The upstream TS/Tailwind component is kept verbatim in vendor/react-bits.
// Inline pointerEvents also works when the Expo web app has no Tailwind CSS.
export const GradualBlur = React.memo(function GradualBlur({
  position = 'bottom', height = 48, width, strength = 1.6, layers = 8,
  curve = 'bezier', exponential = true, opacity = 1, saturation = 1,
  tint = 'transparent', zIndex = 20, active = true, style,
}: GradualBlurProps) {
  const sceneActive = useSceneActive();
  const enabled = active && sceneActive;
  return (
    <ReactBitsGradualBlur
      position={position} height={height} width={width} strength={enabled ? strength : 0}
      layers={layers} curve={curve} exponential={exponential} opacity={opacity}
      saturation={saturation} tint={enabled ? tint : 'transparent'} zIndex={zIndex}
      duration={0.18}
      style={{ pointerEvents: 'none', overflow: 'hidden', ...StyleSheet.flatten(style) } as CSSProperties}
    />
  );
});

export default GradualBlur;
