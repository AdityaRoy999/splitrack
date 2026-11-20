import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { authenticationError } from '../../auth/authErrors';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { FormError, useAsyncAction } from '../../hooks/useAsyncAction';
import { SheetModal } from '../common/SheetModal';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { GlassModalSheet } from '../common/GlassModalSheet';
import { GlassPill } from '../glass/GlassPill';

// A failed optional link must remain reviewable after password sign-in opens
// the existing ledger. Settings handles its own explicit linking dialog.
export function GoogleLinkRecovery({ blocked = false }: { blocked?: boolean }) {
  const { googleLinkRecoveryRequired, googleLinkError, pendingGoogleLink, linkGoogle, cancelGoogleLink } = useAuth();
  const { themeMode } = useLiquidGlass();
  const { pendingDuplicate, pendingFailure } = useSplitTrack();
  const { run, pending, error, setError } = useAsyncAction();
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const dark = themeMode === 'dark', color = dark ? '#F4F4F5' : '#09090B', muted = dark ? '#A1A1AA' : '#71717A';
  const needsPassword = passwordRequired || pendingGoogleLink?.status === 'reauthentication-required';
  const cancel = () => {
    if (pending) return;
    cancelGoogleLink(); setPassword(''); setPasswordRequired(false); setError('');
  };
  const retry = () => {
    if (needsPassword) setPasswordRequired(true);
    if (needsPassword && !password) { setError('Enter your current password.'); return; }
    void run(async () => {
      try { if (await linkGoogle(needsPassword ? password : undefined)) { setPassword(''); setPasswordRequired(false); } }
      catch (failure) { throw new Error(authenticationError(failure)); }
    });
  };
  return <SheetModal visible={googleLinkRecoveryRequired && !blocked && !pendingDuplicate && !pendingFailure} onRequestClose={cancel}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <ModalBackdrop onClose={cancel} />
      <GlassModalSheet>
        <View style={{ alignItems: 'center', paddingVertical: 6, marginBottom: 12 }}><View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: dark ? '#52525B' : '#A1A1AA' }} /></View>
        <Text style={{ color, fontSize: 22, fontWeight: '600', marginBottom: 14 }}>Google sync needs attention</Text>
        <Text style={{ color: muted, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>You are signed in to your existing account. Google could not be synced yet. You can retry or continue using your password.</Text>
        {needsPassword ? <TextInput accessibilityLabel="Current password for Google sync" value={password} onChangeText={setPassword}
          placeholder="Current password" placeholderTextColor={muted} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!pending}
          style={{ backgroundColor: dark ? '#27272A' : '#F4F4F5', color, fontSize: 14, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, marginBottom: 12 }} /> : null}
        <FormError message={error || googleLinkError} />
        <View style={{ gap: 12 }}>
          <GlassPill label={pending ? 'Syncing…' : 'Retry Google sync'} size="lg" shape="rounded" variant="accent" disabled={pending} onPress={retry} />
          <GlassPill label="Continue with password" size="lg" disabled={pending} onPress={cancel} />
        </View>
      </GlassModalSheet>
    </View>
  </SheetModal>;
}
