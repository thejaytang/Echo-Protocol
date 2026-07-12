import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { homePage as renderHomePage } from "../server/src/homePage.mjs";

const root = process.cwd();
const checks = [];

function run(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

function exec(name, command, args, options = {}) {
  run(name, () => {
    const result = spawnSync(command, args, {
      cwd: options.cwd || root,
      env: { ...process.env, ...(options.env || {}) },
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
    }
  });
}

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function readPlistJson(filePath) {
  return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", filePath], { cwd: root, encoding: "utf8" }));
}

function markdownSection(text, heading) {
  const marker = `${heading}\n`;
  const start = text.indexOf(marker);
  if (start === -1) {
    throw new Error(`missing markdown section ${heading}`);
  }
  const bodyStart = start + marker.length;
  const nextSection = text.indexOf("\n## ", bodyStart);
  return text.slice(bodyStart, nextSection === -1 ? text.length : nextSection);
}

function markdownKeyValueTable(section) {
  const rows = new Map();
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (cells[0] === "Field" || cells[0] === "字段") continue;
    rows.set(cells[0], cells[1].replace(/^`|`$/g, ""));
  }
  return rows;
}

function collectPlaceholders(filePath, patterns) {
  const text = read(filePath);
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `${filePath}:${pattern}`);
}

function releaseStrict() {
  return process.env.RELEASE_STRICT === "1";
}

exec("server unit and integration tests", "npm", ["test"], { cwd: path.join(root, "server") });
exec("gameplay balance simulation", "npm", ["run", "balance"], { cwd: path.join(root, "server") });
exec("AI quality evaluation", "npm", ["run", "ai:quality"], { cwd: path.join(root, "server") });
exec("multiclient weak-network stress", "npm", ["run", "stress"], { cwd: path.join(root, "server") });
exec("server HTTP smoke", "node", ["server/scripts/smoke.mjs"]);
exec("Swift source typecheck", "swiftc", [
  "-typecheck",
  "ios/Mirage/Mirage/MirageApp.swift",
  "ios/Mirage/Mirage/MirageModels.swift",
  "ios/Mirage/Mirage/MirageAPIClient.swift",
  "ios/Mirage/Mirage/MirageStore.swift",
  "ios/Mirage/Mirage/MirageViews.swift",
  "ios/Mirage/Mirage/KeychainTokenStore.swift",
], {
  env: { CLANG_MODULE_CACHE_PATH: "/private/tmp/mirage-clang-cache" },
});
exec("iOS plist lint", "plutil", [
  "-lint",
  "ios/Mirage/Mirage/Info.plist",
  "ios/Mirage/Mirage/Info.Debug.plist",
  "ios/Mirage/Mirage/Mirage.entitlements",
  "ios/Mirage/Mirage/PrivacyInfo.xcprivacy",
  "ios/Mirage/Mirage.xcodeproj/project.pbxproj",
  "ios/Mirage/ExportOptions.plist",
]);
exec("iOS shared scheme XML", "xmllint", ["--noout", "ios/Mirage/Mirage.xcodeproj/xcshareddata/xcschemes/Mirage.xcscheme"]);
exec("App icon JSON", "python3", ["-m", "json.tool", "ios/Mirage/Mirage/Assets.xcassets/AppIcon.appiconset/Contents.json"]);

run("gameplay balance invariant report stays inspectable", () => {
  const output = execFileSync("node", ["scripts/simulate_balance.mjs", "--json"], {
    cwd: path.join(root, "server"),
    encoding: "utf8",
  });
  const report = JSON.parse(output);
  for (const required of ["M01", "M02", "M03", "M04", "M06", "M08"]) {
    if (!report.modeCoverage.includes(required)) {
      throw new Error(`balance report missing mode ${required}`);
    }
  }
  for (const [field, expected] of [
    ["fixedPlayerCounts", true],
    ["fixedAiCounts", true],
    ["minimumHumanCounts", true],
    ["taskCardAcknowledgements", true],
    ["specialRolesRealUsers", true],
    ["voteCounts", true],
  ]) {
    if (report.invariantCoverage?.[field] !== expected) {
      throw new Error(`balance invariant coverage missing ${field}`);
    }
  }
  if (!Array.isArray(report.runConfig?.policies) || !report.runConfig.policies.includes("skilled")) {
    throw new Error("balance report missing policy run config");
  }
  if (report.invariantCoverage?.noMidCheckPhase !== true) {
    throw new Error("balance report must confirm the unified flow has no MID_CHECK phase");
  }
  if (!(report.misledScenarioCount >= 2)) {
    throw new Error("balance report missing misled scenarios for M06/M08");
  }
  if (!report.scenarios?.every((scenario) => scenario.invariants && scenario.telemetry?.votes)) {
    throw new Error("balance report scenarios must include invariants and vote telemetry");
  }
});

run("server dependency lockfile", () => {
  const manifest = readJson("server/package.json");
  const lockfile = readJson("server/package-lock.json");
  const lockedRoot = lockfile.packages?.[""];
  if (!lockedRoot) throw new Error("server/package-lock.json is missing root package metadata");
  const manifestDeps = manifest.dependencies || {};
  const lockedDeps = lockedRoot.dependencies || {};
  for (const [name, version] of Object.entries(manifestDeps)) {
    if (lockedDeps[name] !== version) {
      throw new Error(`server/package-lock.json does not match dependency ${name}@${version}`);
    }
  }
});

run("Docker production baseline", () => {
  const dockerfile = read("Dockerfile");
  for (const required of ["npm ci --omit=dev --ignore-scripts", "USER node", "HEALTHCHECK", "/health"]) {
    if (!dockerfile.includes(required)) {
      throw new Error(`Dockerfile missing ${required}`);
    }
  }
  if (/USER\s+root\b/.test(dockerfile)) {
    throw new Error("Dockerfile must not run the production server as root");
  }
});

run("production env example stays complete", () => {
  const envExample = read("server/.env.example");
  const deployment = read("docs/DEPLOYMENT.md");
  const readme = read("README.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "NODE_ENV=production",
    "HOST=0.0.0.0",
    "PORT=8787",
    "SESSION_SECRET=replace-with-64-random-characters",
    "ADMIN_TOKEN=replace-with-admin-token",
    "ADMIN_READONLY_TOKEN=replace-with-different-readonly-token",
    "MIRAGE_STORE=postgres",
    "MIRAGE_POSTGRES_URL=postgres://mirage:mirage-password@postgres:5432/mirage",
    "MIRAGE_POSTGRES_CONNECT_TIMEOUT_MS=10000",
    "AUTH_ALLOW_MOCK_APPLE=false",
    "AUTH_ALLOW_MOCK_GOOGLE=false",
    "AUTH_ALLOW_MOCK_WECHAT=false",
    "APPLE_BUNDLE_ID=com.yourcompany.mirage",
    "APPLE_CLIENT_ID=com.yourcompany.mirage",
    "APPLE_TEAM_ID=YOUR_TEAM_ID",
    "APPLE_KEY_ID=YOUR_KEY_ID",
    "APPLE_PRIVATE_KEY=",
    "GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com",
    "WECHAT_APP_ID=wx-your-wechat-open-platform-app-id",
    "WECHAT_APP_SECRET=replace-with-wechat-app-secret",
    "LLM_API_BASE_URL=https://api.openai.com/v1",
    "LLM_API_KEY=replace-with-llm-api-key",
    "LLM_MODEL=gpt-4.1-mini",
    "LLM_TIMEOUT_MS=4000",
    "LLM_ALLOW_SCRIPTED_FALLBACK_IN_PRODUCTION=false",
    "CORS_ALLOWED_ORIGINS=https://api.your-domain.com,https://admin.your-domain.com",
    "MIRAGE_PUBLIC_BASE_URL=https://api.your-domain.com",
    "MIRAGE_SUPPORT_EMAIL=support@your-domain.com",
    "MIRAGE_SUPPORT_URL=https://your-domain.com/support",
    "REPORT_SLA_SECONDS=86400",
    "REPORT_ALERT_WEBHOOK_URL=https://hooks.your-domain.com/mirage/reports",
    "REPORT_ALERT_WEBHOOK_SECRET=replace-with-alert-secret",
    "REPORT_ALERTS_DISABLED_IN_PRODUCTION=false",
    "MIRAGE_BACKUP_PATH=backups/mirage-state.json",
    "HSTS_MAX_AGE_SECONDS=31536000",
    "TRUST_PROXY_HEADERS=false",
    "SHUTDOWN_TIMEOUT_MS=10000",
  ]) {
    if (!envExample.includes(required)) {
      throw new Error(`server/.env.example missing ${required}`);
    }
  }
  for (const forbidden of [
    "AUTH_ALLOW_MOCK_APPLE=true",
    "AUTH_ALLOW_MOCK_GOOGLE=true",
    "AUTH_ALLOW_MOCK_WECHAT=true",
    "ADMIN_READONLY_TOKEN=replace-with-admin-token",
    "REPORT_ALERTS_DISABLED_IN_PRODUCTION=true",
  ]) {
    if (envExample.includes(forbidden)) {
      throw new Error(`server/.env.example contains unsafe production default ${forbidden}`);
    }
  }
  for (const required of ["ADMIN_READONLY_TOKEN", "WECHAT_APP_ID", "WECHAT_APP_SECRET", "LLM_ALLOW_SCRIPTED_FALLBACK_IN_PRODUCTION"]) {
    if (!deployment.includes(required)) {
      throw new Error(`docs/DEPLOYMENT.md missing env example key ${required}`);
    }
  }
  for (const required of ["ADMIN_READONLY_TOKEN", "REPORT_ALERT_WEBHOOK_URL", "MIRAGE_PUBLIC_BASE_URL", "MIRAGE_SUPPORT_EMAIL", "GOOGLE_CLIENT_ID"]) {
    if (!readme.includes(required)) {
      throw new Error(`README.md missing production env key ${required}`);
    }
  }
  if (!status.includes("`server/.env.example` 已覆盖 production 必填样板")) {
    throw new Error("REAL_APP_STATUS.md must mention complete production env example");
  }
});

run("PostgreSQL runtime schema contract", () => {
  const schema = read("docs/POSTGRES_SCHEMA.sql");
  const store = read("server/src/store.mjs");
  const migration = read("server/scripts/migrate_postgres.mjs");
  const backup = read("server/scripts/backup_postgres_snapshot.mjs");
  const restore = read("server/scripts/restore_postgres_snapshot.mjs");
  const readiness = read("server/scripts/verify_production_readiness.mjs");
  const serverManifest = readJson("server/package.json");
  if (serverManifest.scripts?.["migrate:postgres"] !== "node scripts/migrate_postgres.mjs") {
    throw new Error("server/package.json must expose npm run migrate:postgres");
  }
  if (serverManifest.scripts?.["backup:postgres"] !== "node scripts/backup_postgres_snapshot.mjs") {
    throw new Error("server/package.json must expose npm run backup:postgres");
  }
  if (serverManifest.scripts?.["restore:postgres"] !== "node scripts/restore_postgres_snapshot.mjs") {
    throw new Error("server/package.json must expose npm run restore:postgres");
  }
  if (serverManifest.scripts?.["verify:production"] !== "node scripts/verify_production_readiness.mjs") {
    throw new Error("server/package.json must expose npm run verify:production");
  }
  if (!schema.includes("CREATE TABLE IF NOT EXISTS state_snapshots")) {
    throw new Error("docs/POSTGRES_SCHEMA.sql must create state_snapshots idempotently");
  }
  if (!schema.includes("state_json JSONB NOT NULL") || !schema.includes("updated_at TIMESTAMPTZ NOT NULL")) {
    throw new Error("docs/POSTGRES_SCHEMA.sql state_snapshots must match runtime JSONB snapshot contract");
  }
  if (/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(schema)) {
    throw new Error("docs/POSTGRES_SCHEMA.sql table DDL must be idempotent");
  }
  if (/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(schema)) {
    throw new Error("docs/POSTGRES_SCHEMA.sql index DDL must be idempotent");
  }
  for (const required of ["CREATE TABLE IF NOT EXISTS state_snapshots", "state_json JSONB NOT NULL", "pg_advisory_xact_lock"]) {
    if (!store.includes(required)) {
      throw new Error(`PostgresStore missing ${required}`);
    }
  }
  for (const required of ["docs/POSTGRES_SCHEMA.sql", "MIRAGE_POSTGRES_URL", "DATABASE_URL", "BEGIN", "COMMIT", "ROLLBACK"]) {
    if (!migration.includes(required)) {
      throw new Error(`PostgreSQL migration script missing ${required}`);
    }
  }
  for (const required of ["state_snapshots", "MIRAGE_BACKUP_PATH", "mirage-state-snapshot-v1", "0o600"]) {
    if (!backup.includes(required)) {
      throw new Error(`PostgreSQL backup script missing ${required}`);
    }
  }
  for (const required of ["state_snapshots", "MIRAGE_BACKUP_PATH", "mirage-state-snapshot-v1", "pg_advisory_xact_lock", "BEGIN", "COMMIT", "ROLLBACK"]) {
    if (!restore.includes(required)) {
      throw new Error(`PostgreSQL restore script missing ${required}`);
    }
  }
  for (const required of [
    "/health",
    "/ready",
    "MIRAGE_PRODUCTION_BASE_URL",
    "MIRAGE_EXPECT_STORE",
    "postgres",
    "/legal/privacy",
    "/admin/metrics",
    "MIRAGE_VERIFY_ADMIN_READONLY_TOKEN",
    "/admin/session",
    "/admin/reports/batch",
    "expectHttpStatus",
    "403",
  ]) {
    if (!readiness.includes(required)) {
      throw new Error(`production readiness verifier missing ${required}`);
    }
  }
});

run("CI release coverage", () => {
  const workflow = read(".github/workflows/ci.yml");
  for (const required of [
    "node scripts/release_gate.mjs",
    "docker build -t mirage-server:ci .",
    "ios/Mirage/Mirage/Info.Debug.plist",
  ]) {
    if (!workflow.includes(required)) {
      throw new Error(`.github/workflows/ci.yml missing ${required}`);
    }
  }
  const backendStart = workflow.indexOf("  backend:");
  const iosStart = workflow.indexOf("  ios-structure:");
  if (backendStart === -1 || iosStart === -1 || iosStart < backendStart) {
    throw new Error(".github/workflows/ci.yml must define backend and ios-structure jobs");
  }
  const backendBlock = workflow.slice(backendStart, iosStart);
  const iosBlock = workflow.slice(iosStart);
  if (backendBlock.includes("node scripts/release_gate.mjs")) {
    throw new Error("release gate must not run in the Ubuntu backend job because it needs macOS tools");
  }
  if (!iosBlock.includes("macos-15") || !iosBlock.includes("node scripts/release_gate.mjs")) {
    throw new Error("release gate must run in the macOS iOS job");
  }
});

run("server graceful shutdown hooks", () => {
  const index = read("server/src/index.mjs");
  for (const required of ['process.on("SIGTERM"', 'process.on("SIGINT"', "server.close", "store.close"]) {
    if (!index.includes(required)) {
      throw new Error(`server/src/index.mjs missing ${required}`);
    }
  }
});

run("admin token is not persisted in localStorage", () => {
  const adminPage = read("server/src/adminPage.mjs");
  if (adminPage.includes("localStorage")) {
    throw new Error("admin page must not persist X-Admin-Token in localStorage");
  }
  if (!adminPage.includes("sessionStorage")) {
    throw new Error("admin page should keep X-Admin-Token only for the browser session");
  }
});

