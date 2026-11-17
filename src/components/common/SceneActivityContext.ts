import { createContext, useContext } from 'react';

export const SceneActivityContext = createContext(true);

// Cached tab content remains mounted, so decorative animations need explicit visibility.
export const useSceneActive = () => useContext(SceneActivityContext);
