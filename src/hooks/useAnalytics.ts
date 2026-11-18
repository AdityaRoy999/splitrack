import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSplitTrack } from '../store/SplitTrackStore';
import { useSceneActive } from '../components/common/SceneActivityContext';
import { api, errorMessage } from '../services/api';

interface Analytics {
  categories: Record<string, number>; totalIncome: number; totalExpenses: number;
  points: { key: string; label: string; fullLabel: string; income: number; expense: number }[];
}
const cache = new Map<string, Analytics>();
export function useAnalytics(period: string, year: number, month: number, date: string | null, enabled = true) {
  const { user } = useAuth(), { revision } = useSplitTrack(), active = useSceneActive();
  const query = useMemo(() => `period=${encodeURIComponent(period)}&year=${year}&month=${month + 1}${date && period === 'Date' ? `&date=${encodeURIComponent(date)}` : ''}`, [period, year, month, date]);
  const key = `${user?.uid}:${revision}:${query}`;
  const [result, setResult] = useState<{ key: string; data?: Analytics; error?: string }>(() => ({ key, data: cache.get(key) }));
  useEffect(() => {
    if (!enabled || !active || !user) return;
    const cached = cache.get(key);
    if (cached) return;
    let mounted = true;
    const controller = new AbortController();
    void api<Analytics>(`/api/analytics?${query}`, { signal: controller.signal }).then(data => {
      if (cache.size > 60) cache.clear(); cache.set(key, data);
      if (mounted) setResult({ key, data });
    }).catch(error => { if (mounted) setResult({ key, error: errorMessage(error) }); });
    return () => { mounted = false; controller.abort(); };
  }, [key, query, enabled, active, user]);
  const current = result.key === key ? result : { key, data: cache.get(key) };
  return { data: current.data, error: current.error ?? '', loading: enabled && !current.data && !current.error };
}
