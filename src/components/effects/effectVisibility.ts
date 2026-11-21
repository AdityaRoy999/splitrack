export interface EffectRect { pageX: number; pageY: number; width: number; height: number }

// A small overscan resumes decorative rendering before its card enters view.
export function isEffectVisible(rect: EffectRect | null, width: number, height: number, overscan = 64): boolean {
  'worklet';
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return rect.pageX + rect.width > -overscan && rect.pageX < width + overscan
    && rect.pageY + rect.height > -overscan && rect.pageY < height + overscan;
}
