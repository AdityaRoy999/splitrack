import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Platform, processColor, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GradualBlur, type GradualBlurProps } from '../effects/GradualBlur';

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

export function useHorizontalScrollEdges() {
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
    dimensions.current.viewport = event.nativeEvent.layout.width;
    update();
  }, [update]);
  const onContentSizeChange = useCallback((width: number) => {
    dimensions.current.content = width;
    update();
  }, [update]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    dimensions.current = {
      viewport: event.nativeEvent.layoutMeasurement.width,
      content: event.nativeEvent.contentSize.width,
      offset: event.nativeEvent.contentOffset.x,
    };
    update();
  }, [update]);
  return { ...edges, onLayout, onContentSizeChange, onScroll };
}

function ScrollEdge({
  position, visible, width, tint, blurTarget,
}: {
  position: 'left' | 'right';
  visible: boolean;
  width: number;
  tint: string;
  blurTarget: GradualBlurProps['blurTarget'];
}) {
  const [reveal] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(reveal, {
      toValue: visible ? 1 : 0,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reveal, visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.scrollEdge,
        {
          width, [position]: 0,
          // UIKit blur stays fully opaque; its own mask supplies the fade.
          transform: [{ translateX: reveal.interpolate({
            inputRange: [0, 1], outputRange: [position === 'left' ? -width : width, 0],
          }) }],
        },
      ]}
    >
      <GradualBlur position={position} width={width} strength={0.42} curve="ease-out" layers={12} tint={tint} blurTarget={blurTarget} />
    </Animated.View>
  );
}

export function HorizontalEdgeFade({ children, style, tint, width = 18, left = true, right = true }: HorizontalEdgeFadeProps) {
  const { themeMode } = useLiquidGlass();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const edgeTint = useMemo(() => {
    const base = themeMode === 'dark' ? 0xff121216 : 0xffffffff;
    const resolved = processColor(tint ?? (themeMode === 'dark' ? '#121216' : '#FFFFFF'));
    const color = typeof resolved === 'number' ? resolved >>> 0 : base;
    const alpha = (color >>> 24) / 255;
    const channels = [16, 8, 0].map((shift) => Math.round(((color >>> shift) & 255) * alpha + ((base >>> shift) & 255) * (1 - alpha)));
    // Material card tints can be translucent. Composite their edge color onto
    // the shared grey surface so clipped chip pixels are fully covered.
    return `rgb(${channels.join(',')})`;
  }, [themeMode, tint]);
  return (
    <View style={[styles.horizontal, style]}>
      {Platform.OS === 'android' ? <BlurTargetView ref={blurTarget}>{children}</BlurTargetView> : children}
      {width > 0 ? <>
        <ScrollEdge position="left" visible={left} width={width} tint={edgeTint} blurTarget={blurTarget} />
        <ScrollEdge position="right" visible={right} width={width} tint={edgeTint} blurTarget={blurTarget} />
      </> : null}
    </View>
  );
}

// Keep the fades outside the ScrollView: they soften clipping without scrolling
// with the form or intercepting gestures, and leave fixed controls untouched.
export function ScrollEdgeFade({ children, style, tint, top = 18, bottom = 24 }: ScrollEdgeFadeProps) {
  const { themeMode } = useLiquidGlass();
  const blurTarget = useRef<ComponentRef<typeof BlurTargetView> | null>(null);
  const edgeTint = tint ?? (themeMode === 'dark' ? 'rgba(9,9,11,0.88)' : 'rgba(244,244,248,0.9)');

  return (
    <View style={[styles.viewport, style]}>
      {Platform.OS === 'android' ? (
        <BlurTargetView ref={blurTarget} style={styles.content}>{children}</BlurTargetView>
      ) : children}
      {top > 0 ? <GradualBlur position="top" height={top} strength={0.9} tint={edgeTint} blurTarget={blurTarget} /> : null}
      {bottom > 0 ? <GradualBlur position="bottom" height={bottom} strength={1} tint={edgeTint} blurTarget={blurTarget} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' },
  content: { flex: 1, minHeight: 0 },
  horizontal: { position: 'relative', overflow: 'hidden' },
  scrollEdge: { position: 'absolute', top: 0, bottom: 0, zIndex: 20 },
});
