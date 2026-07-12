import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { exchangeAppleAuthorizationCode, revokeAppleRefreshToken } from "../src/appleAuth.mjs";
import { verifyGoogleIdentityToken } from "../src/googleAuth.mjs";
import { createHttpServer } from "../src/httpServer.mjs";
import { MemoryStore } from "../src/store.mjs";
import { createSessionToken } from "../src/token.mjs";
import { verifyWeChatLoginCode } from "../src/wechatAuth.mjs";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));

function startTestServer({ env = {}, options = {} } = {}) {
  const { server, engine } = createHttpServer({
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "test-secret",
      ADMIN_TOKEN: "test-admin",
      AUTH_ALLOW_MOCK_APPLE: "true",
      ...env,
    },
    ...options,
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        engine,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function validProductionEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    SESSION_SECRET: "production-session-secret-000000000000000000",
    ADMIN_TOKEN: "production-admin-token-000000000000",
    APPLE_BUNDLE_ID: "com.yourcompany.mirage",
    APPLE_CLIENT_ID: "com.yourcompany.mirage",
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    AUTH_ALLOW_MOCK_APPLE: "false",
    AUTH_ALLOW_MOCK_GOOGLE: "false",
    GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
    AUTH_ALLOW_MOCK_WECHAT: "false",
    WECHAT_APP_ID: "wx-production-app-id",
    WECHAT_APP_SECRET: "wechat-production-secret",
    LLM_ALLOW_SCRIPTED_FALLBACK_IN_PRODUCTION: "true",
    CORS_ALLOWED_ORIGINS: "https://api.mirage.app",
    MIRAGE_PUBLIC_BASE_URL: "https://api.mirage.app",
    MIRAGE_SUPPORT_EMAIL: "support@mirage.app",
    REPORT_ALERT_WEBHOOK_URL: "https://hooks.mirage.app/reports",
    MIRAGE_STORE: "postgres",
    MIRAGE_POSTGRES_URL: "postgres://mirage:mirage-password@db.example.internal:5432/mirage",
    ...overrides,
  };
}

function startWebhookServer(handler) {
  const deliveries = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = raw ? JSON.parse(raw) : null;
    deliveries.push({ method: req.method, url: req.url, headers: req.headers, body });
    const result = (await handler?.({ req, body, deliveries })) || {};
    res.writeHead(result.status || 204, result.headers || {});
    res.end(result.body || "");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        deliveries,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function spawnNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

async function request(baseUrl, method, path, body, token, headers = {}) {
  const { "X-Test-No-Task-Ack-Retry": noTaskAckRetry, ...requestHeaders } = headers;
  const requestBody =
    method === "POST" && path === "/auth/guest" && body
      ? { ageConfirmed: true, communityConfirmed: true, ...body }
      : body;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestHeaders,
    },
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
  const json = await response.json();
  const gameAction = path.match(/^\/games\/([^/]+)\/(messages|reactions)$/);
  if (!noTaskAckRetry && response.status === 409 && json.error === "task_card_not_acknowledged" && token && gameAction) {
    const ack = await request(baseUrl, "POST", `/games/${gameAction[1]}/task-card`, null, token);
    assert.equal(ack.status, 200);
    return await request(baseUrl, method, path, body, token, { ...headers, "X-Test-No-Task-Ack-Retry": "1" });
  }
  return { status: response.status, json };
}

function userById(users, userId) {
  return Object.values(users).find((user) => user?.json?.user?.id === userId);
}

async function specialRoleContext(baseUrl, gameId, users, role) {
  const adminGame = await request(baseUrl, "GET", `/admin/games/${gameId}`, null, null, { "X-Admin-Token": "test-admin" });
  assert.equal(adminGame.status, 200);
  const player = adminGame.json.game.players.find((candidate) => candidate.role === role);
  assert.ok(player);
  assert.equal(player.kind, "human");
  assert.ok(player.userId);
  const user = userById(users, player.userId);
  assert.ok(user);
  return { adminGame, player, user };
}

function usersExcept(users, excludedUserId) {
  return Object.values(users).filter((user) => user?.json?.user?.id && user.json.user.id !== excludedUserId);
}

async function advanceToFinalStatement(baseUrl, gameId, token) {
  return await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, token);
}

async function advanceToVoting(baseUrl, gameId, token) {
  const finalPhase = await advanceToFinalStatement(baseUrl, gameId, token);
  if (finalPhase.json?.game?.phase !== "FINAL_STATEMENT") return finalPhase;
  return await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, token);
}

test("PostgreSQL migration script is wired and refuses missing connection string", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.scripts["migrate:postgres"], "node scripts/migrate_postgres.mjs");

  const result = spawnSync(process.execPath, ["scripts/migrate_postgres.mjs"], {
    cwd: serverRoot,
    env: {},
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MIRAGE_POSTGRES_URL or DATABASE_URL/);
});

test("PostgreSQL backup and restore scripts are wired and fail safely without required inputs", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.scripts["backup:postgres"], "node scripts/backup_postgres_snapshot.mjs");
  assert.equal(manifest.scripts["restore:postgres"], "node scripts/restore_postgres_snapshot.mjs");

  const backup = spawnSync(process.execPath, ["scripts/backup_postgres_snapshot.mjs"], {
    cwd: serverRoot,
    env: {},
    encoding: "utf8",
  });
  assert.notEqual(backup.status, 0);
  assert.match(backup.stderr, /MIRAGE_POSTGRES_URL or DATABASE_URL/);

  const restoreMissingPath = spawnSync(process.execPath, ["scripts/restore_postgres_snapshot.mjs"], {
    cwd: serverRoot,
    env: {
      MIRAGE_POSTGRES_URL: "postgres://mirage:mirage@db.internal:5432/mirage",
    },
    encoding: "utf8",
  });
  assert.notEqual(restoreMissingPath.status, 0);
  assert.match(restoreMissingPath.stderr, /MIRAGE_BACKUP_PATH or backup file argument/);
});

test("production readiness verifier is wired and validates deployed endpoints", async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.scripts["verify:production"], "node scripts/verify_production_readiness.mjs");

  const missingUrl = spawnSync(process.execPath, ["scripts/verify_production_readiness.mjs"], {
    cwd: serverRoot,
    env: {},
    encoding: "utf8",
  });
  assert.notEqual(missingUrl.status, 0);
  assert.match(missingUrl.stderr, /MIRAGE_PRODUCTION_BASE_URL/);

  const { server, baseUrl } = await startTestServer({
    env: {
      REPORT_ALERT_WEBHOOK_URL: "https://hooks.mirage.test/reports",
      ADMIN_READONLY_TOKEN: "test-readonly-admin",
    },
  });
  try {
    const result = await spawnNode(["scripts/verify_production_readiness.mjs"], {
      cwd: serverRoot,
      env: {
        MIRAGE_PRODUCTION_BASE_URL: baseUrl,
        MIRAGE_VERIFY_ALLOW_HTTP: "true",
        MIRAGE_EXPECT_STORE: "json",
        MIRAGE_VERIFY_ALLOW_AI_FALLBACK: "true",
        MIRAGE_VERIFY_ADMIN_TOKEN: "test-admin",
        MIRAGE_VERIFY_ADMIN_READONLY_TOKEN: "test-readonly-admin",
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /production readiness verified/);
  } finally {
    server.close();
  }
});

test("gameplay balance simulation rewards skilled play and rejects bad policies", () => {
  const result = spawnSync(process.execPath, ["scripts/simulate_balance.mjs", "--json"], {
    cwd: serverRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.modeCoverage, ["M01", "M02", "M03", "M04", "M06", "M08"]);
  assert.equal(report.scenarioCount, 12);
  assert.equal(report.badPolicyHumanWins, 0);
  assert.ok(report.skilledHumanWins >= 6);
  assert.equal(report.misledScenarioCount, 2);
  assert.equal(report.invariantCoverage.noMidCheckPhase, true);
});

test("Apple client secret uses escaped private key and signs token requests", async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const env = {
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_CLIENT_ID: "com.yourcompany.mirage",
    APPLE_PRIVATE_KEY: privateKeyPem.replace(/\n/g, "\\n"),
  };
  const clock = { now: () => Date.UTC(2026, 0, 1, 0, 0, 0) };
  const seen = [];
  const fetchImpl = async (url, options) => {
    const body = Object.fromEntries(options.body);
    seen.push({ url, body });
    const [headerRaw, payloadRaw, signatureRaw] = body.client_secret.split(".");
    const header = JSON.parse(Buffer.from(headerRaw, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadRaw, "base64url").toString("utf8"));
    assert.equal(header.alg, "ES256");
    assert.equal(header.kid, env.APPLE_KEY_ID);
    assert.equal(payload.iss, env.APPLE_TEAM_ID);
    assert.equal(payload.sub, env.APPLE_CLIENT_ID);
    assert.equal(payload.aud, "https://appleid.apple.com");
    assert.equal(payload.iat, Math.floor(clock.now() / 1000));
    assert.equal(payload.exp, Math.floor(clock.now() / 1000) + 60 * 60 * 24 * 30);
    assert.equal(
      crypto.verify(
        "sha256",
        Buffer.from(`${headerRaw}.${payloadRaw}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signatureRaw, "base64url"),
      ),
      true,
    );
    return {
      ok: true,
      json: async () => (url.endsWith("/auth/token") ? { refresh_token: "apple-refresh-token" } : {}),
    };
  };

  const exchange = await exchangeAppleAuthorizationCode("real-authorization-code", { env, fetchImpl, clock });
  assert.equal(exchange.refreshToken, "apple-refresh-token");
  assert.equal(seen[0].url, "https://appleid.apple.com/auth/token");
  assert.equal(seen[0].body.client_id, env.APPLE_CLIENT_ID);
  assert.equal(seen[0].body.code, "real-authorization-code");
  assert.equal(seen[0].body.grant_type, "authorization_code");

  const revoke = await revokeAppleRefreshToken("apple-refresh-token", { env, fetchImpl, clock });
  assert.deepEqual(revoke, { revoked: true });
  assert.equal(seen[1].url, "https://appleid.apple.com/auth/revoke");
  assert.equal(seen[1].body.token, "apple-refresh-token");
  assert.equal(seen[1].body.token_type_hint, "refresh_token");
});

test("M01 can complete the server-authoritative core loop", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "你" });
    assert.equal(guest.status, 201);
    assert.ok(guest.json.token);

    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    assert.equal(match.status, 201);
    assert.equal(match.json.status, "matched");
    assert.equal(match.json.game.phase, "DISCUSSION");

    const gameId = match.json.game.id;
    const earlyReplay = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, guest.json.token);
    assert.equal(earlyReplay.status, 409);
    assert.equal(earlyReplay.json.error, "replay_not_ready");

    const send = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我支持允许，但必须标注 AI 使用。" }, guest.json.token);
    assert.equal(send.status, 201);
    assert.ok(send.json.game.messages.length >= 3);
    const aiPlayer = send.json.game.players.find((player) => player.kind === "unknown");
    assert.ok(aiPlayer);
    const gameView = await request(baseUrl, "GET", `/games/${gameId}`, null, guest.json.token);
    assert.equal(gameView.json.game.suspicions, undefined);
    const clueMessage = gameView.json.game.messages.find((message) => message.senderPlayerId === aiPlayer.id);
    assert.ok(clueMessage);
    const markClue = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/reactions`,
      { messageId: clueMessage.id, type: "clue" },
      guest.json.token,
    );
    assert.equal(markClue.status, 201);
    assert.equal(markClue.json.game.messages.find((message) => message.id === clueMessage.id).reactionType, "clue");
    assert.equal(markClue.json.game.messages.find((message) => message.id === send.json.game.messages.find((item) => item.senderKind === "player" && item.senderPlayerId !== aiPlayer.id).id).reactionType, null);
    const clearClue = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/reactions`,
      { messageId: clueMessage.id, type: "clue" },
      guest.json.token,
    );
    assert.equal(clearClue.status, 201);
    assert.equal(clearClue.json.game.messages.find((message) => message.id === clueMessage.id).reactionType, null);
    const keepClue = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/reactions`,
      { messageId: clueMessage.id, type: "clue" },
      guest.json.token,
    );
    assert.equal(keepClue.status, 201);
    assert.equal(keepClue.json.game.messages.find((message) => message.id === clueMessage.id).reactionType, "clue");
    const ownPlayer = send.json.game.players.find((player) => player.userId === guest.json.user.id);
    const selfMessage = send.json.game.messages.find((message) => message.senderPlayerId === ownPlayer.id);
    const selfClue = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/reactions`,
      { messageId: selfMessage.id, type: "clue" },
      guest.json.token,
    );
    assert.equal(selfClue.status, 422);
    assert.equal(selfClue.json.error, "invalid_message");
    const legacyEvidence = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/suspicions`,
      { targetPlayerId: aiPlayer.id, score: 70, reason: "detail_gap" },
      guest.json.token,
    );
    assert.equal(legacyEvidence.status, 404);
    assert.equal(legacyEvidence.json.error, "not_found");

    const blocked = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "加我微信聊" }, guest.json.token);
    assert.equal(blocked.status, 422);

    const advanceToFinal = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, guest.json.token);
    assert.equal(advanceToFinal.status, 200);
    assert.equal(advanceToFinal.json.game.phase, "FINAL_STATEMENT");
    assert.equal(advanceToFinal.json.game.finalStatement.remaining, 1);
    assert.equal(advanceToFinal.json.game.messages.find((message) => message.id === clueMessage.id).reactionType, "clue");
    const hiddenAi = advanceToFinal.json.game.players.find((player) => player.id === send.json.game.players.find((item) => item.kind === "unknown").id);
    assert.equal(hiddenAi.kind, "unknown");
    assert.equal(hiddenAi.role, "hidden");

    const lateClue = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/reactions`,
      { messageId: clueMessage.id, type: "clue" },
      guest.json.token,
    );
    assert.equal(lateClue.status, 409);
    assert.equal(lateClue.json.error, "reaction_not_allowed_in_phase");

    const finalStatement = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "最后我投对方，因为回答一直绕规则。" }, guest.json.token);
    assert.equal(finalStatement.status, 201);
    assert.equal(finalStatement.json.game.phase, "VOTING");
    const vote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, guest.json.token);
    assert.equal(vote.status, 200);
    assert.equal(vote.json.game.phase, "REVEAL");

    const complete = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, guest.json.token);
    assert.equal(complete.status, 200);
    assert.equal(complete.json.game.phase, "COMPLETED");
    assert.ok(complete.json.game.replay);
    assert.match(complete.json.game.replay.explanation, /判断正确/);
    assert.doesNotMatch(complete.json.game.replay.explanation, /真人玩家/);
    assert.equal(complete.json.game.replay.suspicionSummary, undefined);
    assert.equal(complete.json.game.replay.midCheckSummary, undefined);
    assert.equal(complete.json.game.replay.skillSummary, undefined);
    const myCompletedPlayer = complete.json.game.players.find((player) => player.userId === guest.json.user.id);
    const myTaskResult = complete.json.game.replay.taskResults.find((item) => item.playerId === myCompletedPlayer.id);
    assert.equal(myTaskResult.title, "侦探任务");
    assert.equal(myTaskResult.status, "completed");
    assert.equal(myTaskResult.completed, true);
    assert.match(myTaskResult.summary, /任务完成/);
  } finally {
    server.close();
  }
});

test("task card acknowledgement is server-authoritative before discussion actions", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Task Reader" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    assert.equal(match.status, 201);
    assert.equal(match.json.game.phase, "DISCUSSION");
    assert.equal(match.json.game.taskCard.acknowledged, false);

    const blocked = await request(
      baseUrl,
      "POST",
      `/games/${match.json.game.id}/messages`,
      { text: "我还没确认任务卡就想发言。" },
      guest.json.token,
      { "X-Test-No-Task-Ack-Retry": "1" },
    );
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.error, "task_card_not_acknowledged");

    const ack = await request(baseUrl, "POST", `/games/${match.json.game.id}/task-card`, null, guest.json.token);
    assert.equal(ack.status, 200);
    assert.equal(ack.json.game.taskCard.acknowledged, true);
    assert.equal(ack.json.game.taskCard.acknowledgedCount, 1);

    const sent = await request(
      baseUrl,
      "POST",
      `/games/${match.json.game.id}/messages`,
      { text: "我已经读完任务卡，现在开始判断。" },
      guest.json.token,
      { "X-Test-No-Task-Ack-Retry": "1" },
    );
    assert.equal(sent.status, 201);
    assert.ok(sent.json.game.messages.some((message) => message.text.includes("读完任务卡")));
  } finally {
    server.close();
  }
});

test("discussion questions stay in chat instead of a separate probe skill", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "发问玩家" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    assert.equal(match.status, 201);
    assert.equal(match.json.game.phase, "DISCUSSION");
    assert.equal(match.json.game.skills, undefined);

    const aiPlayer = match.json.game.players.find((player) => player.kind === "unknown");
    assert.ok(aiPlayer);

    const legacyProbe = await request(baseUrl, "POST", `/games/${match.json.game.id}/skills/probe`, { targetPlayerId: aiPlayer.id }, guest.json.token);
    assert.equal(legacyProbe.status, 404);
    assert.equal(legacyProbe.json.error, "not_found");

    const question = await request(baseUrl, "POST", `/games/${match.json.game.id}/messages`, { text: "请给一个具体经历，不要只讲规则。" }, guest.json.token);
    assert.equal(question.status, 201);
    assert.ok(question.json.game.messages.some((message) => message.text.includes("具体经历")));
    assert.equal(question.json.game.suspicions, undefined);
    assert.ok(!question.json.game.messages.some((message) => message.text.includes("发起追问")));
  } finally {
    server.close();
  }
});

test("M01 can be won by judging a scripted human opponent as human", async () => {
  const { server, baseUrl } = await startTestServer({ env: { MIRAGE_M01_OPPONENT_KIND: "scripted_human" } });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "真假玩家" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    assert.equal(match.status, 201);
    assert.equal(match.json.game.phase, "DISCUSSION");

    const gameId = match.json.game.id;
    const opponent = match.json.game.players.find((player) => player.userId !== guest.json.user.id);
    assert.ok(opponent);
    assert.equal(opponent.kind, "unknown");
    assert.equal(opponent.role, "hidden");
    assert.ok(match.json.game.messages.some((message) => message.senderPlayerId === opponent.id));

    const question = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "请讲一个具体场景，我想看是不是套话。" }, guest.json.token);
    assert.equal(question.status, 201);
    assert.ok(question.json.game.messages.length >= 3);
    assert.equal(question.json.game.players.find((player) => player.id === opponent.id).kind, "unknown");

    const finalPhase = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, guest.json.token);
    assert.equal(finalPhase.status, 200);
    assert.equal(finalPhase.json.game.phase, "FINAL_STATEMENT");
    assert.ok(finalPhase.json.game.messages.some((message) => message.text.includes("别只看我表达整齐") || message.text.includes("细节完整度")));

    const finalStatement = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "最后我判断对方像真人补位，不投 AI。" }, guest.json.token);
    assert.equal(finalStatement.status, 201);
    assert.equal(finalStatement.json.game.phase, "VOTING");

    const vote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: "abstain" }, guest.json.token);
    assert.equal(vote.status, 200);
    assert.equal(vote.json.game.phase, "REVEAL");
    assert.equal(vote.json.game.winner, "human");
    const revealedOpponent = vote.json.game.players.find((player) => player.id === opponent.id);
    assert.equal(revealedOpponent.kind, "scripted_human");
    assert.equal(revealedOpponent.role, "human");

    const complete = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, guest.json.token);
    assert.equal(complete.status, 200);
    assert.equal(complete.json.game.replay.winner, "human");
    assert.deepEqual(complete.json.game.replay.aiPlayerIds, []);
    assert.match(complete.json.game.replay.explanation, /真人补位/);
    assert.match(complete.json.game.replay.explanation, /判断正确/);
  } finally {
    server.close();
  }
});

test("final statement phase allows one last message before voting", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "陈述房主" });
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "陈述玩家" });
    const room = await request(baseUrl, "POST", "/rooms", { modeId: "M03", topicId: "label-ai-content" }, host.json.token);
    assert.equal(room.status, 201);
    assert.equal((await request(baseUrl, "POST", "/rooms/join", { inviteCode: room.json.room.inviteCode }, guest.json.token)).status, 200);
    assert.equal((await request(baseUrl, "POST", `/rooms/${room.json.room.id}/ready`, { ready: true }, guest.json.token)).status, 200);
    const started = await request(baseUrl, "POST", `/rooms/${room.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    assert.equal(started.json.game.phase, "DISCUSSION");

    const gameId = started.json.game.id;
    const finalPhase = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, host.json.token);
    assert.equal(finalPhase.status, 200);
    assert.equal(finalPhase.json.game.phase, "FINAL_STATEMENT");
    assert.equal(finalPhase.json.game.finalStatement.remaining, 1);
    assert.ok(finalPhase.json.game.messages.some((message) => message.text.includes("进入最终陈述")));
    const aiFinal = finalPhase.json.game.messages.find((message) => message.text.includes("我最后补一句"));
    assert.ok(aiFinal);
    assert.equal(aiFinal.strategyTag, null);

    const earlyVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: finalPhase.json.game.players[1].id }, host.json.token);
    assert.equal(earlyVote.status, 409);
    assert.equal(earlyVote.json.error, "vote_not_allowed_in_phase");

    const hostFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我的最后判断是先看谁一直不讲具体经历。" }, host.json.token);
    assert.equal(hostFinal.status, 201);
    assert.equal(hostFinal.json.game.phase, "FINAL_STATEMENT");
    assert.equal(hostFinal.json.game.finalStatement.submitted, true);
    assert.equal(hostFinal.json.game.finalStatement.remaining, 0);

    const duplicate = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我再补一句。" }, host.json.token);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.error, "final_statement_already_sent");

    const guestFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我最后认为要投最回避细节的人。" }, guest.json.token);
    assert.equal(guestFinal.status, 201);
    assert.equal(guestFinal.json.game.phase, "VOTING");
    assert.equal(guestFinal.json.game.myVote, null);
  } finally {
    server.close();
  }
});

