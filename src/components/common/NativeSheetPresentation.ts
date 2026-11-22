import { createContext, useContext } from 'react';
export const NativeSheetPresentationContext = createContext(false);
export const useNativeSheetPresentation = () => useContext(NativeSheetPresentationContext);

// The content reports its natural height while SwiftUI owns the presentation.
export const NativeSheetSizingContext = createContext<((height: number) => void) | null>(null);
