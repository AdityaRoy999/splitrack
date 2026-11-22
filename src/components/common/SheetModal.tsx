import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, useWindowDimensions, View, type ModalProps } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SceneActivityContext } from './SceneActivityContext';
import { ModalVisualContext } from './ModalVisualContext';
import { BubbleNoticeHost } from './BottomBubble';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AppleSheet } from './AppleSheet';
import { NativeSheetPresentationContext } from './NativeSheetPresentation';

const SheetModalContext = createContext({ open: true, ready: true, close: () => {}, finishExit: () => {} });
export const useSheetModal = () => useContext(SheetModalContext);

// Native Modal stays fully opaque; the sheet and backdrop animate independently.
type SheetModalProps = Omit<ModalProps, 'onRequestClose'> & {
  onRequestClose?: () => void;
  onExitComplete?: () => void;
};

const RetainedSheetContent = React.memo(function RetainedSheetContent({ children }: { visible: boolean; children: React.ReactNode }) {
  return <>{children}</>;
}, (_previous, next) => !next.visible);

export function SheetModal({ visible = false, children, onRequestClose, onShow, onDismiss, onExitComplete, ...props }: SheetModalProps) {
  const { isLiquidGlassEnabled } = useLiquidGlass();
  if (Platform.OS === 'ios' && isLiquidGlassEnabled) return <NativeSheetModal visible={visible} onRequestClose={onRequestClose} onDismiss={onDismiss} onExitComplete={onExitComplete}>{children}</NativeSheetModal>;
  return <CustomSheetModal visible={visible} onRequestClose={onRequestClose} onShow={onShow} onDismiss={onDismiss} onExitComplete={onExitComplete} {...props}>{children}</CustomSheetModal>;
}

function NativeSheetModal({ visible, children, onRequestClose, onDismiss, onExitComplete }: SheetModalProps) {
  const parentInsets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const visibleRef = useRef(visible);
  const dismissalPending = useRef(Boolean(visible));
  useLayoutEffect(() => {
    if (visible) dismissalPending.current = true;
    else if (visibleRef.current) Keyboard.dismiss();
    visibleRef.current = visible;
  }, [visible]);
  const close = useCallback(() => {
    if (visibleRef.current) { Keyboard.dismiss(); onRequestClose?.(); }
  }, [onRequestClose]);
  const value = useMemo(() => ({ open: Boolean(visible), ready: true, close, finishExit: () => {} }), [close, visible]);
  const metrics = { frame: { x: 0, y: 0, width, height }, insets: { ...parentInsets, top: 0, bottom: 0 } };
  return <AppleSheet visible={Boolean(visible)} onRequestClose={close} onDismiss={() => {
    if (visibleRef.current || !dismissalPending.current) return;
    dismissalPending.current = false;
    onDismiss?.();
    onExitComplete?.();
  }}>
    <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider initialMetrics={metrics}>
      <NativeSheetPresentationContext.Provider value>
        <SheetModalContext.Provider value={value}><ModalVisualContext.Provider value><SceneActivityContext.Provider value>
          <RetainedSheetContent visible={Boolean(visible)}>{children}</RetainedSheetContent>
        </SceneActivityContext.Provider></ModalVisualContext.Provider></SheetModalContext.Provider>
        <BubbleNoticeHost />
      </NativeSheetPresentationContext.Provider>
    </SafeAreaProvider></GestureHandlerRootView>
  </AppleSheet>;
}

function CustomSheetModal({ visible = false, children, onRequestClose, onShow, onDismiss, onExitComplete, ...props }: SheetModalProps) {
  const parentInsets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [presentation, setPresentation] = useState({ retained: visible, dismissing: false, ready: Platform.OS === 'web' });
  const visibleRef = useRef(visible);
  const requestCloseRef = useRef(onRequestClose);
  const exitCompleteRef = useRef(onExitComplete);
  const exitPendingRef = useRef(false);
  const finishExit = useCallback(() => {
    // An old exit callback must not dismiss a sheet that has just reopened.
    if (!visibleRef.current) {
      exitPendingRef.current = true;
      setPresentation((previous) => previous.retained
        ? { retained: false, dismissing: Platform.OS === 'ios', ready: Platform.OS === 'web' }
        : previous);
    }
  }, []);
  const close = useCallback(() => {
    if (visibleRef.current) {
      Keyboard.dismiss();
      requestCloseRef.current?.();
    }
  }, []);
  useLayoutEffect(() => {
    visibleRef.current = visible;
    requestCloseRef.current = onRequestClose;
    exitCompleteRef.current = onExitComplete;
    if (visible) {
      exitPendingRef.current = false;
    }
    if (!visible && presentation.retained) Keyboard.dismiss();
  }, [onExitComplete, onRequestClose, presentation.retained, visible]);
  useEffect(() => {
    if (!visible && !presentation.retained && !presentation.dismissing && exitPendingRef.current) {
      exitPendingRef.current = false;
      exitCompleteRef.current?.();
    }
  }, [presentation.dismissing, presentation.retained, visible]);
  const handleShow = useCallback<NonNullable<ModalProps['onShow']>>((event) => {
    setPresentation((previous) => previous.ready ? previous : { ...previous, ready: true });
    onShow?.(event);
  }, [onShow]);
  const handleDismiss = useCallback(() => {
    if (!visibleRef.current) setPresentation(previous => ({ ...previous, dismissing: false }));
    onDismiss?.();
  }, [onDismiss]);
  const value = useMemo(() => ({ open: visible, ready: presentation.ready, close, finishExit }), [close, finishExit, presentation.ready, visible]);
  const initialMetrics = useMemo(() => ({
    frame: { x: 0, y: 0, width, height }, insets: parentInsets,
  }), [height, parentInsets, width]);
  // Keep the last committed open tree through exit without an extra render for
  // every keystroke. iOS must finish dismissing its native host before a second
  // modal can be presented; Android removes its host in this commit.
  if (visible && !presentation.retained) {
    setPresentation({ ...presentation, retained: true, dismissing: false });
  }
  if (!visible && !presentation.retained && !presentation.dismissing) return null;

  return (
    <Modal {...props} visible={visible || presentation.retained} transparent animationType="none" presentationStyle="overFullScreen" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onShow={handleShow} onDismiss={handleDismiss} onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <SheetModalContext.Provider value={value}>
            <ModalVisualContext.Provider value>
            {/* A sheet keeps its live backdrop until its exit finishes. */}
            <SceneActivityContext.Provider value>
              <View pointerEvents={visible ? 'auto' : 'none'} style={{ flex: 1 }}>
                <RetainedSheetContent visible={visible}>{children}</RetainedSheetContent>
              </View>
            </SceneActivityContext.Provider>
            </ModalVisualContext.Provider>
          </SheetModalContext.Provider>
          <BubbleNoticeHost />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
