const { withAndroidManifest, withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = function withSplitTrackUpdater(config) {
  const pkg = config.android.package;
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] ??= [];
    if (!manifest['uses-permission'].some(x => x.$['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES')) manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' } });
    const app = manifest.application[0]; app.provider ??= [];
    app.receiver ??= [];
    if (!app.receiver.some(x => x.$['android:name'] === `${pkg}.SplitTrackInstallReceiver`)) app.receiver.push({ $: { 'android:name': `${pkg}.SplitTrackInstallReceiver`, 'android:exported': 'false' } });
    if (!app.provider.some(x => x.$['android:authorities'] === `${pkg}.updates`)) app.provider.push({ $: { 'android:name': 'androidx.core.content.FileProvider', 'android:authorities': `${pkg}.updates`, 'android:exported': 'false', 'android:grantUriPermissions': 'true' }, 'meta-data': [{ $: { 'android:name': 'android.support.FILE_PROVIDER_PATHS', 'android:resource': '@xml/splittrack_update_paths' } }] });
    return mod;
  });
  config = withMainApplication(config, mod => {
    if (!mod.modResults.contents.includes('SplitTrackUpdatePackage()')) {
      if (mod.modResults.language !== 'kt' || !mod.modResults.contents.includes('.packages.apply {')) throw new Error('Review the Android MainApplication template before registering SplitTrackUpdater.');
      mod.modResults.contents = mod.modResults.contents.replace('.packages.apply {', '.packages.apply {\n              add(SplitTrackUpdatePackage())');
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const java = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
    const xml = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(java, { recursive: true }); await fs.mkdir(xml, { recursive: true });
    await fs.writeFile(path.join(xml, 'splittrack_update_paths.xml'), '<paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="updates" path="splittrack-updates/"/></paths>');
    for (const name of ['SplitTrackUpdater.java', 'SplitTrackUpdatePackage.java', 'SplitTrackInstallReceiver.java']) await fs.writeFile(path.join(java, name), (await fs.readFile(path.join(__dirname, 'native', name), 'utf8')).replaceAll('__PACKAGE__', pkg));
    return mod;
  }]);
};
