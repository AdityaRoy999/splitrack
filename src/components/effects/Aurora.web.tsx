'use client';

import React, { useEffect, useRef, type CSSProperties } from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { clamp, createAuroraProgram, INTRO_SECONDS } from './auroraShader';
import { createAuroraPalette, normalizeAuroraSettings, type AuroraOptions } from './auroraSettings';
import { useSceneActive } from '../common/SceneActivityContext';

export interface AuroraProps extends AuroraOptions {
  className?: string;
  style?: StyleProp<ViewStyle> | CSSProperties;
}

export const Aurora = ({
  className = '',
  style,
  ...options
}: AuroraProps) => {
  const sceneActive = useSceneActive();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const settings = normalizeAuroraSettings({ ...options, paused: options.paused || !sceneActive });
  const settingsRef = useRef(settings);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!container || !canvas || !gl) return undefined;

    const program = createAuroraProgram(gl);
    if (!program) return undefined;
    const u = program.uniforms;

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const probe =
      typeof document !== 'undefined'
        ? document.createElement('canvas').getContext('2d', { willReadFrequently: true })
        : null;
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? true
        : false;
    const cache = new Map<string, number[]>();
    const parse = (value: string): number[] => {
      const cached = cache.get(value);
      if (cached) return cached;
      let rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#ffffff';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }
      cache.set(value, rgb);
      return rgb;
    };
    let palette = createAuroraPalette(settingsRef.current.stops, parse);
    let paletteKey = JSON.stringify(settingsRef.current.stops);

    const view = { width: 1, height: 1 };
    const pointer = { x: 0, y: 0, inside: false };
    const state = {
      clock: 0,
      px: 0,
      py: 0.5,
      reach: 0,
      reveal: settingsRef.current.intro && !reduce ? 0 : 1,
    };
    let raf = 0;
    let last = 0;
    let visible = true;

    const render = () => {
      const s = settingsRef.current;
      const nextPaletteKey = JSON.stringify(s.stops);
      if (paletteKey !== nextPaletteKey) {
        paletteKey = nextPaletteKey;
        palette = createAuroraPalette(s.stops, parse);
      }
      const reveal = state.reveal;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, s.time !== undefined ? s.time * s.speed * 0.1 : state.clock);
      gl.uniform3fv(u.uStops, palette);
      gl.uniform1i(u.uStopCount, s.stops.length);
      gl.uniform1f(u.uAmplitude, s.amplitude);
      gl.uniform1f(u.uBlend, s.blend);
      gl.uniform1f(u.uHeight, s.height);
      gl.uniform1f(u.uScale, s.scale);
      gl.uniform1f(u.uGlow, s.glow);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1i(u.uLayers, s.layers);
      gl.uniform1f(u.uFlip, s.flip);
      gl.uniform3f(u.uPointer, state.px, state.py, state.reach);
      gl.uniform1f(u.uReveal, 1 - Math.pow(1 - reveal, 3));
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.uniform1f(u.uLightMode, s.lightMode ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || (typeof document !== 'undefined' && document.hidden)) return;
      const s = settingsRef.current;
      const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      if (s.paused) {
        state.reveal = 1;
        render();
        last = 0;
        return;
      }
      const motion = reduce ? 0 : 1;
      state.clock += dt * s.speed * motion;
      const engaged = s.mouseInteraction && pointer.inside && !reduce;
      const follow = 1 - Math.exp(-dt / 0.6);
      if (engaged) {
        const tx = (pointer.x - view.width / 2) / view.height;
        const ty = s.flip ? 1 - pointer.y / view.height : pointer.y / view.height;
        state.px += (tx - state.px) * follow;
        state.py += (ty - state.py) * follow;
      }
      state.reach += ((engaged ? 1 : 0) - state.reach) * (1 - Math.exp(-dt / (engaged ? 0.9 : 1.4)));
      if (!s.intro || reduce) state.reveal = 1;
      else if (state.reveal < 1) state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);
      render();
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && visible && (typeof document === 'undefined' || !document.hidden)) {
        raf = requestAnimationFrame(frame);
      }
    };

    const resize = () => {
      const s = settingsRef.current;
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(s.dpr || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2);
      view.width = width;
      view.height = height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      render();
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      const wasInside = pointer.inside;
      pointer.inside =
        pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
      if (pointer.inside && !wasInside) {
        const s = settingsRef.current;
        state.px = (pointer.x - rect.width / 2) / Math.max(1, rect.height);
        state.py = s.flip ? 1 - pointer.y / Math.max(1, rect.height) : pointer.y / Math.max(1, rect.height);
      }
      if (!settingsRef.current.paused) wake();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') pointer.inside = false;
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const onVisibility = () => {
      last = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    let lastDpr = settingsRef.current.dpr;
    wakeRef.current = () => {
      const s = settingsRef.current;
      if (s.dpr !== lastDpr) {
        lastDpr = s.dpr;
        resize();
        return;
      }
      if (!raf) render();
      wake();
    };

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(program.program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    wakeRef.current?.();
  });

  const flattenedStyle = StyleSheet.flatten(style as any) as any;
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
    ...flattenedStyle,
  };

  return (
    <div
      ref={containerRef}
      className={['relative h-full w-full overflow-hidden', className].filter(Boolean).join(' ')}
      style={containerStyle}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default Aurora;