test("me summary reflects player records and missions", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "战绩玩家" });
    assert.equal(guest.status, 201);

    const initial = await request(baseUrl, "GET", "/me/summary", null, guest.json.token);
    assert.equal(initial.status, 200);
    assert.equal(initial.json.summary.stats.completedGames, 0);
    assert.equal(initial.json.summary.stats.winRate, null);
    assert.equal(initial.json.summary.wallet.clueStars, 0);
    assert.equal(initial.json.summary.wallet.xp, 0);
    assert.equal(initial.json.summary.progression.level, 1);
    assert.equal(initial.json.summary.progression.title, "新手侦探");
    assert.equal(initial.json.summary.progression.nextLevelXp, 50);
    assert.equal(initial.json.summary.progression.progress, 0);
    assert.equal(initial.json.summary.cosmetics.equippedId, "classic-sleuth");
    assert.equal(initial.json.summary.cosmetics.items.find((item) => item.id === "classic-sleuth").owned, true);
    assert.equal(initial.json.summary.cosmetics.items.find((item) => item.id === "signal-tracker").owned, false);
    assert.equal(initial.json.summary.cosmetics.items.find((item) => item.id === "signal-tracker").affordable, false);
    assert.equal(initial.json.summary.missions.quickStartCompletedToday, false);
    assert.equal(initial.json.summary.missions.items.find((item) => item.id === "daily_quick_start").completed, false);
    assert.equal(initial.json.summary.missions.items.find((item) => item.id === "daily_quick_start").claimable, false);
    const incompleteClaim = await request(baseUrl, "POST", "/me/missions/daily_quick_start/claim", null, guest.json.token);
    assert.equal(incompleteClaim.status, 409);
    assert.equal(incompleteClaim.json.error, "mission_not_completed");
    const lockedEquip = await request(baseUrl, "POST", "/me/cosmetics/signal-tracker/equip", null, guest.json.token);
    assert.equal(lockedEquip.status, 409);
    assert.equal(lockedEquip.json.error, "cosmetic_not_owned");
    const earlyUnlock = await request(baseUrl, "POST", "/me/cosmetics/signal-tracker/unlock", null, guest.json.token);
    assert.equal(earlyUnlock.status, 409);
    assert.equal(earlyUnlock.json.error, "cosmetic_not_enough_stars");
    const initialHistory = await request(baseUrl, "GET", "/me/games", null, guest.json.token);
    assert.equal(initialHistory.status, 200);
    assert.deepEqual(initialHistory.json.games, []);
    const commerce = await request(baseUrl, "GET", "/commerce/catalog", null, guest.json.token);
    assert.equal(commerce.status, 200);
    assert.equal(commerce.json.catalog.paymentsEnabled, false);
    assert.equal(commerce.json.catalog.purchaseProvider, "app_store_iap_required");
    assert.ok(commerce.json.catalog.offers.some((offer) => offer.id === "cosmetic_theme_pack"));
    assert.match(commerce.json.catalog.summary, /不出售胜率|身份信息|投票优势/);

    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const gameId = match.json.game.id;
    const activeHistory = await request(baseUrl, "GET", "/me/games", null, guest.json.token);
    assert.equal(activeHistory.status, 200);
    assert.equal(activeHistory.json.games[0].gameId, gameId);
    assert.equal(activeHistory.json.games[0].phase, "DISCUSSION");
    assert.equal(activeHistory.json.games[0].replayReady, false);
    assert.equal(activeHistory.json.games[0].myRole, "human");
    await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, guest.json.token);
    await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "最后我投对方，因为表达不够具体。" }, guest.json.token);
    const aiPlayer = match.json.game.players.find((player) => player.kind === "unknown");
    await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, guest.json.token);
    await request(baseUrl, "POST", `/games/${gameId}/replay`, null, guest.json.token);

    const summary = await request(baseUrl, "GET", "/me/summary", null, guest.json.token);
    assert.equal(summary.status, 200);
    assert.equal(summary.json.summary.stats.completedGames, 1);
    assert.equal(summary.json.summary.stats.wins, 1);
    assert.equal(summary.json.summary.stats.winRate, 1);
    assert.equal(summary.json.summary.stats.replayReady, 1);
    assert.equal(summary.json.summary.missions.quickStartCompletedToday, true);
    assert.equal(summary.json.summary.missions.replayReadyToday, true);
    assert.equal(summary.json.summary.missions.winCompletedToday, true);
    assert.equal(summary.json.summary.missions.items.find((item) => item.id === "daily_quick_start").claimable, true);
    assert.equal(summary.json.summary.recent.modeId, "M01");
    assert.equal(summary.json.summary.recent.replayReady, true);
    const allClaim = await request(baseUrl, "POST", "/me/missions/claim-all", null, guest.json.token);
    assert.equal(allClaim.status, 200);
    assert.equal(allClaim.json.summary.wallet.clueStars, 90);
    assert.equal(allClaim.json.summary.wallet.xp, 45);
    assert.equal(allClaim.json.summary.progression.level, 1);
    assert.equal(allClaim.json.summary.progression.progress, 0.9);
    assert.equal(allClaim.json.summary.progression.nextTitle, "见习预言家");
    assert.equal(allClaim.json.summary.cosmetics.items.find((item) => item.id === "signal-tracker").affordable, true);
    assert.equal(allClaim.json.summary.missions.items.find((item) => item.id === "daily_quick_start").claimed, true);
    assert.equal(allClaim.json.summary.missions.items.find((item) => item.id === "daily_replay").claimed, true);
    assert.equal(allClaim.json.summary.missions.items.find((item) => item.id === "daily_win").claimed, true);
    const unlockCosmetic = await request(baseUrl, "POST", "/me/cosmetics/signal-tracker/unlock", null, guest.json.token);
    assert.equal(unlockCosmetic.status, 200);
    assert.equal(unlockCosmetic.json.summary.wallet.clueStars, 40);
    assert.equal(unlockCosmetic.json.summary.cosmetics.equippedId, "signal-tracker");
    assert.equal(unlockCosmetic.json.summary.cosmetics.items.find((item) => item.id === "signal-tracker").owned, true);
    const equipDefaultCosmetic = await request(baseUrl, "POST", "/me/cosmetics/classic-sleuth/equip", null, guest.json.token);
    assert.equal(equipDefaultCosmetic.status, 200);
    assert.equal(equipDefaultCosmetic.json.summary.cosmetics.equippedId, "classic-sleuth");
    const duplicateClaim = await request(baseUrl, "POST", "/me/missions/daily_quick_start/claim", null, guest.json.token);
    assert.equal(duplicateClaim.status, 409);
    assert.equal(duplicateClaim.json.error, "mission_already_claimed");
    const duplicateAllClaim = await request(baseUrl, "POST", "/me/missions/claim-all", null, guest.json.token);
    assert.equal(duplicateAllClaim.status, 409);
    assert.equal(duplicateAllClaim.json.error, "no_claimable_missions");
    const completedHistory = await request(baseUrl, "GET", "/me/games", null, guest.json.token);
    assert.equal(completedHistory.status, 200);
    assert.equal(completedHistory.json.games.length, 1);
    assert.equal(completedHistory.json.games[0].gameId, gameId);
    assert.equal(completedHistory.json.games[0].phase, "COMPLETED");
    assert.equal(completedHistory.json.games[0].winner, "human");
    assert.equal(completedHistory.json.games[0].replayReady, true);
    assert.equal(completedHistory.json.games[0].voted, true);
  } finally {
    server.close();
  }
});

test("leaderboard ranks season players and exposes current user context", async () => {
  const { server, baseUrl } = await startTestServer();
  async function completeQuickGame(token) {
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, token);
    assert.equal(match.status, 201);
    const gameId = match.json.game.id;
    await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, token);
    await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "最后我投对方，因为没有具体场景。" }, token);
    const aiPlayer = match.json.game.players.find((player) => player.kind === "unknown");
    await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, token);
    await request(baseUrl, "POST", `/games/${gameId}/replay`, null, token);
  }

  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "榜一玩家" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "追榜玩家" });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const unauthorized = await request(baseUrl, "GET", "/leaderboard");
    assert.equal(unauthorized.status, 401);

    const emptyLeaderboard = await request(baseUrl, "GET", "/leaderboard", null, a.json.token);
    assert.equal(emptyLeaderboard.status, 200);
    assert.equal(emptyLeaderboard.json.leaderboard.totalPlayers, 0);
    assert.equal(emptyLeaderboard.json.leaderboard.myRank, null);

    await completeQuickGame(a.json.token);
    await completeQuickGame(b.json.token);
    const claim = await request(baseUrl, "POST", "/me/missions/claim-all", null, a.json.token);
    assert.equal(claim.status, 200);

    const leaderboardA = await request(baseUrl, "GET", "/leaderboard", null, a.json.token);
    assert.equal(leaderboardA.status, 200);
    assert.equal(leaderboardA.json.leaderboard.season.title, "S1 推理赛季");
    assert.equal(leaderboardA.json.leaderboard.top[0].nickname, "榜一玩家");
    assert.equal(leaderboardA.json.leaderboard.top[0].rank, 1);
    assert.equal(leaderboardA.json.leaderboard.top[0].score, 70);
    assert.equal(leaderboardA.json.leaderboard.myRank.rank, 1);
    assert.equal(leaderboardA.json.leaderboard.myRank.isCurrentUser, true);
    assert.equal(leaderboardA.json.leaderboard.totalPlayers, 2);

    const leaderboardB = await request(baseUrl, "GET", "/leaderboard", null, b.json.token);
    assert.equal(leaderboardB.status, 200);
    assert.equal(leaderboardB.json.leaderboard.myRank.nickname, "追榜玩家");
    assert.equal(leaderboardB.json.leaderboard.myRank.rank, 2);
    assert.equal(leaderboardB.json.leaderboard.aroundMe.length, 2);
  } finally {
    server.close();
  }
});

test("configured LLM gateway generates AI replies without leaking strategy during discussion", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      LLM_MOCK_RESPONSE: "我认为可以用 AI，但学生必须能解释自己的判断。",
    },
  });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "LLM Tester" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const gameId = match.json.game.id;

    const sent = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我担心大家会直接复制答案。" }, guest.json.token);
    assert.equal(sent.status, 201);
    assert.equal(sent.json.game.phase, "DISCUSSION");
    const generated = sent.json.game.messages.find((message) => message.text === "我认为可以用 AI，但学生必须能解释自己的判断。");
    assert.ok(generated);
    assert.equal(generated.strategyTag, null);
    assert.equal(generated.aiSource, null);
    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(metrics.status, 200);
    assert.equal(metrics.json.metrics.aiOperations.messages.total, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.llm, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.bySource[0].source, "llm_mock");
    assert.ok(metrics.json.metrics.aiOperations.costProxy.estimatedOutputTokens > 0);

    await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, guest.json.token);
    await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "最后我投对方，因为这句像模板。" }, guest.json.token);
    const aiPlayer = sent.json.game.players.find((player) => player.kind === "unknown");
    await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, guest.json.token);
    const completed = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, guest.json.token);
    const revealed = completed.json.game.messages.find((message) => message.text === "我认为可以用 AI，但学生必须能解释自己的判断。");
    assert.equal(revealed.strategyTag, "llm_mock");
    assert.equal(revealed.aiSource, "llm_mock");
  } finally {
    server.close();
  }
});

test("blocked AI gateway output falls back without interrupting discussion", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      LLM_MOCK_RESPONSE: "加我微信私聊",
    },
  });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "AI Safety" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const gameId = match.json.game.id;

    const sent = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "你怎么看这个话题？" }, guest.json.token);
    assert.equal(sent.status, 201);
    assert.equal(sent.json.game.phase, "DISCUSSION");
    const fallback = sent.json.game.messages.find((message) => message.text.includes("有限度使用"));
    assert.ok(fallback);
    assert.equal(fallback.strategyTag, null);
    assert.equal(fallback.aiSource, null);

    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(metrics.status, 200);
    assert.equal(metrics.json.metrics.aiOperations.messages.total, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.fallback, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.fallbackRate, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.bySource[0].source, "fallback_after_moderation");
    assert.ok(metrics.json.metrics.aiOperations.costProxy.estimatedOutputTokens > 0);
  } finally {
    server.close();
  }
});

test("message moderation blocks harassment, scam, threat and self-harm categories", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Safety" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const gameId = match.json.game.id;

    const harassment = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "你是废物" }, guest.json.token);
    assert.equal(harassment.status, 422);
    assert.equal(harassment.json.error, "message_blocked:harassment");

    const scam = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "刷单返利，中奖后可以提现吗" }, guest.json.token);
    assert.equal(scam.status, 422);
    assert.equal(scam.json.error, "message_blocked:scam_or_spam");

    const threat = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我会杀了你" }, guest.json.token);
    assert.equal(threat.status, 422);
    assert.equal(threat.json.error, "message_blocked:violent_threat");

    const selfHarm = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我不想活了" }, guest.json.token);
    assert.equal(selfHarm.status, 422);
    assert.equal(selfHarm.json.error, "message_blocked:self_harm_risk");
  } finally {
    server.close();
  }
});

test("auth requires server-side onboarding confirmations", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", {
      nickname: "Too Early",
      ageConfirmed: false,
      communityConfirmed: true,
    });
    assert.equal(guest.status, 422);
    assert.equal(guest.json.error, "onboarding_confirmation_required");

    const apple = await request(
      baseUrl,
      "POST",
      "/auth/apple",
      {
        identityToken: "mock.apple.unconfirmed-apple-user",
        authorizationCode: "mock.code.unconfirmed-apple-user",
        nickname: "Unconfirmed Apple",
        ageConfirmed: true,
        communityConfirmed: false,
      },
    );
    assert.equal(apple.status, 422);
    assert.equal(apple.json.error, "onboarding_confirmation_required");

    const google = await request(
      baseUrl,
      "POST",
      "/auth/google",
      {
        identityToken: "mock.google.unconfirmed-google-user",
        nickname: "Unconfirmed Google",
        ageConfirmed: true,
        communityConfirmed: false,
      },
    );
    assert.equal(google.status, 422);
    assert.equal(google.json.error, "onboarding_confirmation_required");

    const wechat = await request(
      baseUrl,
      "POST",
      "/auth/wechat",
      {
        code: "mock.wechat.unconfirmed-wechat-user",
        nickname: "Unconfirmed WeChat",
        ageConfirmed: true,
        communityConfirmed: false,
      },
    );
    assert.equal(wechat.status, 422);
    assert.equal(wechat.json.error, "onboarding_confirmation_required");
  } finally {
    server.close();
  }
});

test("Google login creates a fixed account and reuses it", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const first = await request(baseUrl, "POST", "/auth/google", {
      identityToken: "mock.google.fixed-user",
      nickname: "Google Player",
      ageConfirmed: true,
      communityConfirmed: true,
    });
    assert.equal(first.status, 200);
    assert.equal(first.json.user.kind, "google");
    assert.equal(first.json.user.nickname, "Google Player");
    assert.ok(first.json.token);

    const second = await request(baseUrl, "POST", "/auth/google", {
      identityToken: "mock.google.fixed-user",
      nickname: "Ignored Rename",
      ageConfirmed: true,
      communityConfirmed: true,
    });
    assert.equal(second.status, 200);
    assert.equal(second.json.user.id, first.json.user.id);
    assert.equal(second.json.user.kind, "google");
  } finally {
    server.close();
  }
});

