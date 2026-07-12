# App Store Submission

This file captures the submission work that must be completed after installing full **Xcode** and deploying the backend. It must stay aligned with `Mirage_PRD_v1.0.md`, `docs/MULTI_AGENT_LAUNCH_PLAN.md`, `docs/APP_STORE_METADATA.md`, and `scripts/release_gate.mjs`.

## Archive Commands

Build for simulator:

```bash
xcodebuild \
  -project ios/Mirage/Mirage.xcodeproj \
  -scheme Mirage \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

Archive for App Store Connect:

```bash
xcodebuild \
  -project ios/Mirage/Mirage.xcodeproj \
  -scheme Mirage \
  -configuration Release \
  -archivePath build/Mirage.xcarchive \
  archive
```

Export:

```bash
xcodebuild \
  -exportArchive \
  -archivePath build/Mirage.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ios/Mirage/ExportOptions.plist
```

## App Information Draft

- Name: 图灵迷局
- Subtitle: Find the hidden AI player
- Category: Games
- Subcategory: Trivia / Word
- Age rating target: 13+ or higher. Final rating depends on selected public matching scope and topics.
- Bundle ID placeholder: `com.mirage.app`
- Login methods: Sign in with Apple is the production-ready iOS entry. Guest entry is not shown in the player-facing app.
- WeChat and Google server contracts exist, but native iOS login buttons are hidden in Release until configured.

Full zh-Hans / en-US metadata, screenshot plan, age rating draft, and stop-ship checks are maintained in `docs/APP_STORE_METADATA.md`.

## Description Draft

图灵迷局 is a text-based social deduction game where humans and AI players enter short game rooms. Chat, observe, vote, reveal identities, and review clues after each round. Every match has rules, a topic, a timer, voting, post-round safety controls, and clue review.

## Review Notes Draft

图灵迷局 is not an open random chat app. All conversations happen inside time-limited game rooms with topics, identity assignment, voting, reveal, clue review, post-round reporting, blocking, and account deletion.

Test account:

```text
Use Sign in with Apple for App Review unless WeChat and Google native SDKs have been configured for the submitted build. Guest entry is not available in the player-facing app. If App Review requires a prepared account, create a provider-backed review account before submission and list that account access here. Do not expose a guest or local preview button for review.
```

Backend:

```text
Production API URL must be set in ios/Mirage/Mirage/Release.xcconfig before archive.
```

Safety controls:

- Message filtering runs before a user message enters a room.
- Post-round reports are linked to game, room, reporter, target, and the full match context when available.
- Users can block reported users.
- Admin can process reports at `/admin`, inspect nearby message context, and ban target users from future play actions.

Privacy manifest:

- `PrivacyInfo.xcprivacy` declares Name, Email Address, User ID, Gameplay Content, Other User Content, Customer Support, and Product Interaction for App Functionality.
- Tracking is declared as false and no tracking domains are declared.
- App Store Connect privacy answers must match `docs/PRIVACY_DATA_MAP.md`, the production backend, and any future analytics, payment, or third-party SDK additions.
- Account deletion is available in Settings.
- Session token is stored in Keychain and removed after account deletion.

AI disclosure:

- Onboarding states that every room may include AI players.
- Identity reveal and clue review disclose AI identity and goal.

## Required App Store URLs

These must point to the deployed HTTPS backend or a public website:

- Privacy Policy URL: `https://your-domain.com/legal/privacy`
- Support URL: `https://your-domain.com/support`
- Community Guidelines URL: `https://your-domain.com/legal/community`

## Pre-Submission Checklist

- `node scripts/release_gate.mjs` passes locally.
- `npm run balance` passes in `server/`, proving fixed-policy gameplay checks for all implemented modes.
- `RELEASE_STRICT=1 node scripts/release_gate.mjs` passes after real App Store identifiers and API URL are configured.
- Full **Xcode** installed.
- `PRODUCT_BUNDLE_IDENTIFIER` changed from placeholder.
- `MIRAGE_API_BASE_URL` changed from placeholder to HTTPS production API.
- `ExportOptions.plist` `teamID` changed from placeholder.
- **Sign in with Apple** capability enabled in Apple Developer and Xcode.
- If WeChat login is enabled in the submitted build: WeChat Open Platform app, Universal Links, native SDK callback, and production login callback configured.
- If Google login is enabled in the submitted build: Google OAuth client, native SDK callback, and production token audience configured.
- Backend deployed with HTTPS.
- `AUTH_ALLOW_MOCK_APPLE=false`.
- `AUTH_ALLOW_MOCK_WECHAT=false`.
- `AUTH_ALLOW_MOCK_GOOGLE=false`.
- Real `APPLE_*` credentials configured.
- Real `WECHAT_*` credentials configured before enabling WeChat login in production.
- Real `GOOGLE_CLIENT_ID` configured before enabling Google login in production.
- Real `LLM_API_KEY` configured or intentional fallback documented in review notes.
- `/health`, `/legal/privacy`, `/support`, `/admin` reachable from public internet.
- TestFlight build uploaded and smoke-tested on device.
- Screenshots captured from real iPhone sizes.
- `docs/APP_STORE_METADATA.md` reviewed and updated with final production URLs, real screenshots, review notes and age rating answers.
- Privacy Nutrition Labels match actual data collection.
- Any future paid entitlement uses Apple **IAP** and does not sell gameplay advantage.

## CI

The repository includes `.github/workflows/ci.yml`.

- `backend` runs server tests and HTTP smoke.
- `ios-structure` validates plist files, the shared scheme, Swift typecheck, and an Xcode simulator build on macOS.

CI cannot replace TestFlight review, but it catches regressions before archive.
