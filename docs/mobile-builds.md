# Android and iOS builds

Build from the separate **frontend** repository (`AdityaRoy999/splitrack`), checked out here at `C:\projects\AWS-SplitTrack\frontend`. The AWS backend remains in `C:\projects\AWS-SplitTrack\backend` and is deployed separately using the backend repository's README. Deploy the matching backend changes before testing offline replay and duplicate confirmation against the production API.

The existing GitHub workflows build native Android APKs and unsigned iOS IPAs. They do not require an Expo Build/EAS account. Both workflows also publish a GitHub release after a successful build; the iOS workflow updates `apps.json` for the existing SideStore feed. Run them when those outputs are intended. They also run automatically after pushing to `main`.

## Configure the frontend repository

In GitHub **Settings → Secrets and variables → Actions → Secrets**, configure the values below. The workflows validate the API URL and all six Firebase values before installing dependencies. Local runtime code reads the same fields from ignored `.env`.

| Variable | Value/source |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | `https://e3kt7e3dag.execute-api.ap-south-1.amazonaws.com` |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Copy `apiKey` from Firebase Project settings → your Web app configuration (also available in ignored local `.env`). |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `fintrack-b7e9d.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `fintrack-b7e9d` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `fintrack-b7e9d.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `828945864022` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `1:828945864022:web:8e9329bf0e0207d11ab2f7` — keep the **web** app ID for Firebase JS on both platforms. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `828945864022-36o5gde55kaebrg6d13vkkeq5ibpg7cp.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `828945864022-hg0dlg1ghp116ft9j3dg96a2r1jn9aih.apps.googleusercontent.com` |
| `GOOGLE_ANDROID_CERTIFICATE_SHA1` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`; guards the current APK signer. |

These Firebase/OAuth identifiers are public app configuration. If place autocomplete is needed, the existing workflows read optional `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` from **Actions Secrets**; use a restricted Google Cloud key. Google sign-in does not require that Places key.

The latest supplied `Access/google-services (6).json` corrects its iOS reference and agrees with these client IDs. Its Android OAuth certificate entry is still absent. Complete the [measured certificate registration](android-signing-certificate.md) and enable Google in Firebase Authentication before expecting Android Google sign-in to work. The matching iOS file/client cannot establish provider enablement either. Existing Email/Password sign-in must also remain enabled.

This implementation uses Firebase JS plus an explicitly configured native Google token provider. Neither build currently requires copying the native Firebase JSON/plist into the frontend. Do not add React Native Firebase packages or replace the web Firebase app ID with a native ID for this setup.

In Firebase Authentication settings, keep **One account per email address** enabled. Password users should sign in, open **Settings → Sync with Google**, and select their matching Google account. Linking preserves the same Firebase UID, ledger and password provider. Test repeat-email signup choices, cancelled linking, and subsequent Continue with Google login before distribution.

## Validate source before building

From `C:\projects\AWS-SplitTrack\frontend` with Node 22 or newer:

```powershell
npm ci
node scripts/validate-build-env.mjs
node --test scripts/*.test.mjs
npx tsc --noEmit
npm run lint
```

`validate-build-env.mjs` reads process environment variables. Set the values from the table in the terminal if running that script locally; an Expo `.env` file alone is not automatically loaded by a plain `node` invocation. GitHub injects the Actions secrets into the workflows.

## Build Android

1. Commit the updated frontend code to the frontend repository and make it available on the chosen build branch.
2. In GitHub **Actions**, open **Build Android APK**, choose **Run workflow**, and select that branch. A push to `main` triggers the same workflow automatically.
3. After success, download artifact **Splittrack-android-apk**. It contains `Splittrack-release.apk` and `android-signing-certificate.txt`. The release asset is also named `Splittrack-release.apk`.
4. Compare the signer in the artifact/build summary with the registered SHA-1 above. The configured `GOOGLE_ANDROID_CERTIFICATE_SHA1` makes a signer mismatch fail the workflow. Register another signer if intentionally changing it.
5. Install the APK on a physical Android device or Google Play-enabled emulator. Test new and returning Google accounts, then save an offline expense/payment receipt, reopen the app offline, reconnect, and verify one backend record. Check duplicate Continue/Cancel as well.

The workflow generates Android with Expo Prebuild, builds `assembleRelease`, verifies the APK and native GL callbacks, and signs with its existing generated Expo testing key. Use the certificate printed for the actual APK; a later Play App Signing or release keystore requires its own registration.

## Build iOS

1. In GitHub **Actions**, open **Build Unsigned iOS IPA**, choose **Run workflow**, and select the frontend branch. A push to `main` triggers it automatically.
2. Wait for Expo Prebuild, CocoaPods, and the Xcode Release build on GitHub's macOS runner. After success, download artifact **Splittrack-unsigned-ipa** or `Splittrack-unsigned.ipa` from the generated release.
3. Sign the unsigned IPA using the existing SideStore/AltStore installation process or another appropriate signing method before installing it. An unsigned IPA cannot be installed directly or submitted to the App Store.
4. Confirm the installed app's actual bundle ID remains `com.AdiSai.fintrack`, matching the supplied iOS OAuth registration. If the signing/installation tool changes it, that resulting bundle ID needs a matching iOS Google client and native callback configuration.
5. Test new and returning Google accounts and the same offline/reconnect/duplicate cases on the signed app.

Native Google sign-in is included through the existing Google config plugin with callback scheme `com.googleusercontent.apps.828945864022-hg0dlg1ghp116ft9j3dg96a2r1jn9aih`. Google sign-in needs a rebuilt native app on both platforms; Expo Go does not contain this native module.

References: [Expo Google authentication](https://docs.expo.dev/guides/google-authentication/), [Firebase JS configuration](https://docs.expo.dev/guides/using-firebase/#using-firebase-js-sdk).