test("WeChat login creates a fixed account and reuses it", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const first = await request(baseUrl, "POST", "/auth/wechat", {
      code: "mock.wechat.fixed-user",
      nickname: "微信玩家",
      ageConfirmed: true,
      communityConfirmed: true,
    });
    assert.equal(first.status, 200);
    assert.equal(first.json.user.kind, "wechat");
    assert.equal(first.json.user.nickname, "微信玩家");
    assert.ok(first.json.token);

    const second = await request(baseUrl, "POST", "/auth/wechat", {
      code: "mock.wechat.fixed-user",
      nickname: "Ignored Rename",
      ageConfirmed: true,
      communityConfirmed: true,
    });
    assert.equal(second.status, 200);
    assert.equal(second.json.user.id, first.json.user.id);
    assert.equal(second.json.user.kind, "wechat");
  } finally {
    server.close();
  }
});

test("WeChat login code validation requires OpenID", async () => {
  await assert.rejects(
    () =>
      verifyWeChatLoginCode("real-code", {
        appId: "wx-app",
        appSecret: "wx-secret",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ access_token: "token" }),
        }),
      }),
    /invalid_wechat_openid/,
  );
});

test("Google identity token validation requires a subject", async () => {
  await assert.rejects(
    () =>
      verifyGoogleIdentityToken("real-token", {
        audience: "google-client-id.apps.googleusercontent.com",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            aud: "google-client-id.apps.googleusercontent.com",
            iss: "accounts.google.com",
            exp: String(Math.floor(Date.now() / 1000) + 60),
          }),
        }),
      }),
    /invalid_google_subject/,
  );
});

test("Google identity token validation rejects the wrong audience", async () => {
  await assert.rejects(
    () =>
      verifyGoogleIdentityToken("real-token", {
        audience: "expected-client-id.apps.googleusercontent.com",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            sub: "google-user",
            aud: "other-client-id.apps.googleusercontent.com",
            iss: "accounts.google.com",
            exp: String(Math.floor(Date.now() / 1000) + 60),
          }),
        }),
      }),
    /invalid_google_audience/,
  );
});

test("M02 waits for two human users before creating 2 human plus 1 AI game", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "B" });

    const wait = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, a.json.token);
    assert.equal(wait.status, 202);
    assert.equal(wait.json.status, "waiting");
    assert.equal(wait.json.modeId, "M02");
    assert.ok(wait.json.topicId);
    assert.ok(wait.json.ticketId);

    const waitingStatus = await request(baseUrl, "GET", `/matchmaking/${wait.json.ticketId}`, null, a.json.token);
    assert.equal(waitingStatus.status, 202);
    assert.equal(waitingStatus.json.status, "waiting");
    assert.equal(waitingStatus.json.modeId, "M02");
    assert.equal(waitingStatus.json.topicId, wait.json.topicId);
    assert.ok(wait.json.createdAt);
    assert.equal(waitingStatus.json.createdAt, wait.json.createdAt);

    const matched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, b.json.token);
    assert.equal(matched.status, 201);
    assert.equal(matched.json.game.players.length, 3);
    assert.equal(matched.json.game.players.filter((player) => player.userId).length, 1);
    assert.equal(matched.json.game.players.filter((player) => player.kind === "unknown").length, 2);
    const internalGame = await request(baseUrl, "GET", `/admin/games/${matched.json.game.id}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(internalGame.status, 200);
    assert.equal(internalGame.json.game.players.filter((player) => player.kind === "human").length, 2);
    assert.equal(internalGame.json.game.players.filter((player) => player.role === "ai").length, 1);

    const matchedStatus = await request(baseUrl, "GET", `/matchmaking/${wait.json.ticketId}`, null, a.json.token);
    assert.equal(matchedStatus.status, 200);
    assert.equal(matchedStatus.json.status, "matched");
    assert.equal(matchedStatus.json.game.id, matched.json.game.id);
  } finally {
    server.close();
  }
});

test("unresolved games hide other players identity and user ids", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const first = await request(baseUrl, "POST", "/auth/guest", { nickname: "Hidden A" });
    const second = await request(baseUrl, "POST", "/auth/guest", { nickname: "Hidden B" });

    const waiting = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, first.json.token);
    assert.equal(waiting.status, 202);
    const matched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, second.json.token);
    assert.equal(matched.status, 201);
    const gameId = matched.json.game.id;

    const firstView = await request(baseUrl, "GET", `/games/${gameId}`, null, first.json.token);
    const secondView = await request(baseUrl, "GET", `/games/${gameId}`, null, second.json.token);
    for (const [viewer, user] of [
      [firstView, first.json.user],
      [secondView, second.json.user],
    ]) {
      assert.equal(viewer.status, 200);
      assert.equal(viewer.json.game.phase, "DISCUSSION");
      const self = viewer.json.game.players.find((player) => player.userId === user.id);
      assert.ok(self);
      assert.equal(self.kind, "human");
      assert.equal(self.role, "human");
      const others = viewer.json.game.players.filter((player) => player.id !== self.id);
      assert.equal(others.length, 2);
      assert.ok(others.every((player) => player.userId === null));
      assert.ok(others.every((player) => player.kind === "unknown"));
      assert.ok(others.every((player) => player.role === "hidden"));
      assert.ok(others.every((player) => player.hiddenTask === null));
      assert.equal(others.filter((player) => player.userId === null && player.kind === "unknown").length, 2);
    }

    const adminGame = await request(baseUrl, "GET", `/admin/games/${gameId}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(adminGame.status, 200);
    const aiPlayer = adminGame.json.game.players.find((player) => player.role === "ai");
    assert.ok(aiPlayer);

    const voting = await advanceToVoting(baseUrl, gameId, first.json.token);
    assert.equal(voting.status, 200);
    assert.equal(voting.json.game.phase, "VOTING");
    await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, first.json.token);
    const reveal = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, second.json.token);
    assert.equal(reveal.status, 200);
    assert.equal(reveal.json.game.phase, "REVEAL");
    assert.equal(reveal.json.game.players.find((player) => player.userId === first.json.user.id).kind, "human");
    assert.equal(reveal.json.game.players.find((player) => player.userId === second.json.user.id).kind, "human");
    assert.equal(reveal.json.game.players.find((player) => player.id === aiPlayer.id).kind, "ai");
    assert.equal(reveal.json.game.players.find((player) => player.id === aiPlayer.id).role, "ai");
  } finally {
    server.close();
  }
});

test("M02 advances straight from discussion to final statement without mid-check", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "表态 A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "表态 B" });

    await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02", topicId: "label-ai-content" }, a.json.token);
    const matched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02", topicId: "label-ai-content" }, b.json.token);
    assert.equal(matched.status, 201);
    const gameId = matched.json.game.id;
    const adminGame = await request(baseUrl, "GET", `/admin/games/${gameId}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(adminGame.status, 200);
    const aiPlayer = adminGame.json.game.players.find((player) => player.role === "ai");
    assert.ok(aiPlayer);

    const finalPhase = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, b.json.token);
    assert.equal(finalPhase.status, 200);
    assert.equal(finalPhase.json.game.phase, "FINAL_STATEMENT");
    assert.equal(finalPhase.json.game.midCheck, undefined);
    assert.equal(finalPhase.json.game.midChecks, undefined);
    assert.ok(!finalPhase.json.game.messages.some((message) => message.text.includes("中段表态")));

    const legacyMidCheck = await request(
      baseUrl,
      "POST",
      `/games/${gameId}/mid-checks`,
      { targetPlayerId: aiPlayer.id, reason: "template_tone" },
      b.json.token,
    );
    assert.equal(legacyMidCheck.status, 404);
    assert.equal(legacyMidCheck.json.error, "not_found");

    const bFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我最后还是锁模板感最重的人。" }, b.json.token);
    assert.equal(bFinal.status, 201);
    assert.equal(bFinal.json.game.phase, "FINAL_STATEMENT");
    const aFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我同意，缺少具体经历。" }, a.json.token);
    assert.equal(aFinal.status, 201);
    assert.equal(aFinal.json.game.phase, "VOTING");

    const bVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, b.json.token);
    assert.equal(bVote.status, 200);
    assert.equal(bVote.json.game.phase, "VOTING");
    const aVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, a.json.token);
    assert.equal(aVote.status, 200);
    assert.equal(aVote.json.game.phase, "REVEAL");

    const completed = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, a.json.token);
    assert.equal(completed.status, 200);
    assert.equal(completed.json.game.phase, "COMPLETED");
    assert.equal(completed.json.game.replay.midCheckSummary, undefined);
  } finally {
    server.close();
  }
});

test("friend-room modes cannot be started through public matchmaking", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "房主" });
    const rejected = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M03" }, guest.json.token);
    assert.equal(rejected.status, 422);
    assert.equal(rejected.json.error, "mode_requires_friend_room");

    const room = await request(baseUrl, "POST", "/rooms", { modeId: "M04" }, guest.json.token);
    assert.equal(room.status, 201);
    assert.equal(room.json.room.modeId, "M04");
  } finally {
    server.close();
  }
});

test("quick-start lets any mode be played solo with AI and scripted fill", async () => {
  const { server, baseUrl } = await startTestServer({ env: { MIRAGE_M01_OPPONENT_KIND: "ai" } });
  try {
    const expectedCounts = {
      M01: { players: 2, ai: 1 },
      M02: { players: 3, ai: 1 },
      M03: { players: 4, ai: 1 },
      M04: { players: 6, ai: 2 },
      M06: { players: 5, ai: 1 },
      M08: { players: 5, ai: 1 },
    };
    for (const [modeId, expected] of Object.entries(expectedCounts)) {
      const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: `Solo ${modeId}` });
      const started = await request(baseUrl, "POST", "/quick-start", { modeId }, guest.json.token);
      assert.equal(started.status, 201, `${modeId} quick-start should return 201`);
      assert.equal(started.json.status, "matched");
      assert.equal(started.json.game.phase, "DISCUSSION");
      assert.equal(started.json.game.players.length, expected.players, `${modeId} player count`);

      const me = started.json.game.players.find((player) => player.userId === guest.json.user.id);
      assert.ok(me, `${modeId} should seat the player`);
      // 单人快速开始：真人玩家永远是侦探视角，卧底/诱饵由脚本补位真人扮演。
      assert.equal(me.role, "human", `${modeId} player must stay detective`);

      const admin = await request(baseUrl, "GET", `/admin/games/${started.json.game.id}`, null, null, { "X-Admin-Token": "test-admin" });
      assert.equal(admin.status, 200);
      const aiCount = admin.json.game.players.filter((player) => player.role === "ai").length;
      assert.equal(aiCount, expected.ai, `${modeId} AI count`);
      if (modeId === "M06" || modeId === "M08") {
        const specialRole = modeId === "M06" ? "human_undercover" : "fake_ai";
        const special = admin.json.game.players.find((player) => player.role === specialRole);
        assert.ok(special, `${modeId} should assign ${specialRole}`);
        assert.equal(special.kind, "scripted_human", `${modeId} special role goes to scripted fill in solo play`);
        assert.notEqual(special.userId, guest.json.user.id);
      }
    }

    // 快速开始不需要好友房；公开匹配对好友房模式仍然拒绝。
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "对照" });
    const rejected = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M06" }, guest.json.token);
    assert.equal(rejected.status, 422);
    assert.equal(rejected.json.error, "mode_requires_friend_room");
  } finally {
    server.close();
  }
});

test("modes expose player-facing rules and flow metadata", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/modes`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.modes.length, 6);
    // 统一世界观：所有模式共享同一个背景设定。
    assert.equal(data.worldSetting.title, "图灵迷局");
    assert.ok(data.worldSetting.background.includes("圆桌"));
    assert.ok(data.modes.every((mode) => mode.flow.includes("复盘")));
    assert.ok(data.modes.every((mode) => !mode.flow.includes("线索回看")));
    // 统一流程：所有模式共享同一套阶段，不再有中段表态或模式专属阶段。
    assert.ok(data.modes.every((mode) => !mode.flow.includes("中段表态")));
    assert.ok(data.modes.every((mode) => mode.midCheckSeconds === undefined));
    assert.ok(data.modes.every((mode) => mode.rules.every((rule) => !rule.includes("中段表态"))));
    assert.ok(data.modes.every((mode) => mode.rules.every((rule) => !rule.includes("证据笔记"))));
    // 商业化展示字段：每个模式都有难度和一句话卖点。
    assert.ok(data.modes.every((mode) => [1, 2, 3].includes(mode.difficulty)));
    assert.ok(data.modes.every((mode) => typeof mode.tagline === "string" && mode.tagline.length > 0));
    assert.ok(data.modes.every((mode) => mode.flow.includes("投票归票")));

    const quickMode = data.modes.find((mode) => mode.id === "M01");
    assert.equal(quickMode.name, "单线接触");
    assert.equal(quickMode.matchType, "public");
    assert.ok(quickMode.rules.length >= 2);
    assert.match(quickMode.safety, /扰局/);

    const threePlayerMode = data.modes.find((mode) => mode.id === "M02");
    assert.equal(threePlayerMode.matchType, "public");
    assert.ok(threePlayerMode.flow.includes("任务卡"));

    const classicMode = data.modes.find((mode) => mode.id === "M03");
    assert.equal(classicMode.matchType, "friend_room");
    assert.ok(classicMode.flow.includes("创建房间"));

    const friendMode = data.modes.find((mode) => mode.id === "M04");
    assert.equal(friendMode.matchType, "friend_room");
    assert.ok(friendMode.flow.includes("成员准备"));
    assert.ok(friendMode.rules.some((rule) => rule.includes("至少 3 名真人")));
    assert.ok(friendMode.rules.some((rule) => rule.includes("得票")));

    const undercoverMode = data.modes.find((mode) => mode.id === "M06");
    assert.equal(undercoverMode.matchType, "friend_room");
    assert.equal(undercoverMode.playerCount, 5);
    assert.equal(undercoverMode.minHumanCount, 4);
    assert.ok(undercoverMode.rules.some((rule) => rule.includes("人类卧底")));
    assert.ok(undercoverMode.rules.some((rule) => rule.includes("真正 AI")));

    const fakeAiMode = data.modes.find((mode) => mode.id === "M08");
    assert.equal(fakeAiMode.matchType, "friend_room");
    assert.equal(fakeAiMode.playerCount, 5);
    assert.equal(fakeAiMode.minHumanCount, 4);
    assert.ok(fakeAiMode.rules.some((rule) => rule.includes("伪 AI 真人")));
  } finally {
    server.close();
  }
});

test("official topics drive matchmaking and friend-room game creation", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const topicsResponse = await fetch(`${baseUrl}/topics`);
    const topicsData = await topicsResponse.json();
    assert.equal(topicsResponse.status, 200);
    assert.ok(topicsData.topics.length >= 4);
    assert.ok(topicsData.topics.every((topic) => Array.isArray(topic.modeIds)));

    const m01TopicsResponse = await fetch(`${baseUrl}/topics?modeId=M01`);
    const m01TopicsData = await m01TopicsResponse.json();
    assert.equal(m01TopicsResponse.status, 200);
    assert.ok(m01TopicsData.topics.some((topic) => topic.id === "label-ai-content"));
    assert.equal(m01TopicsData.topics.some((topic) => topic.id === "workplace-ai-decisions"), false);

    const advancedTopicsResponse = await fetch(`${baseUrl}/topics?modeId=M06`);
    const advancedTopicsData = await advancedTopicsResponse.json();
    assert.equal(advancedTopicsResponse.status, 200);
    assert.ok(advancedTopicsData.topics.some((topic) => topic.id === "campus-ai-writing"));
    assert.ok(advancedTopicsData.topics.some((topic) => topic.id === "workplace-ai-decisions"));

    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Topic Solo" });
    const invalid = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01", topicId: "workplace-ai-decisions" }, guest.json.token);
    assert.equal(invalid.status, 422);
    assert.equal(invalid.json.error, "topic_not_available");

    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01", topicId: "label-ai-content" }, guest.json.token);
    assert.equal(match.status, 201);
    assert.equal(match.json.game.topic.id, "label-ai-content");
    assert.match(match.json.game.topic.title, /标注/);
    assert.ok(match.json.game.messages.some((message) => message.text.includes("AI 生成内容是否必须标注")));

    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Topic Host" });
    const room = await request(baseUrl, "POST", "/rooms", { modeId: "M03", topicId: "campus-ai-writing" }, host.json.token);
    assert.equal(room.status, 201);
    assert.equal(room.json.room.topicId, "campus-ai-writing");

    const guestTwo = await request(baseUrl, "POST", "/auth/guest", { nickname: "Topic Guest" });
    await request(baseUrl, "POST", "/rooms/join", { inviteCode: room.json.room.inviteCode }, guestTwo.json.token);
    await request(baseUrl, "POST", `/rooms/${room.json.room.id}/ready`, { ready: true }, guestTwo.json.token);

    const guestUpdate = await request(baseUrl, "POST", `/rooms/${room.json.room.id}/topic`, { topicId: "workplace-ai-decisions" }, guestTwo.json.token);
    assert.equal(guestUpdate.status, 403);
    assert.equal(guestUpdate.json.error, "only_host_can_update_topic");

    const updated = await request(baseUrl, "POST", `/rooms/${room.json.room.id}/topic`, { topicId: "workplace-ai-decisions" }, host.json.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.json.room.topicId, "workplace-ai-decisions");
    assert.equal(updated.json.room.players.find((player) => player.userId === host.json.user.id).ready, true);
    assert.equal(updated.json.room.players.find((player) => player.userId === guestTwo.json.user.id).ready, false);

    await request(baseUrl, "POST", `/rooms/${room.json.room.id}/ready`, { ready: true }, guestTwo.json.token);
    const started = await request(baseUrl, "POST", `/rooms/${room.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    assert.equal(started.json.game.topic.id, "workplace-ai-decisions");
    assert.match(started.json.game.messages.find((message) => message.senderKind === "player").text, /绩效评估/);
  } finally {
    server.close();
  }
});

test("admin can disable official topics without emptying any mode", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const adminHeaders = { "X-Admin-Token": "test-admin" };
    const listed = await request(baseUrl, "GET", "/admin/topics", null, null, adminHeaders);
    assert.equal(listed.status, 200);
    assert.ok(listed.json.topics.some((topic) => topic.id === "label-ai-content" && topic.enabled === true));

    const disabled = await request(baseUrl, "PATCH", "/admin/topics/label-ai-content", { enabled: false }, null, adminHeaders);
    assert.equal(disabled.status, 200);
    assert.equal(disabled.json.topic.id, "label-ai-content");
    assert.equal(disabled.json.topic.enabled, false);

    const publicTopics = await fetch(`${baseUrl}/topics?modeId=M01`);
    const publicData = await publicTopics.json();
    assert.equal(publicTopics.status, 200);
    assert.equal(publicData.topics.some((topic) => topic.id === "label-ai-content"), false);
    assert.ok(publicData.topics.some((topic) => topic.id === "campus-ai-writing"));

    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Disabled Topic" });
    const blockedMatch = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01", topicId: "label-ai-content" }, guest.json.token);
    assert.equal(blockedMatch.status, 422);
    assert.equal(blockedMatch.json.error, "topic_not_available");

    const lastM01Topic = await request(baseUrl, "PATCH", "/admin/topics/campus-ai-writing", { enabled: false }, null, adminHeaders);
    assert.equal(lastM01Topic.status, 422);
    assert.equal(lastM01Topic.json.error, "topic_disable_would_empty_mode");

    const stillAvailable = await fetch(`${baseUrl}/topics?modeId=M01`);
    const stillAvailableData = await stillAvailable.json();
    assert.ok(stillAvailableData.topics.some((topic) => topic.id === "campus-ai-writing"));

    const enabled = await request(baseUrl, "PATCH", "/admin/topics/label-ai-content", { enabled: true }, null, adminHeaders);
    assert.equal(enabled.status, 200);
    assert.equal(enabled.json.topic.enabled, true);

    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, adminHeaders);
    assert.ok(audit.json.events.some((event) => event.type === "topic.updated" && event.payload.topicId === "label-ai-content"));
  } finally {
    server.close();
  }
});

test("M02 waiting tickets can be cancelled without ghost matching", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cancel A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cancel B" });
    const c = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cancel C" });

    const wait = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, a.json.token);
    assert.equal(wait.status, 202);

    const cancelled = await request(baseUrl, "DELETE", `/matchmaking/${wait.json.ticketId}`, null, a.json.token);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.json.status, "cancelled");

    const missing = await request(baseUrl, "GET", `/matchmaking/${wait.json.ticketId}`, null, a.json.token);
    assert.equal(missing.status, 404);
    assert.equal(missing.json.error, "matchmaking_ticket_not_found");

    const bWait = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, b.json.token);
    assert.equal(bWait.status, 202);
    assert.equal(bWait.json.status, "waiting");

    const cMatched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, c.json.token);
    assert.equal(cMatched.status, 201);
    const cInternalGame = await request(baseUrl, "GET", `/admin/games/${cMatched.json.game.id}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(cInternalGame.status, 200);
    const humanUserIds = cInternalGame.json.game.players.filter((player) => player.kind === "human").map((player) => player.userId);
    assert.deepEqual(new Set(humanUserIds), new Set([b.json.user.id, c.json.user.id]));
  } finally {
    server.close();
  }
});

