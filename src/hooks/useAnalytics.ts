import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSplitTrack } from '../store/SplitTrackStore';
import { useSceneVisible } from '../components/common/SceneActivityContext';
import { api, errorMessage } from '../services/api';

interface Analytics {
  categories: Record<string, number>; totalIncome: number; totalExpenses: number;
  points: { key: string; label: string; fullLabel: string; income: number; expense: number }[];
}
const cache = new Map<string, Analytics>();
export function useAnalytics(period: string, year: number, month: number, date: string | null, enabled = true) {
  const { user } = useAuth(), { revision } = useSplitTrack(), active = useSceneVisible();
  const uid = user?.uid;
  const query = useMemo(() => `period=${encodeURIComponent(period)}&year=${year}&month=${month + 1}${date && period === 'Date' ? `&date=${encodeURIComponent(date)}` : ''}`, [period, year, month, date]);
  const key = `${uid}:${revision}:${query}`;
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: Analytics; error?: string }>(() => ({ key, data: cache.get(key) }));
  useEffect(() => {
    if (!enabled || !active || !uid) return;
    const cached = cache.get(key);
    if (cached) return;
    let mounted = true;
    const controller = new AbortController();
    void api<Analytics>(`/api/analytics?${query}`, { signal: controller.signal, expectedUid: uid, attempts: 2, timeoutMs: 8000 }).then(data => {
      if (cache.size > 60) cache.clear(); cache.set(key, data);
      if (mounted) setResult({ key, data });
    }).catch(error => { if (mounted && !controller.signal.aborted) setResult({ key, error: errorMessage(error) }); });
    return () => { mounted = false; controller.abort(); };
  }, [key, query, enabled, active, uid, retryCount]);
  const retry = useCallback(() => { cache.delete(key); setResult({ key }); setRetryCount(value => value + 1); }, [key]);
  const current = result.key === key ? result : { key };
  const data = cache.get(key) ?? current.data;
  const error = data ? '' : current.error ?? '';
  return { data, error, loading: enabled && Boolean(uid) && !data && !error, retry };
}
