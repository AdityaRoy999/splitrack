# Firebase and AWS integration

The app authenticates through Firebase Email/Password and reads real data from the existing AWS SplitTrack API. Public Firebase values are in ignored `.env`; use `.env.example` for another checkout. Firebase passwords/refresh tokens are not sent to AWS. Native sessions use encrypted SecureStore; web uses Firebase browser persistence.

The existing `splittrack-backend` stack in `ap-south-1` contains the API, tables and private media bucket. Backend source is in the separate, ignored `AWS-SplitTrack` Git repository. Its README and frontend/backend mapping document the API and deployment procedure.

## App behavior

- New users have no sample payment profiles, members, trips or transactions. Nine starting expense categories are configuration.
- Signup, login, password reset, username onboarding, photos and signout use Firebase and the authenticated AWS profile API.
- Member search uses registered profiles by name/username prefix. Display names may repeat; usernames are unique. Emails and account lists remain private.
- Expenses, statement imports, payment profiles, categories, trip membership, partial settlements and preferences save through typed endpoints. Financial totals and analytics come from the server.
- UPI QRs include the receiving UPI ID and debt amount. Users confirm payment in their UPI app; marking it paid is a user-confirmed ledger action, not a bank-verified receipt.
- Removing members preserves their historical debts. A fresh ledger hides old private history by generation, while retaining existing AWS records and the registered profile.
- Snapshots are scoped to Firebase UID and cleared at signout. Four legacy demo/session keys are discarded. Tab changes use loaded data; startup, foregrounding and periodic refresh synchronize AWS. Expanded ledger pages are revalidated during refresh.
- Active forms retain their submitted draft and request ID when retrying uncertain saves. There is no offline financial-write queue or draft recovery across relaunches; inspect the ledger before manually reentering an uncertain save after relaunching.

## Build configuration and verification

The mobile GitHub workflows receive seven public API/Firebase settings through repository variables and the optional Places key through a secret. AWS/Firebase admin credentials remain outside mobile bundles. Google sign-in is unavailable until mobile Firebase registrations and OAuth configuration are provided; email/password is enabled now.

Both mobile workflows build on pushes to `main` and support manual dispatch. Each verifies the required public configuration before building. iOS publishes the unsigned SideStore IPA and updates its feed; Android publishes a signed testing APK with an increasing version code and verifies its signature. Feed-only commits from the GitHub Actions bot do not start another mobile build.

Run `npx expo lint` and `npx tsc --noEmit`, then export the web/iOS JavaScript bundles. Backend checks use `npm run validate` in `AWS-SplitTrack/backend/`. Live checks use temporary users and remove only their test records/media. Device rendering, native persistence and UPI handoff require testing the built IPA/APK; browser checks and JavaScript exports do not prove native frame rates.
