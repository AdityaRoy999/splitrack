import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import * as Application from 'expo-application';
import { updatePolicy, PublicRelease } from '../../services/updatePolicy';
const manifest = process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL ?? '';
export function ReleaseUpdate() {
  const [release, setRelease] = useState<PublicRelease | null>(null), [forced, setForced] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const checked = useRef(0), dismissed = useRef(0), dark = useColorScheme() === 'dark';
  useEffect(() => {
    let controller: AbortController | undefined;
    async function check() {
      if (Platform.OS !== 'android') return;
      if (Date.now() - checked.current < 300000 || !/^https:\/\/[a-z0-9]+\.cloudfront\.net\/version\.json$/.test(manifest)) return;
      checked.current = Date.now(); controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const r = await fetch(manifest, { signal: controller.signal }); if (!r.ok) return;
        const policy = updatePolicy(await r.json(), Platform.OS, Number(Application.nativeBuildVersion));
        if (policy && (policy.forced || dismissed.current !== policy.release.latest_build)) { setRelease(policy.release); setForced(policy.forced); }
      } catch { /* Public update checks never interrupt normal offline startup. */ }
      finally { clearTimeout(timeout); }
    }
    void check(); const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { controller?.abort(); subscription.remove(); };
  }, []);
  async function update() {
    if (!release) return; setError(''); setBusy(true);
    try {
      if (Platform.OS === 'ios') {
        const source = release.sidestore_source_url;
        if (!source || new URL(source).origin !== new URL(manifest).origin) throw new Error('The SideStore source is unavailable.');
        await Linking.openURL(`sidestore://source?url=${encodeURIComponent(source)}`);
      } else {
        if (!NativeModules.SplitTrackUpdater) throw new Error('Install a build with the native updater to continue.');
        await NativeModules.SplitTrackUpdater.downloadAndInstall(release.download_url, release.sha256, release.size ?? 0);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'The update could not be opened. Please try again.'); }
    finally { setBusy(false); }
  }
  const fg = dark ? '#f4f4f5' : '#18181b', muted = dark ? '#a1a1aa' : '#71717a';
  return <Modal transparent visible={Boolean(release)} animationType="fade" onRequestClose={() => { if (!forced && !busy) setRelease(null); }}><View style={styles.overlay}><View style={[styles.panel, { backgroundColor: dark ? '#1b1b1e' : '#fff' }]}><ScrollView><Text style={[styles.title, { color: fg }]}>SplitTrack {release?.version_name}</Text><Text style={[styles.note, { color: muted }]}>{forced ? 'This update is required to continue.' : 'A new update is ready.'}</Text><Text style={[styles.label, { color: fg }]}>Problem</Text><Text style={[styles.body, { color: muted }]}>{release?.changelog.problem}</Text><Text style={[styles.label, { color: fg }]}>Action taken</Text><Text style={[styles.body, { color: muted }]}>{release?.changelog.action_taken}</Text>{Platform.OS === 'ios' && <Text style={[styles.note, { color: muted }]}>SideStore installs and re-signs the app with your Apple ID. Add the source once and keep SideStore installed.</Text>}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} style={[styles.update, { backgroundColor: fg, opacity: busy ? .5 : 1 }]} onPress={() => void update()}><Text style={{ color: dark ? '#18181b' : '#fff', fontWeight: '600' }}>{busy ? 'Preparing update…' : Platform.OS === 'ios' ? 'Open in SideStore' : 'Download & install'}</Text></Pressable>{!forced && <Pressable accessibilityRole="button" disabled={busy} style={styles.later} onPress={() => { dismissed.current = release?.latest_build ?? 0; setRelease(null); }}><Text style={{ color: muted }}>Later</Text></Pressable>}</ScrollView></View></View></Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 28 }, panel: { padding: 25, borderRadius: 20, maxHeight: '85%' }, title: { fontSize: 23, fontWeight: '600' }, note: { fontSize: 12, lineHeight: 19, marginTop: 12 }, label: { marginTop: 24, fontSize: 13, fontWeight: '600' }, body: { marginTop: 7, fontSize: 13, lineHeight: 21 }, update: { padding: 16, borderRadius: 11, alignItems: 'center', marginTop: 26 }, later: { padding: 16, alignItems: 'center' }, error: { color: '#db7777', fontSize: 12, lineHeight: 19, marginTop: 20 } });