test("cancelling a just-matched ticket returns the game instead of dropping it", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "Race A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "Race B" });

    const wait = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, a.json.token);
    assert.equal(wait.status, 202);

    const matched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, b.json.token);
    assert.equal(matched.status, 201);

    const cancelAfterMatch = await request(baseUrl, "DELETE", `/matchmaking/${wait.json.ticketId}`, null, a.json.token);
    assert.equal(cancelAfterMatch.status, 200);
    assert.equal(cancelAfterMatch.json.status, "matched");
    assert.equal(cancelAfterMatch.json.game.id, matched.json.game.id);
  } finally {
    server.close();
  }
});

test("reports are traceable and actionable through admin API", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Reporter" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const gameId = match.json.game.id;
    const messageId = match.json.game.messages[1].id;

    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId, messageId, reason: "harassment" },
      guest.json.token,
    );
    assert.equal(report.status, 201);
    assert.equal(report.json.report.status, "open");

    const reports = await request(baseUrl, "GET", "/admin/reports", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(reports.status, 200);
    assert.equal(reports.json.reports.length, 1);

    const patched = await request(
      baseUrl,
      "PATCH",
      `/admin/reports/${report.json.report.id}`,
      { status: "resolved", action: "warned" },
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(patched.status, 200);
    assert.equal(patched.json.report.action, "warned");

    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(audit.status, 200);
    const createdEvent = audit.json.events.find((event) => event.type === "report.created");
    assert.equal(createdEvent.payload.reportId, report.json.report.id);
    const updatedEvent = audit.json.events.find((event) => event.type === "report.updated");
    assert.equal(updatedEvent.payload.actor, "admin");
    assert.deepEqual(updatedEvent.payload.previous, { status: "open", action: null });
    assert.deepEqual(updatedEvent.payload.next, { status: "resolved", action: "warned" });
  } finally {
    server.close();
  }
});

test("admin can export reports as csv", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "CSV Reporter" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "harassment,spam" },
      guest.json.token,
    );
    assert.equal(report.status, 201);

    const forbidden = await fetch(`${baseUrl}/admin/reports.csv`);
    assert.equal(forbidden.status, 403);

    const exported = await fetch(`${baseUrl}/admin/reports.csv`, {
      headers: { "X-Admin-Token": "test-admin" },
    });
    const csv = await exported.text();
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("content-type"), /text\/csv/);
    assert.match(exported.headers.get("content-disposition"), /mirage-reports\.csv/);
    assert.match(csv, /id,status,action,reason,createdAt,updatedAt,reporterUserId,targetUserId,gameId,roomId,messageId/);
    assert.match(csv, new RegExp(report.json.report.id));
    assert.match(csv, /"harassment,spam"/);
    assert.equal(csv.includes(match.json.game.messages[1].text), false);
  } finally {
    server.close();
  }
});

test("admin can filter report queue and csv export", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const reporter = await request(baseUrl, "POST", "/auth/guest", { nickname: "Filter Reporter" });
    const firstTarget = await request(baseUrl, "POST", "/auth/guest", { nickname: "Filter Target A" });
    const secondTarget = await request(baseUrl, "POST", "/auth/guest", { nickname: "Filter Target B" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, reporter.json.token);
    const first = await request(
      baseUrl,
      "POST",
      "/reports",
      {
        gameId: match.json.game.id,
        targetUserId: firstTarget.json.user.id,
        reason: "filter_harassment",
      },
      reporter.json.token,
    );
    const second = await request(
      baseUrl,
      "POST",
      "/reports",
      {
        targetUserId: secondTarget.json.user.id,
        reason: "filter_spam",
      },
      reporter.json.token,
    );
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    await request(
      baseUrl,
      "PATCH",
      `/admin/reports/${first.json.report.id}`,
      { status: "resolved", action: "filtered_reviewed" },
      null,
      { "X-Admin-Token": "test-admin" },
    );

    const resolved = await request(baseUrl, "GET", "/admin/reports?status=resolved", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(resolved.status, 200);
    assert.deepEqual(resolved.json.reports.map((report) => report.id), [first.json.report.id]);

    const spam = await request(baseUrl, "GET", "/admin/reports?reason=spam", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(spam.status, 200);
    assert.deepEqual(spam.json.reports.map((report) => report.id), [second.json.report.id]);

    const target = await request(
      baseUrl,
      "GET",
      `/admin/reports?targetUserId=${encodeURIComponent(secondTarget.json.user.id)}`,
      null,
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(target.status, 200);
    assert.deepEqual(target.json.reports.map((report) => report.id), [second.json.report.id]);

    const filteredCsv = await fetch(`${baseUrl}/admin/reports.csv?reason=spam`, {
      headers: { "X-Admin-Token": "test-admin" },
    });
    const csv = await filteredCsv.text();
    assert.equal(filteredCsv.status, 200);
    assert.match(csv, new RegExp(second.json.report.id));
    assert.equal(csv.includes(first.json.report.id), false);
  } finally {
    server.close();
  }
});

test("admin can batch resolve reports with audit trail", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Batch Reporter" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const first = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "spam" },
      guest.json.token,
    );
    const second = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "harassment" },
      guest.json.token,
    );
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    const empty = await request(
      baseUrl,
      "POST",
      "/admin/reports/batch",
      { reportIds: [] },
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(empty.status, 422);
    assert.equal(empty.json.error, "report_batch_empty");

    const batch = await request(
      baseUrl,
      "POST",
      "/admin/reports/batch",
      { reportIds: [first.json.report.id, second.json.report.id], status: "resolved", action: "bulk_reviewed" },
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(batch.status, 200);
    assert.equal(batch.json.reports.length, 2);
    assert.ok(batch.json.reports.every((report) => report.status === "resolved" && report.action === "bulk_reviewed"));

    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(metrics.json.metrics.reports.open, 0);
    assert.equal(metrics.json.metrics.reports.resolved, 2);

    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, { "X-Admin-Token": "test-admin" });
    const batchEvent = audit.json.events.find((event) => event.type === "report.batch.updated");
    assert.equal(batchEvent.payload.count, 2);
    assert.equal(batchEvent.payload.action, "bulk_reviewed");
    assert.deepEqual(new Set(batchEvent.payload.reportIds), new Set([first.json.report.id, second.json.report.id]));
  } finally {
    server.close();
  }
});

test("admin can batch ban report targets with audit trail", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const reporter = await request(baseUrl, "POST", "/auth/guest", { nickname: "Batch Ban Reporter" });
    const firstTarget = await request(baseUrl, "POST", "/auth/guest", { nickname: "Batch Target A" });
    const secondTarget = await request(baseUrl, "POST", "/auth/guest", { nickname: "Batch Target B" });
    const first = await request(
      baseUrl,
      "POST",
      "/reports",
      { targetUserId: firstTarget.json.user.id, reason: "confirmed_threat" },
      reporter.json.token,
    );
    const second = await request(
      baseUrl,
      "POST",
      "/reports",
      { targetUserId: secondTarget.json.user.id, reason: "confirmed_scam" },
      reporter.json.token,
    );
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    const batch = await request(
      baseUrl,
      "POST",
      "/admin/reports/batch-ban-targets",
      { reportIds: [first.json.report.id, second.json.report.id], reason: "confirmed_batch_violation" },
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(batch.status, 200);
    assert.equal(batch.json.users.length, 2);
    assert.ok(batch.json.users.every((user) => user.bannedAt && user.banReason === "confirmed_batch_violation"));
    assert.ok(batch.json.reports.every((report) => report.status === "resolved" && report.action === "banned_user"));

    const firstPlay = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, firstTarget.json.token);
    assert.equal(firstPlay.status, 403);
    assert.equal(firstPlay.json.error, "user_banned");
    const secondPlay = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, secondTarget.json.token);
    assert.equal(secondPlay.status, 403);
    assert.equal(secondPlay.json.error, "user_banned");

    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(metrics.json.metrics.safety.bannedUsers, 2);

    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, { "X-Admin-Token": "test-admin" });
    const batchEvent = audit.json.events.find((event) => event.type === "report.batch.targets_banned");
    assert.equal(batchEvent.payload.count, 2);
    assert.equal(batchEvent.payload.reason, "confirmed_batch_violation");
    assert.deepEqual(new Set(batchEvent.payload.reportIds), new Set([first.json.report.id, second.json.report.id]));
    assert.deepEqual(new Set(batchEvent.payload.targetUserIds), new Set([firstTarget.json.user.id, secondTarget.json.user.id]));
  } finally {
    server.close();
  }
});

test("admin trends summarize launch funnel and safety activity", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const player = await request(baseUrl, "POST", "/auth/guest", { nickname: "Trend Player" });
    const target = await request(baseUrl, "POST", "/auth/guest", { nickname: "Trend Target" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, player.json.token);
    assert.equal(match.status, 201);
    const gameId = match.json.game.id;
    const send = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我会根据具体细节判断。" }, player.json.token);
    assert.equal(send.status, 201);
    const suspect = send.json.game.players.find((item) => item.kind === "unknown");
    assert.ok(suspect);
    const finalStatement = await advanceToVoting(baseUrl, gameId, player.json.token);
    assert.equal(finalStatement.status, 200);
    const vote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: suspect.id }, player.json.token);
    assert.equal(vote.status, 200);
    const replay = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, player.json.token);
    assert.equal(replay.status, 200);
    assert.equal(replay.json.game.phase, "COMPLETED");

    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId, targetUserId: target.json.user.id, reason: "trend_safety_review" },
      player.json.token,
    );
    assert.equal(report.status, 201);
    const batchBan = await request(
      baseUrl,
      "POST",
      "/admin/reports/batch-ban-targets",
      { reportIds: [report.json.report.id], reason: "trend_confirmed" },
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(batchBan.status, 200);

    const trends = await request(baseUrl, "GET", "/admin/trends?days=14", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(trends.status, 200);
    assert.equal(trends.json.trends.window.days, 14);
    assert.equal(trends.json.trends.days.length, 14);
    const activeDay = trends.json.trends.days.find((day) => day.startedGames > 0);
    assert.ok(activeDay);
    assert.equal(activeDay.startedGames, 1);
    assert.equal(activeDay.completedGames, 1);
    assert.equal(activeDay.reports, 1);
    assert.equal(activeDay.bans, 1);
    assert.ok(activeDay.aiMessages >= 1);
    assert.equal(activeDay.replayViewers, 1);
    assert.equal(trends.json.trends.totals.startedGames, 1);
    assert.equal(trends.json.trends.totals.completedGames, 1);
    assert.equal(trends.json.trends.totals.reports, 1);
    assert.equal(trends.json.trends.totals.bans, 1);
  } finally {
    server.close();
  }
});

test("admin readonly token can inspect operations but cannot mutate state", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      ADMIN_READONLY_TOKEN: "test-readonly",
    },
  });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Read Only Ops" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "readonly_review" },
      guest.json.token,
    );
    assert.equal(report.status, 201);
    const readonlyHeaders = { "X-Admin-Token": "test-readonly" };

    const readonlySession = await request(baseUrl, "GET", "/admin/session", null, null, readonlyHeaders);
    assert.equal(readonlySession.status, 200);
    assert.equal(readonlySession.json.access, "read");
    const writeSession = await request(baseUrl, "GET", "/admin/session", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(writeSession.status, 200);
    assert.equal(writeSession.json.access, "write");

    const reports = await request(baseUrl, "GET", "/admin/reports", null, null, readonlyHeaders);
    assert.equal(reports.status, 200);
    assert.equal(reports.json.reports.length, 1);
    const context = await request(baseUrl, "GET", `/admin/reports/${report.json.report.id}/context`, null, null, readonlyHeaders);
    assert.equal(context.status, 200);
    assert.equal(context.json.report.id, report.json.report.id);
    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, readonlyHeaders);
    assert.equal(metrics.status, 200);
    const trends = await request(baseUrl, "GET", "/admin/trends?days=7", null, null, readonlyHeaders);
    assert.equal(trends.status, 200);
    assert.equal(trends.json.trends.window.days, 7);
    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, readonlyHeaders);
    assert.equal(audit.status, 200);
    const topics = await request(baseUrl, "GET", "/admin/topics", null, null, readonlyHeaders);
    assert.equal(topics.status, 200);
    const game = await request(baseUrl, "GET", `/admin/games/${match.json.game.id}`, null, null, readonlyHeaders);
    assert.equal(game.status, 200);
    const csv = await fetch(`${baseUrl}/admin/reports.csv`, { headers: readonlyHeaders });
    assert.equal(csv.status, 200);

    const patchReport = await request(
      baseUrl,
      "PATCH",
      `/admin/reports/${report.json.report.id}`,
      { status: "resolved", action: "readonly_attempt" },
      null,
      readonlyHeaders,
    );
    assert.equal(patchReport.status, 403);
    assert.equal(patchReport.json.error, "admin_write_forbidden");
    const batch = await request(
      baseUrl,
      "POST",
      "/admin/reports/batch",
      { reportIds: [report.json.report.id], status: "resolved" },
      null,
      readonlyHeaders,
    );
    assert.equal(batch.status, 403);
    assert.equal(batch.json.error, "admin_write_forbidden");
    const batchBan = await request(
      baseUrl,
      "POST",
      "/admin/reports/batch-ban-targets",
      { reportIds: [report.json.report.id], reason: "readonly_attempt" },
      null,
      readonlyHeaders,
    );
    assert.equal(batchBan.status, 403);
    assert.equal(batchBan.json.error, "admin_write_forbidden");
    const topicPatch = await request(
      baseUrl,
      "PATCH",
      "/admin/topics/label-ai-content",
      { enabled: false },
      null,
      readonlyHeaders,
    );
    assert.equal(topicPatch.status, 403);
    assert.equal(topicPatch.json.error, "admin_write_forbidden");
    const ban = await request(
      baseUrl,
      "POST",
      `/admin/reports/${report.json.report.id}/ban-target`,
      { reason: "readonly_attempt" },
      null,
      readonlyHeaders,
    );
    assert.equal(ban.status, 403);
    assert.equal(ban.json.error, "admin_write_forbidden");

    const unchanged = await request(baseUrl, "GET", "/admin/reports", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(unchanged.json.reports[0].status, "open");
    assert.equal(unchanged.json.reports[0].action, null);
  } finally {
    server.close();
  }
});

test("report creation sends configured alert webhook and records audit", async () => {
  const webhook = await startWebhookServer();
  const { server, baseUrl } = await startTestServer({
    env: {
      REPORT_ALERT_WEBHOOK_URL: `${webhook.url}/alerts`,
      REPORT_ALERT_WEBHOOK_SECRET: "test-alert-secret",
    },
  });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Alert Reporter" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "alert_test" },
      guest.json.token,
    );

    assert.equal(report.status, 201);
    assert.equal(webhook.deliveries.length, 1);
    assert.equal(webhook.deliveries[0].method, "POST");
    assert.equal(webhook.deliveries[0].url, "/alerts");
    assert.equal(webhook.deliveries[0].headers["x-mirage-alert-secret"], "test-alert-secret");
    assert.equal(webhook.deliveries[0].body.type, "report.created");
    assert.equal(webhook.deliveries[0].body.report.id, report.json.report.id);
    assert.equal(webhook.deliveries[0].body.report.reason, "alert_test");

    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(audit.status, 200);
    const sentEvent = audit.json.events.find((event) => event.type === "report.alert.sent");
    assert.equal(sentEvent.payload.reportId, report.json.report.id);
    assert.equal(sentEvent.payload.destination, webhook.url);
    assert.equal(sentEvent.payload.statusCode, 204);
    assert.equal(JSON.stringify(audit.json).includes("test-alert-secret"), false);

    const ready = await request(baseUrl, "GET", "/ready");
    assert.equal(ready.json.reportAlerts.configured, true);
    assert.equal(ready.json.reportAlerts.destination, webhook.url);
    assert.equal(JSON.stringify(ready.json).includes("test-alert-secret"), false);
  } finally {
    server.close();
    webhook.server.close();
  }
});

test("report alert failures are audited without blocking report creation", async () => {
  const webhook = await startWebhookServer(async () => ({ status: 500, body: "failed" }));
  const { server, baseUrl } = await startTestServer({
    env: {
      REPORT_ALERT_WEBHOOK_URL: `${webhook.url}/alerts`,
    },
  });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Alert Failure" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "alert_failure" },
      guest.json.token,
    );

    assert.equal(report.status, 201);
    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(audit.status, 200);
    const failedEvent = audit.json.events.find((event) => event.type === "report.alert.failed");
    assert.equal(failedEvent.payload.reportId, report.json.report.id);
    assert.equal(failedEvent.payload.destination, webhook.url);
    assert.equal(failedEvent.payload.statusCode, 500);
    assert.equal(failedEvent.payload.error, "webhook_500");
  } finally {
    server.close();
    webhook.server.close();
  }
});

