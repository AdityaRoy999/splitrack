# Frontend configuration and secret storage

The frontend's build inputs are stored in GitHub Actions repository Secrets. Both Android and iOS workflows use `secrets.*`; the former repository Variables were migrated without changing their values.

Configured names: `EXPO_PUBLIC_API_URL`, six `EXPO_PUBLIC_FIREBASE_*` values, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `GOOGLE_ANDROID_CERTIFICATE_SHA1`. The unused legacy API credential is retained privately as `LEGACY_SPLITTRACK_API_KEY` and is never injected into builds. The local Places key was empty, so no Places secret was created; configure `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` when needed.

Local development uses ignored `.env`. `src/services/firebaseConfig.ts` contains environment lookups and validation, with no literal Firebase API key. The unused local `src/config/firebase.ts`, numbered Firebase JSON/plist copies, signing keys, service-account files and build artifacts are ignored. The canonical environment-driven service remains tracked.

Firebase web app settings, OAuth client IDs, public API URLs and certificate fingerprints are public client configuration. Supplying them through GitHub Secrets keeps them out of source configuration, but cannot hide values used in a compiled mobile or web application. Privileged service-account keys, AWS credentials, admin API keys and GitHub tokens must never be injected into `EXPO_PUBLIC_*` fields.

The audit found no privileged-secret patterns in frontend source or Git history. The `.env` file was never tracked. Existing public native OAuth callback identifiers and Expo's public testing-keystore password remain unchanged so builds retain their current identity and signing behavior.

Before publishing, inspect staged paths and verify that `.env`, local Firebase copies, service accounts and signing material are ignored. Run the auth/configuration tests, TypeScript and lint checks documented in [mobile-builds.md](mobile-builds.md).
