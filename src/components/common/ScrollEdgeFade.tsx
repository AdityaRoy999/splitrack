import React, { useCallback, useContext, useRef, useState } from 'react';
import { Platform, processColor, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { GradualBlur } from '../effects/GradualBlur';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { BackdropSurfaceContext } from './BackdropSurfaceContext';

interface ScrollEdgeFadeProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  top?: number;
  bottom?: number;
}

interface HorizontalEdgeFadeProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  width?: number;
  left?: boolean;
  right?: boolean;
}

function captureBackground(tint: string | undefined, fallback: string): string {
  const color = tint ? processColor(tint) : null;
  if (typeof color !== 'number') return fallback;
  const base = processColor(fallback);
  if (typeof base !== 'number') return fallback;
  const alpha = (color >>> 24) / 255;
  const channel = (shift: number) => Math.round((color >>> shift & 255) * alpha + (base >>> shift & 255) * (1 - alpha));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

function useScrollEdges(horizontal: boolean) {
  const dimensions = useRef({ viewport: 0, content: 0, offset: 0 });
  const currentEdges = useRef({ left: false, right: false });
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const { viewport, content, offset } = dimensions.current;
    const maxOffset = Math.max(0, content - viewport);
    const x = Math.max(0, Math.min(maxOffset, offset));
    const next = { left: viewport > 0 && x > 1, right: viewport > 0 && maxOffset - x > 1 };
    if (next.left !== currentEdges.current.left || next.right !== currentEdges.current.right) {
      currentEdges.current = next;
      setEdges(next);
    }
  }, []);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    dimensions.current.viewport = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
    update();
  }, [horizontal, update]);
  const onContentSizeChange = useCallback((width: number, height: number) => {
    dimensions.current.content = horizontal ? width : height;
    update();
  }, [horizontal, update]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const e = event.nativeEvent;
    dimensions.current = {
      viewport: horizontal ? e.layoutMeasurement.width : e.layoutMeasurement.height,
      content: horizontal ? e.contentSize.width : e.contentSize.height,
      offset: horizontal ? e.contentOffset.x : e.contentOffset.y,
    };
    update();
  }, [horizontal, update]);
  return { ...edges, onLayout, onContentSizeChange, onScroll };
}

export function useHorizontalScrollEdges() {
  return useScrollEdges(true);
}

// Keep the gradient mask at the clipping edge and animate the blur's reveal.
export function HorizontalEdgeFade({ children, style, tint, width = 24, left = true, right = true }: HorizontalEdgeFadeProps) {
  const { themeMode } = useLiquidGlass();
  const surface = useContext(BackdropSurfaceContext);
  const background = captureBackground(tint, surface ?? (themeMode === 'dark' ? '#17171C' : '#F4F5F8'));
  return (
    <View collapsable={false} style={[styles.horizontal, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : background }, style]}>
      {children}
      {width > 0 ? <>
        <GradualBlur position="left" active={left} width={width} strength={0.5} curve="bezier" />
        <GradualBlur position="right" active={right} width={width} strength={0.5} curve="bezier" />
      </> : null}
    </View>
  );
}

// A single scrollable child fills the bounded viewport. Preserve its handlers,
// and only enable a fade where content is actually being clipped.
export function ScrollEdgeFade({ children, style, tint, top = 24, bottom = 28 }: ScrollEdgeFadeProps) {
  const { themeMode } = useLiquidGlass();
  const surface = useContext(BackdropSurfaceContext);
  const background = captureBackground(tint, surface ?? (themeMode === 'dark' ? '#09090B' : '#F4F4F8'));
  const edges = useScrollEdges(false);
  const scroller = React.isValidElement<ScrollViewProps>(children) ? React.cloneElement(children, {
    style: [styles.content, children.props.style],
    automaticallyAdjustContentInsets: false,
    contentInsetAdjustmentBehavior: 'never',
    keyboardShouldPersistTaps: children.props.keyboardShouldPersistTaps ?? 'handled',
    keyboardDismissMode: children.props.keyboardDismissMode ?? 'interactive',
    scrollEventThrottle: children.props.scrollEventThrottle ?? 16,
    onLayout: (event: LayoutChangeEvent) => { edges.onLayout(event); children.props.onLayout?.(event); },
    onContentSizeChange: (width: number, height: number) => { edges.onContentSizeChange(width, height); children.props.onContentSizeChange?.(width, height); },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { edges.onScroll(event); children.props.onScroll?.(event); },
  }) : children;
  return (
    <View collapsable={false} style={[styles.viewport, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : background }, style]}>
      {scroller}
      {top > 0 ? <GradualBlur position="top" active={edges.left} height={top} strength={0.5} curve="bezier" /> : null}
      {bottom > 0 ? <GradualBlur position="bottom" active={edges.right} height={bottom} strength={0.5} curve="bezier" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' },
  content: { flex: 1, minHeight: 0 },
  horizontal: { position: 'relative', overflow: 'hidden' },
});
