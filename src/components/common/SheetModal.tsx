import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { Keyboard, Modal, View, type ModalProps } from 'react-native';

const SheetModalContext = createContext({ open: true, close: () => {}, finishExit: () => {} });
export const useSheetModal = () => useContext(SheetModalContext);

// Native Modal stays fully opaque; the sheet and backdrop animate independently.
type SheetModalProps = Omit<ModalProps, 'onRequestClose'> & { onRequestClose?: () => void };

export function SheetModal({ visible = false, children, onRequestClose, ...props }: SheetModalProps) {
  const [presentation, setPresentation] = useState({ retained: visible, content: children });
  const finishExit = useCallback(() => setPresentation((previous) => ({ ...previous, retained: false })), []);
  const close = useCallback(() => {
    if (visible) {
      Keyboard.dismiss();
      onRequestClose?.();
    }
  }, [onRequestClose, visible]);
  useLayoutEffect(() => {
    if (!visible && presentation.retained) Keyboard.dismiss();
  }, [presentation.retained, visible]);
  const value = useMemo(() => ({ open: visible, close, finishExit }), [close, finishExit, visible]);
  // Save the last open tree before rendering descendants. A parent may clear
  // editing data on close, but that must not remove the sheet during its exit.
  if (visible && (!presentation.retained || presentation.content !== children)) {
    setPresentation({ retained: true, content: children });
  }
  if (!visible && !presentation.retained) return null;

  return (
    <Modal {...props} visible transparent animationType="none" onRequestClose={close}>
      <SheetModalContext.Provider value={value}>
        <View pointerEvents={visible ? 'auto' : 'none'} style={{ flex: 1 }}>
          {visible ? children : presentation.content}
        </View>
      </SheetModalContext.Provider>
    </Modal>
  );
}
