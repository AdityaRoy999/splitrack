import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassPill } from '../glass/GlassPill';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
import { SheetModal } from './SheetModal';
import { ModalBackdrop } from './ModalBackdrop';
import { GlassModalSheet } from './GlassModalSheet';
import { ScrollEdgeFade } from './ScrollEdgeFade';
import { SheetHeader } from './SheetHeader';

// Sync runs silently. Settings opens this review only when the user requests it.
export function CloudStatus() {
  const { pendingFailure, queueReviewRequest, discardQueuedTransaction } = useSplitTrack();
  const [dismissedRequest, setDismissedRequest] = useState(0);
  const { run, pending, error, setError } = useAsyncAction();
  const { themeMode } = useLiquidGlass();
  const dark = themeMode === 'dark';
  const color = dark ? '#F4F4F5' : '#09090B';
  const muted = dark ? '#A1A1AA' : '#71717A';
  useEffect(() => { setError(''); }, [pendingFailure?.requestId, setError]);
  const discardFailure = () => {
    if (pendingFailure && !pending) {
      const id = pendingFailure.requestId;
      void run(async () => {
        await discardQueuedTransaction(id);
        setDismissedRequest(queueReviewRequest);
      });
    }
  };
  const closeWarning = useCallback(() => { if (!pending) setDismissedRequest(queueReviewRequest); }, [pending, queueReviewRequest]);
  return <SheetModal visible={queueReviewRequest > dismissedRequest && Boolean(pendingFailure)} onRequestClose={closeWarning}>
      <View style={styles.fill}>
        <ModalBackdrop onClose={closeWarning} />
        <GlassModalSheet>
          <SheetHeader title="Saved transaction" subtitle="Review an entry that could not sync" onClose={closeWarning} disabled={pending} />
          <ScrollEdgeFade>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text style={[styles.recordTitle, { color }]}>{pendingFailure?.title}</Text>
              <Text style={{ color: muted }}>{pendingFailure?.error}</Text>
              <Text style={{ color }}>This entry is retained on this device until you discard it. Other transactions can continue syncing.</Text>
              <FormError message={error} />
              <GlassPill label={pending ? 'Discarding…' : 'Discard this entry'} size="lg" variant="danger" disabled={pending} onPress={discardFailure} />
              <GlassPill label="Close" size="lg" variant="dark" disabled={pending} onPress={closeWarning} />
            </ScrollView>
          </ScrollEdgeFade>
        </GlassModalSheet>
      </View>
    </SheetModal>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  content: { gap: 14, paddingBottom: 4 },
  recordTitle: { fontSize: 15, fontWeight: '500' },
});
