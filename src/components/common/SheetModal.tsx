import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, useWindowDimensions, View, type ModalProps } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SceneActivityContext } from './SceneActivityContext';
import { ModalVisualContext } from './ModalVisualContext';

const SheetModalContext = createContext({ open: true, ready: true, close: () => {}, finishExit: () => {} });
export const useSheetModal = () => useContext(SheetModalContext);

// Native Modal stays fully opaque; the sheet and backdrop animate independently.
type SheetModalProps = Omit<ModalProps, 'onRequestClose'> & { onRequestClose?: () => void };

export function SheetModal({ visible = false, children, onRequestClose, onShow, ...props }: SheetModalProps) {
  const parentInsets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [presentation, setPresentation] = useState({ retained: visible, content: children, ready: Platform.OS === 'web' });
  const visibleRef = useRef(visible);
  const requestCloseRef = useRef(onRequestClose);
  const finishExit = useCallback(() => {
    // An old exit callback must not dismiss a sheet that has just reopened.
    if (!visibleRef.current) {
      setPresentation((previous) => ({ ...previous, retained: false, ready: Platform.OS === 'web' }));
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
    if (!visible && presentation.retained) Keyboard.dismiss();
  }, [onRequestClose, presentation.retained, visible]);
  const handleShow = useCallback<NonNullable<ModalProps['onShow']>>((event) => {
    setPresentation((previous) => previous.ready ? previous : { ...previous, ready: true });
    onShow?.(event);
  }, [onShow]);
  const value = useMemo(() => ({ open: visible, ready: presentation.ready, close, finishExit }), [close, finishExit, presentation.ready, visible]);
  const initialMetrics = useMemo(() => ({
    frame: { x: 0, y: 0, width, height }, insets: parentInsets,
  }), [height, parentInsets, width]);
  // Save the last open tree before rendering descendants. A parent may clear
  // editing data on close, but that must not remove the sheet during its exit.
  if (visible && (!presentation.retained || presentation.content !== children)) {
    setPresentation({ ...presentation, retained: true, content: children });
  }
  if (!visible && !presentation.retained) return null;

  return (
    <Modal {...props} visible transparent animationType="none" presentationStyle="overFullScreen" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onShow={handleShow} onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <SheetModalContext.Provider value={value}>
            <ModalVisualContext.Provider value>
            {/* A sheet keeps its live backdrop until its exit finishes. */}
            <SceneActivityContext.Provider value>
              <View pointerEvents={visible ? 'auto' : 'none'} style={{ flex: 1 }}>
                {visible ? children : presentation.content}
              </View>
            </SceneActivityContext.Provider>
            </ModalVisualContext.Provider>
          </SheetModalContext.Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
