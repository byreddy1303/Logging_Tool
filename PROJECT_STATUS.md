# AIR Journal — Project Status and Handoff

Last updated: 2026-07-22 (Asia/Kolkata)

This is the first file to read when resuming work. Update it after every release,
deployment, or material change of plan. `BUILD.md` remains the product specification;
this file records what is actually finished, what is currently in progress, and what
must happen next.

## Current repository state

- Branch: `main`
- Last pushed product-code baseline: `d23b6b3` (`S42: fix daily Telegram cron authentication`)
- `origin/main` matched local `main` before this handoff documentation was added.
- The pushed baseline includes Android/mobile production work from `a0c2568`.
- The working tree is intentionally **not clean**. Do not discard or overwrite the
  concealed-answer changes described below.

### Current verification

Run on 2026-07-22 against the current working tree:

- `npm run typecheck` — passed
- `npm run lint` — passed with zero warnings
- `npm run test -- --run` — 18 files passed, 100 tests passed

These checks do not mean the in-progress database migration has been deployed or that
the current web assets have been rebuilt into a new Android release.

## Shipped and pushed baseline

The pushed app includes the production-oriented Android/mobile pass:

- Capacitor Android app with application ID `in.airjournal.app`
- Mobile-first spacing, navigation and responsive component layouts
- Bottom navigation: Home, Log, Sessions, Journal, Planner and More
- Native back-navigation handling and haptics
- Question-first Re-attempt flow with an attempt timer
- Dashboard Due Today navigation into Re-attempts
- Overdue work rolls forward until completed
- Empty sessions are not logged and Last Session reflects a real session
- Mobile heatmap layout and overlap fixes
- Signed release APK workflow documented in `ANDROID.md`

The web app and Android wrapper share product code, but Android-only presentation and
native behavior are scoped so they do not change the desktop website layout.

## In-progress work — do not lose

There is an uncommitted private concealed-answer feature in the working tree. It adds:

- Optional `questions.answer_text` storage and TypeScript types
- Answer capture in manual Log and timed Sessions
- A shared concealed `AnswerReveal` control
- Answer reveal in Journal and Session Review
- Re-attempt answer reveal only after the attempt timer finishes
- Tests ensuring Buddy question sharing never includes the answer
- Migration: `supabase/migrations/20260722000001_question_answers.sql`

Relevant modified or new areas include `BUILD.md`, `DECISIONS.md`, question/source
draft models, `QuestionEditor`, Log, Session Active/Review, Journal, Re-attempts,
database types, tests, and the migration above.

Before calling this feature complete:

1. Review the whole diff and confirm the reveal UX on a physical Android phone.
2. Apply/test the Supabase migration in the intended environment.
3. Verify offline creation, sync, editing, logout isolation, and multi-device hydration.
4. Confirm Buddy payloads omit `answer_text` at every boundary.
5. Re-run typecheck, lint, unit tests, production web build, and Android device QA.
6. Commit and push only after the checks above pass.

## Android release artifacts

### Existing direct-install APK

- Version: `1.0.0` (`versionCode 1`)
- Path: `android/app/build/outputs/apk/release/airjournal-release.apk`
- Purpose: direct/sideload installation

### Prepared Google Play bundle

- Version: `1.0.1` (`versionCode 2`)
- Path: `android/app/build/outputs/bundle/release/app-release.aab`
- Size when verified: approximately 1.9 MB
- Build task: signed `bundleRelease`
- Signature check: `jarsigner -verify` passed on 2026-07-22
- Purpose: Google Play Internal Testing; an AAB cannot be installed directly like an APK

The 1.0.1 AAB was produced from the currently synced native assets. The concealed-answer
working-tree changes have **not** been declared part of that Play build. Rebuild with a
higher version code after those changes are finalized and synced.

### Signing safety

- Upload keystore is outside the Git repository under the workspace `release/` folder.
- Signing credentials are in ignored `android/keystore.properties`.
- Never print, copy into documentation, or commit passwords, aliases, `.env` files,
  keystores, or `keystore.properties`.
- Back up the keystore and credentials securely before making a Play App Signing choice.

## Google Play Internal Testing — current plan

Goal: the friend installs AIR Journal once from the Play testing link and later receives
updates through Google Play instead of downloading a new APK each time.

Current state:

- Signed 1.0.1 AAB is ready.
- Play Console setup/upload has not started.
- Browser automation is blocked because the ChatGPT Chrome Extension is not installed
  in the active Chrome profile. The user approved opening its official Chrome Web Store
  page; installation still needs to be completed by the user.
- The friend's Google account email is still needed when configuring the tester list.

Next Play steps:

1. Install/enable the ChatGPT Chrome Extension in the active Chrome profile and reconnect.
2. Open Google Play Console with the developer account.
3. If developer registration, payment, identity verification, or legal acceptance is
   required, hand control to the user. Do not accept or pay automatically.
4. Create `AIR Journal` as an Android app using package `in.airjournal.app`.
5. Configure **Internal testing only**; do not publish to Production.
6. Pause at Play App Signing. Decide whether to import the existing signing key or let
   Play generate a new app-signing key. This choice is long-lived and affects whether
   the currently sideloaded APK can be updated in place.
7. Upload the signed AAB, add tester Gmail addresses, create the release, and share the
   opt-in link.
8. Verify install, sign-in, cloud sync, navigation, timers, haptics and back behavior on
   a physical phone.

If Play uses a different app-signing key from the sideloaded APK, the friend will need to
uninstall the sideloaded build once and install the Play build. Confirm cloud sync/export
before uninstalling so local-only data is not lost.

## Future Android update workflow

For each Play update:

1. Finish and verify the source changes.
2. Run `npm run typecheck`, `npm run lint`, `npm run test -- --run`, and the production build.
3. Sync the latest web assets into Capacitor Android.
4. Increment `versionCode` above every previously uploaded code. Since code 2 is already
   prepared, the next Play bundle should use at least code 3.
5. Build a signed release AAB.
6. Upload it to the Internal testing track and roll it out to testers.

Google Play then distributes the update; testers with Play auto-update enabled normally
receive it automatically.

## Resume checklist

At the start of the next session:

```bash
cd "/Users/bkalyankrishnareddy/Desktop/GATE PREP/air-journal"
git status --short --branch
git log -3 --oneline --decorate
```

Then read, in order:

1. `PROJECT_STATUS.md`
2. `AGENTS.md`
3. `BUILD.md`
4. `ANDROID.md` for release work
5. `DECISIONS.md` for product tradeoffs

Preserve unrelated working-tree changes and never use destructive Git commands to make
the repository look clean.
