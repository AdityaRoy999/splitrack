# Android Google sign-in certificate

Verified on 20 November 2026 against the published [Android build 30 APK](https://github.com/AdityaRoy999/splitrack/releases/download/splittrack-android-30/Splittrack-release.apk), downloaded from this frontend repository's Git remote. `apksigner verify --print-certs` passed, and `aapt dump badging` confirmed package `com.AdiSai.fintrack`, version `1.0.30`, version code `31`.

Register these **signing certificate** fingerprints in Firebase project **`fintrack-b7e9d`**, Android app **`com.AdiSai.fintrack`**:

| Fingerprint | Value |
| --- | --- |
| SHA-1 | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| SHA-256 | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

The APK's signer is `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`. Its certificate matches the actual `debug.keystore` inside the installed Expo **58.0.26** `template.tgz`, inspected using `keytool`. The generated Gradle template signs both debug and release builds using that key. The checked-in Android CI workflow also reuses it when explicitly signing an unsigned APK. These hashes therefore apply to the currently published APK and this workflow's current Expo template; they are not guesses based on a universal Android debug certificate.

The downloaded APK itself has SHA-256 `d63584f01377bfa41a40b92c42665e695b05683f8ebfde093da0c468cded51b2`, matching GitHub's release asset digest. **This file digest is not the certificate fingerprint to enter in Firebase.** No APK or private keystore was added to the repository.

## Register in Firebase

1. Open [Firebase Console](https://console.firebase.google.com/project/fintrack-b7e9d/settings/general) and select **fintrack-b7e9d**.
2. In **Project settings → General → Your apps**, select the Android app with package **com.AdiSai.fintrack**. The supplied registration's app ID is `1:828945864022:android:fec98ee949bfe4c91ab2f7`. If no matching Android app exists, add one using that exact package name.
3. Under **SHA certificate fingerprints**, select **Add fingerprint**, paste the SHA-1 above, and save. Add the SHA-256 above separately and save.
4. Open **Authentication → Sign-in method → Google**, enable the provider, select the project's support email, and save. Keep **Email/Password** enabled for the existing email flow.
5. Download a fresh `google-services.json` from the Android app's settings. Keep it local. The latest supplied `Access/google-services (6).json`, checked on 20 November 2026, still contains the Web OAuth client only in its main `oauth_client` list; it contains no Android OAuth client or certificate hash. It corrects the iOS cross-platform reference to `com.AdiSai.fintrack`, which already matches the app. Verification against the measured signer returns `registered: false` and `iosRegistered: true`. The updated file must include an Android OAuth client for this package and SHA-1 to verify Android registration.
6. In the frontend GitHub repository's **Settings → Secrets and variables → Actions → Secrets**, set `GOOGLE_ANDROID_CERTIFICATE_SHA1` to the SHA-1 above. Keep `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set to `828945864022-36o5gde55kaebrg6d13vkkeq5ibpg7cp.apps.googleusercontent.com`, the Web client from this same Firebase project. Do not substitute an Android OAuth client ID for that Web client ID.
7. Test **Continue with Google** on a physical Android device or a Google Play-enabled emulator using a native APK. Check that a new Google account reaches username onboarding and an existing account opens its ledger.

Firebase registration is an account-side change. The source fixes and these measured hashes do not establish that the console settings have already been updated.

The native JSON's API key and Android app ID are not substituted into the app's existing Firebase JS **web app** configuration. This project explicitly configures native Google OAuth and exchanges its ID token through Firebase JS. The registration files do not need to be bundled for that implementation. See [mobile build steps](mobile-builds.md).

## Verify future builds

The Android workflow now prints the actual APK signer and uploads `android-signing-certificate.txt` with the APK. Its verifier checks the signer against `GOOGLE_ANDROID_CERTIFICATE_SHA1` when that variable is set. Recheck the printed hashes if signing configuration or the Expo template changes. A future EAS release key or Google Play App Signing certificate has its own fingerprints and must also be registered before distributing APKs signed by it.

For a local APK with Android build tools installed:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs 'C:\absolute\path\Splittrack-release.apk'
```

Use the available build-tools version on your machine. To validate a new downloaded Firebase registration against the actual signer output:

```powershell
node scripts/verify-android-google.mjs 'C:\absolute\path\android-signing-certificate.txt' 'C:\absolute\path\google-services.json'
```

Reference: [Firebase Android Google sign-in setup](https://firebase.google.com/docs/auth/android/google-signin).