run("admin operations dashboard and batch moderation are covered", () => {
  const engine = read("server/src/gameEngine.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  const adminPage = read("server/src/adminPage.mjs");
  const apiContract = read("docs/API_CONTRACT.md");
  const status = read("docs/REAL_APP_STATUS.md");
  const tests = read("server/test/api.test.mjs");
  for (const [source, required] of [
    [engine, "async updateReportsBatch"],
    [engine, "async banReportTargetsBatch"],
    [engine, "async listReports({ status = null, reason = null, gameId = null, targetUserId = null, limit = null }"],
    [engine, "report.batch.updated"],
    [engine, "report.batch.targets_banned"],
    [httpServer, "ADMIN_READONLY_TOKEN"],
    [httpServer, "requireAdminWrite"],
    [httpServer, "admin_write_forbidden"],
    [httpServer, "/admin/session"],
    [engine, "byReason"],
    [engine, "oldestOpen"],
    [engine, "modes: modeStats"],
    [engine, "topics: topicStats"],
    [engine, "funnel: {"],
    [engine, "retention: {"],
    [engine, "economy: {"],
    [engine, "aiOperations: {"],
    [engine, "async adminTrends"],
    [engine, "estimatedOutputTokens"],
    [engine, "fallbackRate"],
    [engine, "cosmeticUnlockEvents"],
    [adminPage, "renderFunnelStats"],
    [adminPage, "renderRetentionStats"],
    [adminPage, "renderEconomyStats"],
    [adminPage, "renderAiOperations"],
    [adminPage, "renderTrendStats"],
    [adminPage, "accessStatus"],
    [adminPage, "只读模式"],
    [adminPage, "data-write-action"],
    [adminPage, "/admin/session"],
    [httpServer, "function reportsCsv"],
    [httpServer, "function sendCsv"],
    [httpServer, "/admin/reports.csv"],
    [httpServer, "status: url.searchParams.get(\"status\")"],
    [httpServer, "targetUserId: url.searchParams.get(\"targetUserId\")"],
    [httpServer, "/admin/reports/batch"],
    [httpServer, "/admin/reports/batch-ban-targets"],
    [httpServer, "/admin/trends"],
    [adminPage, "导出 CSV"],
    [adminPage, "exportReportsCsv"],
    [adminPage, "举报筛选"],
    [adminPage, "reportFilterQuery"],
    [adminPage, "clearReportFilters"],
    [adminPage, "/admin/reports.csv"],
    [adminPage, "批量处理"],
    [adminPage, "bulkResolveReports"],
    [adminPage, "批量封禁目标"],
    [adminPage, "bulkBanReportTargets"],
    [adminPage, "加载趋势"],
    [adminPage, "renderModeStats"],
    [adminPage, "renderTopicStats"],
    [apiContract, "`POST /admin/reports/batch`"],
    [apiContract, "`POST /admin/reports/batch-ban-targets`"],
    [apiContract, "`GET /admin/reports.csv`"],
    [apiContract, "`GET /admin/reports?status=open&reason=spam&gameId=...&targetUserId=...`"],
    [apiContract, "The same filters are accepted by `GET /admin/reports.csv`"],
    [apiContract, "`GET /admin/trends?days=14`"],
    [apiContract, "mode performance"],
    [apiContract, "oldest open report queue"],
    [apiContract, "product funnel"],
    [apiContract, "virtual economy"],
    [apiContract, "AI operations"],
    [apiContract, "daily aggregate trends"],
    [apiContract, "fallback rate"],
    [apiContract, "ADMIN_READONLY_TOKEN"],
    [apiContract, "admin_write_forbidden"],
    [apiContract, "`GET /admin/session`"],
    [status, "运营看板"],
    [status, "按状态/原因/Game/Target 筛选"],
    [status, "产品漏斗"],
    [status, "虚拟经济统计"],
    [status, "AI 运营"],
    [status, "长期趋势"],
    [status, "ADMIN_READONLY_TOKEN"],
    [status, "/admin/session"],
    [status, "批量标记处理"],
    [status, "批量封禁目标"],
    [status, "CSV 导出"],
    [tests, "admin can export reports as csv"],
    [tests, "admin can filter report queue and csv export"],
    [tests, "admin can batch resolve reports with audit trail"],
    [tests, "admin can batch ban report targets with audit trail"],
    [tests, "admin trends summarize launch funnel and safety activity"],
    [tests, "metrics.json.metrics.reports.byReason"],
    [tests, "metrics.json.metrics.funnel.gameStartRate"],
    [tests, "metrics.json.metrics.economy.cosmetics.clueStarsSpent"],
    [tests, "metrics.json.metrics.aiOperations.messages.fallbackRate"],
    [tests, "admin readonly token can inspect operations but cannot mutate state"],
    [tests, "/admin/reports/batch-ban-targets"],
    [tests, "readonlySession.json.access"],
    [tests, "data-write-action"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`admin operations coverage missing ${required}`);
    }
  }
});

run("AI provider quality harness", () => {
  const manifest = readJson("server/package.json");
  const script = read("server/scripts/evaluate_ai_quality.mjs");
  const deployment = read("docs/DEPLOYMENT.md");
  const status = read("docs/REAL_APP_STATUS.md");
  if (manifest.scripts?.["ai:quality"] !== "node scripts/evaluate_ai_quality.mjs") {
    throw new Error("server/package.json must expose npm run ai:quality");
  }
  for (const required of [
    "MIRAGE_AI_QUALITY_REQUIRE_LLM",
    "fallback_after_moderation",
    "fallback_after_llm_failure",
    "strategyTag",
    "aiSource",
    "moderateText",
    "assertSafeReplyText",
  ]) {
    if (!script.includes(required)) {
      throw new Error(`AI quality script missing ${required}`);
    }
  }
  for (const required of ["npm run ai:quality", "MIRAGE_AI_QUALITY_REQUIRE_LLM=true", "LLM_API_KEY"]) {
    if (!deployment.includes(required)) {
      throw new Error(`docs/DEPLOYMENT.md missing AI quality instruction ${required}`);
    }
  }
  if (!status.includes("`npm run ai:quality`")) {
    throw new Error("docs/REAL_APP_STATUS.md must mention the AI quality gate");
  }
});

run("commercialization preview does not sell gameplay advantage", () => {
  const commerce = read("server/src/commerce.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  const homePage = read("server/src/homePage.mjs");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const api = read("ios/Mirage/Mirage/MirageAPIClient.swift");
  const store = read("ios/Mirage/Mirage/MirageStore.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const apiContract = read("docs/API_CONTRACT.md");
  const prd = read("Mirage_PRD_v1.0.md");
  const status = read("docs/REAL_APP_STATUS.md");
  const tests = read("server/test/api.test.mjs");
  for (const [source, required] of [
    [commerce, "paymentsEnabled: false"],
    [commerce, "app_store_iap_required"],
    [commerce, "不出售身份、阵营、AI 位置或投票提示"],
    [commerce, "不提高匹配胜率、发言权重、结算分或排行榜分"],
    [commerce, "不绕过内容审核、举报、拉黑、封禁和年龄确认"],
    [httpServer, "/commerce/catalog"],
    [homePage, "/commerce/catalog"],
    [homePage, "renderCommercePreviewPanel"],
    [homePage, "权益预告"],
    [models, "struct CommerceCatalog"],
    [models, "struct CommerceOffer"],
    [api, "fetchCommerceCatalog"],
    [store, "@Published var commerceCatalog"],
    [store, "api.fetchCommerceCatalog"],
    [store, "private func bootstrapSession() async"],
    [store, "async let fetchedCommerceCatalog = api.fetchCommerceCatalog()"],
    [store, "commerceCatalog = try await fetchedCommerceCatalog"],
    [views, "CommercePreviewSection"],
    [views, "model.commerceCatalog"],
    [apiContract, "GET `/commerce/catalog`"],
    [apiContract, "paymentsEnabled"],
    [apiContract, "不出售胜率、身份信息或投票优势"],
    [prd, "`/commerce/catalog`"],
    [prd, "不出售身份信息、AI 位置、投票提示、匹配优势、结算分或排行榜分"],
    [status, "商业化权益预告"],
    [tests, "/commerce/catalog"],
    [tests, "paymentsEnabled, false"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`commercialization fairness contract missing ${required}`);
    }
  }
});

run("high-risk text moderation covers threat and self-harm", () => {
  const config = read("server/src/config.mjs");
  const tests = read("server/test/api.test.mjs");
  const homePage = read("server/src/homePage.mjs");
  const store = read("ios/Mirage/Mirage/MirageStore.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const apiContract = read("docs/API_CONTRACT.md");
  const status = read("docs/REAL_APP_STATUS.md");
  const legalPages = read("server/src/legalPages.mjs");
  for (const [source, required] of [
    [config, 'reason: "violent_threat"'],
    [config, 'reason: "self_harm_risk"'],
    [tests, "message_blocked:violent_threat"],
    [tests, "message_blocked:self_harm_risk"],
    [homePage, "function playerErrorMessage(message)"],
    [homePage, "如果你或他人正处于危险"],
    [homePage, "showNotice(playerErrorMessage(error.message), \"error\")"],
    [store, "playerErrorMessage(for:"],
    [store, "如果你或他人正处于危险"],
    [homePage, "post_game_threat_or_self_harm"],
    [views, "post_game_threat_or_self_harm"],
    [apiContract, "post_game_threat_or_self_harm"],
    [apiContract, "violent_threat"],
    [apiContract, "self_harm_risk"],
    [status, "自伤风险"],
    [legalPages, "自伤表达"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`high-risk moderation contract missing ${required}`);
    }
  }
});

run("iOS privacy manifest data declarations", () => {
  const manifest = readPlistJson("ios/Mirage/Mirage/PrivacyInfo.xcprivacy");
  if (manifest.NSPrivacyTracking !== false) {
    throw new Error("PrivacyInfo.xcprivacy must declare NSPrivacyTracking=false");
  }
  if ((manifest.NSPrivacyTrackingDomains || []).length !== 0) {
    throw new Error("PrivacyInfo.xcprivacy must not declare tracking domains");
  }
  const collected = manifest.NSPrivacyCollectedDataTypes || [];
  const declaredTypes = new Set(collected.map((item) => item.NSPrivacyCollectedDataType));
  const requiredTypes = [
    "NSPrivacyCollectedDataTypeName",
    "NSPrivacyCollectedDataTypeEmailAddress",
    "NSPrivacyCollectedDataTypeUserID",
    "NSPrivacyCollectedDataTypeGameplayContent",
    "NSPrivacyCollectedDataTypeOtherUserContent",
    "NSPrivacyCollectedDataTypeCustomerSupport",
    "NSPrivacyCollectedDataTypeProductInteraction",
  ];
  const missingTypes = requiredTypes.filter((type) => !declaredTypes.has(type));
  if (missingTypes.length) {
    throw new Error(`PrivacyInfo.xcprivacy missing collected data types: ${missingTypes.join(", ")}`);
  }
  for (const item of collected) {
    if (item.NSPrivacyCollectedDataTypeTracking !== false) {
      throw new Error(`PrivacyInfo.xcprivacy marks ${item.NSPrivacyCollectedDataType} as tracking`);
    }
    const purposes = item.NSPrivacyCollectedDataTypePurposes || [];
    if (!purposes.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality")) {
      throw new Error(`PrivacyInfo.xcprivacy ${item.NSPrivacyCollectedDataType} lacks AppFunctionality purpose`);
    }
  }
});

run("privacy data map stays aligned", () => {
  const privacyMap = read("docs/PRIVACY_DATA_MAP.md");
  const submission = read("docs/APP_STORE_SUBMISSION.md");
  const status = read("docs/REAL_APP_STATUS.md");
  const legalPages = read("server/src/legalPages.mjs");
  const manifest = readPlistJson("ios/Mirage/Mirage/PrivacyInfo.xcprivacy");
  const declaredTypes = new Set((manifest.NSPrivacyCollectedDataTypes || []).map((item) => item.NSPrivacyCollectedDataType));
  for (const required of [
    "NSPrivacyTracking=false",
    "NSPrivacyTrackingDomains=[]",
    "App Functionality",
    "guest 仅用于服务端自动化测试和审核演示接口",
    "当前 iOS Release 可提交入口为 Apple",
    "原生 SDK 接入后开启 Release 按钮",
    "账号删除入口在 App 设置中提供",
    "NSPrivacyCollectedDataTypeName",
    "NSPrivacyCollectedDataTypeEmailAddress",
    "NSPrivacyCollectedDataTypeUserID",
    "NSPrivacyCollectedDataTypeGameplayContent",
    "NSPrivacyCollectedDataTypeOtherUserContent",
    "NSPrivacyCollectedDataTypeCustomerSupport",
    "NSPrivacyCollectedDataTypeProductInteraction",
    "Contacts",
    "Location",
    "Photos / Camera",
    "Microphone / Speech",
    "Advertising ID",
    "Payment Information",
    "Third-party analytics SDK",
    "Tracking domains",
    "paymentsEnabled=false",
    "PrivacyInfo.xcprivacy",
    "server/src/legalPages.mjs",
    "scripts/release_gate.mjs",
  ]) {
    if (!privacyMap.includes(required)) {
      throw new Error(`privacy data map missing ${required}`);
    }
  }
  for (const type of declaredTypes) {
    if (!privacyMap.includes(type)) {
      throw new Error(`privacy data map missing manifest type ${type}`);
    }
  }
  if (!submission.includes("docs/PRIVACY_DATA_MAP.md")) {
    throw new Error("App Store submission notes must reference docs/PRIVACY_DATA_MAP.md");
  }
  if (!status.includes("docs/PRIVACY_DATA_MAP.md")) {
    throw new Error("REAL_APP_STATUS.md must reference docs/PRIVACY_DATA_MAP.md");
  }
  for (const required of ["Apple / 微信 / Google 登录标识", "guest id", "不作为玩家入口"]) {
    if (!legalPages.includes(required)) {
      throw new Error(`privacy policy page missing aligned account data copy: ${required}`);
    }
  }
  for (const forbidden of ["本地试玩 id", "广告标识符用于追踪", "Tracking=true"]) {
    if (privacyMap.includes(forbidden) || legalPages.includes(forbidden)) {
      throw new Error(`privacy materials contain stale or unsafe copy: ${forbidden}`);
    }
  }
});

run("friend-room fixed seat caps stay enforced", () => {
  const engine = read("server/src/gameEngine.mjs");
  const tests = read("server/test/api.test.mjs");
  const apiContract = read("docs/API_CONTRACT.md");
  const blueprint = read("docs/GAME_MODE_BLUEPRINT.md");
  for (const [source, required] of [
    [engine, "const maxHumanSeats = Math.max(0, mode.playerCount - mode.aiCount)"],
    [engine, 'new Error("room_full")'],
    [tests, "friend room enforces fixed player counts before AI seats are filled"],
    [tests, 'assert.equal(overfill.json.error, "room_full")'],
    [apiContract, "mode.playerCount - mode.aiCount"],
    [apiContract, "409 room_full"],
    [blueprint, "好友房真人席位上限为 `playerCount - aiCount`"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`friend-room fixed seat cap contract missing ${required}`);
    }
  }
});

run("iOS Release ATS policy", () => {
  const project = read("ios/Mirage/Mirage.xcodeproj/project.pbxproj");
  if (!project.includes("INFOPLIST_FILE = Mirage/Info.Debug.plist;")) {
    throw new Error("Debug build configuration must use Mirage/Info.Debug.plist");
  }
  if (!project.includes("INFOPLIST_FILE = Mirage/Info.plist;")) {
    throw new Error("Release build configuration must use Mirage/Info.plist");
  }

  const releaseInfo = readPlistJson("ios/Mirage/Mirage/Info.plist");
  const releaseExceptions = releaseInfo.NSAppTransportSecurity?.NSExceptionDomains;
  if (releaseExceptions) {
    const domains = Object.keys(releaseExceptions);
    throw new Error(`Release Info.plist must not declare ATS exception domains: ${domains.join(", ")}`);
  }

  const debugInfo = readPlistJson("ios/Mirage/Mirage/Info.Debug.plist");
  const debugExceptions = debugInfo.NSAppTransportSecurity?.NSExceptionDomains || {};
  for (const domain of ["127.0.0.1", "localhost"]) {
    if (debugExceptions[domain]?.NSExceptionAllowsInsecureHTTPLoads !== true) {
      throw new Error(`Debug Info.Debug.plist missing local ATS exception for ${domain}`);
    }
  }
});

run("visible product name is 图灵迷局", () => {
  const releaseInfo = readPlistJson("ios/Mirage/Mirage/Info.plist");
  const debugInfo = readPlistJson("ios/Mirage/Mirage/Info.Debug.plist");
  if (releaseInfo.CFBundleDisplayName !== "图灵迷局" || releaseInfo.CFBundleName !== "图灵迷局") {
    throw new Error("Release Info.plist must expose 图灵迷局 as the app name");
  }
  if (debugInfo.CFBundleDisplayName !== "图灵迷局" || debugInfo.CFBundleName !== "图灵迷局") {
    throw new Error("Debug Info.Debug.plist must expose 图灵迷局 as the app name");
  }
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const productDocs = [
    "README.md",
    "Mirage_PRD_v1.0.md",
    "docs/DEPLOYMENT.md",
    "docs/API_CONTRACT.md",
    "docs/APP_STORE_SUBMISSION.md",
    "docs/REAL_APP_STATUS.md",
    "design-qa.md",
  ];
  if (!homePage.includes("<strong>图灵迷局</strong>") || !homePage.includes("<p class=\"eyebrow\">图灵迷局</p>")) {
    throw new Error("Web preview must expose 图灵迷局 as the product name");
  }
  if (
    homePage.includes("<strong>狼人杀</strong>") ||
    homePage.includes("<p class=\"eyebrow\">狼人杀</p>") ||
    views.includes('Text("狼人杀")') ||
    homePage.includes("<strong>找AI</strong>") ||
    homePage.includes("<p class=\"eyebrow\">找AI</p>") ||
    views.includes('Text("找AI")')
  ) {
    throw new Error("Player-facing UI must not expose old or reference app names as the product name");
  }
  for (const doc of productDocs) {
    const text = read(doc);
    if (!text.includes("图灵迷局")) {
      throw new Error(`${doc} must name the product 图灵迷局`);
    }
    if (
      text.includes("产品正式名: 狼人杀") ||
      text.includes("用户可见产品名、App Store 名称和网页标题统一为“狼人杀”") ||
      text.includes("产品正式名: 找AI") ||
      text.includes("用户可见产品名、App Store 名称和网页标题统一为“找AI”")
    ) {
      throw new Error(`${doc} must not name the product 狼人杀 or 找AI`);
    }
  }
});

run("visual design direction stays player-facing", () => {
  const visual = read("VISUAL_DESIGN.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Visual Design: 图灵迷局",
    "composition-table-stage",
    "lighting-low-key-deduction",
    "motionviz-signal-pulse",
    "Stage background",
    "Player agency",
    "Suspicion signal",
    "Risk and AI pressure",
    "Evidence surface",
    "## 7. AI-Generated Look Suppression Rules",
    "任务卡",
    "起手句",
    "起手句只能填入草稿",
    "不能像项目说明页",
    "Release 截图不能包含 debug、admin、localhost、占位域名或旧产品名",
  ]) {
    if (!visual.includes(required)) {
      throw new Error(`visual design missing ${required}`);
    }
  }
  if (!status.includes("VISUAL_DESIGN.md")) {
    throw new Error("REAL_APP_STATUS.md must reference VISUAL_DESIGN.md");
  }
});

run("PRD current implementation baseline is authoritative", () => {
  const prd = read("Mirage_PRD_v1.0.md");
  for (const required of [
    "## 当前实现基线",
    "文档版本: v1.1 current implementation baseline",
    "M01 2 人真假局",
    "M02 3 人抓伪装者",
    "M03 4 人经典混聊",
    "M04 6 人立场局",
    "M06 5 人卧底护 **AI**",
    "M08 5 人伪 **AI** 诱饵",
    "当前首发范围不包含 M05、M07、M09",
    "细节提问不是独立功能",
    "开局显示“任务卡”，不是“身份卡”",
    "当前 iOS Release 可提交入口为 Apple",
    "旧词“线索回看”“看线索”不再作为流程入口",
    "release gate 必须通过",
  ]) {
    if (!prd.includes(required)) {
      throw new Error(`PRD current baseline missing ${required}`);
    }
  }
});

run("multi-agent launch plan stays aligned", () => {
  const plan = read("docs/MULTI_AGENT_LAUNCH_PLAN.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Agent 1 PM",
    "Agent 2 Game Design",
    "Agent 3 Engineering",
    "Agent 4 UI/UX",
    "Agent 5 QA",
    "Agent 6 Commercialization",
    "Apple / 微信 / Google",
    "当前 iOS Release 可提交入口为 Apple",
    "Release 按钮",
    "guest 仅作为服务端自动化测试和审核演示接口",
    "任务卡",
    "局后对玩家处理",
    "不出售胜率",
    "npm test",
    "npm run balance",
    "npm run ai:quality",
    "npm run stress",
    "node scripts/release_gate.mjs",
    "Stop-Ship Invariants",
    "外部阻塞",
  ]) {
    if (!plan.includes(required)) {
      throw new Error(`multi-agent launch plan missing ${required}`);
    }
  }
  if (!status.includes("docs/MULTI_AGENT_LAUNCH_PLAN.md")) {
    throw new Error("REAL_APP_STATUS.md must reference the multi-agent launch plan");
  }
});

run("launch QA matrix stays aligned", () => {
  const matrix = read("docs/LAUNCH_QA_MATRIX.md");
  const status = read("docs/REAL_APP_STATUS.md");
  const manualQa = read("docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md");
  for (const required of [
    "Gate Policy",
    "Automated QA Coverage",
    "Manual QA Before TestFlight",
    "Regression Triggers",
    "stop-ship",
    "npm test",
    "npm run balance",
    "npm run ai:quality",
    "npm run stress",
    "node scripts/release_gate.mjs",
    "RELEASE_STRICT=1 node scripts/release_gate.mjs",
    "普通本地 gate 通过不等于可提交归档",
    "QA-001",
    "QA-002",
    "QA-003",
    "QA-004",
    "QA-005",
    "QA-005A",
    "QA-006",
    "QA-007",
    "QA-008",
    "QA-009",
    "QA-010",
    "QA-011",
    "QA-012",
    "QA-013",
    "QA-014",
    "QA-015",
    "QA-016",
    "MQ-001",
    "MQ-002",
    "MQ-003",
    "MQ-004",
    "MQ-005",
    "MQ-006",
    "MQ-007",
    "MQ-008",
    "Apple / 微信 / Google",
    "iOS Release 只开启已接正式 SDK 的入口",
    "Release 按钮在 SDK 未接入前保持禁用",
    "guest 不出现在玩家 UI",
    "任务卡不是身份卡",
    "局后举报/拉黑",
    "最近复盘",
    "同模式再来一局",
    "不出售胜率",
    "PrivacyInfo.xcprivacy",
    "production env validation",
    "TestFlight 前",
    "App Store 截图",
  ]) {
    if (!matrix.includes(required)) {
      throw new Error(`launch QA matrix missing ${required}`);
    }
  }
  if (!status.includes("docs/LAUNCH_QA_MATRIX.md")) {
    throw new Error("REAL_APP_STATUS.md must reference docs/LAUNCH_QA_MATRIX.md");
  }
  if (!matrix.includes("docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md") || !status.includes("docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md")) {
    throw new Error("TestFlight manual QA template must be referenced by launch docs");
  }
  for (const required of [
    "Run Metadata",
    "Stop-Ship Summary",
    "MQ-001 Fixed Account Login",
    "MQ-002 M01 First Game",
    "MQ-003 M02 Multi-Human Match",
    "MQ-004 Friend Room Modes",
    "MQ-005 Weak Network And Resume",
    "MQ-006 Safety: Report, Block, Ban",
    "MQ-007 Account Deletion",
    "MQ-008 App Store Screenshots",
    "Go / No-Go",
    "证据",
  ]) {
    if (!manualQa.includes(required)) {
      throw new Error(`TestFlight manual QA template missing ${required}`);
    }
  }
});

run("code and function review stays aligned", () => {
  const review = read("docs/CODE_FUNCTION_REVIEW.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Code And Function Review",
    "Pass with external release blockers",
    "Final Delivery Review",
    "Code Review Scope",
    "Function Review Scope",
    "External Blockers",
    "Go / No-Go",
    "npm test --prefix server",
    "npm run balance --prefix server",
    "npm run ai:quality --prefix server",
    "npm run stress --prefix server",
    "node scripts/release_gate.mjs",
    "RELEASE_STRICT=1 node scripts/release_gate.mjs",
    "用户可以用 Apple、微信或 Google 登录进入并完成第一局",
    "用户可以玩 2 人真假局",
    "用户可以玩 3 人找 AI",
    "用户可以创建 4 人和 6 人好友房",
    "AI 可以作为玩家混入并执行隐藏任务",
    "每局都有任务卡、聊天、投票、揭晓和复盘",
    "每个模式有明确人数、角色、任务、胜利条件和评分",
    "用户可以举报、拉黑、退出和删除账号",
    "运营可以在后台处理举报、主题和房间记录",
    "产品可以通过数据判断留存、复盘价值、好友传播和 AI 成本",
    "TestFlight manual QA",
    "真实 Bundle ID",
    "真实 PostgreSQL",
    "真实 LLM provider key",
    "真实举报告警接收端",
  ]) {
    if (!review.includes(required)) {
      throw new Error(`code/function review missing ${required}`);
    }
  }
  if (!status.includes("docs/CODE_FUNCTION_REVIEW.md")) {
    throw new Error("REAL_APP_STATUS.md must reference docs/CODE_FUNCTION_REVIEW.md");
  }
});

run("completion audit stays aligned", () => {
  const audit = read("docs/COMPLETION_AUDIT.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Completion Audit",
    "Local scope complete with external release blockers",
    "Requirement Audit",
    "Evidence Commands",
    "External Release Blockers",
    "Completion Decision",
    "功能模块、交互、文本和 UI 显示闭环",
    "避免内容冗余、分组混乱、交互重复或不闭环",
    "玩法存在对抗性和成就感",
    "存在类似狼人杀的环节、技能和影响",
    "约 6 种游戏模式",
    "iOS 游戏基本功能具备",
    "代码审查通过",
    "功能审查通过",
    "完成设计 demo，而不是停留在静态原型",
    "达到完成打包上线的所有准备工作，除手动配置外",
    "M01 2 人真假局",
    "M02 3 人猎 **AI**",
    "M03 4 人经典混聊",
    "M04 6 人双 **AI** 立场局",
    "M06 5 人卧底护 **AI**",
    "M08 5 人伪 **AI** 诱饵",
    "npm test --prefix server",
    "npm run balance --prefix server",
    "npm run ai:quality --prefix server",
    "npm run stress --prefix server",
    "node scripts/release_gate.mjs",
    "RELEASE_STRICT=1 node scripts/release_gate.mjs",
    "TestFlight manual QA",
    "真实 **PostgreSQL**",
    "真实 **LLM** provider key",
    "真实举报告警接收端",
    "微信 / Google 原生 iOS SDK",
    "Apple **IAP**",
  ]) {
    if (!audit.includes(required)) {
      throw new Error(`completion audit missing ${required}`);
    }
  }
  if (!status.includes("docs/COMPLETION_AUDIT.md")) {
    throw new Error("REAL_APP_STATUS.md must reference docs/COMPLETION_AUDIT.md");
  }
});

