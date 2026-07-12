# 图灵迷局 Deployment

This document describes the minimum backend deployment needed before TestFlight or App Store review.

## Requirements

- HTTPS public domain, for example `https://api.your-domain.com`.
- **PostgreSQL** database for production runtime state. SQLite is only for single-instance validation.
- Strong `SESSION_SECRET`.
- Strong `ADMIN_TOKEN`.
- Optional strong `ADMIN_READONLY_TOKEN` for operators who only need dashboards, report context and CSV exports.
- Apple Developer identifiers and private key for **Sign in with Apple** token exchange and revoke.
- Google OAuth client ID for Google login token verification.
- WeChat Open Platform App ID and secret for WeChat login code exchange.
- **LLM** provider key for AI player responses. The server uses an OpenAI-compatible `chat/completions` endpoint.
- `CORS_ALLOWED_ORIGINS` configured to the deployed admin/support origins.
- `REQUEST_BODY_LIMIT_BYTES` kept small enough for text-only game actions.
- Rate limits configured for auth, matchmaking, rooms, messages, game actions, and reports.
- Logs and backups enabled by the hosting provider.

## Docker

The Docker image runs the Node server as the non-root `node` user, creates `/data` for mounted persistence, and includes a container `HEALTHCHECK` against `/health`.

Build:

```bash
docker build -t mirage-server .
```

Run:

```bash
docker run --rm \
  -p 8787:8787 \
  --env-file server/.env \
  -v mirage-data:/data \
  mirage-server
```

Health check:

```bash
curl https://api.your-domain.com/health
```

Readiness check:

```bash
curl https://api.your-domain.com/ready
```

The `/ready` response includes `store` and `ai` status. Before TestFlight, verify `store` is `postgres` and `ai.configured` is `true` unless scripted fallback is intentionally documented for review.

Deployment verifier:

```bash
cd server
MIRAGE_PRODUCTION_BASE_URL=https://api.your-domain.com \
MIRAGE_VERIFY_ADMIN_TOKEN=$ADMIN_TOKEN \
MIRAGE_VERIFY_ADMIN_READONLY_TOKEN=$ADMIN_READONLY_TOKEN \
npm run verify:production
```

The verifier checks HTTPS, `/health`, `/ready`, `store=postgres`, AI readiness, report alert readiness, legal/support pages, and `/admin/metrics` when an admin token is provided. When `MIRAGE_VERIFY_ADMIN_READONLY_TOKEN` is provided, it also checks `/admin/session`, readonly `/admin/metrics`, and confirms a mutating admin endpoint returns `403`.

Admin metrics:

```bash
curl -H "X-Admin-Token: $ADMIN_TOKEN" https://api.your-domain.com/admin/metrics
```

Read-only admin access:

```bash
curl -H "X-Admin-Token: $ADMIN_READONLY_TOKEN" https://api.your-domain.com/admin/metrics
```

`ADMIN_READONLY_TOKEN` can call `GET /admin/*` endpoints only. Report updates, batch handling, user bans and topic changes still require `ADMIN_TOKEN`.

Local smoke before deployment:

```bash
cd server
npm run smoke
```

Local multi-client weak-network stress before TestFlight:

```bash
cd server
npm run stress
```

The stress script starts an in-memory server, applies deterministic weak-network jitter, and verifies concurrent public matchmaking, friend-room join/ready/start, discussion, final statements, voting, replay, and rematch race convergence.

Release gate before TestFlight:

```bash
node scripts/release_gate.mjs
RELEASE_STRICT=1 node scripts/release_gate.mjs
```