test("admin can inspect report context and ban target user from continuing play", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "Reporter A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "Target B" });
    const outsider = await request(baseUrl, "POST", "/auth/guest", { nickname: "Outsider" });

    await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, a.json.token);
    const matched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, b.json.token);
    const gameId = matched.json.game.id;

    const outsiderRead = await request(baseUrl, "GET", `/games/${gameId}`, null, outsider.json.token);
    assert.equal(outsiderRead.status, 403);

    const bMessage = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我觉得可以不告诉老师用了 AI。" }, b.json.token);
    assert.equal(bMessage.status, 201);
    const targetMessage = bMessage.json.game.messages.find((message) => message.text === "我觉得可以不告诉老师用了 AI。");
    assert.ok(targetMessage);

    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      {
        gameId,
        messageId: targetMessage.id,
        targetUserId: b.json.user.id,
        reason: "unsafe_advice",
      },
      a.json.token,
    );
    assert.equal(report.status, 201);

    const context = await request(
      baseUrl,
      "GET",
      `/admin/reports/${report.json.report.id}/context`,
      null,
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(context.status, 200);
    assert.equal(context.json.target.nickname, "Target B");
    assert.ok(context.json.messages.some((message) => message.id === targetMessage.id));

    const banned = await request(
      baseUrl,
      "POST",
      `/admin/reports/${report.json.report.id}/ban-target`,
      { reason: "confirmed_policy_violation" },
      null,
      { "X-Admin-Token": "test-admin" },
    );
    assert.equal(banned.status, 200);
    assert.equal(banned.json.user.banReason, "confirmed_policy_violation");

    const bMe = await request(baseUrl, "GET", "/me", null, b.json.token);
    assert.equal(bMe.status, 200);
    assert.ok(bMe.json.user.bannedAt);

    const bPlay = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, b.json.token);
    assert.equal(bPlay.status, 403);
    assert.equal(bPlay.json.error, "user_banned");

    const bReadGame = await request(baseUrl, "GET", `/games/${gameId}`, null, b.json.token);
    assert.equal(bReadGame.status, 403);

    const audit = await request(baseUrl, "GET", "/admin/audit", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(audit.status, 200);
    const bannedEvent = audit.json.events.find((event) => event.type === "user.banned");
    assert.equal(bannedEvent.payload.targetUserId, b.json.user.id);
    assert.equal(bannedEvent.payload.reportId, report.json.report.id);
    assert.equal(bannedEvent.payload.actor, "admin");
    const reportResolvedEvent = audit.json.events.find(
      (event) => event.type === "report.updated" && event.payload.next?.action === "banned_user",
    );
    assert.equal(reportResolvedEvent.payload.reportId, report.json.report.id);
    assert.deepEqual(reportResolvedEvent.payload.previous, { status: "open", action: null });
  } finally {
    server.close();
  }
});

test("user blocks prevent rematching and friend room joins", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "Blocker A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "Blocked B" });
    const c = await request(baseUrl, "POST", "/auth/guest", { nickname: "Neutral C" });

    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { targetUserId: b.json.user.id, reason: "block_test", block: true },
      a.json.token,
    );
    assert.equal(report.status, 201);

    const bWait = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, b.json.token);
    assert.equal(bWait.status, 202);

    const aWait = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, a.json.token);
    assert.equal(aWait.status, 202);

    const cMatch = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, c.json.token);
    assert.equal(cMatch.status, 201);
    const blockedInternalGame = await request(baseUrl, "GET", `/admin/games/${cMatch.json.game.id}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(blockedInternalGame.status, 200);
    const matchedUserIds = blockedInternalGame.json.game.players.filter((player) => player.kind === "human").map((player) => player.userId);
    assert.ok(matchedUserIds.includes(b.json.user.id));
    assert.ok(matchedUserIds.includes(c.json.user.id));
    assert.equal(matchedUserIds.includes(a.json.user.id), false);

    const room = await request(baseUrl, "POST", "/rooms", { modeId: "M03" }, a.json.token);
    assert.equal(room.status, 201);

    const blockedJoin = await request(baseUrl, "POST", "/rooms/join", { inviteCode: room.json.room.inviteCode }, b.json.token);
    assert.equal(blockedJoin.status, 403);
    assert.equal(blockedJoin.json.error, "room_blocked_user");
  } finally {
    server.close();
  }
});

test("standalone blocks do not create reports and cannot target self", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const blocker = await request(baseUrl, "POST", "/auth/guest", { nickname: "Block Only A" });
    const target = await request(baseUrl, "POST", "/auth/guest", { nickname: "Block Only B" });

    const block = await request(
      baseUrl,
      "POST",
      "/blocks",
      { targetUserId: target.json.user.id },
      blocker.json.token,
    );
    assert.equal(block.status, 201);
    assert.equal(block.json.block.sourceUserId, blocker.json.user.id);
    assert.equal(block.json.block.targetUserId, target.json.user.id);

    const repeated = await request(
      baseUrl,
      "POST",
      "/blocks",
      { targetUserId: target.json.user.id },
      blocker.json.token,
    );
    assert.equal(repeated.status, 201);
    assert.equal(repeated.json.block.id, block.json.block.id);

    const reports = await request(baseUrl, "GET", "/admin/reports", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(reports.status, 200);
    assert.equal(reports.json.reports.length, 0);

    const room = await request(baseUrl, "POST", "/rooms", { modeId: "M03" }, target.json.token);
    assert.equal(room.status, 201);
    const blockedJoin = await request(baseUrl, "POST", "/rooms/join", { inviteCode: room.json.room.inviteCode }, blocker.json.token);
    assert.equal(blockedJoin.status, 403);
    assert.equal(blockedJoin.json.error, "room_blocked_user");

    const selfBlock = await request(
      baseUrl,
      "POST",
      "/blocks",
      { targetUserId: blocker.json.user.id },
      blocker.json.token,
    );
    assert.equal(selfBlock.status, 422);
    assert.equal(selfBlock.json.error, "cannot_block_self");
  } finally {
    server.close();
  }
});

test("friend room members can observe lobby changes and enter started game", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Host" });
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Guest" });

    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M03", topicId: "label-ai-content" }, host.json.token);
    assert.equal(created.json.room.topicId, "label-ai-content");
    assert.equal(created.status, 201);

    const joined = await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guest.json.token);
    assert.equal(joined.status, 200);
    assert.equal(joined.json.room.players.length, 2);

    const hostReadLobby = await request(baseUrl, "GET", `/rooms/${created.json.room.id}`, null, host.json.token);
    assert.equal(hostReadLobby.status, 200);
    assert.ok(hostReadLobby.json.room.players.some((player) => player.userId === guest.json.user.id));

    const ready = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, guest.json.token);
    assert.equal(ready.status, 200);

    const hostReadReady = await request(baseUrl, "GET", `/rooms/${created.json.room.id}`, null, host.json.token);
    const guestPlayer = hostReadReady.json.room.players.find((player) => player.userId === guest.json.user.id);
    assert.equal(guestPlayer.ready, true);

    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    assert.equal(started.json.game.topic.id, "label-ai-content");

    const guestReadStartedRoom = await request(baseUrl, "GET", `/rooms/${created.json.room.id}`, null, guest.json.token);
    assert.equal(guestReadStartedRoom.status, 200);
    assert.equal(guestReadStartedRoom.json.room.status, "IN_GAME");
    assert.equal(guestReadStartedRoom.json.room.gameId, started.json.game.id);

    const guestReadGame = await request(baseUrl, "GET", `/games/${started.json.game.id}`, null, guest.json.token);
    assert.equal(guestReadGame.status, 200);
    assert.equal(guestReadGame.json.game.id, started.json.game.id);
  } finally {
    server.close();
  }
});

test("completed friend rooms can rematch with retained members", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Host" });
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Guest" });

    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M03", topicId: "label-ai-content" }, host.json.token);
    await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guest.json.token);
    await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, guest.json.token);

    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);

    const earlyRematch = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, guest.json.token);
    assert.equal(earlyRematch.status, 409);
    assert.equal(earlyRematch.json.error, "room_rematch_not_available");

    const gameId = started.json.game.id;
    const finalPhase = await advanceToFinalStatement(baseUrl, gameId, host.json.token);
    assert.equal(finalPhase.status, 200);
    assert.equal(finalPhase.json.game.phase, "FINAL_STATEMENT");
    const voting = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, host.json.token);
    assert.equal(voting.status, 200);
    assert.equal(voting.json.game.phase, "VOTING");
    const rematchAdminGame = await request(baseUrl, "GET", `/admin/games/${gameId}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(rematchAdminGame.status, 200);
    const hiddenAi = rematchAdminGame.json.game.players.find((player) => player.role === "ai");
    assert.ok(hiddenAi);

    const invalidAbstain = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: "abstain" }, host.json.token);
    assert.equal(invalidAbstain.status, 422);
    assert.equal(invalidAbstain.json.error, "invalid_vote_target");

    const hostVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: hiddenAi.id }, host.json.token);
    assert.equal(hostVote.status, 200);
    assert.equal(hostVote.json.game.phase, "VOTING");
    assert.deepEqual(hostVote.json.game.votes, []);
    assert.equal(hostVote.json.game.myVote.targetPlayerId, hiddenAi.id);
    assert.equal(hostVote.json.game.voteState.submitted, true);
    assert.equal(hostVote.json.game.voteState.submittedCount, 1);
    assert.equal(hostVote.json.game.voteState.remaining, 1);
    assert.equal(hostVote.json.game.voteState.total, 2);

    const guestReadBeforeVote = await request(baseUrl, "GET", `/games/${gameId}`, null, guest.json.token);
    assert.equal(guestReadBeforeVote.status, 200);
    assert.equal(guestReadBeforeVote.json.game.myVote, null);
    assert.equal(guestReadBeforeVote.json.game.voteState.submitted, false);
    assert.equal(guestReadBeforeVote.json.game.voteState.submittedCount, 1);
    assert.equal(guestReadBeforeVote.json.game.voteState.remaining, 1);

    const alternateTarget = hostVote.json.game.players.find((player) => player.id !== hiddenAi.id && player.userId !== host.json.user.id);
    assert.ok(alternateTarget);
    const changedVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: alternateTarget.id }, host.json.token);
    assert.equal(changedVote.status, 200);
    assert.equal(changedVote.json.game.phase, "VOTING");
    assert.equal(changedVote.json.game.myVote.targetPlayerId, alternateTarget.id);
    assert.equal(changedVote.json.game.voteState.submittedCount, 1);
    assert.equal(changedVote.json.game.voteState.remaining, 1);

    const restoredVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: hiddenAi.id }, host.json.token);
    assert.equal(restoredVote.status, 200);
    assert.equal(restoredVote.json.game.phase, "VOTING");
    assert.equal(restoredVote.json.game.myVote.targetPlayerId, hiddenAi.id);
    const guestVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: hiddenAi.id }, guest.json.token);
    assert.equal(guestVote.status, 200);
    assert.equal(guestVote.json.game.phase, "REVEAL");

    const completed = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, host.json.token);
    assert.equal(completed.status, 200);
    assert.equal(completed.json.game.phase, "COMPLETED");

    const rematch = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, guest.json.token);
    assert.equal(rematch.status, 201);
    assert.equal(rematch.json.room.modeId, "M03");
    assert.equal(rematch.json.room.topicId, "label-ai-content");
    assert.equal(rematch.json.room.status, "LOBBY");
    assert.equal(rematch.json.room.hostUserId, guest.json.user.id);
    assert.equal(rematch.json.room.rematchFromRoomId, created.json.room.id);
    assert.equal(rematch.json.room.rematchFromGameId, gameId);
    assert.deepEqual(
      rematch.json.room.players.map((player) => player.userId).sort(),
      [host.json.user.id, guest.json.user.id].sort(),
    );
    assert.equal(rematch.json.room.players.find((player) => player.userId === guest.json.user.id).ready, true);
    assert.equal(rematch.json.room.players.find((player) => player.userId === host.json.user.id).ready, false);

    const sameRematch = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, host.json.token);
    assert.equal(sameRematch.status, 200);
    assert.equal(sameRematch.json.room.id, rematch.json.room.id);

    const hostOldGame = await request(baseUrl, "GET", `/games/${gameId}`, null, host.json.token);
    assert.equal(hostOldGame.status, 200);
    assert.equal(hostOldGame.json.game.rematchRoomId, rematch.json.room.id);

    const guestOldGame = await request(baseUrl, "GET", `/games/${gameId}`, null, guest.json.token);
    assert.equal(guestOldGame.status, 200);
    assert.equal(guestOldGame.json.game.rematchRoomId, rematch.json.room.id);
  } finally {
    server.close();
  }
});

test("multi-member rematch returns one retained lobby under repeated clicks", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Race Host" });
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Race Guest" });

    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M03" }, host.json.token);
    await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guest.json.token);
    await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, guest.json.token);

    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    const gameId = started.json.game.id;

    const voting = await advanceToVoting(baseUrl, gameId, host.json.token);
    assert.equal(voting.status, 200);
    assert.equal(voting.json.game.phase, "VOTING");
    const raceAdminGame = await request(baseUrl, "GET", `/admin/games/${gameId}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(raceAdminGame.status, 200);
    const hiddenAi = raceAdminGame.json.game.players.find((player) => player.role === "ai");
    assert.ok(hiddenAi);

    const hostVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: hiddenAi.id }, host.json.token);
    assert.equal(hostVote.status, 200);
    const guestVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: hiddenAi.id }, guest.json.token);
    assert.equal(guestVote.status, 200);
    assert.equal(guestVote.json.game.phase, "REVEAL");

    const completed = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, host.json.token);
    assert.equal(completed.status, 200);
    assert.equal(completed.json.game.phase, "COMPLETED");

    const rematches = await Promise.all([
      request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, host.json.token),
      request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, guest.json.token),
      request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, host.json.token),
      request(baseUrl, "POST", `/rooms/${created.json.room.id}/rematch`, null, guest.json.token),
    ]);
    assert.equal(rematches.filter((response) => response.status === 201).length, 1);
    assert.equal(rematches.filter((response) => response.status === 200).length, 3);
    assert.ok(rematches.every((response) => response.json.room.status === "LOBBY"));

    const rematchRoomIds = new Set(rematches.map((response) => response.json.room.id));
    assert.equal(rematchRoomIds.size, 1);
    const rematchRoomId = rematches[0].json.room.id;
    const inviteCodes = new Set(rematches.map((response) => response.json.room.inviteCode));
    assert.equal(inviteCodes.size, 1);
    assert.deepEqual(
      rematches[0].json.room.players.map((player) => player.userId).sort(),
      [host.json.user.id, guest.json.user.id].sort(),
    );

    const rooms = await request(baseUrl, "GET", "/admin/rooms", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(rooms.status, 200);
    const rematchRooms = rooms.json.rooms.filter((room) => room.rematchFromRoomId === created.json.room.id);
    assert.equal(rematchRooms.length, 1);
    assert.equal(rematchRooms[0].id, rematchRoomId);

    const hostOldGame = await request(baseUrl, "GET", `/games/${gameId}`, null, host.json.token);
    const guestOldGame = await request(baseUrl, "GET", `/games/${gameId}`, null, guest.json.token);
    assert.equal(hostOldGame.json.game.rematchRoomId, rematchRoomId);
    assert.equal(guestOldGame.json.game.rematchRoomId, rematchRoomId);
  } finally {
    server.close();
  }
});

test("friend room members can leave lobby and host is transferred", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Leave Host" });
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Leave Guest" });
    const third = await request(baseUrl, "POST", "/auth/guest", { nickname: "Leave Third" });
    const soloUser = await request(baseUrl, "POST", "/auth/guest", { nickname: "Solo Close" });

    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M03" }, host.json.token);
    const joined = await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guest.json.token);
    assert.equal(joined.json.room.players.length, 2);

    const guestLeft = await request(baseUrl, "DELETE", `/rooms/${created.json.room.id}`, null, guest.json.token);
    assert.equal(guestLeft.status, 200);
    assert.equal(guestLeft.json.room.players.some((player) => player.userId === guest.json.user.id), false);

    const guestReadAfterLeave = await request(baseUrl, "GET", `/rooms/${created.json.room.id}`, null, guest.json.token);
    assert.equal(guestReadAfterLeave.status, 403);
    assert.equal(guestReadAfterLeave.json.error, "room_forbidden");

    await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guest.json.token);
    await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, guest.json.token);

    const hostLeft = await request(baseUrl, "DELETE", `/rooms/${created.json.room.id}`, null, host.json.token);
    assert.equal(hostLeft.status, 200);
    assert.equal(hostLeft.json.room.hostUserId, guest.json.user.id);
    assert.equal(hostLeft.json.room.players.some((player) => player.userId === host.json.user.id), false);

    const guestReadTransferred = await request(baseUrl, "GET", `/rooms/${created.json.room.id}`, null, guest.json.token);
    assert.equal(guestReadTransferred.status, 200);
    assert.equal(guestReadTransferred.json.room.hostUserId, guest.json.user.id);

    const startBeforeEnoughHumans = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, guest.json.token);
    assert.equal(startBeforeEnoughHumans.status, 409);
    assert.equal(startBeforeEnoughHumans.json.error, "not_enough_humans");

    await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, third.json.token);
    await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, third.json.token);

    const startedByNewHost = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, guest.json.token);
    assert.equal(startedByNewHost.status, 201);

    const leaveStarted = await request(baseUrl, "DELETE", `/rooms/${created.json.room.id}`, null, guest.json.token);
    assert.equal(leaveStarted.status, 409);
    assert.equal(leaveStarted.json.error, "room_leave_not_allowed");

    const solo = await request(baseUrl, "POST", "/rooms", { modeId: "M03" }, soloUser.json.token);
    const soloLeft = await request(baseUrl, "DELETE", `/rooms/${solo.json.room.id}`, null, soloUser.json.token);
    assert.equal(soloLeft.status, 200);
    assert.equal(soloLeft.json.room.status, "CLOSED");
    assert.equal(soloLeft.json.room.hostUserId, null);
  } finally {
    server.close();
  }
});

test("friend room start requires the mode minimum human players", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Six Host" });
    const guestA = await request(baseUrl, "POST", "/auth/guest", { nickname: "Six Guest A" });
    const guestB = await request(baseUrl, "POST", "/auth/guest", { nickname: "Six Guest B" });

    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M04" }, host.json.token);
    assert.equal(created.status, 201);

    const soloStart = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(soloStart.status, 409);
    assert.equal(soloStart.json.error, "not_enough_humans");

    await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guestA.json.token);
    await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, guestA.json.token);

    const twoHumanStart = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(twoHumanStart.status, 409);
    assert.equal(twoHumanStart.json.error, "not_enough_humans");

    await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guestB.json.token);
    await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, guestB.json.token);

    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    assert.equal(started.json.game.modeId, "M04");
    const startedInternalGame = await request(baseUrl, "GET", `/admin/games/${started.json.game.id}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(startedInternalGame.status, 200);
    assert.equal(startedInternalGame.json.game.players.filter((player) => player.kind === "human").length, 3);
  } finally {
    server.close();
  }
});

