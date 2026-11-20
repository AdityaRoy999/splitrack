import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, useWindowDimensions, View, type ModalProps } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SceneActivityContext } from './SceneActivityContext';
import { ModalVisualContext } from './ModalVisualContext';
import { BubbleNoticeHost } from './BottomBubble';

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