run("weak-network stress covers launched room modes", () => {
  const stress = read("server/scripts/simulate_multiclient_stress.mjs");
  const matrix = read("docs/LAUNCH_QA_MATRIX.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    '["M03", "M04", "M06", "M08"]',
    "friendRooms",
    "modeCoverage",
    "M02",
    "assertSpecialRoleAssigned",
    "Rematch rooms:",
  ]) {
    if (!stress.includes(required)) {
      throw new Error(`weak-network stress script missing ${required}`);
    }
  }
  for (const [source, required] of [
    [matrix, "M03/M04/M06/M08 好友房"],
    [matrix, "公开匹配 M02"],
    [status, "覆盖公开匹配 M02"],
    [status, "M03/M04/M06/M08 好友房"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`weak-network stress documentation missing ${required}`);
    }
  }
});

run("operations runbook stays aligned", () => {
  const runbook = read("docs/OPERATIONS_RUNBOOK.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Operating Principles",
    "Daily Checks",
    "Report Moderation Flow",
    "Incident Severity",
    "AI Fallback Response",
    "Backup And Restore",
    "Rollback",
    "Launch Day Checklist",
    "Ownership",
    "GET /health",
    "GET /ready",
    "GET /admin/metrics",
    "/admin/reports/:reportId/context",
    "/admin/reports/batch",
    "REPORT_SLA_SECONDS",
    "report.alert.failed",
    "ADMIN_READONLY_TOKEN",
    "ADMIN_TOKEN",
    "X-Admin-Token",
    "session 级保存",
    "SEV-1",
    "SEV-2",
    "SEV-3",
    "MIRAGE_AI_QUALITY_REQUIRE_LLM=true",
    "npm run backup:postgres",
    "npm run restore:postgres",
    "npm run verify:production",
    "RELEASE_STRICT=1 node scripts/release_gate.mjs",
    "npm run migrate:postgres",
    "TestFlight 真机 smoke",
    "REPORT_ALERT_WEBHOOK_URL",
    "Agent 1 PM",
    "Agent 2 Game Design",
    "Agent 3 Engineering",
    "Agent 4 UI/UX",
    "Agent 5 QA",
    "Agent 6 Commercialization",
  ]) {
    if (!runbook.includes(required)) {
      throw new Error(`operations runbook missing ${required}`);
    }
  }
  if (!status.includes("docs/OPERATIONS_RUNBOOK.md")) {
    throw new Error("REAL_APP_STATUS.md must reference docs/OPERATIONS_RUNBOOK.md");
  }
});

