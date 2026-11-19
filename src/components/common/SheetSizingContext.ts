import { createContext, useContext } from 'react';

// Scroll content provides its intrinsic height while the sheet retains a
// bounded native viewport. This avoids the zero-height native ScrollView case.
export const SheetSizingContext = createContext<((viewport: number, content: number) => void) | null>(null);
export const useSheetSizing = () => useContext(SheetSizingContext);
