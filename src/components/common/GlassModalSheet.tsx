import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from '../glass/GlassSurface';
import { useSheetMotion } from './useSheetMotion';
import { SheetSizingContext } from './SheetSizingContext';
import { ScrollEdgeFade } from './ScrollEdgeFade';
import { useNativeSheetPresentation } from './NativeSheetPresentation';

// Measure fixed sections directly, including their margins. Scroll sections
// report their intrinsic content, so sheet height never depends on its viewport.
function MeasuredSheetSection({ id, scrollable, children, report }: {
  id: string; scrollable: boolean; children: React.ReactNode;
  report(id: string, height: number): void;
}) {
  const onLayout = useCallback((event: LayoutChangeEvent) => report(id, event.nativeEvent.layout.height), [id, report]);
  const fitContent = useCallback((_viewport: number, content: number) => {
    if (content > 0) report(id, content);
  }, [id, report]);
  return scrollable
    ? <SheetSizingContext.Provider value={fitContent}>{children}</SheetSizingContext.Provider>
    : <View collapsable={false} onLayout={onLayout} style={styles.fixedSection}>{children}</View>;
}

interface GlassModalSheetProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const GlassModalSheet: React.FC<GlassModalSheetProps> = ({
  style,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { themeMode } = useLiquidGlass();
  const native = useNativeSheetPresentation();
  const isDark = themeMode === 'dark';

  const bgMatte = isDark ? '#09090B' : '#F4F4F8';
  const tintGlass = isDark ? 'rgba(18, 18, 24, 0.88)' : 'rgba(255, 255, 255, 0.92)';

  const maxSheetHeight = Math.round(Math.min(windowHeight * 0.92, windowHeight - insets.top - 8));
  const bottomPadding = Math.max(16, insets.bottom + 8);
  const sections = React.Children.toArray(children).map((child, index) => {
    const scrollable = React.isValidElement(child) && child.type === ScrollEdgeFade;
    return { child, scrollable, id: `${React.isValidElement(child) ? child.key : index}:${scrollable ? 'scroll' : 'fixed'}` };
  });
  // The handle and title form one native gesture surface. The old 32px
  // invisible overlay missed drags on the title and could cover other controls.
  // Keep the scroller outside this detector so its vertical gestures stay native.
  const firstScroll = sections.findIndex(section => section.scrollable);
  const headerCount = firstScroll < 0 ? Math.min(1, sections.length) : firstScroll;
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const report = useCallback((id: string, height: number) => {
    if (!Number.isFinite(height) || height < 0) return;
    setMeasurements(previous => previous[id] !== undefined && Math.abs(previous[id] - height) < 1 ? previous : { ...previous, [id]: height });
  }, []);
  // Hidden fixed sections can omit onLayout. Their height is zero until they
  // report; only scroll content must provide a measurement before fitting.
  const measured = sections.filter(section => section.scrollable).every(section => measurements[section.id] !== undefined);
  const [laidOut, setLaidOut] = useState(false);
  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.height > 0) setLaidOut(true);
  }, []);
  const paddingTop = StyleSheet.flatten([styles.sheetBase, style])?.paddingTop ?? 10;
  const contentHeight = sections.reduce((sum, section) => sum + (measurements[section.id] ?? 0), 0);
  const sheetHeight = measured ? Math.min(maxSheetHeight, Math.ceil(contentHeight + (typeof paddingTop === 'number' ? paddingTop : 10) + bottomPadding)) : maxSheetHeight;
  // Empty sections (for example a hidden FormError) may never dispatch a native
  // layout event. They must not leave an otherwise laid-out sheet offscreen.
  const { animatedStyle, gesture } = useSheetMotion(windowHeight, laidOut);

  if (native) return <View style={[styles.sheetBase, style, { flex: 1, maxWidth: undefined, paddingBottom: bottomPadding, backgroundColor: 'transparent' }]}>
    <SheetSizingContext.Provider value={null}>{children}</SheetSizingContext.Provider>
  </View>;

  return (
    <Animated.View
      onLayout={onSheetLayout}
      style={[
        styles.animWrap,
        {
          height: sheetHeight,
          maxHeight: maxSheetHeight,
        },
        animatedStyle,
      ]}
    >
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={windowHeight - sheetHeight}>
        <GlassSurface
          borderTopLeftRadius={32}
          borderTopRightRadius={32}
          borderBottomLeftRadius={0}
          borderBottomRightRadius={0}
          borderRadius={0}
          glassStyle="regular"
          intensity={isDark ? 85 : 95}
          tintColor={tintGlass}
          matteColor={bgMatte}
          style={[
            styles.sheetBase,
            style,
            {
              maxHeight: maxSheetHeight,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              marginBottom: 0,
              paddingBottom: bottomPadding,
            },
          ]}
        >
          {headerCount > 0 ? <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
            <View collapsable={false} style={styles.headerGestureArea}>
              {sections.slice(0, headerCount).map(section => <MeasuredSheetSection key={section.id} id={section.id} scrollable={false} report={report}>{section.child}</MeasuredSheetSection>)}
            </View>
          </GestureDetector> : null}
          {sections.slice(headerCount).map(section => <MeasuredSheetSection key={section.id} id={section.id} scrollable={section.scrollable} report={report}>{section.child}</MeasuredSheetSection>)}
        </GlassSurface>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fixedSection: { flexShrink: 0, minWidth: 0 },
  headerGestureArea: { flexShrink: 0, minWidth: 0 },
  keyboardArea: { flex: 1, minHeight: 0, width: '100%' },
  animWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexShrink: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    zIndex: 10,
  },
  sheetBase: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    borderWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
});
