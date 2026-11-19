import { createContext, useContext } from 'react';

// Modal surfaces stay solid, even when Liquid Glass is enabled on main pages.
export const ModalVisualContext = createContext(false);
export const useModalVisual = () => useContext(ModalVisualContext);
