import React from 'react';
import { View, type ViewProps } from 'react-native';

// Fields, badges and icon boxes are content within the surrounding glass.
// A flat fill keeps labels readable without another refracting layer.
export function GlassPanel({ style, children, ...props }: ViewProps) {
  return <View {...props} style={style}>{children}</View>;
}
