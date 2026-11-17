import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  PixelRatio,
  processColor,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import { useSceneActive } from '../common/SceneActivityContext';
import { useVisualActivity } from '../../hooks/useVisualActivity';
import { subscribeAuroraFrame } from './auroraFrameLoop';
import { createNativeAuroraRenderer, type AuroraRenderer } from './auroraRenderer';
import { normalizeAuroraSettings, type AuroraOptions } from './auroraSettings';
import { clamp, INTRO_SECONDS } from './auroraShader';

export interface AuroraProps extends AuroraOptions {
  style?: StyleProp<ViewStyle>;
}

function parseColor(color: string): number[] {
  const value = processColor(color);
  if (typeof value !== 'number') return [1, 1, 1];
  return [(value >>> 16 & 255) / 255, (value >>> 8 & 255) / 255, (value & 255) / 255];
}

export const Aurora = memo(function Aurora({ style, ...options }: AuroraProps) {
  const sceneActive = useSceneActive();
  const { foreground, reducedMotion } = useVisualActivity();
  const settings = normalizeAuroraSettings(options);
  const settingsRef = useRef(settings);
  const aliveRef = useRef(true);
  const rendererRef = useRef<AuroraRenderer | null>(null);
  const stopFrameRef = useRef<(() => void) | null>(null);
  const stateRef = useRef({ clock: 0, reveal: settings.intro ? 0 : 1, last: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const fail = useCallback((error: unknown) => {
    stopFrameRef.current?.();
    stopFrameRef.current = null;
    rendererRef.current?.dispose();
    rendererRef.current = null;
    console.warn('Aurora native rendering failed:', error);
    setFailed(true);
  }, []);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    if (!aliveRef.current) return;
    try {
      const renderer = createNativeAuroraRenderer(gl, PixelRatio.get(), parseColor);
      rendererRef.current = renderer;
      renderer.update(settingsRef.current);
      renderer.draw(stateRef.current.clock, stateRef.current.reveal);
      setReady(true);
    } catch (error) {
      fail(error);
    }
  }, [fail]);

  useLayoutEffect(() => {
    settingsRef.current = settings;
    const renderer = rendererRef.current;
    if (!renderer) return;
    try {
      renderer.update(settings);
      if (foreground && sceneActive) {
        if (!settings.intro || reducedMotion || settings.paused) stateRef.current.reveal = 1;
        renderer.draw(stateRef.current.clock, stateRef.current.reveal);
      }
    } catch (error) {
      fail(error);
    }
  });

  useEffect(() => {
    const state = stateRef.current;
    state.last = 0;
    if (!ready || failed || !foreground || !sceneActive || reducedMotion || settings.paused || settings.speed === 0) return;
    const stop = subscribeAuroraFrame((now) => {
      const current = settingsRef.current;
      const dt = state.last ? clamp((now - state.last) / 1000, 0, 0.05) : 1 / 30;
      state.last = now;
      state.clock += dt * current.speed;
      state.reveal = current.intro ? Math.min(1, state.reveal + dt / INTRO_SECONDS) : 1;
      try {
        rendererRef.current?.draw(state.clock, state.reveal);
      } catch (error) {
        fail(error);
      }
    });
    stopFrameRef.current = stop;
    return () => {
      stop();
      stopFrameRef.current = null;
      state.last = 0;
    };
  }, [fail, failed, foreground, ready, reducedMotion, sceneActive, settings.paused, settings.speed]);

  useLayoutEffect(() => {
    aliveRef.current = true;
    return () => {
      // Release resources before GLView removes its native context.
      aliveRef.current = false;
      stopFrameRef.current?.();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.container, style]}>
      {failed ? (
        <LinearGradient
          colors={['transparent', settings.stops[0]]}
          start={{ x: 0.5, y: settings.flip ? 0 : 1 }}
          end={{ x: 0.5, y: settings.flip ? 1 : 0 }}
          style={[StyleSheet.absoluteFill, { opacity: settings.opacity }]}
        />
      ) : (
        <GLView pointerEvents="none" msaaSamples={0} onContextCreate={onContextCreate} style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
});

export default Aurora;

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: 'transparent' },
});