Minimum production environment:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=8787
SESSION_SECRET=replace-with-64-random-characters
ADMIN_TOKEN=replace-with-admin-token
ADMIN_READONLY_TOKEN=replace-with-different-readonly-token
MIRAGE_STORE=postgres
MIRAGE_POSTGRES_URL=postgres://mirage:mirage-password@postgres:5432/mirage
MIRAGE_SQLITE_PATH=/data/mirage.sqlite
AUTH_ALLOW_MOCK_APPLE=false
AUTH_ALLOW_MOCK_GOOGLE=false
AUTH_ALLOW_MOCK_WECHAT=false
APPLE_BUNDLE_ID=com.yourcompany.mirage
APPLE_CLIENT_ID=com.yourcompany.mirage
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
WECHAT_APP_ID=wx-your-wechat-open-platform-app-id
WECHAT_APP_SECRET=replace-with-wechat-app-secret
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-with-llm-api-key
LLM_MODEL=gpt-4.1-mini
LLM_TIMEOUT_MS=4000
LLM_ALLOW_SCRIPTED_FALLBACK_IN_PRODUCTION=false
CORS_ALLOWED_ORIGINS=https://api.your-domain.com,https://admin.your-domain.com
MIRAGE_PUBLIC_BASE_URL=https://api.your-domain.com
MIRAGE_SUPPORT_EMAIL=support@your-domain.com
MIRAGE_SUPPORT_URL=https://your-domain.com/support
REQUEST_BODY_LIMIT_BYTES=32768
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_AUTH_PER_MINUTE=20
RATE_LIMIT_MATCHMAKING_PER_MINUTE=30
RATE_LIMIT_ROOMS_PER_MINUTE=30
RATE_LIMIT_MESSAGES_PER_MINUTE=20
RATE_LIMIT_GAME_ACTIONS_PER_MINUTE=60
RATE_LIMIT_REPORTS_PER_MINUTE=10
RATE_LIMIT_ADMIN_PER_MINUTE=60
REPORT_SLA_SECONDS=86400
REPORT_ALERT_WEBHOOK_URL=https://hooks.your-domain.com/mirage/reports
REPORT_ALERT_WEBHOOK_SECRET=replace-with-alert-secret
REPORT_ALERT_TIMEOUT_MS=3000
REPORT_ALERTS_DISABLED_IN_PRODUCTION=false
HSTS_MAX_AGE_SECONDS=31536000
TRUST_PROXY_HEADERS=false
```

The server refuses to start in `NODE_ENV=production` when required secrets, Apple credentials, Google client ID, or WeChat credentials are missing, mock Apple/Google/WeChat auth is enabled, CORS origins are not configured, public legal/support metadata is still a placeholder, production storage is not configured, report alerting is neither configured nor explicitly disabled, or **LLM** credentials are absent without an explicit fallback override.

`MIRAGE_PUBLIC_BASE_URL` must be the HTTPS origin used for App Store privacy/support URLs. `MIRAGE_SUPPORT_EMAIL` and optional `MIRAGE_SUPPORT_URL` are rendered in `/support` and linked from `/legal/privacy`.

`APPLE_PRIVATE_KEY` may be configured as a single-line environment value with escaped newlines, for example `-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----`. The server converts escaped newlines before generating the **Sign in with Apple** ES256 client secret for authorization-code exchange and refresh-token revoke.

Production storage must use `MIRAGE_STORE=postgres` with `MIRAGE_POSTGRES_URL` or `DATABASE_URL`. Single-instance SQLite is only allowed when `MIRAGE_STORE=sqlite`, `MIRAGE_SQLITE_PATH` is set, and `MIRAGE_ALLOW_SINGLE_INSTANCE_SQLITE_IN_PRODUCTION=true` is explicitly configured. JSON store is not accepted in production validation.

Production responses include `Strict-Transport-Security` with `HSTS_MAX_AGE_SECONDS`, defaulting to one year. Only enable production mode behind the final HTTPS domain.

## Rate Limits

The server applies in-memory sliding-window limits per IP for auth and admin API attempts, and per user for authenticated write actions. Defaults are conservative enough for normal play and can be tuned with the `RATE_LIMIT_*` variables above. In a multi-instance deployment, keep these app-level limits and add provider-level rate limiting at the load balancer or API gateway.

The app ignores `X-Forwarded-For` by default so clients cannot spoof IP-based limits. Set `TRUST_PROXY_HEADERS=true` only when the service is reachable exclusively through a trusted proxy or load balancer that overwrites `X-Forwarded-For`.

## Report Operations

`REPORT_SLA_SECONDS` controls the open-report SLA used by `/admin/metrics`. The admin UI surfaces open report count, overdue count, oldest open age, and SLA so operators can see when App Review guideline 1.2 moderation response risk is increasing.

`REPORT_ALERT_WEBHOOK_URL` receives a `report.created` POST whenever a user submits a report. The alert is non-blocking for the user: delivery success is recorded as `report.alert.sent` in `/admin/audit`, and delivery failure is recorded as `report.alert.failed`. `REPORT_ALERT_WEBHOOK_SECRET` is sent as `X-Mirage-Alert-Secret` for the receiving alert service to verify. The server only exposes the webhook origin in `/ready` and audit events, not the secret or full URL. In production, configure this webhook or explicitly set `REPORT_ALERTS_DISABLED_IN_PRODUCTION=true` while another real moderation alerting channel is in place.

## Shutdown

The Node entrypoint handles `SIGTERM` and `SIGINT`, stops the HTTP server, then closes the active store when it exposes `close()`. `SHUTDOWN_TIMEOUT_MS` defaults to 10 seconds. Container platforms should send `SIGTERM` and allow at least that long before force-killing the process.

## iOS Configuration

Update `ios/Mirage/Mirage/Release.xcconfig` before archive:

```text
PRODUCT_BUNDLE_IDENTIFIER = com.yourcompany.mirage
MIRAGE_API_BASE_URL = https://api.your-domain.com
```

`ios/Mirage/Mirage/Debug.xcconfig` is for local simulator/device development and defaults to `http://127.0.0.1:8787`.

