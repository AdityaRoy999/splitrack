import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const fingerprint = value => String(value || '').replace(/[:\s]/g, '').toUpperCase();

export function verifyAndroidGoogle({ certificateOutput, packageName, projectId, projectNumber, webClientId, expectedSha1, registration, iosClientId, iosBundleId, iosUrlScheme }) {
  const sha1 = fingerprint(certificateOutput.match(/Signer #1 certificate SHA-1 digest:\s*([a-f\d]+)/i)?.[1]);
  const sha256 = fingerprint(certificateOutput.match(/Signer #1 certificate SHA-256 digest:\s*([a-f\d]+)/i)?.[1]);
  if (!/^[A-F\d]{40}$/.test(sha1) || !/^[A-F\d]{64}$/.test(sha256)) {
    throw new Error('Could not read the APK signing certificate from apksigner --print-certs.');
  }
  if (webClientId && (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId) ||
      (projectNumber && !webClientId.startsWith(`${projectNumber}-`)))) {
    throw new Error('Android Google web OAuth client must belong to the configured Firebase project number.');
  }
  if (iosClientId && (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(iosClientId) ||
      (projectNumber && !iosClientId.startsWith(`${projectNumber}-`)))) {
    throw new Error('iOS Google OAuth client must belong to the configured Firebase project number.');
  }
  if (iosClientId && iosUrlScheme && iosClientId.split('.').reverse().join('.') !== iosUrlScheme) {
    throw new Error('iOS Google client and native callback URL scheme differ. Update them together before building.');
  }
  if (expectedSha1) {
    if (!/^[A-F\d]{40}$/.test(fingerprint(expectedSha1))) throw new Error('GOOGLE_ANDROID_CERTIFICATE_SHA1 must be a SHA-1 fingerprint.');
    if (fingerprint(expectedSha1) !== sha1) throw new Error('APK signer differs from GOOGLE_ANDROID_CERTIFICATE_SHA1. Register this certificate before distributing the APK.');
  }
  let registered, iosRegistered;
  if (registration) {
    if (registration.project_info?.project_id !== projectId) throw new Error('Android registration belongs to a different Firebase project.');
    if (projectNumber && registration.project_info?.project_number !== projectNumber) throw new Error('Android registration belongs to a different Firebase project number.');
    const client = registration.client?.find(item => item.client_info?.android_client_info?.package_name === packageName);
    if (!client) throw new Error('Firebase registration does not include the Android package name.');
    if (webClientId && !client.oauth_client?.some(item => item.client_type === 3 && item.client_id === webClientId)) {
      throw new Error('Google web client ID differs from the supplied Firebase registration.');
    }
    const androidClients = client.oauth_client?.filter(item => item.client_type === 1) || [];
    registered = androidClients.some(item => item.android_info?.package_name === packageName && fingerprint(item.android_info?.certificate_hash) === sha1);
    if (androidClients.length && !registered) throw new Error('APK certificate is absent from the supplied Android OAuth registrations.');
    if (iosClientId) {
      const iosClients = client.services?.appinvite_service?.other_platform_oauth_client?.filter(item => item.client_type === 2) || [];
      iosRegistered = iosClients.some(item => item.client_id === iosClientId && item.ios_info?.bundle_id === (iosBundleId || packageName));
      if (iosClients.length && !iosRegistered) throw new Error('iOS OAuth reference differs from the app bundle identifier or native callback client.');
    }
  }
  return { packageName, projectId, sha1, sha256, registered, iosRegistered };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const publicConfig = readFileSync(new URL('../src/constants/googleAuthConfig.ts', import.meta.url), 'utf8');
  const configured = name => publicConfig.match(new RegExp(`${name}:\\s*['"]([^'"]+)['"]`))?.[1];
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || configured('webClientId');
  const registration = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : undefined;
  const result = verifyAndroidGoogle({
    certificateOutput: readFileSync(process.argv[2], 'utf8'),
    packageName: config.expo.android.package,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() || configured('projectId'),
    projectNumber: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || webClientId?.split('-')[0],
    webClientId,
    expectedSha1: process.env.GOOGLE_ANDROID_CERTIFICATE_SHA1,
    registration,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || configured('iosClientId'),
    iosBundleId: config.expo.ios.bundleIdentifier,
    iosUrlScheme: config.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin')?.[1]?.iosUrlScheme,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.registered !== true) console.log('Register this package and SHA-1 in Firebase Project settings, enable Google in Authentication, and download the updated Android registration. A web OAuth client alone cannot authenticate Android APKs.');
}
