import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassPill } from '../glass/GlassPill';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
import { SheetModal } from './SheetModal';
import { ModalBackdrop } from './ModalBackdrop';
import { GlassModalSheet } from './GlassModalSheet';
import { ScrollEdgeFade } from './ScrollEdgeFade';

// Offline status and duplicate confirmation reuse the existing connection
// banner and transaction sheet styling on both mobile platforms.
export function CloudStatus() {
  const { loading, syncing, syncError, refresh, friends, trips, pendingDuplicate, resolveDuplicate, queuedTransactionCount, pendingFailure, discardQueuedTransaction } = useSplitTrack();
  const { run, pending, error, setError } = useAsyncAction();
  const { themeMode, formatAmount } = useLiquidGlass();
  const dark = themeMode === 'dark';
  const color = dark ? '#F4F4F5' : '#09090B';
  const muted = dark ? '#A1A1AA' : '#71717A';
  const existing = pendingDuplicate?.existingTransaction;
  const memberName = (id: string) => id === 'user' ? 'You' : friends.find(friend => friend.id === id)?.name || 'Member';
  const tripName = existing?.tripId ? trips.find(trip => trip.id === existing.tripId)?.name || 'Group' : undefined;
  useEffect(() => { setError(''); }, [pendingDuplicate?.requestId, pendingFailure?.requestId, setError]);
  const decide = (proceed: boolean) => {
    if (pendingDuplicate && !pending) {
      const id = pendingDuplicate.requestId;
      void run(() => resolveDuplicate(id, proceed));
    }
  };
  const discardFailure = () => {
    if (pendingFailure && !pending) {
      const id = pendingFailure.requestId;
      void run(() => discardQueuedTransaction(id));
    }
  };
  const closeWarning = () => { if (pendingDuplicate) decide(false); };
  const queuedMessage = queuedTransactionCount
    ? `${queuedTransactionCount} transaction${queuedTransactionCount === 1 ? '' : 's'} saved on this device. ${syncing ? 'Syncing…' : 'Will sync when connected.'}`
    : '';
  return <>
    {loading || syncError || queuedMessage ? <View style={styles.banner}>
      <Text accessibilityLiveRegion="polite" style={styles.bannerText}>{syncError || queuedMessage || 'Loading your saved records…'}</Text>
      {syncError && queuedMessage ? <Text style={styles.bannerText}>{queuedMessage}</Text> : null}
      {syncError ? <GlassPill label={pending || syncing ? 'Connecting…' : 'Retry connection'} disabled={pending || syncing} onPress={() => { void run(refresh); }} /> : null}
    </View> : null}
    <SheetModal visible={Boolean(pendingDuplicate || pendingFailure)} onRequestClose={closeWarning}>
      <View style={styles.fill}>
        <ModalBackdrop onClose={closeWarning} />
        <GlassModalSheet>
          <View style={styles.handleWrap}><View style={[styles.handle, { backgroundColor: dark ? '#52525B' : '#A1A1AA' }]} /></View>
          <ScrollEdgeFade>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text style={[styles.title, { color }]}>{pendingDuplicate ? 'Transaction already exists' : 'Saved transaction needs review'}</Text>
              <Text style={{ color }}>{pendingDuplicate ? 'A transaction with the same amount, payer and group or split members is already recorded. Do you still want to continue?' : pendingFailure?.error}</Text>
              {existing ? <View style={[styles.record, { backgroundColor: dark ? '#27272A' : '#F4F4F5' }]}>
                <Text style={[styles.recordTitle, { color }]}>{existing.title}</Text>
                <Text style={{ color }}>{formatAmount(Math.abs(existing.amount))} · {existing.date}</Text>
                <Text style={{ color: muted }}>Paid by {memberName(existing.paidBy)}</Text>
                {tripName ? <Text style={{ color: muted }}>{tripName}</Text> : null}
                {existing.splits?.length ? <Text style={{ color: muted }}>Split with {existing.splits.map(split => memberName(split.friendId)).join(', ')}</Text> : null}
              </View> : null}
              {!pendingDuplicate && pendingFailure ? <Text style={{ color }}>{pendingFailure.title} is retained on this device until you cancel it.</Text> : null}
              <FormError message={error} />
              {pendingDuplicate ? <>
                <GlassPill label={pending ? 'Saving…' : 'Continue anyway'} size="lg" shape="rounded" disabled={pending} onPress={() => decide(true)} />
                <GlassPill label="Cancel" size="lg" disabled={pending} onPress={() => decide(false)} />
              </> : <GlassPill label={pending ? 'Cancelling…' : 'Cancel saved entry'} size="lg" variant="danger" disabled={pending} onPress={discardFailure} />}
            </ScrollView>
          </ScrollEdgeFade>
        </GlassModalSheet>
      </View>
    </SheetModal>
  </>;
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#18181B', gap: 8 },
  bannerText: { color: '#F4F4F5', textAlign: 'center', fontSize: 13 },
  fill: { flex: 1, justifyContent: 'flex-end' },
  handleWrap: { alignItems: 'center', paddingVertical: 6, marginBottom: 12 },
  handle: { width: 38, height: 4, borderRadius: 2 },
  content: { gap: 14, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  record: { padding: 14, borderRadius: 18, gap: 10 },
  recordTitle: { fontSize: 15, fontWeight: '500' },
});