The iOS target uses separate Info plist files:

- `ios/Mirage/Mirage/Info.Debug.plist` is used by Debug and allows local HTTP ATS exceptions for `localhost` and `127.0.0.1`.
- `ios/Mirage/Mirage/Info.plist` is used by Release and must not include local ATS exceptions. Production traffic must use HTTPS.

The Swift client also treats local API fallback as Debug-only. Release builds surface a configuration error and stop requests when `MIRAGE_API_BASE_URL` is missing, non-HTTPS, or points to localhost.

Then open `ios/Mirage/Mirage.xcodeproj` in full **Xcode** and set:

- Team.
- Bundle identifier.
- **Sign in with Apple** capability.
- Release signing.
- Archive destination.

## Storage

The production path is `MIRAGE_STORE=postgres` with `MIRAGE_POSTGRES_URL` or `DATABASE_URL`. The current adapter stores authoritative game state in the `state_snapshots` table under a transaction-level advisory lock, so the existing game engine can run against **PostgreSQL** before the data model is split into fully normalized table writes.

`docs/POSTGRES_SCHEMA.sql` is idempotent and can be applied more than once during environment bootstrap or recovery. It creates the runtime `state_snapshots` table and also contains the normalized table layout intended for the next storage iteration.

Apply the schema with the committed migration entrypoint:

```bash
cd server
npm run migrate:postgres
```

The command reads `MIRAGE_POSTGRES_URL` or `DATABASE_URL`, refuses empty or placeholder connection strings, and runs `docs/POSTGRES_SCHEMA.sql` inside a transaction.

Back up the runtime snapshot:

```bash
cd server
MIRAGE_BACKUP_PATH=backups/mirage-state.json npm run backup:postgres
```

Restore a runtime snapshot:

```bash
cd server
MIRAGE_BACKUP_PATH=backups/mirage-state.json npm run restore:postgres
```

The backup file format is `mirage-state-snapshot-v1` and contains the current `state_snapshots` `main` row. Restore writes the snapshot under the same advisory lock used by runtime mutations. After restore, run `npm run verify:production` against the deployed API before reopening traffic.

The SQLite adapter remains available for single-instance MVP validation and local persistence. It uses Node's built-in `node:sqlite`, which is currently marked experimental by Node. Treat it as a pragmatic validation option, not the final production data layer.

## Reproducible Build

The server has a committed `server/package-lock.json`, and the Docker image uses `npm ci --omit=dev --ignore-scripts`. Update the lockfile with:

```bash
cd server
npm install --package-lock-only --ignore-scripts
```

## AI Gateway

The AI player uses an OpenAI-compatible `POST /chat/completions` request. If `LLM_API_KEY` is missing, the request times out, or moderation blocks the generated text, the game falls back to scripted safe replies. This preserves the PRD requirement that AI failure must not block the game phase.

Before TestFlight, run the local AI quality gate:

```bash
cd server
npm run ai:quality
```

This starts an isolated in-memory game server and verifies that configured AI replies pass moderation, stay within the visible length limit, hide `strategyTag` and `aiSource` from player-visible messages before reveal, fall back after moderation blocks, and fall back after provider failure.

When a real provider key is available, run the same gate against the provider:

```bash
cd server
MIRAGE_AI_QUALITY_REQUIRE_LLM=true LLM_API_KEY=replace-with-llm-api-key npm run ai:quality
```

`MIRAGE_AI_QUALITY_REQUIRE_LLM=true` fails the gate unless the internal AI reply source is `llm`, so use it only in an environment that can reach the configured provider.

## Gameplay Balance Gate

Before TestFlight, run the local gameplay balance gate:

```bash
cd server
npm run balance
```

For audit records, keep the JSON output:

```bash
cd server
npm run balance -- --json
```

The JSON report includes `runConfig`, `invariantCoverage`, and per-scenario `invariants` / `telemetry`. It must prove fixed player counts, fixed AI counts, minimum real-human counts, server task-card acknowledgement, real-user assignment for M06/M08 special roles, vote counts matching human voters, and advanced skill replay entries for `cover_ping` and `decoy_spike`.
