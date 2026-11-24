import { createContext, useContext } from 'react';

export const SceneActivityContext = createContext(true);
export const SceneVisibilityContext = createContext(true);

// Cached tab content remains mounted, so decorative animations need explicit visibility.
export const useSceneActive = () => useContext(SceneActivityContext);
// Fetching content and decoding photos follow visibility, independently of
// decorative effects paused while a sheet or transition is on screen.
export const useSceneVisible = () => useContext(SceneVisibilityContext);
