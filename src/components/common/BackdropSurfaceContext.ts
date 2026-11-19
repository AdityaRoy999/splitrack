import { createContext } from 'react';

// A nested scroll viewport must match its own surface, including in a modal.
export const BackdropSurfaceContext = createContext<string | null>(null);