test("friend room enforces fixed player counts before AI seats are filled", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cap Host" });
    const guestA = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cap Guest A" });
    const guestB = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cap Guest B" });
    const guestC = await request(baseUrl, "POST", "/auth/guest", { nickname: "Cap Guest C" });

    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M03", topicId: "campus-ai-writing" }, host.json.token);
    assert.equal(created.status, 201);

    for (const user of [guestA, guestB]) {
      const joined = await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, user.json.token);
      assert.equal(joined.status, 200);
      await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, user.json.token);
    }

    const overfill = await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, guestC.json.token);
    assert.equal(overfill.status, 409);
    assert.equal(overfill.json.error, "room_full");

    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    assert.equal(started.json.game.players.length, 4);
    const startedInternalGame = await request(baseUrl, "GET", `/admin/games/${started.json.game.id}`, null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(startedInternalGame.status, 200);
    assert.equal(startedInternalGame.json.game.players.filter((player) => player.kind === "human").length, 3);
    assert.equal(startedInternalGame.json.game.players.filter((player) => player.role === "ai").length, 1);
  } finally {
    server.close();
  }
});

test("debug room fill starts advanced modes for local solo preview without weakening normal start", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    async function createAndDebugStart(modeId, nickname) {
      const host = await request(baseUrl, "POST", "/auth/guest", { nickname });
      const created = await request(baseUrl, "POST", "/rooms", { modeId, topicId: "campus-ai-writing" }, host.json.token);
      assert.equal(created.status, 201);
      const normalStart = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
      assert.equal(normalStart.status, 409);
      assert.equal(normalStart.json.error, "not_enough_humans");
      const debugStart = await request(baseUrl, "POST", `/debug/rooms/${created.json.room.id}/fill-and-start`, null, host.json.token);
      assert.equal(debugStart.status, 201);
      assert.equal(debugStart.json.game.modeId, modeId);
      return { host, game: debugStart.json.game };
    }

    const dualAi = await createAndDebugStart("M04", "Debug M04");
    assert.equal(dualAi.game.players.length, 6);
    assert.equal(dualAi.game.players.filter((player) => player.userId).length, 1);

    const undercover = await createAndDebugStart("M06", "Debug M06");
    const undercoverPlayer = undercover.game.players.find((player) => player.userId === undercover.host.json.user.id);
    assert.equal(undercoverPlayer.role, "human_undercover");
    assert.equal(undercover.game.skills, undefined);

    const fakeAi = await createAndDebugStart("M08", "Debug M08");
    const fakeAiPlayer = fakeAi.game.players.find((player) => player.userId === fakeAi.host.json.user.id);
    assert.equal(fakeAiPlayer.role, "fake_ai");
    assert.equal(fakeAi.game.skills, undefined);
  } finally {
    server.close();
  }
});

test("M04 dual AI mode requires split votes across both AI players", async () => {
  const { server, baseUrl, engine } = await startTestServer();

  async function startM04(label) {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} Host` });
    const guestA = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} A` });
    const guestB = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} B` });
    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M04", topicId: "campus-ai-writing" }, host.json.token);
    assert.equal(created.status, 201);
    for (const user of [guestA, guestB]) {
      const joined = await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, user.json.token);
      assert.equal(joined.status, 200);
      const ready = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, user.json.token);
      assert.equal(ready.status, 200);
    }
    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    const hiddenPlayers = started.json.game.players.filter((player) => player.kind === "unknown");
    assert.ok(hiddenPlayers.length >= 2);
    const rawGame = await engine.adminGame(started.json.game.id);
    const aiPlayers = rawGame.players.filter((player) => player.role === "ai");
    assert.equal(aiPlayers.length, 2);
    for (const ai of aiPlayers) {
      assert.ok(hiddenPlayers.some((player) => player.id === ai.id));
      assert.ok(started.json.game.messages.some((message) => message.senderPlayerId === ai.id));
    }
    return { host, guestA, guestB, gameId: started.json.game.id, aiPlayers };
  }

  async function advanceToVoting({ host, guestA, guestB, gameId, aiPlayers }) {
    const finalPhase = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 999 }, host.json.token);
    assert.equal(finalPhase.status, 200);
    assert.equal(finalPhase.json.game.phase, "FINAL_STATEMENT");
    for (const ai of aiPlayers) {
      assert.ok(finalPhase.json.game.messages.some((message) => message.senderPlayerId === ai.id && message.text.includes("最后")));
    }
    const hostFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我锁第一个，另一个也有人要分票。" }, host.json.token);
    assert.equal(hostFinal.status, 201);
    const guestAFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我负责第二个目标，避免只集火一人。" }, guestA.json.token);
    assert.equal(guestAFinal.status, 201);
    const guestBFinal = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我补票第一个，让两个 AI 都吃票。" }, guestB.json.token);
    assert.equal(guestBFinal.status, 201);
    assert.equal(guestBFinal.json.game.phase, "VOTING");
  }

  try {
    const winning = await startM04("Split");
    await advanceToVoting(winning);
    await request(baseUrl, "POST", `/games/${winning.gameId}/votes`, { targetPlayerId: winning.aiPlayers[0].id }, winning.host.json.token);
    await request(baseUrl, "POST", `/games/${winning.gameId}/votes`, { targetPlayerId: winning.aiPlayers[1].id }, winning.guestA.json.token);
    const splitVote = await request(baseUrl, "POST", `/games/${winning.gameId}/votes`, { targetPlayerId: winning.aiPlayers[0].id }, winning.guestB.json.token);
    assert.equal(splitVote.status, 200);
    assert.equal(splitVote.json.game.phase, "REVEAL");
    assert.equal(splitVote.json.game.winner, "human");
    const winningReplay = await request(baseUrl, "POST", `/games/${winning.gameId}/replay`, null, winning.host.json.token);
    assert.equal(winningReplay.status, 200);
    assert.deepEqual(winningReplay.json.game.replay.aiPlayerIds.sort(), winning.aiPlayers.map((player) => player.id).sort());
    assert.equal(winningReplay.json.game.replay.aiGoals.length, 2);
    assert.match(winningReplay.json.game.replay.explanation, /两名 AI/);

    const losing = await startM04("Stack");
    await advanceToVoting(losing);
    await request(baseUrl, "POST", `/games/${losing.gameId}/votes`, { targetPlayerId: losing.aiPlayers[0].id }, losing.host.json.token);
    await request(baseUrl, "POST", `/games/${losing.gameId}/votes`, { targetPlayerId: losing.aiPlayers[0].id }, losing.guestA.json.token);
    const stackedVote = await request(baseUrl, "POST", `/games/${losing.gameId}/votes`, { targetPlayerId: losing.aiPlayers[0].id }, losing.guestB.json.token);
    assert.equal(stackedVote.status, 200);
    assert.equal(stackedVote.json.game.phase, "REVEAL");
    assert.equal(stackedVote.json.game.winner, "ai");
    const losingReplay = await request(baseUrl, "POST", `/games/${losing.gameId}/replay`, null, losing.host.json.token);
    assert.equal(losingReplay.status, 200);
    assert.match(losingReplay.json.game.replay.explanation, /双 AI 阵营撑过归票/);
  } finally {
    server.close();
  }
});

test("advanced friend modes assign special human roles and settle decoy votes", async () => {
  const { server, baseUrl } = await startTestServer();
  async function createStartedRoom(modeId, label) {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} Host` });
    const guestA = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} A` });
    const guestB = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} B` });
    const special = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} Special` });
    const created = await request(baseUrl, "POST", "/rooms", { modeId, topicId: "campus-ai-writing" }, host.json.token);
    assert.equal(created.status, 201);
    for (const user of [guestA, guestB, special]) {
      const joined = await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, user.json.token);
      assert.equal(joined.status, 200);
      const ready = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, user.json.token);
      assert.equal(ready.status, 200);
    }
    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    assert.equal(started.json.game.modeId, modeId);
    return { host, guestA, guestB, special, gameId: started.json.game.id };
  }

  async function forceDecoyWin({ users, gameId, specialRole, explanationPattern }) {
    const { adminGame, player: internalSpecialPlayer, user: specialUser } = await specialRoleContext(baseUrl, gameId, users, specialRole);
    const specialView = await request(baseUrl, "GET", `/games/${gameId}`, null, specialUser.json.token);
    assert.equal(specialView.status, 200);
    const specialPlayer = specialView.json.game.players.find((player) => player.userId === specialUser.json.user.id);
    assert.equal(specialPlayer.id, internalSpecialPlayer.id);
    assert.equal(specialPlayer.role, specialRole);
    assert.ok(specialPlayer.hiddenTask);

    const observerUser = usersExcept(users, specialUser.json.user.id)[0];
    const observerView = await request(baseUrl, "GET", `/games/${gameId}`, null, observerUser.json.token);
    assert.equal(observerView.status, 200);
    const hiddenSpecial = observerView.json.game.players.find((player) => player.id === specialPlayer.id);
    assert.equal(hiddenSpecial.role, "hidden");
    assert.equal(hiddenSpecial.hiddenTask, null);

    const finalPhase = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, users.host.json.token);
    assert.equal(finalPhase.status, 200);
    assert.equal(finalPhase.json.game.phase, "FINAL_STATEMENT");
    const voting = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, users.host.json.token);
    assert.equal(voting.status, 200);
    assert.equal(voting.json.game.phase, "VOTING");
    const aiPlayer = adminGame.json.game.players.find((player) => player.role === "ai");
    assert.ok(aiPlayer);

    for (const user of usersExcept(users, specialUser.json.user.id)) {
      const vote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: specialPlayer.id }, user.json.token);
      assert.equal(vote.status, 200);
    }
    const specialVote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: aiPlayer.id }, specialUser.json.token);
    assert.equal(specialVote.status, 200);
    assert.equal(specialVote.json.game.phase, "REVEAL");
    assert.equal(specialVote.json.game.winner, "ai");

    const completed = await request(baseUrl, "POST", `/games/${gameId}/replay`, null, users.host.json.token);
    assert.equal(completed.status, 200);
    assert.equal(completed.json.game.phase, "COMPLETED");
    assert.match(completed.json.game.replay.explanation, explanationPattern);
    assert.ok(completed.json.game.replay.identitySummary.some((item) => item.role === specialRole));
  }

  try {
    const undercover = await createStartedRoom("M06", "Undercover");
    await forceDecoyWin({
      users: undercover,
      gameId: undercover.gameId,
      specialRole: "human_undercover",
      explanationPattern: /人类卧底/,
    });

    const fakeAi = await createStartedRoom("M08", "Fake AI");
    await forceDecoyWin({
      users: fakeAi,
      gameId: fakeAi.gameId,
      specialRole: "fake_ai",
      explanationPattern: /伪 AI 真人/,
    });
  } finally {
    server.close();
  }
});

test("legacy role skill endpoints are removed and hidden tasks stay private", async () => {
  const { server, baseUrl } = await startTestServer();

  async function createStartedRoom(modeId, label) {
    const host = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} Host` });
    const guestA = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} A` });
    const guestB = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} B` });
    const special = await request(baseUrl, "POST", "/auth/guest", { nickname: `${label} Special` });
    const created = await request(baseUrl, "POST", "/rooms", { modeId, topicId: "campus-ai-writing" }, host.json.token);
    assert.equal(created.status, 201);
    for (const user of [guestA, guestB, special]) {
      assert.equal((await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, user.json.token)).status, 200);
      assert.equal((await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, user.json.token)).status, 200);
    }
    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, host.json.token);
    assert.equal(started.status, 201);
    return { host, guestA, guestB, special, gameId: started.json.game.id };
  }

  try {
    const undercover = await createStartedRoom("M06", "Cover");
    const undercoverContext = await specialRoleContext(baseUrl, undercover.gameId, undercover, "human_undercover");
    const undercoverSpecialUser = undercoverContext.user;
    const undercoverView = await request(baseUrl, "GET", `/games/${undercover.gameId}`, null, undercoverSpecialUser.json.token);
    const undercoverPlayer = undercoverView.json.game.players.find((player) => player.userId === undercoverSpecialUser.json.user.id);
    assert.equal(undercoverPlayer.role, "human_undercover");
    assert.ok(undercoverPlayer.hiddenTask);
    assert.equal(undercoverView.json.game.skills, undefined);

    const observerUser = usersExcept(undercover, undercoverSpecialUser.json.user.id)[0];
    const observerView = await request(baseUrl, "GET", `/games/${undercover.gameId}`, null, observerUser.json.token);
    const hiddenSpecial = observerView.json.game.players.find((player) => player.id === undercoverPlayer.id);
    assert.equal(hiddenSpecial.role, "hidden");
    assert.equal(hiddenSpecial.hiddenTask, null);

    const legacyCover = await request(baseUrl, "POST", `/games/${undercover.gameId}/skills/cover_ping`, {}, undercoverSpecialUser.json.token);
    assert.equal(legacyCover.status, 404);
    assert.equal(legacyCover.json.error, "not_found");

    const fakeAi = await createStartedRoom("M08", "Decoy");
    const fakeAiContext = await specialRoleContext(baseUrl, fakeAi.gameId, fakeAi, "fake_ai");
    const fakeAiSpecialUser = fakeAiContext.user;
    const fakeAiView = await request(baseUrl, "GET", `/games/${fakeAi.gameId}`, null, fakeAiSpecialUser.json.token);
    const fakeAiPlayer = fakeAiView.json.game.players.find((player) => player.userId === fakeAiSpecialUser.json.user.id);
    assert.equal(fakeAiPlayer.role, "fake_ai");
    assert.ok(fakeAiPlayer.hiddenTask);
    assert.equal(fakeAiView.json.game.skills, undefined);

    const legacyDecoy = await request(baseUrl, "POST", `/games/${fakeAi.gameId}/skills/decoy_spike`, {}, fakeAiSpecialUser.json.token);
    assert.equal(legacyDecoy.status, 404);
    assert.equal(legacyDecoy.json.error, "not_found");
  } finally {
    server.close();
  }
});

test("special human roles are not fixed to last joined player", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      RATE_LIMIT_ROOMS_PER_MINUTE: "200",
    },
  });
  const users = {
    host: await request(baseUrl, "POST", "/auth/guest", { nickname: "Order Host" }),
    guestA: await request(baseUrl, "POST", "/auth/guest", { nickname: "Order A" }),
    guestB: await request(baseUrl, "POST", "/auth/guest", { nickname: "Order B" }),
    last: await request(baseUrl, "POST", "/auth/guest", { nickname: "Order Last" }),
  };
  for (const user of Object.values(users)) {
    assert.equal(user.status, 201);
  }

  async function createStartedRoom(attempt) {
    const created = await request(baseUrl, "POST", "/rooms", { modeId: "M06", topicId: "campus-ai-writing" }, users.host.json.token);
    assert.equal(created.status, 201);
    for (const user of [users.guestA, users.guestB, users.last]) {
      assert.equal((await request(baseUrl, "POST", "/rooms/join", { inviteCode: created.json.room.inviteCode }, user.json.token)).status, 200);
      assert.equal((await request(baseUrl, "POST", `/rooms/${created.json.room.id}/ready`, { ready: true }, user.json.token)).status, 200);
    }
    const started = await request(baseUrl, "POST", `/rooms/${created.json.room.id}/start`, null, users.host.json.token);
    assert.equal(started.status, 201);
    return started.json.game.id;
  }

  try {
    const roleKeys = new Set();
    let lastJoinedSelections = 0;
    const attempts = 12;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const gameId = await createStartedRoom(attempt);
      const { player, user } = await specialRoleContext(baseUrl, gameId, users, "human_undercover");
      assert.equal(player.kind, "human");
      assert.ok(player.userId);
      const roleKey = Object.entries(users).find(([, candidate]) => candidate.json.user.id === user.json.user.id)?.[0];
      assert.ok(roleKey);
      roleKeys.add(roleKey);
      if (roleKey === "last") lastJoinedSelections += 1;
    }

    assert.ok(roleKeys.size > 1);
    assert.ok(lastJoinedSelections < attempts);
  } finally {
    server.close();
  }
});