run("App Store submission notes stay aligned", () => {
  const submission = read("docs/APP_STORE_SUBMISSION.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Login methods: Sign in with Apple is the production-ready iOS entry",
    "Guest entry is not shown in the player-facing app",
    "WeChat and Google server contracts exist, but native iOS login buttons are hidden in Release until configured",
    "Use Sign in with Apple for App Review unless WeChat and Google native SDKs have been configured for the submitted build",
    "Do not expose a guest or local preview button for review",
    "If WeChat login is enabled in the submitted build",
    "If Google login is enabled in the submitted build",
    "AUTH_ALLOW_MOCK_APPLE=false",
    "AUTH_ALLOW_MOCK_WECHAT=false",
    "AUTH_ALLOW_MOCK_GOOGLE=false",
    "Real `APPLE_*` credentials configured",
    "Real `WECHAT_*` credentials configured before enabling WeChat login in production",
    "Real `GOOGLE_CLIENT_ID` configured before enabling Google login in production",
    "Apple **IAP**",
    "does not sell gameplay advantage",
    "Post-round reports are linked to game, room, reporter, target",
    "PrivacyInfo.xcprivacy",
    "Account deletion is available in Settings",
    "Identity reveal and clue review disclose AI identity and goal",
  ]) {
    if (!submission.includes(required)) {
      throw new Error(`App Store submission notes missing ${required}`);
    }
  }
  for (const forbidden of [
    "Guest entry is only for local debug builds",
    "Use Sign in with Apple, Google login",
    "Use Sign in with Apple, WeChat login, or Google login",
    "游客进场",
    "本地试玩",
  ]) {
    if (submission.includes(forbidden)) {
      throw new Error(`App Store submission notes contain stale entry copy: ${forbidden}`);
    }
  }
  if (!status.includes("App Store 提交说明已同步当前固定账号策略")) {
    throw new Error("REAL_APP_STATUS.md must mention aligned App Store submission notes");
  }
});

run("App Store metadata draft stays aligned", () => {
  const metadata = read("docs/APP_STORE_METADATA.md");
  const submission = read("docs/APP_STORE_SUBMISSION.md");
  const status = read("docs/REAL_APP_STATUS.md");
  for (const required of [
    "Field Length Guardrails",
    "App Name | <=30 characters",
    "Subtitle | <=30 characters",
    "Promotional Text | <=170 characters",
    "Keywords | <=100 characters",
    "Description | <=4000 characters",
    "What's New | <=4000 characters",
    "zh-Hans Metadata",
    "en-US Metadata",
    "App Name | 图灵迷局",
    "Subtitle | 找出混在局里的 AI",
    "Subtitle | Find the hidden AI player",
    "Keywords | AI推理,社交推理",
    "Keywords | AI deduction,social deduction",
    "Review Notes",
    "Guest entry is not shown in the player-facing app",
    "Sign in with Apple as the production-ready iOS login entry",
    "WeChat and Google native iOS login require production SDK configuration before their Release entries are shown",
    "Screenshot Plan",
    "Onboarding with Apple login",
    "Task card",
    "Voting confirmation",
    "Reveal / replay",
    "Post-game report sheet",
    "Profile / account safety",
    "Age Rating Draft",
    "Target: 13+ or higher",
    "No gambling",
    "No real-money gameplay advantage",
    "Text chat exists only inside structured game rooms and is moderated",
    "Metadata Stop-Ship Checks",
    "docs/PRIVACY_DATA_MAP.md",
    "狼人杀",
    "找AI",
    "localhost",
    "placeholder production URL",
    "paid products improve win rate",
  ]) {
    if (!metadata.includes(required)) {
      throw new Error(`App Store metadata draft missing ${required}`);
    }
  }
  for (const forbidden of [
    "产品正式名: 找AI",
    "产品正式名: 狼人杀",
    "Guest entry is only for local debug builds",
    "pay to win",
  ]) {
    if (metadata.includes(forbidden)) {
      throw new Error(`App Store metadata draft contains stale or unsafe copy: ${forbidden}`);
    }
  }
  const metadataLimits = new Map([
    ["App Name", 30],
    ["Subtitle", 30],
    ["Promotional Text", 170],
    ["Keywords", 100],
    ["Description", 4000],
    ["What's New", 4000],
  ]);
  for (const [locale, heading] of [
    ["zh-Hans", "## zh-Hans Metadata"],
    ["en-US", "## en-US Metadata"],
  ]) {
    const table = markdownKeyValueTable(markdownSection(metadata, heading));
    for (const [field, limit] of metadataLimits) {
      const value = table.get(field);
      if (!value) {
        throw new Error(`App Store ${locale} metadata missing ${field}`);
      }
      if (value.length > limit) {
        throw new Error(`App Store ${locale} ${field} is ${value.length} characters, over ${limit}`);
      }
    }
  }
  if (!submission.includes("docs/APP_STORE_METADATA.md")) {
    throw new Error("APP_STORE_SUBMISSION.md must reference docs/APP_STORE_METADATA.md");
  }
  if (!status.includes("docs/APP_STORE_METADATA.md")) {
    throw new Error("REAL_APP_STATUS.md must reference docs/APP_STORE_METADATA.md");
  }
});

run("web home inline script compiles", () => {
  const html = renderHomePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Web home page must include inline script");
  }
  new vm.Script(match[1], { filename: "home-inline.js" });
});

run("prototype does not leak hidden AI identity before reveal", () => {
  const prototype = read("mirage-prototype/src/App.jsx");
  const styles = read("mirage-prototype/src/styles.css");
  for (const forbidden of [
    "realRole",
    "ai: true",
    "player.ai",
    "当前怀疑度",
    "className={`player-tile ${player.ai",
  ]) {
    if (prototype.includes(forbidden)) {
      throw new Error(`prototype leaks hidden identity or system suspicion: ${forbidden}`);
    }
  }
  // mirage-prototype 只是历史视觉参考，不再要求跟进正式玩法功能；
  // 这里只保留身份泄漏防线检查。
  for (const required of ["标为线索", "确认删除账号"]) {
    if (!prototype.includes(required)) {
      throw new Error(`prototype safety/core-loop contract missing ${required}`);
    }
  }
  if (!styles.length) {
    throw new Error("prototype styles missing");
  }
});

