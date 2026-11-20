# Android Google sign-in

Android uses `src/services/googleAuth.android.ts`; iOS uses `src/services/googleAuth.native.ts`. Both supply Google's ID token to Firebase `signInWithCredential`, which creates the user on first sign-in. The retired AWS `/auth/google` and `/auth/signup` endpoints are not part of this flow.

Both mobile platforms read all six Firebase client values from ignored local `.env` or GitHub Actions Secrets. The local `.env` has been populated with the current web app configuration. Missing or partial values fail clearly instead of mixing projects. The shared config does not initialize Firebase Auth eagerly, so the existing encrypted native auth persistence remains in control. Firebase web API keys and OAuth IDs are public client settings and remain visible in built applications even when supplied through Secrets.

The latest supplied `Access/google-services (6).json`, checked on 20 November 2026, registers `com.AdiSai.fintrack` in `fintrack-b7e9d` and contains the same web OAuth client (`client_type: 3`). It still contains no Android OAuth client (`client_type: 1`) or certificate hash. Verification against the measured published APK signer returns `registered: false`; the file does not establish that the required Android package/certificate pair is registered. This missing configuration can cause Google's Android `DEVELOPER_ERROR` (code 10).

The change from file `(5)` to `(6)` fixes its cross-platform iOS OAuth reference: it now uses `com.AdiSai.fintrack` and client `828945864022-hg0dlg1ghp116ft9j3dg96a2r1jn9aih.apps.googleusercontent.com`. That agrees with the supplied iOS plist, existing native callback scheme, and app configuration. The runtime identifiers therefore already match the newer file and need no replacement.

This app uses the **Firebase JS SDK** initialized with its Firebase **web app** configuration, plus native Google sign-in to obtain the ID token. `GoogleSignin.configure` receives explicit web/iOS client IDs. This flow does not load `google-services.json` or `GoogleService-Info.plist` at runtime and does not use React Native Firebase. Adding native Firebase configuration files or swapping the Firebase JS app ID for the Android/iOS native app ID would not create the missing OAuth registration. The supplied files are checked as registration evidence.

To complete the Google configuration:

1. Use the already measured [published APK certificate](android-signing-certificate.md): SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. The Android GitHub workflow adds the actual signing certificate SHA-1 and SHA-256 to every new build summary and artifact. It currently uses Expo's generated `android/app/debug.keystore`; recheck the new APK's printed certificate if the template or signing configuration changes.
2. In Firebase Project settings, select the Android app with package `com.AdiSai.fintrack`, then add that APK's SHA-1 (and SHA-256). Firebase/Google Cloud must have an Android OAuth client for that exact package and certificate pair. For Play Store distribution, also register the Play App Signing certificate.
3. In Firebase Authentication > Sign-in method, enable Google and choose the support email. Download the updated `google-services.json` and verify that it includes the matching Android `oauth_client` and the web client.
4. Keep `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` as the **web** client ID from that same Firebase project, not its Android client ID. All Firebase public build variables and the backend Firebase project must refer to the same project.

Optional `GOOGLE_ANDROID_CERTIFICATE_SHA1` in GitHub repository secrets guards future Android builds against unexpectedly changing the registered signer. Its absence does not block existing builds or prove registration. The workflow publishes certificate diagnostics either way.

For a local registration check, save the output of `apksigner verify --print-certs Splittrack-release.apk`, load the Firebase build environment, then run:

```powershell
node scripts/verify-android-google.mjs artifacts/android-signing-certificate.txt path/to/google-services.json
node --test scripts/verify-android-google.test.mjs
```

Google sign-in requires a native Android build containing `RNGoogleSignin` and updated Google Play services. Expo Go cannot supply this native module. Local source validation does not confirm that Firebase provider settings or certificate registrations have been applied. See [Android and iOS build steps](mobile-builds.md) for the existing GitHub workflows.

## iOS Google registration

The supplied `Access/GoogleService-Info (1).plist` and the latest `(6)` Android export now both match `com.AdiSai.fintrack`, the configured iOS client ID, and its reversed URL scheme in `app.json`. The registration verifier returns `iosRegistered: true` for that cross-platform reference; this confirms file consistency, not provider enablement or a successful device sign-in. The native iOS service uses `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` when supplied and checks that its callback scheme agrees with `googleAuthConfig.ts`. Changing the iOS registration requires updating the iOS client ID and native Google plugin URL scheme together and rebuilding the app. The web OAuth client must remain from the same Firebase project.

The iOS Google credential signs up through Firebase, with the same enabled Google provider required above. Native builds are required on iOS too. If an installation tool changes the app's bundle identifier, that identifier must have its own matching iOS OAuth registration; the supplied client is for `com.AdiSai.fintrack`.

Run `node --test scripts/android-google-auth.test.mjs` for both mobile credential paths, environment configuration, cancellation, callback consistency, and disabled-provider handling. The iOS workflow runs these auth checks without modifying its design or rendering components.
