import { Text, View } from 'react-native';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { GlassPill } from '../glass/GlassPill';
import { useAsyncAction } from '../../hooks/useAsyncAction';

export function CloudStatus() {
  const { loading, syncing, syncError, refresh } = useSplitTrack();
  const { run, pending } = useAsyncAction();
  if (!loading && !syncError) return null;
  return <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#18181B', gap: 8 }}>
    <Text accessibilityLiveRegion="polite" style={{ color: '#F4F4F5', textAlign: 'center', fontSize: 13 }}>{syncError || 'Loading your saved records…'}</Text>
    {syncError ? <GlassPill label={pending || syncing ? 'Connecting…' : 'Retry connection'} disabled={pending || syncing} onPress={() => { void run(refresh); }} /> : null}
  </View>;
}