run("player-facing copy avoids project wording", () => {
  const homePage = read("server/src/homePage.mjs");
  const config = read("server/src/config.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const prototypeApp = read("mirage-prototype/src/App.jsx");
  const playerSources = [
    ["server/src/homePage.mjs", homePage],
    ["server/src/config.mjs", config],
    ["server/src/gameEngine.mjs", engine],
    ["ios/Mirage/Mirage/MirageViews.swift", views],
    ["mirage-prototype/src/App.jsx", prototypeApp],
  ];
  const bannedVisibleCopy = [
    "生成 1 次复盘",
    "复盘可用",
    "复盘率",
    "关联整局",
    "查看模式规则",
    "玩法规则",
    "社区安全",
    "游客账号",
    "处理玩家",
    "房间安全",
    "AI 特征提示",
    "本地推进阶段",
    "数据收集和使用说明",
    "第一局结束后，最近战况会出现在这里。",
    "对局会收在这里",
    "游客上桌中，可绑定 Apple 留住进度",
    "提交投票",
    "选择你认为最像 AI 的玩家",
    "开局，揪出 AI",
    "找出隐藏的 AI",
    "找出隐藏 AI",
    "3 人猎 AI",
    "投票找出 AI",
    "标准 v1.0",
    "下一步确认归票",
    "身份已公开，下一步看线索",
    "看线索",
    "线索局数",
    "线索已整理",
    "线索整理中",
    "发言模板",
    "按本局任务完成判断，结算以服务端复盘为准",
    "信心值只用于复盘校准",
  ];
  for (const [path, source] of playerSources) {
    for (const copy of bannedVisibleCopy) {
      if (source.includes(copy)) {
        throw new Error(`${path} still contains project-style UI copy: ${copy}`);
      }
    }
  }
  if (!homePage.includes('new URLSearchParams(location.search).has("debug")')) {
    throw new Error("Web debug controls must require an explicit debug query param");
  }
  if (homePage.includes('data-action="advance-game">投票')) {
    throw new Error("Discussion composer must not expose a vote-like local advance button");
  }
  for (const required of [
    ".wolf-home .primary-panel",
    "radial-gradient(circle at 88% 4%",
    "background-color: #161c2b",
    ".wolf-home .primary-panel h2",
    "mission-wallet-panel",
    "mission-list",
    "calc(128px + env(safe-area-inset-bottom))",
    ".mission-list .progress-row",
    "history-list",
    "empty-record-card",
    "今晚还没上桌",
    "快速上桌",
    "season-panel",
    "renderSeasonPanel",
    "renderSeasonTrack",
    "renderSeasonObjective",
    "S1 推理赛季",
    "今日段位奖励待领取",
    "继续冲榜",
    "profile-action-grid",
    "profile-action-card",
    "房间规则",
    "删档后不可恢复",
    "背包",
    "今日奖励",
  ]) {
    if (!homePage.includes(required)) {
      throw new Error(`Web missions/profile panels missing dark game styling contract: ${required}`);
    }
  }
  for (const required of ["EmptyRecordCard", "今晚还没上桌", "快速上桌"]) {
    if (!homePage.includes(required) && !views.includes(required)) {
      throw new Error(`record empty-state contract missing ${required}`);
    }
  }
  for (const staleCopy of ["还没有战局记录。", 'InfoPanel(title: "最近牌局"']) {
    if (homePage.includes(staleCopy) || views.includes(staleCopy)) {
      throw new Error(`record empty state still uses static explanatory copy: ${staleCopy}`);
    }
  }
  for (const required of ["ProfileSettingsEntry", "账号与规则", "社区规范、客服、隐私和删档都在这里。"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS profile settings entry missing ${required}`);
    }
  }
  if (views.includes('LinkRow(title: "隐私政策"') || views.includes('LinkRow(title: "服务条款"')) {
    throw new Error("iOS profile home should route account/legal actions through the settings entry");
  }
});

run("reveal to replay uses player endpoint", () => {
  const homePage = read("server/src/homePage.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const api = read("ios/Mirage/Mirage/MirageAPIClient.swift");
  const store = read("ios/Mirage/Mirage/MirageStore.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [source, required] of [
    [engine, "async viewReplay({ userId, gameId })"],
    [engine, "completeRevealedGame(game, this.clock)"],
    [httpServer, 'match(pathname, "/games/:gameId/replay")'],
    [homePage, 'data-action="view-replay">看复盘'],
    [homePage, 'function viewReplay()'],
    [homePage, 'api("/games/" + encodeURIComponent(state.game.id) + "/replay"'],
    [api, "func viewReplay(gameId: String)"],
    [store, "func viewReplay() async"],
    [views, "PrimaryButtonLabel(title: \"看复盘\")"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`reveal replay contract missing ${required}`);
    }
  }
  if (homePage.includes('data-action="advance-game">查看线索') || homePage.includes('data-action="advance-game">看线索')) {
    throw new Error("Player-facing replay button must not call debug advance");
  }
});

run("debug controls stay outside player panels", () => {
  const homePage = read("server/src/homePage.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  for (const required of [
    "function renderDebugDock(game)",
    '<details class="dev-dock" open>',
    "Dev</summary>",
    "renderDebugDock(game)",
    "data-action=\"debug-fill-room\"",
    "data-action=\"debug-complete-replay\"",
    "function debugFillAndStartRoom()",
    "async function debugCompleteReplay()",
    "state.game.phase === \"REVEAL\"",
    "/debug/rooms/",
  ]) {
    if (!homePage.includes(required)) {
      throw new Error(`debug dock contract missing ${required}`);
    }
  }
  for (const required of [
    'match(pathname, "/debug/rooms/:roomId/fill-and-start")',
    'env.NODE_ENV !== "production"',
    "engine.debugFillAndStartRoom",
  ]) {
    if (!httpServer.includes(required)) {
      throw new Error(`debug room fill route contract missing ${required}`);
    }
  }
  for (const forbidden of [
    "const localTools = localDebug",
    '<div class="local-tools"',
    'data-action="advance-game">推进</button>',
    'data-action="advance-game">下一阶段</button>',
    'data-action="debug-complete-replay">复盘</button>',
  ]) {
    if (homePage.includes(forbidden)) {
      throw new Error(`debug control leaked into player panel: ${forbidden}`);
    }
  }
  if (!homePage.includes("remainingSeconds + 1") || homePage.includes("body: { seconds: 1 }")) {
    throw new Error("local debug advance must jump to the next phase instead of nudging one second");
  }
});

run("web onboarding gates entry before auth request", () => {
  const homePage = read("server/src/homePage.mjs");
  const prototypeApp = read("mirage-prototype/src/App.jsx");
  for (const required of [
    'class="auth-provider-list"',
    'aria-label="固定账号登录"',
    'id="appleLoginButton"',
    'id="wechatLoginButton"',
    'id="googleLoginButton"',
    'data-action="mock-apple-login" disabled',
    'data-action="mock-wechat-login" disabled',
    'data-action="mock-google-login" disabled',
    "function updateOnboardingEntryState()",
    "function handleAppInput(event)",
    'throw new Error("请先确认入场规则")',
    'app.addEventListener("input", handleAppInput)',
    'app.addEventListener("change", updateOnboardingEntryState)',
  ]) {
    if (!homePage.includes(required)) {
      throw new Error(`web onboarding gate missing ${required}`);
    }
  }
  if (homePage.includes(">游客上桌<")) {
    throw new Error("web onboarding must not expose guest as a primary login");
  }
  for (const forbidden of ['id="guestLoginButton"', 'data-action="guest-login"', ">本地试玩<"]) {
    if (homePage.includes(forbidden)) {
      throw new Error(`web onboarding must not expose local guest entry: ${forbidden}`);
    }
  }
  for (const forbidden of ['id="entryStatus"', "勾上两项，用固定账号入场。", "可以上桌。"]) {
    if (homePage.includes(forbidden)) {
      throw new Error(`web onboarding must not expose redundant entry prompt: ${forbidden}`);
    }
  }
  for (const required of ["Apple 登录", "微信登录", "Google 登录", "auth-provider-list"]) {
    if (!prototypeApp.includes(required)) {
      throw new Error(`prototype onboarding fixed account entry missing ${required}`);
    }
  }
  for (const forbidden of ["游客进入", "游客上桌", "本地试玩"]) {
    if (prototypeApp.includes(forbidden)) {
      throw new Error(`prototype onboarding must not expose guest entry: ${forbidden}`);
    }
  }
});

run("home information architecture uses three primary tabs", () => {
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [source, required] of [
    [homePage, "function normalizedHomeTab(tab)"],
    [homePage, "今日悬赏"],
    [homePage, "renderLeaderboardPanel"],
    [homePage, "function leaderboardUnlocked"],
    [homePage, "function renderLeaderboardLockedCard"],
    [homePage, "排行榜 3 局后解锁"],
    [homePage, "还差 "],
    [homePage, "renderMissionRewardsPanel"],
    [homePage, "leaderboard-embed"],
    [homePage, "mission-lobby-block"],
    [homePage, "nav-icon"],
    [homePage, "nav-lobby"],
    [homePage, "nav-records"],
    [homePage, "nav-profile"],
    [homePage, "nav-badge"],
    [homePage, "renderHomeNavBadge"],
    [homePage, "homeNavBadge"],
    [homePage, "claimable && !item.claimed"],
    [views, "LeaderboardHomeSection(leaderboard: model.leaderboard)"],
    [views, "LeaderboardLockedCard"],
    [views, "排行榜 3 局后解锁"],
    [views, "还差 \\(remainingGames) 局"],
    [views, "MissionsHomeSection(summary: summary)"],
    [views, "SeasonRankCard"],
    [views, "SeasonStatsPanel"],
    [views, "DarkProgressStatusRow"],
    [views, "S1 推理赛季"],
    [views, "今日段位奖励待领取"],
    [views, "继续冲榜"],
    [views, "openTab(.lobby)"],
    [views, "var systemImage: String"],
    [views, "Image(systemName: tab.systemImage)"],
    [views, "badge(for: tab)"],
    [views, "activeGameCount"],
    [views, "missionClaimableCount"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`lobby shortcut contract missing ${required}`);
    }
  }
  // 首页只保留模式开始入口：悬赏捷径、最近战报、世界观卡不再出现在大厅。
  for (const [sourceName, source, forbidden] of [
    ["home page", homePage, 'data-shortcut="bounty"'],
    ["home page", homePage, "renderLobbyRecentReplay"],
    ["home page", homePage, "renderLobbyShortcuts"],
    ["home page", homePage, "renderWorldSettingCard"],
    ["iOS views", views, "LobbyShortcutGrid"],
    ["iOS views", views, "LobbyRecentReplayCard"],
    ["iOS views", views, "WorldSettingCard"],
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${sourceName} still exposes removed lobby block: ${forbidden}`);
    }
  }
  for (const [sourceName, source, forbidden] of [
    ["web home", homePage, 'data-tab="leaderboard"'],
    ["web home", homePage, 'data-tab="missions"'],
    ["web home", homePage, "nav-leaderboard"],
    ["web home", homePage, "nav-missions"],
    ["web home", homePage, "mission-profile-block"],
    ["web home", homePage, 'data-tab="profile" data-shortcut="bounty"'],
    ["iOS views", views, "case leaderboard"],
    ["iOS views", views, "case missions"],
    ["iOS views", views, "openTab(.leaderboard)"],
    ["iOS views", views, "openTab(.missions)"],
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${sourceName} still exposes old five-tab IA: ${forbidden}`);
    }
  }
});

run("web friend room exposes ready and start state", () => {
  const homePage = read("server/src/homePage.mjs");
  for (const required of [
    "const humanPlayers = room.players.filter",
    "const readyCount = humanPlayers.filter",
    "const readyTarget = Math.max(requiredHumans, humanCount)",
    "const isCurrentReady = currentPlayer?.ready === true",
    "const canReady = room.status === \"LOBBY\" && !isCurrentReady",
    "const startButtonTitle = canStart",
    "你是房主",
    "等待房主",
    "readyTarget",
    "等待准备",
    "房主离开时会自动换房主",
    'data-action="ready-room"',
    'data-action="start-room"',
  ]) {
    if (!homePage.includes(required)) {
      throw new Error(`web friend-room ready/start contract missing ${required}`);
    }
  }
});

run("web discussion keeps the simplified action set", () => {
  const homePage = read("server/src/homePage.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  const engine = read("server/src/gameEngine.mjs");
  for (const required of [
    "function renderDiscussionTarget(game)",
    "function selectedDiscussionPlayer(game)",
    "function toggleMessageClue(messageId)",
    'data-action="toggle-message-clue"',
    '"/reactions"',
    "点座位盯人",
    "标为线索",
    "已标线索",
    "reactionType",
    "我标记的发言",
  ]) {
    if (!homePage.includes(required)) {
      throw new Error(`web discussion contract missing ${required}`);
    }
  }
  // 怀疑度、话术模板、中段表态和角色技能已下线，不允许回流。
  for (const forbidden of [
    "function playerSuspicion(player, message)",
    "对他的怀疑度",
    "可疑点：",
    "async function sendMessage(text)",
    "sendMessage(button.dataset.text",
    'data-action="use-probe"',
    '"/skills/',
    'data-action="quick-chat"',
    'data-action="quote-message"',
    'data-action="mark-suspicion"',
    'data-action="submit-mid-check"',
    'data-action="use-role-skill"',
    "起手句",
    "证据笔记",
    "我的怀疑标记",
    "中段表态",
    "追问技能",
  ]) {
    if (homePage.includes(forbidden)) {
      throw new Error(`web discussion still exposes a removed mechanic: ${forbidden}`);
    }
  }
  for (const forbidden of [
    "/games/:gameId/skills/:skillId",
    "/games/:gameId/suspicions",
    "/games/:gameId/mid-checks",
    "engine.useSkill",
  ]) {
    if (httpServer.includes(forbidden)) {
      throw new Error(`removed gameplay route still wired: ${forbidden}`);
    }
  }
  for (const required of [
    "async react({ userId, gameId, messageId, type })",
    "reaction_not_allowed_in_phase",
    "invalid_reaction_type",
    "viewerReactionType",
  ]) {
    if (!engine.includes(required)) {
      throw new Error(`clue reaction engine contract missing ${required}`);
    }
  }
  for (const forbidden of [
    "async markSuspicion",
    "async submitMidCheck",
    "async useSkill",
    "voteConfidenceLevels",
    "gameSkillState",
    "suspicionSummary",
    "midCheckSummary",
    "skillSummary",
  ]) {
    if (engine.includes(forbidden)) {
      throw new Error(`removed mechanic still in engine: ${forbidden}`);
    }
  }
});

run("seats are selectable only during action phases", () => {
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [source, required] of [
    [homePage, "const canSelectSeat = (game.phase === \"DISCUSSION\" || game.phase === \"VOTING\") && !isSelf"],
    [homePage, 'class="seat-card'],
    [homePage, '" locked"'],
    [homePage, 'data-action="select-target"'],
    [views, "private var canSelectSeats: Bool"],
    [views, 'game.phase == "DISCUSSION" || game.phase == "VOTING"'],
    [views, "if isSelf || !canSelectSeats"],
    [views, "selectedDiscussionTargetId"],
    [views, "selectedVoteTargetId"],
    [views, "selectedSeatTargetId"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`seat selection phase contract missing ${required}`);
    }
  }
});

run("hidden roles stay hidden before reveal", () => {
  const engine = read("server/src/gameEngine.mjs");
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const apiContract = read("docs/API_CONTRACT.md");
  const tests = read("server/test/api.test.mjs");
  for (const forbidden of [
    'player.kind === "unknown" ? "AI ?"',
    'player.kind === "unknown" ? "avatar-ai"',
    "AI ?",
  ]) {
    if (homePage.includes(forbidden) || views.includes(forbidden)) {
      throw new Error(`hidden role leak remains: ${forbidden}`);
    }
  }
  for (const [source, required] of [
    [engine, "userId: revealed || isSelf ? player.userId : null"],
    [engine, 'kind: revealed || isSelf ? player.kind : "unknown"'],
    [engine, 'role: revealed || isSelf ? player.role : "hidden"'],
    [homePage, "function visibleRoleTitle(player, phase)"],
    [homePage, 'return "待判断"'],
    [views, "func visibleRoleTitle(_ player: GamePlayer, phase: String, isSelf: Bool) -> String"],
    [views, 'return "待判断"'],
    [apiContract, 'Other seats return `userId: null`, `kind: "unknown"`, `role: "hidden"`'],
    [tests, "unresolved games hide other players identity and user ids"],
    [tests, "others.every((player) => player.userId === null)"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`hidden role contract missing ${required}`);
    }
  }
  if (views.includes('marked: player.kind == "unknown"') || views.includes("playerKindTitle(player.kind)")) {
    throw new Error("iOS gameplay must not use unknown kind as a visible identity hint");
  }
});

run("advanced modes are playable special-role friend rooms", () => {
  const config = read("server/src/config.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const homePage = read("server/src/homePage.mjs");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const tests = read("server/test/api.test.mjs");
  const apiContract = read("docs/API_CONTRACT.md");
  const gameModeBlueprint = read("docs/GAME_MODE_BLUEPRINT.md");
  for (const [source, required] of [
    [config, "M06"],
    [config, "引路人"],
    [config, "人类卧底"],
    [config, "M08"],
    [config, "拟声陷阱"],
    [config, "minHumanCount: 4"],
    [engine, "function assignModeRoles"],
    [engine, "human_undercover"],
    [engine, "fake_ai"],
    [engine, "function roleSelectionScore"],
    [engine, "function selectSpecialHuman"],
    [engine, "hiddenTask"],
    [engine, "aiWasUniqueHighest"],
    [engine, "function replayExplanation"],
    [homePage, "阵营任务"],
    [homePage, "诱饵任务"],
    [homePage, "人类卧底"],
    [homePage, "伪 AI 真人"],
    [models, "let hiddenTask: String?"],
    [views, "引路人"],
    [views, "拟声陷阱"],
    [views, "阵营任务"],
    [views, "诱饵任务"],
    [views, "人类卧底"],
    [views, "伪 AI 真人"],
    [apiContract, "M01, M02, M03, M04, M06 and M08"],
    [apiContract, '"hiddenTask": null'],
    [apiContract, "Clients must not assume the last joined user"],
    [gameModeBlueprint, "不按入座顺序固定"],
    [tests, "special human roles are not fixed to last joined player"],
    [tests, "specialRoleContext"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`advanced mode contract missing ${required}`);
    }
  }
  for (const forbidden of ["[...realHumans].reverse()", ".reverse().find((player) => player.userId)"]) {
    if (engine.includes(forbidden)) {
      throw new Error(`advanced role assignment still depends on join order: ${forbidden}`);
    }
  }
});

run("M04 dual AI mode is a real split-vote game", () => {
  const config = read("server/src/config.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const homePage = read("server/src/homePage.mjs");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const apiContract = read("docs/API_CONTRACT.md");
  const blueprint = read("docs/GAME_MODE_BLUEPRINT.md");
  for (const [source, required] of [
    [config, 'voteType: "identify_ai_pair"'],
    [config, "每名真人仍只投 1 票"],
    [engine, "function aiPlayers(game)"],
    [engine, "aiPairIdentified"],
    [engine, 'game.modeId === "M04"'],
    [engine, "aiPlayerIds"],
    [engine, "aiGoals"],
    [engine, "双 AI 阵营撑过归票"],
    [homePage, "分票锁定双 AI"],
    [homePage, "renderAiGoalNotes"],
    [models, "let aiPlayerIds: [String]?"],
    [models, "struct AiGoal"],
    [views, "分票锁定双 AI"],
    [views, "visibleAiGoals"],
    [apiContract, "aiPlayerIds"],
    [apiContract, "aiGoals"],
    [blueprint, "M04（双 AI）"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`M04 dual AI contract missing ${required}`);
    }
  }
});

run("opening task card gates discussion start", () => {
  const engine = read("server/src/gameEngine.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  const homePage = read("server/src/homePage.mjs");
  const apiClient = read("ios/Mirage/Mirage/MirageAPIClient.swift");
  const store = read("ios/Mirage/Mirage/MirageStore.swift");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const config = read("server/src/config.mjs");
  const apiContract = read("docs/API_CONTRACT.md");
  const apiTests = read("server/test/api.test.mjs");
  const prototype = read("mirage-prototype/src/App.jsx");
  for (const [source, required] of [
    [engine, "task_card_not_acknowledged"],
    [engine, "function assertTaskCardAcknowledged"],
    [engine, "async acknowledgeTaskCard"],
    [engine, "taskAcks"],
    [engine, "game.task_card.acknowledged"],
    [httpServer, 'match(pathname, "/games/:gameId/task-card")'],
    [homePage, "task-card-overlay"],
    [homePage, "renderTaskCardOverlay"],
    [homePage, "shouldShowTaskCard"],
    [homePage, "async function acknowledgeTaskCard"],
    [homePage, '"/task-card"'],
    [homePage, "game.taskCard?.acknowledged === false"],
    [homePage, "shouldRenderTaskCard"],
    [homePage, 'data-action="ack-task-card"'],
    [homePage, 'data-action="open-task-card"'],
    [homePage, 'data-action="close-task-card"'],
    [homePage, "reviewingTaskGameId"],
    [homePage, "先确认任务卡，再开始发言"],
    [homePage, "task-detail-grid"],
    [homePage, "function taskCardTitle"],
    [homePage, "侦探任务"],
    [homePage, "阵营任务"],
    [homePage, "诱饵任务"],
    [homePage, "伪装任务"],
    [homePage, "任务目标"],
    [homePage, "function taskWinCondition"],
    [homePage, "function taskTools"],
    [homePage, "function taskBoundary"],
    [homePage, "让它们的得票都压过所有真人"],
    [homePage, "可用工具"],
    [homePage, "禁忌"],
    [views, "TaskCardPanel"],
    [views, "TaskCardDetailRow"],
    [views, "showTaskCardReview"],
    [views, "taskAction:"],
    [views, 'primaryTitle: "开始发言"'],
    [views, 'primaryTitle: "继续游戏"'],
    [views, "game.taskCard?.acknowledged == false"],
    [apiClient, "func acknowledgeTaskCard"],
    [store, "func acknowledgeTaskCard"],
    [models, "struct TaskCardState"],
    [models, "let taskCard: TaskCardState?"],
    [views, "taskCardPending"],
    [views, "先确认任务卡，再开始发言"],
    [views, "func taskCardTitle(_ role: String) -> String"],
    [views, "侦探任务"],
    [views, "阵营任务"],
    [views, "诱饵任务"],
    [views, "伪装任务"],
    [views, "任务目标"],
    [views, "func taskGoal(_ player: GamePlayer?, modeId: String? = nil) -> String"],
    [views, "func taskWinCondition(_ player: GamePlayer?, game: MirageGame) -> String"],
    [views, "func taskTools(_ player: GamePlayer?, game: MirageGame) -> String"],
    [views, "func taskBoundary(_ player: GamePlayer?) -> String"],
    [views, "让它们的得票都压过所有真人"],
    [views, "可用工具"],
    [views, "禁忌"],
    [apiContract, "POST `/games/:gameId/task-card`"],
    [apiContract, "task_card_not_acknowledged"],
    [apiTests, "task card acknowledgement is server-authoritative"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`opening task card contract missing ${required}`);
    }
  }
  for (const forbidden of ['<button class="quiet-button full" data-action="go-home">回大厅</button>', "Button(action: goHome)"]) {
    if (homePage.includes(forbidden) || views.includes(forbidden)) {
      throw new Error(`opening task card still exposes exit action: ${forbidden}`);
    }
  }
  for (const [sourceName, source] of [
    ["home page", homePage],
    ["iOS views", views],
    ["server config", config],
    ["API contract", apiContract],
    ["prototype", prototype],
  ]) {
    for (const forbidden of ["身份卡", "你的身份", "你的本局任务", "你是真人", "普通真人", "开局只看自己的身份"]) {
      if (source.includes(forbidden)) {
        throw new Error(`${sourceName} still exposes old identity-card copy: ${forbidden}`);
      }
    }
  }
});

run("iOS phase rail starts with task card", () => {
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const required of [
    'GamePhaseRail(phase: game.phase, taskCardPending: shouldShowTaskCard(game))',
    '["TASK", "DISCUSSION", "FINAL_STATEMENT", "VOTING", "REVEAL", "COMPLETED"]',
    'if taskCardPending',
    'case "TASK":',
    '"任务"',
  ]) {
    if (!views.includes(required)) {
      throw new Error(`iOS phase rail task-card contract missing ${required}`);
    }
  }
});

run("final statement phase is playable before voting", () => {
  const engine = read("server/src/gameEngine.mjs");
  const config = read("server/src/config.mjs");
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const apiContract = read("docs/API_CONTRACT.md");
  for (const [source, required] of [
    [config, "finalStatementSeconds"],
    [config, "最终陈述"],
    [engine, 'game.phase = "FINAL_STATEMENT"'],
    [engine, "final_statement_already_sent"],
    [engine, "addAiFinalStatement"],
    [engine, "finalStatement: finalStatementState"],
    [homePage, 'game.phase === "FINAL_STATEMENT"'],
    [homePage, "renderFinalStatementPanel"],
    [homePage, "输入最后陈述"],
    [views, 'case "FINAL_STATEMENT"'],
    [views, "FinalStatementInfoPanel"],
    [views, "finalStatementSubmitted"],
    [models, "struct FinalStatementState"],
    [apiContract, "finalStatementSeconds"],
    [apiContract, "final_statement_already_sent"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`final statement phase contract missing ${required}`);
    }
  }
});

run("mid-check phase stays removed from the unified flow", () => {
  const engine = read("server/src/gameEngine.mjs");
  const config = read("server/src/config.mjs");
  const httpServer = read("server/src/httpServer.mjs");
  const homePage = read("server/src/homePage.mjs");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const apiClient = read("ios/Mirage/Mirage/MirageAPIClient.swift");
  const store = read("ios/Mirage/Mirage/MirageStore.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [sourceName, source, forbidden] of [
    ["config", config, "midCheckSeconds"],
    ["config", config, "中段表态"],
    ["engine", engine, 'game.phase = "MID_CHECK"'],
    ["engine", engine, "submitMidCheck"],
    ["engine", engine, "midCheckSummary"],
    ["httpServer", httpServer, "/games/:gameId/mid-checks"],
    ["homePage", homePage, "renderMidCheckPanel"],
    ["homePage", homePage, 'data-action="submit-mid-check"'],
    ["homePage", homePage, "midCheckStageNames"],
    ["models", models, "struct MidCheckState"],
    ["models", models, "struct MidCheckRecord"],
    ["apiClient", apiClient, "func submitMidCheck"],
    ["store", store, "func submitMidCheck"],
    ["views", views, "MidCheckActionPanel"],
    ["views", views, 'case "MID_CHECK"'],
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${sourceName} still contains removed mid-check mechanic: ${forbidden}`);
    }
  }
  // 兼容旧存档：引擎需要把历史 MID_CHECK 对局直接推进到最终陈述。
  if (!engine.includes('if (game.phase === "MID_CHECK")')) {
    throw new Error("engine must migrate legacy MID_CHECK games to FINAL_STATEMENT");
  }
  if (homePage.includes("流程：任务卡 → 开聊 → 归票 → 揭晓 → 线索")) {
    throw new Error("waiting screen still hardcodes the old phase flow");
  }
});

