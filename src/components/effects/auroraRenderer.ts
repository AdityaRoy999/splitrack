import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { clamp, createAuroraProgram } from './auroraShader';
import { createAuroraPalette, type AuroraSettings } from './auroraSettings';

export interface AuroraRenderer {
  update: (settings: AuroraSettings) => void;
  draw: (clock: number, reveal: number) => void;
  dispose: () => void;
}

export function createNativeAuroraRenderer(
  gl: ExpoWebGLRenderingContext,
  pixelRatio: number,
  parseColor: (color: string) => number[],
): AuroraRenderer {
  const program = createAuroraProgram(gl);
  if (!program) throw new Error('Aurora shader could not be initialized');
  const buffer = gl.createBuffer();
  const framebuffer = gl.createFramebuffer();
  const texture = gl.createTexture();
  if (!buffer || !framebuffer || !texture) {
    if (buffer) gl.deleteBuffer(buffer);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    if (texture) gl.deleteTexture(texture);
    gl.deleteProgram(program.program);
    throw new Error('Aurora GPU buffers could not be allocated');
  }

  const u = program.uniforms;
  let settings: AuroraSettings;
  let settingsKey = '';
  let paletteKey = '';
  let width = 0;
  let height = 0;
  let disposed = false;

  gl.useProgram(program.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    update(next) {
      if (disposed) return;
      settings = next;
      const nextKey = JSON.stringify(next);
      if (settingsKey === nextKey) return;
      settingsKey = nextKey;
      gl.useProgram(program.program);
      const nextPaletteKey = JSON.stringify(next.stops);
      if (paletteKey !== nextPaletteKey) {
        paletteKey = nextPaletteKey;
        gl.uniform3fv(u.uStops, createAuroraPalette(next.stops, parseColor));
      }
      gl.uniform1i(u.uStopCount, next.stops.length);
      gl.uniform1f(u.uAmplitude, next.amplitude);
      gl.uniform1f(u.uBlend, next.blend);
      gl.uniform1f(u.uHeight, next.height);
      gl.uniform1f(u.uScale, next.scale);
      gl.uniform1f(u.uGlow, next.glow);
      gl.uniform1f(u.uBrightness, next.brightness);
      gl.uniform1i(u.uLayers, next.layers);
      gl.uniform1f(u.uFlip, next.flip);
      gl.uniform3f(u.uPointer, 0, 0.5, 0);
      gl.uniform1f(u.uOpacity, next.opacity);
      gl.uniform1f(u.uLightMode, next.lightMode ? 1 : 0);
    },
    draw(clock, reveal) {
      if (disposed || !settings) return;
      const fullWidth = gl.drawingBufferWidth;
      const fullHeight = gl.drawingBufferHeight;
      if (fullWidth < 1 || fullHeight < 1) return;
      // Soft curtains do not need a full 3x Retina noise pass. Upscale on the GPU.
      const density = Math.min(pixelRatio, clamp(settings.dpr ?? 1.5, 0.5, 2));
      const nextWidth = Math.max(1, Math.round(fullWidth * density / pixelRatio));
      const nextHeight = Math.max(1, Math.round(fullHeight * density / pixelRatio));
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      if (width !== nextWidth || height !== nextHeight) {
        width = nextWidth;
        height = nextHeight;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          throw new Error('Aurora framebuffer is incomplete');
        }
        gl.uniform2f(u.uResolution, width, height);
      }
      gl.viewport(0, 0, width, height);
      gl.uniform1f(u.uTime, settings.time === undefined ? clock : settings.time * settings.speed * 0.1);
      gl.uniform1f(u.uReveal, 1 - Math.pow(1 - reveal, 3));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, fullWidth, fullHeight, gl.COLOR_BUFFER_BIT, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.endFrameEXP();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program.program);
    },
  };
}
