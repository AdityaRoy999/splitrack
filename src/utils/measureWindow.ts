import React from 'react';
import { View } from 'react-native';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ViewRefNode = React.ComponentRef<typeof View>;

/**
 * Measures a React Native View's position in window coordinates across iOS, Android, and Web.
 */
export function measureNodeInWindow(
  node: ViewRefNode | null,
  onMeasured: (rect: WindowRect) => void
): void {
  if (!node) return;
  const candidate = node as ViewRefNode & {
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    getBoundingClientRect?: () => DOMRect;
  };
  if (typeof candidate.measureInWindow === 'function') {
    candidate.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onMeasured({ x, y, width, height });
      }
    });
  } else if (typeof candidate.getBoundingClientRect === 'function') {
    const rect = candidate.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      onMeasured({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    }
  }
}