run("player-facing human role copy uses detective label", () => {
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const engine = read("server/src/gameEngine.mjs");
  for (const [source, required] of [
    [homePage, 'if (role === "human") return "侦探"'],
    [views, "侦探胜利"],
    [views, '"侦探"'],
    [engine, "侦探阵营把真正 AI 投成唯一最高票"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`player-facing detective copy missing ${required}`);
    }
  }
  for (const [sourceName, source] of [
    ["home page", homePage],
    ["iOS views", views],
    ["game engine", engine],
  ]) {
    for (const forbidden of ["真人胜利", "真人玩家把 AI", "普通真人"]) {
      if (source.includes(forbidden)) {
        throw new Error(`${sourceName} still exposes old human-role copy: ${forbidden}`);
      }
    }
  }
});

run("vote confirmation prevents accidental submit", () => {
  const homePage = read("server/src/homePage.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const tests = read("server/test/api.test.mjs");
  const apiContract = read("docs/API_CONTRACT.md");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [source, required] of [
    [engine, "const myVote = game.votes.find"],
    [engine, "myVote: game.phase === \"VOTING\" ? myVote : null"],
    [engine, "function voteState(game, viewerUserId)"],
    [engine, "voteState: voteState(game, viewerUserId)"],
    [engine, "submittedCount"],
    [engine, "game.votes = game.votes.filter((item) => item.userId !== userId)"],
    [engine, "targetPlayerId === \"abstain\" && game.modeId !== \"M01\""],
    [apiContract, '`targetPlayerId: "abstain"` is allowed only in M01'],
    [apiContract, "`voteState` exposes `submitted`, `submittedCount`, `remaining`, and `total`"],
    [apiContract, 'reactionType: "clue"'],
    [tests, "invalidAbstain"],
    [tests, "reaction_not_allowed_in_phase"],
    [homePage, "confirmingVote"],
    [homePage, "selectedVotePlayer"],
    [homePage, "renderVoteConfirm"],
    [homePage, "function renderMyVoteStatus(game)"],
    [homePage, "function voteProgressText(game)"],
    [homePage, "function renderVoteEvidence(game, player)"],
    [homePage, "function playerSavedClues(game, player)"],
    [homePage, "function carriedDiscussionTarget(game)"],
    [homePage, "function renderVoteCarryHint(game)"],
    [homePage, "selectedDiscussionTargetId"],
    [homePage, "selectedVoteTargetId"],
    [homePage, "lastDiscussionTargetId"],
    [homePage, 'data-action="clear-vote-target"'],
    [homePage, "已沿用盯人目标"],
    [homePage, "标记发言"],
    [homePage, "我标记的发言"],
    [homePage, 'data-action="confirm-vote"'],
    [homePage, 'data-action="cancel-vote-confirm"'],
    [homePage, "game.myVote"],
    [homePage, "game.voteState"],
    [homePage, "当前票"],
    [homePage, "可在归票结束或全员交票前修改"],
    [homePage, "function phaseExpired(value)"],
    [homePage, "归票已结束，正在揭晓身份"],
    [homePage, "名真人交票"],
    [homePage, "最后一次提交生效"],
    [homePage, "确认归票"],
    [homePage, "返回修改"],
    [views, "@State private var confirmingVote"],
    [models, "let myVote: GameVote?"],
    [models, "let voteState: VoteState?"],
    [models, "let reactionType: String?"],
    [models, "struct VoteState"],
    [views, "toggleMessageClue"],
    [views, "reactionType == \"clue\""],
    [views, "@State private var lastDiscussionTargetId"],
    [views, "@State private var selectedDiscussionTargetId"],
    [views, "@State private var selectedVoteTargetId"],
    [views, "carriedDiscussionTarget"],
    [views, "已沿用盯人目标"],
    [views, "currentVoteTargetId(for:"],
    [views, "标为线索"],
    [views, "我标记的发言"],
    [views, "VoteStatusPill"],
    [views, "voteProgressSuffix"],
    [views, "VoteEvidencePills"],
    [views, "VoteConfirmationCard"],
    [views, "当前票"],
    [views, "可在归票结束或全员交票前修改"],
    [views, "func phaseExpired(_ value: String?) -> Bool"],
    [views, "归票已结束"],
    [views, "正在揭晓身份，稍后会自动进入结果。"],
    [views, "名真人交票"],
    [views, "确认归票"],
    [views, "返回修改"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`vote confirmation contract missing ${required}`);
    }
  }
  // 归票信心已下线，不允许回流。
  for (const [sourceName, source, forbidden] of [
    ["engine", engine, "voteConfidenceLevels"],
    ["home page", homePage, "confidenceTitle"],
    ["iOS views", views, "confidenceTitle"],
    ["models", models, "let confidence: String"],
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${sourceName} still contains removed vote confidence: ${forbidden}`);
    }
  }
  for (const [sourceName, source] of [
    ["home page", homePage],
    ["iOS views", views],
  ]) {
    if (source.includes("交票后不能更改")) {
      throw new Error(`${sourceName} still exposes locked-vote copy`);
    }
  }
});

run("M01 is a truth-test game, not a deterministic AI target", () => {
  const config = read("server/src/config.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const homePage = read("server/src/homePage.mjs");
  const tests = read("server/test/api.test.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const apiContract = read("docs/API_CONTRACT.md");
  for (const [source, required] of [
    [config, "对面可能是 AI，也可能是真人补位"],
    [config, "投票时判断对方是 AI 还是真人"],
    [engine, "function m01OpponentKind"],
    [engine, "MIRAGE_M01_OPPONENT_KIND"],
    [engine, "function m01Judgement"],
    [engine, "targetPlayerId === \"abstain\""],
    [engine, "scripted_human.message.sent"],
    [homePage, "判断是 AI"],
    [homePage, "判断是真人"],
    [homePage, "归票时判断对方是真人还是 AI"],
    [homePage, "讨论结束，判断对方是真人还是 AI"],
    [homePage, "不是弃票，是真假判断"],
    [views, "M01HumanGuessConfirmationCard"],
    [views, "判断是真人"],
    [views, "归票时判断对方是真人还是 AI"],
    [tests, "MIRAGE_M01_OPPONENT_KIND: \"scripted_human\""],
    [tests, "targetPlayerId: \"abstain\""],
    [apiContract, "judge the opponent as human"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`M01 truth-test contract missing ${required}`);
    }
  }
});

run("post-game settlement closes the game loop", () => {
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [source, required] of [
    [homePage, "result-hero"],
    [homePage, "settlement-grid"],
    [homePage, "renderReplayTaskResult"],
    [homePage, "renderReplayJudgement"],
    [homePage, "renderReplayCalibration"],
    [homePage, "renderReplayVoteBoard"],
    [homePage, "renderReplayIdentityBoard"],
    [homePage, "我的任务结果"],
    [homePage, "我的判断"],
    [homePage, "复盘校准"],
    [homePage, "判断命中"],
    [homePage, "判断失准"],
    [homePage, "投票板"],
    [homePage, "身份结果"],
    [homePage, "renderRewardCard"],
    [homePage, "renderAccountProtectionCard"],
    [homePage, "首局战绩已保存"],
    [homePage, "Apple 已保护战绩"],
    [homePage, "go-profile"],
    [homePage, "go-missions"],
    [homePage, "go-records"],
    [homePage, "本局结算"],
    [homePage, "本局奖励"],
    [views, "ResultSettlementCard"],
    [views, "ReplayTaskResultCard"],
    [views, "ReplayVoteBoardCard"],
    [views, "ReplayIdentityBoardCard"],
    [views, "ReplayCalibrationCard"],
    [views, "AccountProtectionReplayCard"],
    [views, "首局战绩已保存"],
    [views, "Apple 已保护战绩"],
    [views, "preferredHomeTab"],
    [views, "SettlementMetric"],
    [views, "我的任务结果"],
    [views, "我的判断"],
    [views, "复盘校准"],
    [views, "判断命中"],
    [views, "判断失准"],
    [views, "投票板"],
    [views, "身份结果"],
    [views, "本局结算"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`post-game settlement contract missing ${required}`);
    }
  }
});

run("post-game reports do not show empty safety state", () => {
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  if (homePage.includes("暂无可举报玩家") || homePage.includes("本局没有其他真人玩家") || homePage.includes("局后举报只处理真人玩家")) {
    throw new Error("Web post-game must not show an empty report card in AI-only quick games");
  }
  if (views.includes("只举报本局真人玩家，举报会带上本局记录。") || views.includes("局后举报只处理真人玩家")) {
    throw new Error("iOS post-game must not show report instructions when there are no reportable players");
  }
  for (const phrase of ["记录会自动带上", "复盘会用到", "举报只关联本局", "带上本局记录", "安全记录"]) {
    if (homePage.includes(phrase) || views.includes(phrase)) {
      throw new Error(`Player-facing UI still contains explanatory copy: ${phrase}`);
    }
  }
  for (const [source, required] of [
    [homePage, "function renderPostGameReports(game)"],
    [homePage, "function renderReportReasonSheet(game)"],
    [homePage, "function reportReasonOptions()"],
    [homePage, 'data-action="open-report-player"'],
    [homePage, 'data-action="block-player"'],
    [homePage, 'data-action="submit-report-player"'],
    [homePage, 'api("/blocks"'],
    [homePage, "post_game_disruptive_play"],
    [homePage, 'return "";'],
    [homePage, "局后处理"],
    [views, "if !reportablePlayers.isEmpty"],
    [views, "ReportPlayersSection(reportablePlayers: reportablePlayers, report: report)"],
    [views, "ReportReasonOption"],
    [views, "post_game_disruptive_play"],
    [views, "选择一个理由，运营会查看本局上下文。"],
    [views, "局后处理"],
    [views, "Button(\"拉黑\", role: .destructive)"],
    [views, "举报并拉黑"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`post-game report visibility contract missing ${required}`);
    }
  }
  for (const [source, required] of [
    [read("server/src/httpServer.mjs"), 'pathname === "/blocks"'],
    [read("server/src/gameEngine.mjs"), "cannot_block_self"],
    [read("ios/Mirage/Mirage/MirageAPIClient.swift"), "func blockUser(targetUserId: String)"],
    [read("ios/Mirage/Mirage/MirageStore.swift"), "func blockUser(targetUserId: String, nickname: String)"],
    [read("ios/Mirage/Mirage/MirageModels.swift"), "struct MirageBlock"],
    [read("server/test/api.test.mjs"), "standalone blocks do not create reports and cannot target self"],
    [read("docs/API_CONTRACT.md"), "POST `/blocks`"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`standalone block contract missing ${required}`);
    }
  }
});

run("iOS Release API base URL policy", () => {
  const releaseConfig = read("ios/Mirage/Mirage/Release.xcconfig");
  const match = /^MIRAGE_API_BASE_URL\s*=\s*(\S+)/m.exec(releaseConfig);
  if (!match) {
    throw new Error("Release.xcconfig must set MIRAGE_API_BASE_URL");
  }
  const baseURL = match[1];
  if (!baseURL.startsWith("https://")) {
    throw new Error("Release MIRAGE_API_BASE_URL must use HTTPS");
  }
  if (/localhost|127\.0\.0\.1/i.test(baseURL)) {
    throw new Error("Release MIRAGE_API_BASE_URL must not point to localhost");
  }
});

run("fixed account login release contract", () => {
  const entitlements = readPlistJson("ios/Mirage/Mirage/Mirage.entitlements");
  const appleSignIn = entitlements["com.apple.developer.applesignin"] || [];
  if (!appleSignIn.includes("Default")) {
    throw new Error("Mirage.entitlements must enable Sign in with Apple");
  }
  const project = read("ios/Mirage/Mirage.xcodeproj/project.pbxproj");
  if (!project.includes("CODE_SIGN_ENTITLEMENTS = Mirage/Mirage.entitlements;")) {
    throw new Error("Xcode project must use Mirage.entitlements for signing");
  }
  const releaseConfig = read("ios/Mirage/Mirage/Release.xcconfig");
  const bundleMatch = /^PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(\S+)/m.exec(releaseConfig);
  if (!bundleMatch) {
    throw new Error("Release.xcconfig must set PRODUCT_BUNDLE_IDENTIFIER");
  }
  const deployment = read("docs/DEPLOYMENT.md");
  if (
    !deployment.includes("APPLE_BUNDLE_ID=com.yourcompany.mirage") ||
    !deployment.includes("APPLE_CLIENT_ID=com.yourcompany.mirage") ||
    !deployment.includes("GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com") ||
    !deployment.includes("WECHAT_APP_ID=wx-your-wechat-open-platform-app-id") ||
    !deployment.includes("WECHAT_APP_SECRET=replace-with-wechat-app-secret") ||
    !deployment.includes("AUTH_ALLOW_MOCK_WECHAT=false") ||
    !deployment.includes("AUTH_ALLOW_MOCK_GOOGLE=false")
  ) {
    throw new Error("docs/DEPLOYMENT.md must document Apple, WeChat and Google login configuration");
  }
  const httpServer = read("server/src/httpServer.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const apiClient = read("ios/Mirage/Mirage/MirageAPIClient.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const debugConfig = read("ios/Mirage/Mirage/Debug.xcconfig");
  const apiContract = read("docs/API_CONTRACT.md");
  const schema = read("docs/POSTGRES_SCHEMA.sql");
  for (const [source, required] of [
    [httpServer, 'pathname === "/auth/google"'],
    [httpServer, 'pathname === "/auth/wechat"'],
    [httpServer, "verifyGoogleIdentityToken"],
    [httpServer, "verifyWeChatLoginCode"],
    [engine, "async upsertGoogleUser"],
    [engine, "async upsertWeChatUser"],
    [engine, 'kind: "google"'],
    [engine, 'kind: "wechat"'],
    [apiClient, "func signInWithGoogle("],
    [apiClient, "func signInWithWeChat("],
    [views, "Google 登录"],
    [views, "微信登录"],
    [views, "#if DEBUG"],
    [views, "mock.google.ios-preview"],
    [views, "mock.wechat.ios-preview"],
    [debugConfig, "-D DEBUG"],
    [apiContract, "POST `/auth/google`"],
    [apiContract, "POST `/auth/wechat`"],
    [schema, "'google'"],
    [schema, "'wechat'"],
    [schema, "google_sub TEXT UNIQUE"],
    [schema, "wechat_sub TEXT UNIQUE"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`fixed account login contract missing ${required}`);
    }
  }
  for (const forbidden of ["本地试玩", "signInGuest(", "Google 登录待接入", "微信登录待接入", "正在接入正式 SDK", "微信开放平台 SDK"]) {
    if (views.includes(forbidden)) {
      throw new Error(`iOS onboarding must not expose local or implementation-state entry: ${forbidden}`);
    }
  }
  if (views.includes("signInGuest(")) {
    throw new Error("iOS onboarding must not expose local guest entry");
  }
});

run("profile safety entry stays player-facing", () => {
  const homePage = read("server/src/homePage.mjs");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  for (const [source, required] of [
    [homePage, '<p class="panel-kicker">账号与安全</p>'],
    [homePage, "固定账号保存战绩和装扮"],
    [homePage, "<strong>安全中心</strong>"],
    [homePage, "已处理 "],
    [homePage, "拉黑 "],
    [homePage, '<span class="mode-pill">账号</span>'],
    [views, "struct ProfileAccountCard"],
    [views, 'ProfileAccountCard(userName: model.user?.nickname, isBanned: model.isBanned)'],
    [views, 'Text("账号与安全")'],
    [views, 'Text("固定账号保存战绩和装扮。房间规则、客服申诉、隐私和删档都在这里。")'],
    [views, 'ProfileStatusRow(title: "安全中心"'],
    [views, "已处理 \\(summary?.safety.reportsSubmitted ?? 0) 次举报"],
    [views, 'meta: "账号"'],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`profile safety entry missing player-facing copy: ${required}`);
    }
  }
  for (const forbidden of [
    "<strong>局后处理</strong><span>举报 ",
    '<p class="panel-kicker">玩家等级</p>',
    "PlayerProgressionCard(summary: summary)",
    'ProfileStatusRow(title: "玩家"',
    'ProfileStatusRow(title: "局后处理"',
  ]) {
    if (homePage.includes(forbidden) || views.includes(forbidden)) {
      throw new Error(`profile safety entry must not use post-game report copy: ${forbidden}`);
    }
  }
});

run("iOS safety UX gates", () => {
  const app = read("ios/Mirage/Mirage/MirageApp.swift");
  const models = read("ios/Mirage/Mirage/MirageModels.swift");
  const store = read("ios/Mirage/Mirage/MirageStore.swift");
  const api = read("ios/Mirage/Mirage/MirageAPIClient.swift");
  const views = read("ios/Mirage/Mirage/MirageViews.swift");
  const httpServer = read("server/src/httpServer.mjs");
  const engine = read("server/src/gameEngine.mjs");
  const apiContract = read("docs/API_CONTRACT.md");
  for (const [source, required] of [
    [app, "@Environment(\\.scenePhase)"],
    [app, "phase == .active"],
    [app, "model.resumeFromForeground()"],
    [store, "func resumeFromForeground() async"],
    [store, "api.fetchMe()"],
    [store, "api.fetchMatchmakingStatus(ticketId:"],
    [store, "api.fetchRoom(roomId:"],
    [store, "api.fetchGame(gameId:"],
    [store, "route = .game"],
    [store, "route = .home"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`iOS foreground resume contract missing ${required}`);
    }
  }
  for (const required of ["var isBanned", "func canStartPlay", "账号已被限制"]) {
    if (!store.includes(required) && !views.includes(required)) {
      throw new Error(`iOS client missing banned-user UX guard: ${required}`);
    }
  }
  for (const required of ["BannedAccountBanner", ".disabled(model.isBanned)", "currentUserId", "reportablePlayers", "局后处理", "拉黑", "举报并拉黑"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS client missing report or banned-state UI guard: ${required}`);
    }
  }
  for (const required of ["GameRoomTopBar", "GamePhaseRail", "GameSeatBoard", "StageActionPanel", "BottomPhaseBar", "标为线索", "我标记的发言"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS game room UI missing game-style structure: ${required}`);
    }
  }
  // 起手句、问细节引用、怀疑标记等旧机制不允许回流 iOS 对局界面。
  for (const forbidden of ["quickSend", "quoteMessage", "quotedDetailDraft", "起手句", "问细节", "我的怀疑标记", "evidenceReasonOptions", "中段表态"]) {
    if (views.includes(forbidden)) {
      throw new Error(`iOS game room still contains removed mechanic: ${forbidden}`);
    }
  }
  const stageActionConstructors = views.match(/StageActionPanel\(/g) || [];
  if (stageActionConstructors.length !== 1) {
    throw new Error("iOS game room must construct StageActionPanel through one shared helper");
  }
  const stageOrder = views.match(/private func shouldPlaceStageActionBeforeMessages\(_ game: MirageGame\) -> Bool \{[\s\S]*?\n    \}/);
  if (!stageOrder) {
    throw new Error("iOS game room missing stage action ordering helper");
  }
  for (const phase of ["FINAL_STATEMENT", "VOTING", "REVEAL", "COMPLETED"]) {
    if (!stageOrder[0].includes(`"${phase}"`)) {
      throw new Error(`iOS game room stage action ordering helper missing ${phase}`);
    }
  }
  if (stageOrder[0].includes('"DISCUSSION"')) {
    throw new Error("iOS game room must keep discussion timeline before discussion action panel");
  }
  const beforeAction = views.indexOf("if shouldPlaceStageActionBeforeMessages(game) {");
  const timeline = views.indexOf("MessageTimeline(", beforeAction);
  const afterAction = views.indexOf("} else if !shouldPlaceStageActionBeforeMessages(game)", timeline);
  if (beforeAction === -1 || timeline === -1 || afterAction === -1 || !(beforeAction < timeline && timeline < afterAction)) {
    throw new Error("iOS game room must place non-discussion action panels before the message timeline and discussion fallback after it");
  }
  for (const [source, required] of [
    [api, "func toggleMessageClue(gameId: String, messageId: String)"],
    [api, '"/games/\\(gameId)/reactions"'],
    [store, "func toggleMessageClue(messageId: String)"],
    [views, "toggleMessageClue(message.id)"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`iOS clue-marking contract missing ${required}`);
    }
  }
  for (const forbidden of ["useProbeSkill", "game.skills?.probe", "Label(strategyLabel(tag)", "追问", "追问技能", "想追问就直接发言", "别再追问", "/games/\\(gameId)/skills/probe"]) {
    if (views.includes(forbidden) || api.includes(forbidden) || store.includes(forbidden)) {
      throw new Error(`iOS game room UI still exposes redundant probe skill: ${forbidden}`);
    }
  }
  for (const forbidden of ["GameSkillSummary", "GameSkillState", "GameSkillUse", "SuspicionMark", "MidCheckRecord"]) {
    if (models.includes(forbidden)) {
      throw new Error(`iOS models still contain removed mechanic type: ${forbidden}`);
    }
  }
  for (const required of ["MatchingHeroCard", "MatchingSeatBoard", "FriendRoomSeatBoard", "FriendRoomEmptySeatCard", "FriendRoomControlPanel", "队列座位", "房间座位", "等待入座"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS lobby flow UI missing game-style structure: ${required}`);
    }
  }
  for (const [source, required] of [
    [views, "WaitingFallbackPanel"],
    [views, "FriendRoomTimeoutPanel"],
    [views, "MatchingFlowPanel"],
    [views, "ticketCode"],
    [views, "model.waitingModeId"],
    [views, "model.waitingTopicId"],
    [views, "model.waitingStartedAt"],
    [views, "waitingElapsedText"],
    [views, "waitingFallbackText"],
    [views, "friendRoomFallbackText"],
    [views, "超过 45 秒"],
    [views, "超过 90 秒"],
    [views, "TimelineView(.periodic"],
    [views, "先玩单线接触"],
    [models, "let topicId: String?"],
    [models, "let createdAt: String?"],
    [store, "@Published var waitingModeId"],
    [store, "@Published var waitingTopicId"],
    [store, "@Published var waitingStartedAt"],
    [store, "clearWaitingContext()"],
    [store, "switchWaitingToQuickStart"],
    [store, "cancelWaitingTicketForAlternative"],
    [read("server/src/homePage.mjs"), "waiting-hero"],
    [read("server/src/homePage.mjs"), "waiting-stat-grid"],
    [read("server/src/homePage.mjs"), "waitingModeId"],
    [read("server/src/homePage.mjs"), "waitingTopicId"],
    [read("server/src/homePage.mjs"), "waitingStartedAt"],
    [read("server/src/homePage.mjs"), "data-waiting-elapsed"],
    [read("server/src/homePage.mjs"), "data-waiting-fallback-copy"],
    [read("server/src/homePage.mjs"), "friend-room-timeout-card"],
    [read("server/src/homePage.mjs"), "friendRoomFallbackCopy"],
    [read("server/src/homePage.mjs"), "data-room-fallback-copy"],
    [read("server/src/homePage.mjs"), "超过 45 秒"],
    [read("server/src/homePage.mjs"), "超过 90 秒"],
    [read("server/src/gameEngine.mjs"), "createdAt: ticket.createdAt"],
    [read("docs/API_CONTRACT.md"), '"createdAt": "2026-06-15T12:00:00.000Z"'],
    [read("server/src/homePage.mjs"), "renderWaitingSeats"],
    [read("server/src/homePage.mjs"), "waiting-quick-start"],
    [read("server/src/homePage.mjs"), "waiting-screen"],
    [read("server/src/homePage.mjs"), "renderWaitingSeat"],
    [read("server/src/homePage.mjs"), "候场码 "],
    [read("server/src/homePage.mjs"), "已保留你的座位"],
    [read("server/src/homePage.mjs"), "开局补位"],
    [read("server/src/homePage.mjs"), "renderEmptySeat"],
    [read("server/src/homePage.mjs"), "seat-card empty"],
    [read("server/src/homePage.mjs"), "等待入座"],
    [read("server/src/homePage.mjs"), "clearWaitingTicket"],
    [read("server/src/homePage.mjs"), "clearWaitingContext"],
    [read("server/src/homePage.mjs"), "data.status === \"matched\""],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`waiting fallback contract missing ${required}`);
    }
  }
  for (const required of ["OnboardingHeroPanel", "OnboardingRulePanel", "OnboardingEntryPanel", "SettingsHeaderCard", "SettingsDangerCard", "入场确认"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS onboarding or settings UI missing game-style structure: ${required}`);
    }
  }
  for (const [source, required] of [
    [httpServer, "/me/summary"],
    [httpServer, "/leaderboard"],
    [httpServer, "/me/cosmetics/:itemId/unlock"],
    [httpServer, "/me/cosmetics/:itemId/equip"],
    [httpServer, "/me/missions/:missionId/claim"],
    [httpServer, "/me/missions/claim-all"],
    [engine, "userSummary(userId)"],
    [engine, "leaderboard(userId"],
    [engine, "function playerLeaderboard"],
    [engine, "const cosmeticItems"],
    [engine, "unlockCosmetic"],
    [engine, "equipCosmetic"],
    [engine, "cosmetic_not_enough_stars"],
    [engine, "claimMissionReward"],
    [engine, "claimAllMissionRewards"],
    [engine, "no_claimable_missions"],
    [models, "struct UserSummary"],
    [models, "struct LeaderboardSummary"],
    [models, "struct LeaderboardRow"],
    [models, "struct UserCosmeticSummary"],
    [models, "struct UserCosmeticItem"],
    [models, "struct UserMissionItem"],
    [models, "struct UserProgressionSummary"],
    [api, "fetchUserSummary"],
    [api, "fetchLeaderboard"],
    [api, "unlockCosmetic"],
    [api, "equipCosmetic"],
    [api, "claimMissionReward"],
    [api, "claimAllMissionRewards"],
    [store, "@Published var userSummary"],
    [store, "@Published var leaderboard"],
    [store, "@Published var lastRewardStatus"],
    [store, "unlockCosmetic(itemId:"],
    [store, "equipCosmetic(itemId:"],
    [store, "claimMissionReward(missionId:"],
    [store, "claimAllMissionRewards()"],
    [store, "allMissionRewardClaimText()"],
    [store, "rewardResultText(previous:"],
    [store, "称号升级：Lv."],
    [store, "rewardClaimText(missionId:"],
    [store, "领取成功：推理星 +"],
    [views, "summary: model.userSummary"],
    [views, "LeaderboardHomeSection"],
    [views, "LeaderboardRowView"],
    [views, "CosmeticInventorySection"],
    [views, "CosmeticInventoryRow"],
    [views, "背包装扮"],
    [views, "MissionClaimRow"],
    [views, "claimableMissionCount"],
    [views, "一键领取"],
    [views, "PlayerProgressionCard"],
    [views, "model.lastRewardStatus"],
    [views, "推理星"],
    [views, "Lv."],
    [read("server/src/homePage.mjs"), "/me/summary"],
    [read("server/src/homePage.mjs"), "/leaderboard"],
    [read("server/src/homePage.mjs"), "/me/cosmetics/"],
    [read("server/src/homePage.mjs"), "renderCosmeticsPanel"],
    [read("server/src/homePage.mjs"), "unlock-cosmetic"],
    [read("server/src/homePage.mjs"), "equip-cosmetic"],
    [read("server/src/homePage.mjs"), "renderLeaderboardPanel"],
    [read("server/src/homePage.mjs"), "leaderboard-embed"],
    [read("server/src/homePage.mjs"), "normalizedHomeTab"],
    [read("server/src/homePage.mjs"), "/me/missions/claim-all"],
    [read("server/src/homePage.mjs"), "claim-mission"],
    [read("server/src/homePage.mjs"), "claim-all-missions"],
    [read("server/src/homePage.mjs"), "function claimAllMissions()"],
    [read("server/src/homePage.mjs"), "missionRewardTotals"],
    [read("server/src/homePage.mjs"), "function rewardResultText(previousProgression"],
    [read("server/src/homePage.mjs"), "称号升级：Lv."],
    [read("server/src/homePage.mjs"), "function rewardClaimText(mission)"],
    [read("server/src/homePage.mjs"), "领取成功：推理星 +"],
    [read("server/src/homePage.mjs"), "账号与安全"],
    [read("server/src/homePage.mjs"), "固定账号保存战绩和装扮"],
    [read("server/src/homePage.mjs"), "progression"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`home summary contract missing ${required}`);
    }
  }
  for (const [source, required] of [
    [httpServer, "/me/games"],
    [engine, "userGames(userId"],
    [models, "struct UserGameHistoryItem"],
    [api, "fetchUserGames"],
    [store, "@Published var gameHistory"],
    [views, "GameHistoryRow"],
    [views, "ActiveGameResumeCard"],
    [read("server/src/homePage.mjs"), "open-history-game"],
    [read("server/src/homePage.mjs"), "renderActiveGameBanner"],
    [read("server/src/homePage.mjs"), "继续上一局"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`game history contract missing ${required}`);
    }
  }
  for (const [source, required] of [
    [engine, "mode_requires_friend_room"],
    // 快速开始：任何模式单人 + AI/脚本补位立即开局。
    [engine, "async quickStart({ userId, modeId, topicId })"],
    [read("server/src/httpServer.mjs"), "engine.quickStart"],
    [read("server/src/httpServer.mjs"), 'pathname === "/quick-start"'],
    [views, "ModeStartSheet"],
    [api, "func quickStart(modeId: String, topicId: String?)"],
    [store, "api.quickStart(modeId: modeId, topicId: resolvedTopicId)"],
    [store, "[\"M03\", \"M04\", \"M06\", \"M08\"].contains(modeId)"],
    [read("server/src/homePage.mjs"), "[\"M03\", \"M04\", \"M06\", \"M08\"].includes(modeId)"],
    // 大厅显示全部模式，都走 quick-start（不再按 matchType 过滤）。
    [read("server/src/homePage.mjs"), "(state.modes || []).map"],
    [read("server/src/homePage.mjs"), '"/quick-start"'],
    [read("server/src/homePage.mjs"), "data-action=\"show-mode\" data-mode=\""],
    [read("server/src/homePage.mjs"), "data-action=\"confirm-mode\""],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`mode entry contract missing ${required}`);
    }
  }
  // 好友房入口暂时下线：大厅不再提供开房或房号加入。
  for (const [sourceName, source, forbidden] of [
    ["home page", read("server/src/homePage.mjs"), "paste-invite-code"],
    ["home page", read("server/src/homePage.mjs"), 'data-action="join-room"'],
    ["iOS views", views, "FriendRoomEntry"],
    ["iOS views", views, "加入房间"],
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${sourceName} still exposes friend-room entry: ${forbidden}`);
    }
  }
  const config = read("server/src/config.mjs");
  for (const [source, required] of [
    [config, "modeIds: [\"M01\", \"M02\", \"M03\", \"M04\", \"M06\", \"M08\"]"],
    [config, "workplace-ai-decisions"],
    [httpServer, "/topics"],
    [httpServer, "/rooms/:roomId/topic"],
    [engine, "listTopics({ modeId }"],
    [engine, "async adminTopics()"],
    [engine, "async updateTopicSetting"],
    [engine, "topic_disable_would_empty_mode"],
    [engine, "topic.updated"],
    [engine, "async setRoomTopic({ userId, roomId, topicId })"],
    [engine, "topic_not_available"],
    [engine, "topicId: topic.id"],
    [read("server/src/store.mjs"), "topicSettings"],
    [httpServer, "/admin/topics"],
    [read("server/src/adminPage.mjs"), "loadTopics"],
    [read("server/src/adminPage.mjs"), "官方主题"],
    [models, "struct TopicListResponse"],
    [models, "let topicId: String?"],
    [models, "let modeIds: [String]?"],
    [api, "fetchTopics"],
    [api, "func setRoomTopic(roomId: String, topicId: String)"],
    [api, "let topicId: String?"],
    [store, "@Published var topics"],
    [store, "topicsForMode"],
    [store, "setRoomTopic(topicId:"],
    [views, "TopicSelectionPanel"],
    [views, "FriendRoomTopicPanel"],
    [views, "本局话题"],
    [read("server/src/homePage.mjs"), "\"select-topic\""],
    [read("server/src/homePage.mjs"), "\"set-room-topic\""],
    [read("server/src/homePage.mjs"), "function setRoomTopic(topicId)"],
    [read("docs/API_CONTRACT.md"), "GET `/topics`"],
    [read("docs/API_CONTRACT.md"), "GET `/admin/topics`"],
    [read("docs/API_CONTRACT.md"), "PATCH `/admin/topics/:topicId`"],
    [read("docs/API_CONTRACT.md"), "POST `/rooms/:roomId/topic`"],
    [read("server/test/api.test.mjs"), "admin can disable official topics without emptying any mode"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`topic selection contract missing ${required}`);
    }
  }
  for (const [source, required] of [
    [store, "func replayAgain(modeId: String, roomId: String?, rematchRoomId: String?)"],
    // 再来一局统一走快速开始；好友房 rematch 服务端能力保留但客户端暂不入口。
    [api, "func rematchRoom(roomId: String)"],
    [api, "/rooms/\\(roomId)/rematch"],
    [models, "let rematchRoomId: String?"],
    [views, "model.replayAgain(modeId: modeId, roomId: roomId, rematchRoomId: rematchRoomId)"],
    [views, "同模式再来一局"],
    [views, "原房间再来一局"],
    [views, "进入再来一局房间"],
    [engine, "rematchRoomId: visibleRematchRoomId"],
    [engine, "async rematchRoom({ userId, roomId })"],
    [httpServer, "/rooms/:roomId/rematch"],
    [read("docs/API_CONTRACT.md"), "POST `/rooms/:roomId/rematch`"],
    [read("docs/API_CONTRACT.md"), "rematchRoomId"],
    [read("server/src/homePage.mjs"), "data-action=\"replay-again\""],
    [read("server/src/homePage.mjs"), "data-rematch-room"],
    [read("server/src/homePage.mjs"), "rematchRefreshing"],
    [read("server/src/homePage.mjs"), "lastRematchRefreshAt"],
    [read("server/src/homePage.mjs"), "function replayAgain(modeId, roomId, rematchRoomId)"],
    [read("server/src/homePage.mjs"), "function openRoom(roomId)"],
    [read("server/src/homePage.mjs"), "function rematchRoom(roomId)"],
    [read("server/src/homePage.mjs"), "原房间再来一局"],
    [read("server/src/homePage.mjs"), "进入再来一局房间"],
    [read("server/src/homePage.mjs"), "同模式再试"],
    [read("server/test/api.test.mjs"), "multi-member rematch returns one retained lobby under repeated clicks"],
    [read("server/test/api.test.mjs"), "rematches.filter((response) => response.status === 201).length"],
    [read("server/test/api.test.mjs"), "rematchFromRoomId === created.json.room.id"],
    [read("docs/REAL_APP_STATUS.md"), "好友房 rematch 已补本地并发回归测试"],
    [read("docs/REAL_APP_STATUS.md"), "多人重复点击幂等性"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`rematch contract missing ${required}`);
    }
  }
  for (const [source, required] of [
    [read("server/src/homePage.mjs"), "data-action=\"share-replay\""],
    [read("server/src/homePage.mjs"), "function renderReplaySharePreview(game)"],
    [read("server/src/homePage.mjs"), "匿名战报卡"],
    [read("server/src/homePage.mjs"), "分享前预览，不带昵称、房号或对局编号。"],
    [read("server/src/homePage.mjs"), "function replayShareText(game)"],
    [read("server/src/homePage.mjs"), "function shareLandingUrl(game)"],
    [read("server/src/homePage.mjs"), "function shareLandingIntent()"],
    [read("server/src/homePage.mjs"), "function applyShareLandingIntent()"],
    [read("server/src/homePage.mjs"), "url.searchParams.set(\"mode\", game?.modeId || \"M01\")"],
    [read("server/src/homePage.mjs"), "url.searchParams.set(\"topic\", topicId)"],
    [read("server/src/homePage.mjs"), "async function shareReplay()"],
    [read("server/src/homePage.mjs"), "navigator.share"],
    [read("server/src/homePage.mjs"), "copyTextToClipboard(text)"],
    [read("server/src/homePage.mjs"), "分享战报"],
    [views, "ReplaySharePreviewCard(game: game)"],
    [views, "struct ReplaySharePreviewCard"],
    [views, "struct SharePreviewRow"],
    [views, 'Text("匿名战报卡")'],
    [views, 'Text("分享前预览，不带昵称、房号或对局编号。")'],
    [views, "ShareLink(item: replayShareText(game: game))"],
    [views, "func replayShareText(game: MirageGame) -> String"],
    [views, "func replayShareURL(game: MirageGame) -> URL?"],
    [views, "URLQueryItem(name: \"mode\", value: game.modeId)"],
    [views, "URLQueryItem(name: \"topic\", value: game.topic.id)"],
    [views, "分享战报"],
    [read("docs/REAL_APP_STATUS.md"), "`mode/topic` 落地链接"],
    [read("docs/REAL_APP_STATUS.md"), "分享内容和分享前预览卡只包含"],
    [read("docs/REAL_APP_STATUS.md"), "不带真实昵称、用户 ID、game ID、房号或原房间号"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`post-game share contract missing ${required}`);
    }
  }
  const homePageForShare = read("server/src/homePage.mjs");
  const shareTextBody = homePageForShare.slice(
    homePageForShare.indexOf("function replayShareText(game)"),
    homePageForShare.indexOf("async function shareReplay()"),
  );
  for (const forbidden of ["roomId", "game.id", "userId", "nickname"]) {
    if (shareTextBody.includes(forbidden)) {
      throw new Error(`web share text must not include identity or room data: ${forbidden}`);
    }
  }
  const sharePreviewBody = homePageForShare.slice(
    homePageForShare.indexOf("function renderReplaySharePreview(game)"),
    homePageForShare.indexOf("function renderReplayTaskResult(game, replay)"),
  );
  for (const forbidden of ["roomId", "game.id", "userId", "nickname"]) {
    if (sharePreviewBody.includes(forbidden)) {
      throw new Error(`web share preview must not include identity or room data: ${forbidden}`);
    }
  }
  for (const [source, required] of [
    [config, "name: \"单线接触\""],
    [config, "matchType: \"friend_room\""],
    [config, "const publicFlow = [\"任务卡\", \"讨论发言\", \"最终陈述\", \"投票归票\", \"身份揭晓\", \"复盘\"]"],
    [config, "扰局玩家"],
    [models, "let flow: [String]?"],
    [models, "let rules: [String]?"],
    [views, "ModeRulesSheet"],
    [views, "ModeStartSheet"],
    [views, "上桌提示"],
    [views, "看玩法"],
    [views, "flowStepTitle"],
    [views, 'ModeRulesSheet(modes: currentModes)'],
    [views, "showGameRules = true"],
    [read("server/src/homePage.mjs"), "renderGameRulesModal"],
    [read("server/src/homePage.mjs"), "renderTopicCard(game)"],
    [read("server/src/homePage.mjs"), "renderModeStartModal"],
    [read("server/src/homePage.mjs"), "data-action=\"show-game-rules\""],
    [read("server/src/homePage.mjs"), "data-action=\"close-game-rules\""],
    [read("server/src/homePage.mjs"), "data-action=\"show-mode\""],
    [read("server/src/homePage.mjs"), "flowStepTitle"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`mode rules contract missing ${required}`);
    }
  }
  for (const [source, forbidden] of [
    [config, "线索回看"],
    [config, "揭晓和线索"],
    [apiContract, "线索回看"],
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`mode flow still uses deprecated replay wording: ${forbidden}`);
    }
  }
  if (!store.includes("post_game_player_report")) {
    throw new Error("iOS client reports must use post_game_player_report reason");
  }
  if (!models.includes("let hostUserId: String?")) {
    throw new Error("iOS MirageRoom.hostUserId must be optional because closed rooms return null hostUserId");
  }
  for (const required of ["isCurrentUserHost", "等待房主开局", "房主离开时会自动换房主"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS friend-room UI missing host guard: ${required}`);
    }
  }
  for (const [source, required] of [
    [store, "copyInviteCode"],
    [store, "copiedInviteCode"],
    [views, "复制邀请码"],
    [views, "邀请码已复制"],
    [read("server/src/homePage.mjs"), "copy-invite-code"],
    [read("server/src/homePage.mjs"), "navigator.clipboard"],
  ]) {
    if (!source.includes(required)) {
      throw new Error(`friend-room invite sharing contract missing ${required}`);
    }
  }
  for (const required of ["allHumansReady", "canStartRoom", ".disabled(!canStartRoom)", ".disabled(!isLobby || isCurrentUserReady)"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS friend-room UI missing ready/start guard: ${required}`);
    }
  }
  for (const required of ["not_enough_humans", "humanCount < mode.minHumanCount"]) {
    if (!engine.includes(required)) {
      throw new Error(`server friend-room start missing minimum-human guard: ${required}`);
    }
  }
  for (const required of ["requiredHumanCount", "hasEnoughHumans", "名真人玩家加入后才能开局"]) {
    if (!views.includes(required)) {
      throw new Error(`iOS friend-room UI missing minimum-human guard: ${required}`);
    }
  }
  for (const required of ["room.status == \"LOBBY\"", "room.hostUserId == user?.id", "还有成员未准备", "requiredHumanCount(for: room)", "真人玩家不足", "case \"M06\", \"M08\":"]) {
    if (!store.includes(required)) {
      throw new Error(`iOS view model missing start-room guard: ${required}`);
    }
  }
  for (const required of ["handleRunError", "refreshBannedSession", "\"unauthorized\", \"user_not_found\"", "\"user_banned\""]) {
    if (!store.includes(required)) {
      throw new Error(`iOS view model missing server-error recovery: ${required}`);
    }
  }
});

