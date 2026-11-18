import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { errorMessage, requestId } from '../services/api';
import { NotificationType, triggerNotification } from '../utils/haptics';

export function useAsyncAction() {
  const busy = useRef(false), mounted = useRef(true);
  const submission = useRef<{ key: string; id: string; value: unknown } | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await action(); }
    catch (failure) { if (mounted.current) setError(errorMessage(failure)); triggerNotification(NotificationType.Error); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  }, []);
  const runWithIntent = useCallback(<T,>(value: T, action: (draft: T, id: string) => Promise<void>, key = JSON.stringify(value)) => {
    if (busy.current) return Promise.resolve();
    if (!submission.current || submission.current.key !== key) submission.current = { key, id: requestId(), value };
    const intent = submission.current;
    return run(async () => {
      // Retain both the payload and ID if a response is lost. Retrying this
      // form confirms the original save instead of creating another entry.
      await action(intent.value as T, intent.id);
      if (submission.current === intent) submission.current = null;
    });
  }, [run]);
  return { run, runWithIntent, pending, error, setError };
}
export function FormError({ message }: { message: string }) {
  return message ? <Text accessibilityLiveRegion="polite" style={{ color: '#F87171', fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>{message}</Text> : null;
}