test("admin page is available for operations", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/admin`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /图灵迷局 Admin/);
    assert.match(html, /加载举报/);
    assert.match(html, /导出 CSV/);
    assert.match(html, /exportReportsCsv/);
    assert.match(html, /\/admin\/reports\.csv/);
    assert.match(html, /加载指标/);
    assert.match(html, /加载审计/);
    assert.match(html, /加载房间/);
    assert.match(html, /查询对局/);
    assert.match(html, /accessStatus/);
    assert.match(html, /只读模式/);
    assert.match(html, /\/admin\/session/);
    assert.match(html, /data-write-action/);
    assert.match(html, /批量处理/);
    assert.match(html, /批量标记已处理/);
    assert.match(html, /bulkResolveReports/);
    assert.match(html, /最老等待/);
    assert.match(html, /超过 SLA/);
    assert.match(html, /模式表现/);
    assert.match(html, /主题表现/);
  } finally {
    server.close();
  }
});

test("user home page is available for local product preview", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    const script = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(script, "home page should include the boot script");
    assert.doesNotThrow(() => new vm.Script(script[1], { filename: "home-inline.js" }));
    assert.match(html, /抓出伪装者/);
    assert.match(html, /图灵迷局/);
    assert.match(html, /Apple 登录/);
    assert.match(html, /微信登录/);
    assert.match(html, /Google 登录/);
    assert.match(html, /\/auth\/wechat/);
    assert.match(html, /\/auth\/google/);
    assert.match(html, /mock\.wechat\.local-web-preview/);
    assert.match(html, /mock\.google\.local-web-preview/);
    assert.doesNotMatch(html, />游客上桌</);
    assert.doesNotMatch(html, />本地试玩</);
    assert.doesNotMatch(html, /data-action="guest-login"/);
    // 大厅只保留模式开始入口；今日悬赏移入“我的”。
    assert.match(html, /选择模式/);
    assert.match(html, /mission-lobby-block/);
    assert.doesNotMatch(html, /data-shortcut="bounty"/);
    assert.match(html, /renderMissionRewardsPanel\(\) \+\s*renderCosmeticsPanel\(\)/);
    assert.match(html, /排行榜/);
    assert.match(html, /排行榜 3 局后解锁/);
    assert.match(html, /function leaderboardUnlocked/);
    assert.match(html, /function renderLeaderboardLockedCard/);
    assert.match(html, /renderLeaderboardPanel/);
    assert.doesNotMatch(html, /data-tab="leaderboard"/);
    assert.doesNotMatch(html, /data-tab="missions"/);
    assert.match(html, /\/leaderboard/);
    assert.match(html, /\/commerce\/catalog/);
    assert.match(html, /renderCommercePreviewPanel/);
    assert.match(html, /权益预告/);
    assert.match(html, /不出售胜率、身份信息或投票优势/);
    assert.match(html, /背包装扮/);
    assert.match(html, /renderCosmeticsPanel/);
    assert.match(html, /unlock-cosmetic/);
    assert.match(html, /equip-cosmetic/);
    assert.match(html, /\/me\/cosmetics\//);
    assert.match(html, /账号与安全/);
    assert.match(html, /固定账号保存战绩和装扮/);
    assert.match(html, /安全中心/);
    assert.match(html, /已处理/);
    assert.doesNotMatch(html, /<strong>局后处理<\/strong><span>举报/);
    assert.match(html, /单线接触/);
    assert.doesNotMatch(html, /2 人真假局/);
    // 首页简化：世界观卡、最近战报、玩法速览入口全部下线。
    assert.doesNotMatch(html, /renderWorldSettingCard/);
    assert.doesNotMatch(html, /world-setting-card/);
    assert.match(html, /modeDifficultyTitle/);
    assert.match(html, /modeMetaLine/);
    // 大厅显示全部模式、统一走快速开始（单人点开即玩）。
    assert.match(html, /点开即玩/);
    assert.match(html, /\/quick-start/);
    assert.doesNotMatch(html, /邀请码开局/);
    assert.doesNotMatch(html, /renderLobbyRecentReplay/);
    assert.doesNotMatch(html, /lobby-recent-replay/);
    assert.match(html, /再来一局/);
    assert.doesNotMatch(html, /玩法速览/);
    assert.doesNotMatch(html, /data-action="show-rules"/);
    assert.doesNotMatch(html, /renderRulesModal/);
    assert.match(html, /renderGameRulesModal/);
    assert.match(html, /renderTopicCard\(game\)/);
    assert.match(html, /data-action="show-game-rules"/);
    assert.match(html, /data-action="close-game-rules"/);
    assert.match(html, /renderModeStartModal/);
    assert.match(html, /data-action="show-mode" data-mode="M01"/);
    assert.match(html, /data-action="show-mode" data-mode="' \+ h\(mode\.id\)/);
    assert.match(html, /data-action="confirm-mode"/);
    assert.match(html, /模式详情/);
    assert.match(html, /\/topics/);
    assert.match(html, /本局话题/);
    assert.match(html, /renderTopicPicker\(mode, selectedTopic\?\.id \|\| "", "select-topic"\)/);
    assert.match(html, /selectedTopicForMode/);
    assert.match(html, /topicId/);
    assert.match(html, /renderTopicPicker\(mode \|\| \{ id: room\.modeId \}, roomTopic\?\.id \|\| "", "set-room-topic"\)/);
    assert.match(html, /\/topic/);
    assert.match(html, /开始对局/);
    assert.match(html, /flowStepTitle/);
    assert.match(html, /开聊/);
    assert.match(html, /已等待/);
    assert.match(html, /超过 45 秒/);
    assert.match(html, /waiting-hero/);
    assert.match(html, /waiting-stat-grid/);
    assert.match(html, /renderWaitingSeats/);
    assert.match(html, /waitingModeId/);
    assert.match(html, /waitingTopicId/);
    assert.match(html, /waitingStartedAt/);
    assert.match(html, /data-waiting-elapsed/);
    assert.match(html, /data-waiting-fallback-copy/);
    assert.match(html, /超过 45 秒/);
    assert.match(html, /候场码 /);
    assert.match(html, /已保留你的座位/);
    assert.match(html, /data-action="waiting-quick-start"/);
    // 好友房入口暂时下线。
    assert.doesNotMatch(html, /data-action="waiting-friend-room"/);
    assert.doesNotMatch(html, /data-action="join-room"/);
    assert.doesNotMatch(html, /data-action="paste-invite-code"/);
    assert.match(html, /clearWaitingTicket/);
    assert.match(html, /clearWaitingContext/);
    assert.match(html, /data\.status === "matched"/);
    assert.match(html, /data-action="replay-again"/);
    assert.match(html, /data-action="share-replay"/);
    assert.match(html, /分享战报/);
    assert.match(html, /renderReplaySharePreview/);
    assert.match(html, /匿名战报卡/);
    assert.match(html, /分享前预览，不带昵称、房号或对局编号。/);
    assert.match(html, /function replayShareText\(game\)/);
    assert.match(html, /function shareLandingUrl\(game\)/);
    assert.match(html, /function shareLandingIntent\(\)/);
    assert.match(html, /function applyShareLandingIntent\(\)/);
    assert.match(html, /url\.searchParams\.set\("mode", game\?\.modeId \|\| "M01"\)/);
    assert.match(html, /url\.searchParams\.set\("topic", topicId\)/);
    assert.match(html, /async function shareReplay\(\)/);
    assert.match(html, /navigator\.share/);
    assert.match(html, /copyTextToClipboard\(text\)/);
    assert.match(html, /data-action="debug-complete-replay"/);
    assert.match(html, /async function debugCompleteReplay\(\)/);
    assert.match(html, /state\.game\.phase === "REVEAL"/);
    assert.match(html, /\/games\/" \+ encodeURIComponent\(state\.game\.id\) \+ "\/replay/);
    assert.match(html, /同模式再来一局/);
    assert.match(html, /原房间再来一局/);
    assert.match(html, /进入再来一局房间/);
    assert.match(html, /data-rematch-room/);
    assert.match(html, /rematchRoomId/);
    // 再来一局统一走快速开始（好友房联机暂不开发）。
    assert.match(html, /所有模式统一走快速开始再来一局/);
    assert.match(html, /rematchRefreshing/);
    assert.match(html, /lastRematchRefreshAt/);
    assert.match(html, /\/rematch/);
    assert.match(html, /同模式再试/);
    assert.match(html, /isFriendRoomMode/);
    assert.match(html, /复制邀请码/);
    assert.match(html, /data-action="copy-invite-code"/);
    assert.match(html, /\/me\/summary/);
    assert.match(html, /\/me\/missions\//);
    assert.match(html, /\/me\/missions\/claim-all/);
    assert.match(html, /data-action="claim-mission"/);
    assert.match(html, /data-action="claim-all-missions"/);
    assert.match(html, /一键领取/);
    assert.match(html, /missionRewardTotals/);
    assert.match(html, /rewardResultText/);
    assert.match(html, /称号升级：Lv\./);
    assert.match(html, /function rewardClaimText\(mission\)/);
    assert.match(html, /领取成功：推理星 \+/);
    assert.match(html, /推理星/);
    assert.match(html, /背包/);
    assert.match(html, /\.wolf-home \.primary-panel/);
    assert.match(html, /background-color: #161c2b/);
    assert.match(html, /mission-wallet-panel/);
    assert.match(html, /mission-list/);
    assert.match(html, /calc\(128px \+ env\(safe-area-inset-bottom\)\)/);
    assert.match(html, /radial-gradient\(circle at 88% 4%/);
    assert.match(html, /账号与安全/);
    assert.match(html, /固定账号保存战绩和装扮/);
    assert.match(html, /新手侦探/);
    assert.match(html, /profile-action-grid/);
    assert.match(html, /profile-action-card/);
    assert.match(html, /房间规则/);
    assert.match(html, /删档后不可恢复/);
    assert.match(html, /nav-icon/);
    assert.match(html, /nav-lobby/);
    assert.match(html, /nav-records/);
    assert.doesNotMatch(html, /nav-missions/);
    assert.doesNotMatch(html, /nav-leaderboard/);
    assert.match(html, /nav-profile/);
    assert.match(html, /nav-badge/);
    assert.match(html, /renderHomeNavBadge/);
    assert.match(html, /homeNavBadge/);
    assert.match(html, /progression/);
    assert.match(html, /season-panel/);
    assert.match(html, /renderSeasonPanel/);
    assert.match(html, /renderSeasonTrack/);
    assert.match(html, /renderSeasonObjective/);
    assert.match(html, /S1 推理赛季/);
    assert.match(html, /今日段位奖励待领取/);
    assert.match(html, /继续冲榜/);
    assert.match(html, /识别胜率/);
    assert.match(html, /复盘局数/);
    assert.match(html, /看复盘/);
    assert.doesNotMatch(html, /看线索/);
    assert.doesNotMatch(html, /线索局数/);
    assert.match(html, /empty-record-card/);
    assert.match(html, /今晚还没上桌/);
    assert.match(html, /快速上桌/);
    assert.match(html, /history-list/);
    assert.match(html, /继续上一局/);
    assert.match(html, /renderActiveGameBanner/);
    assert.match(html, /\/matchmaking\//);
    assert.match(html, /\/games\//);
    assert.match(html, /waiting-screen/);
    assert.match(html, /renderWaitingSeat/);
    assert.match(html, /开局补位/);
    assert.match(html, /renderEmptySeat/);
    assert.match(html, /seat-card empty/);
    assert.match(html, /等待入座/);
    assert.match(html, /friend-room-timeout-card/);
    assert.match(html, /friendRoomFallbackCopy/);
    assert.match(html, /超过 90 秒/);
    assert.match(html, /data-room-fallback-copy/);
    assert.match(html, /\/reports/);
    assert.match(html, /post_game_player_report/);
    assert.match(html, /data-action="open-report-player"/);
    assert.match(html, /data-action="submit-report-player"/);
    assert.match(html, /renderReportReasonSheet/);
    assert.match(html, /post_game_disruptive_play/);
    assert.match(html, /post_game_threat_or_self_harm/);
    assert.match(html, /选择一个理由，运营会查看本局上下文。/);
    assert.match(html, /局后处理/);
    assert.match(html, /function playerErrorMessage\(message\)/);
    assert.match(html, /message_blocked:violent_threat/);
    assert.match(html, /message_blocked:self_harm_risk/);
    assert.match(html, /如果你或他人正处于危险/);
    assert.match(html, /task-card-overlay/);
    assert.match(html, /renderTaskCardOverlay/);
    assert.match(html, /shouldShowTaskCard/);
    assert.match(html, /shouldRenderTaskCard/);
    assert.match(html, /ack-task-card/);
    assert.match(html, /data-action="open-task-card"/);
    assert.match(html, /close-task-card/);
    assert.match(html, /reviewingTaskGameId/);
    assert.match(html, /我的任务/);
    assert.doesNotMatch(html, /<button class="quiet-button full" data-action="go-home">回大厅<\/button>/);
    assert.match(html, /先确认任务卡，再开始发言/);
    assert.match(html, /task-detail-grid/);
    assert.match(html, /taskWinCondition/);
    assert.match(html, /taskTools/);
    assert.match(html, /taskBoundary/);
    assert.match(html, /taskCardTitle/);
    assert.match(html, /侦探任务/);
    assert.match(html, /阵营任务/);
    assert.match(html, /诱饵任务/);
    assert.match(html, /伪装任务/);
    assert.match(html, /任务目标/);
    assert.match(html, /赢法/);
    assert.match(html, /可用工具/);
    assert.match(html, /禁忌/);
    assert.match(html, /让它们的得票都压过所有真人/);
    assert.doesNotMatch(html, /身份卡/);
    assert.doesNotMatch(html, /你的身份/);
    assert.doesNotMatch(html, /你的本局任务/);
    assert.doesNotMatch(html, /你是真人/);
    assert.doesNotMatch(html, /开局只看自己的身份/);
    // 简化后的对局界面：起手句话术模板、问细节引用模板全部下线。
    assert.doesNotMatch(html, /quick-chat-row/);
    assert.doesNotMatch(html, /data-action="quick-chat"/);
    assert.doesNotMatch(html, /data-action="quote-message"/);
    assert.doesNotMatch(html, /function quickChatPhrases\(\)/);
    assert.doesNotMatch(html, /起手句/);
    assert.doesNotMatch(html, /问细节/);
    assert.match(html, /async function sendMessage\(\)/);
    assert.doesNotMatch(html, /async function sendMessage\(text\)/);
    assert.doesNotMatch(html, /sendMessage\(button\.dataset\.text/);
    assert.match(html, /标为线索/);
    assert.match(html, /已标线索/);
    assert.match(html, /toggleMessageClue/);
    assert.match(html, /data-action="toggle-message-clue"/);
    assert.match(html, /playerSavedClues/);
    assert.match(html, /标记发言/);
    assert.match(html, /我标记的发言/);
    // 怀疑度标记与中段表态已从玩法中移除。
    assert.doesNotMatch(html, /我的怀疑标记/);
    assert.doesNotMatch(html, /evidenceReasonOptions/);
    assert.doesNotMatch(html, /suspicionSummary/);
    assert.doesNotMatch(html, /mark-suspicion/);
    assert.doesNotMatch(html, /中段表态/);
    assert.doesNotMatch(html, /playerMidChecks/);
    assert.doesNotMatch(html, /selectedMidCheckTargetId/);
    assert.doesNotMatch(html, /MID_CHECK/);
    assert.match(html, /renderMyVoteStatus/);
    assert.match(html, /voteProgressText/);
    assert.match(html, /renderVoteEvidence/);
    assert.match(html, /lastDiscussionTargetId/);
    assert.match(html, /selectedDiscussionTargetId/);
    assert.match(html, /selectedVoteTargetId/);
    assert.doesNotMatch(html, /selectedTarget:/);
    assert.match(html, /carriedDiscussionTarget/);
    assert.match(html, /renderVoteCarryHint/);
    assert.match(html, /已沿用盯人目标/);
    assert.match(html, /data-action="clear-vote-target"/);
    assert.match(html, /game\.myVote/);
    assert.match(html, /game\.voteState/);
    assert.match(html, /当前票/);
    assert.match(html, /可在归票结束或全员交票前修改/);
    assert.match(html, /归票已结束，正在揭晓身份/);
    assert.match(html, /function phaseExpired\(value\)/);
    assert.match(html, /还差/);
    assert.match(html, /名真人交票/);
    assert.match(html, /最后一次提交生效/);
    // 归票信心与角色技能已下线。
    assert.doesNotMatch(html, /信心/);
    assert.doesNotMatch(html, /set-confidence/);
    assert.doesNotMatch(html, /renderRoleSkillPanel/);
    assert.doesNotMatch(html, /useRoleSkill/);
    assert.doesNotMatch(html, /data-action="use-role-skill"/);
    assert.doesNotMatch(html, /\/skills\//);
    assert.doesNotMatch(html, /data-action="use-probe"/);
    assert.doesNotMatch(html, /掩护暗号/);
    assert.doesNotMatch(html, /诱饵发言已发出/);
    assert.match(html, /本局结算/);
    assert.match(html, /本局奖励/);
    assert.match(html, /result-hero/);
    assert.match(html, /settlement-grid/);
    assert.match(html, /renderReplayJudgement/);
    assert.match(html, /renderReplayTaskResult/);
    assert.match(html, /renderReplayVoteBoard/);
    assert.match(html, /renderReplayIdentityBoard/);
    assert.match(html, /renderReplayCalibration/);
    assert.match(html, /复盘校准/);
    assert.match(html, /判断命中/);
    assert.match(html, /判断失准/);
    assert.doesNotMatch(html, /renderReplaySkillSummary/);
    assert.match(html, /我的判断/);
    assert.match(html, /我的任务结果/);
    assert.match(html, /投票板/);
    assert.match(html, /身份结果/);
    assert.match(html, /renderRewardCard/);
    assert.match(html, /renderAccountProtectionCard/);
    assert.match(html, /首局战绩已保存/);
    assert.match(html, /Apple 已保护战绩/);
    assert.match(html, /data-action="go-profile"/);
    assert.match(html, /data-action="go-missions"/);
    assert.match(html, /data-action="go-records"/);
    assert.doesNotMatch(html, /data-action="report-message"/);
    assert.doesNotMatch(html, /message_reported/);
    assert.doesNotMatch(html, /记录会自动带上/);
    assert.doesNotMatch(html, /复盘会用到/);
    assert.doesNotMatch(html, /举报只关联本局/);
    assert.doesNotMatch(html, /带上本局记录/);
    assert.doesNotMatch(html, /对他的怀疑度/);
    assert.doesNotMatch(html, /可疑点：/);
    assert.doesNotMatch(html, /交票后不能更改/);
    assert.doesNotMatch(html, /function playerSuspicion\(player, message\)/);
    assert.doesNotMatch(html, /return sendMessage\(button\.dataset\.text/);
  } finally {
    server.close();
  }
});

test("admin metrics summarize games, reports and safety state", async () => {
  let now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const { server, baseUrl } = await startTestServer({
    env: {
      REPORT_SLA_SECONDS: "60",
    },
    options: {
      clock: { now: () => now },
    },
  });
  try {
    const guest = await request(baseUrl, "POST", "/auth/guest", { nickname: "Metrics" });
    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const discussion = await request(
      baseUrl,
      "POST",
      `/games/${match.json.game.id}/messages`,
      { text: "我先听一下对方怎么判断。" },
      guest.json.token,
    );
    assert.equal(discussion.status, 201);
    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId: match.json.game.id, messageId: match.json.game.messages[1].id, reason: "metrics_report" },
      guest.json.token,
    );
    assert.equal(report.status, 201);

    const aiPlayer = match.json.game.players.find((player) => player.kind === "unknown");
    assert.ok(aiPlayer);
    await request(baseUrl, "POST", `/debug/games/${match.json.game.id}/advance`, { seconds: 1 }, guest.json.token);
    await request(baseUrl, "POST", `/games/${match.json.game.id}/messages`, { text: "我最后判断对方更像伪装者。" }, guest.json.token);
    await request(baseUrl, "POST", `/games/${match.json.game.id}/votes`, { targetPlayerId: aiPlayer.id }, guest.json.token);
    const replay = await request(baseUrl, "POST", `/games/${match.json.game.id}/replay`, null, guest.json.token);
    assert.equal(replay.status, 200);
    const claim = await request(baseUrl, "POST", "/me/missions/claim-all", null, guest.json.token);
    assert.equal(claim.status, 200);
    const unlock = await request(baseUrl, "POST", "/me/cosmetics/signal-tracker/unlock", null, guest.json.token);
    assert.equal(unlock.status, 200);
    const room = await request(baseUrl, "POST", "/rooms", { modeId: "M03" }, guest.json.token);
    assert.equal(room.status, 201);

    now += 120_000;
    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "test-admin" });
    assert.equal(metrics.status, 200);
    assert.equal(metrics.json.metrics.users.total, 1);
    assert.equal(metrics.json.metrics.games.total, 1);
    assert.equal(metrics.json.metrics.reports.open, 1);
    assert.equal(metrics.json.metrics.reports.slaSeconds, 60);
    assert.equal(metrics.json.metrics.reports.oldestOpenAgeSeconds, 120);
    assert.equal(metrics.json.metrics.reports.overdueOpen, 1);
    const mode = metrics.json.metrics.modes.find((item) => item.modeId === "M01");
    assert.equal(mode.total, 1);
    assert.equal(mode.reports, 1);
    const topic = metrics.json.metrics.topics.find((item) => item.topicId === match.json.game.topic.id);
    assert.equal(topic.total, 1);
    assert.equal(topic.reports, 1);
    assert.deepEqual(metrics.json.metrics.reports.byReason[0], { reason: "metrics_report", count: 1 });
    assert.equal(metrics.json.metrics.reports.oldestOpen[0].ageSeconds, 120);
    assert.equal(metrics.json.metrics.funnel.activeUsers, 1);
    assert.equal(metrics.json.metrics.funnel.gameStarters, 1);
    assert.equal(metrics.json.metrics.funnel.completedPlayers, 1);
    assert.equal(metrics.json.metrics.funnel.replayViewers, 1);
    assert.equal(metrics.json.metrics.funnel.friendRoomCreators, 1);
    assert.equal(metrics.json.metrics.funnel.missionClaimers, 1);
    assert.equal(metrics.json.metrics.funnel.cosmeticUnlockers, 1);
    assert.equal(metrics.json.metrics.funnel.gameStartRate, 1);
    assert.equal(metrics.json.metrics.funnel.replayViewRate, 1);
    assert.equal(metrics.json.metrics.retention.completedPlayers, 1);
    assert.equal(metrics.json.metrics.retention.repeatCompletedUsers, 0);
    assert.equal(metrics.json.metrics.economy.missionClaims.total, 3);
    assert.equal(metrics.json.metrics.economy.missionClaims.clueStarsGranted, 90);
    assert.equal(metrics.json.metrics.economy.missionClaims.xpGranted, 45);
    assert.equal(metrics.json.metrics.economy.cosmetics.unlocks, 1);
    assert.equal(metrics.json.metrics.economy.cosmetics.clueStarsSpent, 50);
    assert.deepEqual(metrics.json.metrics.economy.cosmetics.topItems[0], { itemId: "signal-tracker", unlocks: 1 });
    assert.equal(metrics.json.metrics.aiOperations.messages.total, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.fallback, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.fallbackRate, 1);
    assert.equal(metrics.json.metrics.aiOperations.messages.bySource[0].source, "fallback");
    assert.ok(metrics.json.metrics.aiOperations.costProxy.estimatedOutputTokens > 0);
    assert.equal(
      metrics.json.metrics.aiOperations.costProxy.estimatedOutputTokensPerCompletedGame,
      metrics.json.metrics.aiOperations.costProxy.estimatedOutputTokens,
    );
  } finally {
    server.close();
  }
});

test("Apple login can delete account through revoke-capable path", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const login = await request(
      baseUrl,
      "POST",
      "/auth/apple",
      {
        identityToken: "mock.apple.apple-user-1",
        authorizationCode: "mock.code.apple-user-1",
        nickname: "Apple Player",
        ageConfirmed: true,
        communityConfirmed: true,
      },
    );
    assert.equal(login.status, 200);
    assert.equal(login.json.user.kind, "apple");

    const deleted = await request(baseUrl, "DELETE", "/account", null, login.json.token);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.json.user.deletedAt !== null, true);
    assert.equal(deleted.json.user.nickname, "已删除用户");
    assert.equal(deleted.json.user.avatarKey, null);
    assert.equal(deleted.json.appleRevoke.revoked, true);

    const me = await request(baseUrl, "GET", "/me", null, login.json.token);
    assert.equal(me.status, 401);
  } finally {
    server.close();
  }
});

test("Apple revoke failure does not block local account deletion", async () => {
  const { server, baseUrl, engine } = await startTestServer();
  try {
    const user = await engine.upsertAppleUser({
      appleSub: "apple-user-revoke-failure",
      email: "apple-revoke-failure@example.test",
      nickname: "Apple Revoke Failure",
      appleRefreshToken: "manual-refresh-token-not-mock",
      ageConfirmed: true,
      communityConfirmed: true,
    });
    const token = createSessionToken(user.id, "test-secret");

    const deleted = await request(baseUrl, "DELETE", "/account", null, token);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.json.user.deletedAt !== null, true);
    assert.equal(deleted.json.appleRevoke.revoked, false);
    assert.match(deleted.json.appleRevoke.reason, /missing_apple_client_env|apple_revoke_failed|invalid/i);

    const me = await request(baseUrl, "GET", "/me", null, token);
    assert.equal(me.status, 401);
  } finally {
    server.close();
  }
});

test("account deletion anonymizes historical game player names", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const a = await request(baseUrl, "POST", "/auth/guest", { nickname: "Remaining A" });
    const b = await request(baseUrl, "POST", "/auth/guest", { nickname: "Deleted B" });

    await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, a.json.token);
    const matched = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M02" }, b.json.token);
    const gameId = matched.json.game.id;

    const beforeDelete = await request(baseUrl, "GET", `/games/${gameId}`, null, a.json.token);
    assert.ok(beforeDelete.json.game.players.some((player) => player.nickname === "Deleted B"));

    const deleted = await request(baseUrl, "DELETE", "/account", null, b.json.token);
    assert.equal(deleted.status, 200);

    const afterDelete = await request(baseUrl, "GET", `/games/${gameId}`, null, a.json.token);
    assert.ok(afterDelete.json.game.players.some((player) => player.nickname === "已删除用户"));
    assert.equal(afterDelete.json.game.players.some((player) => player.nickname === "Deleted B"), false);

    const deletedMe = await request(baseUrl, "GET", "/me", null, b.json.token);
    assert.equal(deletedMe.status, 401);
  } finally {
    server.close();
  }
});

test("legal and support pages are available for App Store metadata", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      MIRAGE_LEGAL_NAME: "Mirage Labs",
      MIRAGE_PUBLIC_BASE_URL: "https://api.mirage.app",
      MIRAGE_SUPPORT_EMAIL: "support@mirage.app",
      MIRAGE_SUPPORT_URL: "https://mirage.app/support",
    },
  });
  try {
    for (const [path, expected] of [
      ["/legal/privacy", "隐私政策"],
      ["/legal/terms", "服务条款"],
      ["/legal/community", "社区规范"],
      ["/support", "支持与反馈"],
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, new RegExp(expected));
    }
    const support = await fetch(`${baseUrl}/support`);
    const supportHtml = await support.text();
    assert.match(supportHtml, /support@mirage\.app/);
    assert.match(supportHtml, /https:\/\/mirage\.app\/support/);

    const privacy = await fetch(`${baseUrl}/legal/privacy`);
    const privacyHtml = await privacy.text();
    assert.match(privacyHtml, /Mirage Labs/);
    assert.match(privacyHtml, /https:\/\/mirage\.app\/support/);
  } finally {
    server.close();
  }
});

test("SQLite store persists users across server restarts", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mirage-sqlite-"));
  const sqlitePath = path.join(dir, "mirage.sqlite");
  try {
    const first = await startTestServer({
      env: {
        NODE_ENV: "production",
        MIRAGE_SKIP_PRODUCTION_VALIDATION: "true",
        MIRAGE_STORE: "sqlite",
        MIRAGE_SQLITE_PATH: sqlitePath,
        SESSION_SECRET: "sqlite-secret",
        ADMIN_TOKEN: "test-admin",
        AUTH_ALLOW_MOCK_APPLE: "true",
      },
    });
    const guest = await request(first.baseUrl, "POST", "/auth/guest", { nickname: "Persisted" });
    assert.equal(guest.status, 201);
    first.server.close();

    const second = await startTestServer({
      env: {
        NODE_ENV: "production",
        MIRAGE_SKIP_PRODUCTION_VALIDATION: "true",
        MIRAGE_STORE: "sqlite",
        MIRAGE_SQLITE_PATH: sqlitePath,
        SESSION_SECRET: "sqlite-secret",
        ADMIN_TOKEN: "test-admin",
        AUTH_ALLOW_MOCK_APPLE: "true",
      },
    });
    try {
      const me = await request(second.baseUrl, "GET", "/me", null, guest.json.token);
      assert.equal(me.status, 200);
      assert.equal(me.json.user.nickname, "Persisted");
    } finally {
      second.server.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("production env validation rejects unsafe defaults", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: {
          NODE_ENV: "production",
          SESSION_SECRET: "dev-session-secret-change-me",
          ADMIN_TOKEN: "local-admin-token",
        },
      }),
    /production_env_invalid/,
  );
});

test("production env validation rejects disabled rate limits", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          RATE_LIMIT_DISABLED: "true",
        }),
      }),
    /RATE_LIMIT_DISABLED must not be true in production/,
  );
});

test("production env validation rejects unsafe readonly admin token", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          ADMIN_READONLY_TOKEN: "short",
        }),
      }),
    /ADMIN_READONLY_TOKEN must be strong when configured/,
  );
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          ADMIN_READONLY_TOKEN: "production-admin-token-000000000000",
        }),
      }),
    /ADMIN_READONLY_TOKEN must be different from ADMIN_TOKEN/,
  );
});

test("production env validation requires real Google login configuration", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          GOOGLE_CLIENT_ID: "",
        }),
      }),
    /GOOGLE_CLIENT_ID must be configured for Google Sign-In/,
  );
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          GOOGLE_CLIENT_ID: "your-google-client-id.apps.googleusercontent.com",
        }),
      }),
    /GOOGLE_CLIENT_ID must be configured for Google Sign-In/,
  );
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          AUTH_ALLOW_MOCK_GOOGLE: "true",
        }),
      }),
    /AUTH_ALLOW_MOCK_GOOGLE must be false in production/,
  );
});

test("production env validation requires real WeChat login configuration", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          WECHAT_APP_ID: "",
        }),
      }),
    /WECHAT_APP_ID must be configured for WeChat login/,
  );
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          WECHAT_APP_SECRET: "",
        }),
      }),
    /WECHAT_APP_SECRET must be configured for WeChat login/,
  );
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          AUTH_ALLOW_MOCK_WECHAT: "true",
        }),
      }),
    /AUTH_ALLOW_MOCK_WECHAT must be false in production/,
  );
});

test("production env validation rejects placeholder legal and support metadata", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          MIRAGE_SUPPORT_EMAIL: "support@mirage.example.com",
        }),
      }),
    /MIRAGE_SUPPORT_EMAIL must be set to a real support email/,
  );

  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          MIRAGE_PUBLIC_BASE_URL: "http://api.mirage.app",
        }),
      }),
    /MIRAGE_PUBLIC_BASE_URL must be set to a production HTTPS URL/,
  );

  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          MIRAGE_SUPPORT_URL: "https://support.example.com",
        }),
      }),
    /MIRAGE_SUPPORT_URL must be a production HTTPS URL when set/,
  );
});

test("production env validation requires report alert webhook or explicit override", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          REPORT_ALERT_WEBHOOK_URL: "",
        }),
        store: new MemoryStore(),
      }),
    /REPORT_ALERT_WEBHOOK_URL must be set/,
  );

  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          REPORT_ALERT_WEBHOOK_URL: "http://hooks.mirage.app/reports",
        }),
        store: new MemoryStore(),
      }),
    /REPORT_ALERT_WEBHOOK_URL must be a production HTTPS URL/,
  );

  assert.doesNotThrow(() =>
    createHttpServer({
      env: validProductionEnv({
        REPORT_ALERT_WEBHOOK_URL: "",
        REPORT_ALERTS_DISABLED_IN_PRODUCTION: "true",
      }),
      store: new MemoryStore(),
    }),
  );
});

test("production env validation rejects unsafe storage modes", () => {
  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          MIRAGE_STORE: "json",
          MIRAGE_POSTGRES_URL: "",
        }),
      }),
    /MIRAGE_STORE must be postgres in production/,
  );

  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          MIRAGE_STORE: "sqlite",
          MIRAGE_POSTGRES_URL: "",
          MIRAGE_SQLITE_PATH: "/data/mirage.sqlite",
        }),
      }),
    /MIRAGE_ALLOW_SINGLE_INSTANCE_SQLITE_IN_PRODUCTION=true is required/,
  );

  assert.throws(
    () =>
      createHttpServer({
        env: validProductionEnv({
          MIRAGE_STORE: "postgres",
          MIRAGE_POSTGRES_URL: "postgres://mirage:mirage-password@example.com:5432/mirage",
        }),
      }),
    /MIRAGE_POSTGRES_URL or DATABASE_URL must be set/,
  );
});

test("CORS whitelist, security headers and body limits are enforced", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      REQUEST_BODY_LIMIT_BYTES: "64",
    },
  });
  try {
    const health = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://admin.example.com" },
    });
    assert.equal(health.headers.get("access-control-allow-origin"), "https://admin.example.com");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.equal(health.headers.get("x-frame-options"), "DENY");
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal(health.headers.get("strict-transport-security"), null);

    const blockedOrigin = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://evil.example.com" },
    });
    assert.equal(blockedOrigin.headers.get("access-control-allow-origin"), null);

    const ready = await request(baseUrl, "GET", "/ready");
    assert.equal(ready.status, 200);
    assert.equal(ready.json.ok, true);

    const adminPage = await fetch(`${baseUrl}/admin`);
    assert.equal(adminPage.headers.get("cache-control"), "no-store");

    const tooLarge = await request(baseUrl, "POST", "/auth/guest", { nickname: "x".repeat(200) });
    assert.equal(tooLarge.status, 413);
    assert.equal(tooLarge.json.error, "request_body_too_large");

    const invalid = await fetch(`${baseUrl}/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });
    const invalidJson = await invalid.json();
    assert.equal(invalid.status, 400);
    assert.equal(invalidJson.error, "invalid_json");
  } finally {
    server.close();
  }
});