run(releaseStrict() ? "release placeholders removed" : "release placeholders documented", () => {
  const placeholderChecks = [
    ["ios/Mirage/Mirage/Release.xcconfig", [/com\.mirage\.app/, /api\.mirage\.example\.com/]],
    ["ios/Mirage/ExportOptions.plist", [/YOUR_TEAM_ID/]],
    ["docs/APP_STORE_METADATA.md", [/your-domain\.com/]],
    ["docs/APP_STORE_SUBMISSION.md", [/com\.mirage\.app/, /your-domain\.com/]],
    ["docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md", [/your-domain\.com/, /api\.mirage\.example\.com/, /YOUR_TEAM_ID/]],
  ];
  if (releaseStrict()) {
    const found = placeholderChecks.flatMap(([filePath, patterns]) => collectPlaceholders(filePath, patterns));
    if (found.length) {
      throw new Error(`release placeholders remain:\n${found.join("\n")}`);
    }
    return;
  }
  const present = placeholderChecks.flatMap(([filePath, patterns]) => collectPlaceholders(filePath, patterns));
  if (!present.length) return;
  console.log(`WARN release placeholders remain until real App Store configuration is available:\n${present.join("\n")}`);
});

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
  if (!item.ok) console.log(item.error);
}

if (failed.length) {
  process.exitCode = 1;
} else {
  console.log("release gate passed");
}
