import { createContext, useContext } from 'react';
export const NativeSheetPresentationContext = createContext(false);
export const useNativeSheetPresentation = () => useContext(NativeSheetPresentationContext);
