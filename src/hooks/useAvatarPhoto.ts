import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVisualActivity } from './useVisualActivity';
import { useSceneVisible } from '../components/common/SceneActivityContext';

export const isPhotoUri = (uri?: string | null) => Boolean(uri && /^(https?:\/\/|file:\/\/|content:\/\/|blob:|data:image\/)/i.test(uri));

const RETRY_DELAYS = [1000, 4000, 15000];
type PhotoState = { uri: string | null | undefined; attempt: number; status: 'loading' | 'loaded' | 'failed' };
const initial = (uri: PhotoState['uri']): PhotoState => ({ uri, attempt: 0, status: 'loading' });

// A failed download must not permanently replace a friend's photo. Retry with
// capped backoff while visible, and retry immediately on foreground/scene return.
export function useAvatarPhoto(uri?: string | null) {
  const { foreground } = useVisualActivity();
  const sceneActive = useSceneVisible();
  const active = foreground && sceneActive;
  const [photo, setPhoto] = useState(() => initial(uri));
  const current = photo.uri === uri ? photo : initial(uri);
  const source = useRef(uri), wasActive = useRef(active);
  useLayoutEffect(() => { source.current = uri; }, [uri]);

  useEffect(() => {
    const resumed = active && !wasActive.current;
    wasActive.current = active;
    if (!active || !isPhotoUri(uri) || photo.uri !== uri || photo.status !== 'failed') return;
    const timer = setTimeout(() => {
      setPhoto(previous => previous.uri === uri && previous.status === 'failed'
        ? { ...previous, attempt: previous.attempt + 1, status: 'loading' } : previous);
    }, resumed ? 0 : RETRY_DELAYS[photo.attempt] ?? 60000);
    return () => clearTimeout(timer);
  }, [active, uri, photo]);

  // Native image callbacks may never arrive after a suspended request. Keep a
  // bounded attempt so the initials cannot mask a photo indefinitely.
  useEffect(() => {
    if (!active || !isPhotoUri(uri) || current.status !== 'loading') return;
    const timer = setTimeout(() => {
      if (source.current !== uri) return;
      setPhoto(previous => {
        const value = previous.uri === uri ? previous : initial(uri);
        return value.status === 'loading' && value.attempt === current.attempt ? { ...value, status: 'failed' } : previous;
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, [active, uri, current.status, current.attempt]);

  const onError = useCallback(() => {
    if (source.current !== uri) return;
    setPhoto(previous => {
      const value = previous.uri === uri ? previous : initial(uri);
      return value.attempt === current.attempt && value.status === 'loading' ? { ...value, status: 'failed' } : previous;
    });
  }, [uri, current.attempt]);
  const onLoad = useCallback(() => {
    if (source.current !== uri) return;
    setPhoto(previous => {
      const value = previous.uri === uri ? previous : initial(uri);
      return value.attempt === current.attempt && value.status === 'loading' ? { ...value, status: 'loaded' } : previous;
    });
  }, [uri, current.attempt]);

  return {
    attempt: current.attempt,
    loaded: isPhotoUri(uri) && current.status === 'loaded',
    shouldLoad: isPhotoUri(uri) && current.status !== 'failed' && (active || current.status === 'loaded'),
    onError, onLoad,
  };
}
