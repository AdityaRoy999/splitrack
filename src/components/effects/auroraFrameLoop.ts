type FrameListener = (timestamp: number) => void;

const listeners = new Set<FrameListener>();
const FRAME_INTERVAL = 1000 / 30;
let frameId: number | undefined;
let lastFrame: number | undefined;

function frame(timestamp: number) {
  frameId = undefined;
  if (lastFrame === undefined || timestamp - lastFrame >= FRAME_INTERVAL - 0.5) {
    lastFrame = timestamp;
    listeners.forEach((listener) => listener(timestamp));
  }
  if (listeners.size > 0) frameId = requestAnimationFrame(frame);
}

export function subscribeAuroraFrame(listener: FrameListener) {
  listeners.add(listener);
  if (frameId === undefined) frameId = requestAnimationFrame(frame);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = undefined;
      lastFrame = undefined;
    }
  };
}