test("production responses include HSTS", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      NODE_ENV: "production",
      MIRAGE_SKIP_PRODUCTION_VALIDATION: "true",
      HSTS_MAX_AGE_SECONDS: "12345",
    },
    options: {
      store: new MemoryStore(),
    },
  });
  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("strict-transport-security"), "max-age=12345");
  } finally {
    server.close();
  }
});

test("readiness exposes AI provider status without leaking secrets", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      LLM_API_KEY: "secret-test-key",
      LLM_API_BASE_URL: "https://llm.example.test/v1",
      LLM_MODEL: "mirage-test-model",
      LLM_TIMEOUT_MS: "1234",
    },
  });
  try {
    const ready = await request(baseUrl, "GET", "/ready");
    assert.equal(ready.status, 200);
    assert.equal(ready.json.ai.provider, "openai-compatible");
    assert.equal(ready.json.ai.configured, true);
    assert.equal(ready.json.ai.model, "mirage-test-model");
    assert.equal(ready.json.ai.timeoutMs, 1234);
    assert.equal(JSON.stringify(ready.json).includes("secret-test-key"), false);
  } finally {
    server.close();
  }
});

test("rate limits protect admin API token attempts", async () => {
  const { server, baseUrl } = await startTestServer({
    env: {
      RATE_LIMIT_ADMIN_PER_MINUTE: "2",
    },
  });
  try {
    const first = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "wrong" });
    const second = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "wrong" });
    const third = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": "wrong" });
    assert.equal(first.status, 403);
    assert.equal(second.status, 403);
    assert.equal(third.status, 429);
    assert.equal(third.json.error, "rate_limited:admin");
  } finally {
    server.close();
  }
});

test("rate limits protect auth and message write actions", async () => {
  const authLimited = await startTestServer({
    env: {
      RATE_LIMIT_AUTH_PER_MINUTE: "2",
    },
  });
  try {
    const first = await request(authLimited.baseUrl, "POST", "/auth/guest", { nickname: "Rate A" });
    const second = await request(authLimited.baseUrl, "POST", "/auth/guest", { nickname: "Rate B" });
    const third = await request(authLimited.baseUrl, "POST", "/auth/guest", { nickname: "Rate C" });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(third.status, 429);
    assert.equal(third.json.error, "rate_limited:auth");
  } finally {
    authLimited.server.close();
  }

  const forwardedIgnored = await startTestServer({
    env: {
      RATE_LIMIT_AUTH_PER_MINUTE: "2",
    },
  });
  try {
    const first = await request(forwardedIgnored.baseUrl, "POST", "/auth/guest", { nickname: "Forward A" }, null, {
      "X-Forwarded-For": "203.0.113.1",
    });
    const second = await request(forwardedIgnored.baseUrl, "POST", "/auth/guest", { nickname: "Forward B" }, null, {
      "X-Forwarded-For": "203.0.113.2",
    });
    const third = await request(forwardedIgnored.baseUrl, "POST", "/auth/guest", { nickname: "Forward C" }, null, {
      "X-Forwarded-For": "203.0.113.3",
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(third.status, 429);
    assert.equal(third.json.error, "rate_limited:auth");
  } finally {
    forwardedIgnored.server.close();
  }

  const trustedForwarded = await startTestServer({
    env: {
      RATE_LIMIT_AUTH_PER_MINUTE: "2",
      TRUST_PROXY_HEADERS: "true",
    },
  });
  try {
    const first = await request(trustedForwarded.baseUrl, "POST", "/auth/guest", { nickname: "Trusted A" }, null, {
      "X-Forwarded-For": "203.0.113.10",
    });
    const second = await request(trustedForwarded.baseUrl, "POST", "/auth/guest", { nickname: "Trusted B" }, null, {
      "X-Forwarded-For": "203.0.113.10",
    });
    const third = await request(trustedForwarded.baseUrl, "POST", "/auth/guest", { nickname: "Trusted C" }, null, {
      "X-Forwarded-For": "203.0.113.11",
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(third.status, 201);
  } finally {
    trustedForwarded.server.close();
  }

  const messageLimited = await startTestServer({
    env: {
      RATE_LIMIT_MESSAGES_PER_MINUTE: "1",
    },
  });
  try {
    const guest = await request(messageLimited.baseUrl, "POST", "/auth/guest", { nickname: "Speaker" });
    const match = await request(messageLimited.baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.json.token);
    const gameId = match.json.game.id;
    const taskCard = await request(messageLimited.baseUrl, "POST", `/games/${gameId}/task-card`, null, guest.json.token);
    assert.equal(taskCard.status, 200);
    const firstMessage = await request(
      messageLimited.baseUrl,
      "POST",
      `/games/${gameId}/messages`,
      { text: "我支持使用 AI，但必须明确标注。" },
      guest.json.token,
    );
    const secondMessage = await request(
      messageLimited.baseUrl,
      "POST",
      `/games/${gameId}/messages`,
      { text: "我补充一个观点。" },
      guest.json.token,
    );
    assert.equal(firstMessage.status, 201);
    assert.equal(secondMessage.status, 429);
    assert.equal(secondMessage.json.error, "rate_limited:messages");
  } finally {
    messageLimited.server.close();
  }
});
