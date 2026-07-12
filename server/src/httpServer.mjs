import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GameEngine, publicUser } from "./gameEngine.mjs";
import { JsonStore, MemoryStore, PostgresStore, SQLiteStore } from "./store.mjs";
import { createSessionToken, verifyToken } from "./token.mjs";
import {
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
  verifyAppleIdentityToken,
} from "./appleAuth.mjs";
import { verifyGoogleIdentityToken } from "./googleAuth.mjs";
import { verifyWeChatLoginCode } from "./wechatAuth.mjs";
import { adminPage } from "./adminPage.mjs";
import { publicCommerceCatalog } from "./commerce.mjs";
import { homePage } from "./homePage.mjs";
import { communityPage, privacyPage, supportPage, termsPage } from "./legalPages.mjs";
import { createAIGatewayFromEnv } from "./aiGateway.mjs";
import { createReportAlertDispatcherFromEnv } from "./reportAlerts.mjs";
import { corsHeaders, requestLimitBytes, securityHeaders, validateProductionEnv } from "./security.mjs";
import { worldSetting } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readJson(req, limitBytes) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > limitBytes) {
      throw Object.assign(new Error("request_body_too_large"), { status: 413 });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("invalid_json"), { status: 400 });
  }
}

function send(req, res, status, payload, env) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders({ env }),
    ...corsHeaders(req, env),
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(req, res, status, html, env) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders({ html: true, env }),
    ...corsHeaders(req, env),
  });
  res.end(html);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportsCsv(reports) {
  const columns = [
    "id",
    "status",
    "action",
    "reason",
    "createdAt",
    "updatedAt",
    "reporterUserId",
    "targetUserId",
    "gameId",
    "roomId",
    "messageId",
  ];
  const rows = reports.map((report) => columns.map((column) => csvCell(report[column])).join(","));
  return `${columns.join(",")}\n${rows.join("\n")}\n`;
}

function sendCsv(req, res, status, filename, csv, env) {
  res.writeHead(status, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    ...securityHeaders({ env }),
    ...corsHeaders(req, env),
  });
  res.end(`\uFEFF${csv}`);
}

async function sendPreviewAsset(req, res, filename, env) {
  const allowed = new Set(["avatar-you.png", "avatar-ai.png", "avatar-lu.png"]);
  if (!allowed.has(filename)) return notFound(req, res, env);
  const assetPath = path.resolve(__dirname, "../../mirage-prototype/public/assets", filename);
  const data = await readFile(assetPath);
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=3600",
    ...securityHeaders({ env }),
    ...corsHeaders(req, env),
  });
  res.end(data);
}

function notFound(req, res, env) {
  send(req, res, 404, { error: "not_found" }, env);
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || null;
}

function adminAccess(req, env) {
  const expected = env.ADMIN_TOKEN || "local-admin-token";
  const token = req.headers["x-admin-token"];
  if (token === expected) return "write";
  if (env.ADMIN_READONLY_TOKEN && token === env.ADMIN_READONLY_TOKEN) return "read";
  return null;
}

function requireAdminWrite(req, res, env) {
  const access = adminAccess(req, env);
  if (!access) {
    send(req, res, 403, { error: "admin_forbidden" }, env);
    return false;
  }
  if (access !== "write") {
    send(req, res, 403, { error: "admin_write_forbidden" }, env);
    return false;
  }
  return true;
}

class RateLimiter {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.buckets = new Map();
  }

  check({ key, limit, windowMs }) {
    const numericLimit = Number(limit);
    if (!numericLimit || numericLimit < 1) return true;
    const now = this.now();
    const startedAt = now - Number(windowMs || 60_000);
    const existing = (this.buckets.get(key) || []).filter((timestamp) => timestamp > startedAt);
    if (existing.length >= numericLimit) {
      this.buckets.set(key, existing);
      return false;
    }
    existing.push(now);
    this.buckets.set(key, existing);
    return true;
  }
}

function clientIp(req, env) {
  const forwarded = req.headers["x-forwarded-for"];
  if (env.TRUST_PROXY_HEADERS === "true" && typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateLimitConfig(env, key, fallback) {
  return Number(env[key] || fallback);
}

function assertRateLimit(req, env, limiter, { bucket, subject, limit }) {
  if (env.RATE_LIMIT_DISABLED === "true") return;
  const ok = limiter.check({
    key: `${bucket}:${subject}`,
    limit,
    windowMs: rateLimitConfig(env, "RATE_LIMIT_WINDOW_MS", 60_000),
  });
  if (!ok) throw Object.assign(new Error(`rate_limited:${bucket}`), { status: 429 });
}

function match(pathname, pattern) {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = actual;
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

export function createHttpServer(options = {}) {
  const env = options.env || process.env;
  validateProductionEnv(env);
  const secret = env.SESSION_SECRET || "dev-session-secret-change-me";
  const maxBodyBytes = requestLimitBytes(env);
  const rateLimiter = options.rateLimiter || new RateLimiter({ now: options.rateLimitNow || Date.now });
  const storagePath = options.storagePath || env.MIRAGE_STORAGE_PATH || path.resolve(__dirname, "../data/mirage.dev.json");
  const sqlitePath = options.sqlitePath || env.MIRAGE_SQLITE_PATH || path.resolve(__dirname, "../data/mirage.sqlite");
  const store =
    options.store ||
    (env.NODE_ENV === "test"
      ? new MemoryStore()
      : env.MIRAGE_STORE === "postgres"
        ? (() => {
            throw new Error("postgres_store_requires_createHttpServerAsync");
          })()
      : env.MIRAGE_STORE === "sqlite"
        ? new SQLiteStore(sqlitePath)
        : new JsonStore(storagePath));
  const aiGateway = options.aiGateway || createAIGatewayFromEnv(env);
  const reportAlerts = options.reportAlertDispatcher || createReportAlertDispatcherFromEnv(env);
  const engine =
    options.engine ||
    new GameEngine(store, {
      clock: options.clock || Date,
      aiGateway,
      env,
    });

  async function authenticate(req) {
    const token = getBearer(req);
    const payload = verifyToken(token, secret);
    if (!payload?.sub) return null;
    const user = await engine.getUser(payload.sub);
    return user || null;
  }

  async function notifyReportAlert({ report, blockRequested }) {
    try {
      return await reportAlerts.notifyReportCreated({ report, blockRequested });
    } catch (error) {
      return {
        status: "failed",
        destination: reportAlerts.describe?.().destination || null,
        error: String(error?.message || error || "report_alert_failed").slice(0, 160),
      };
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        send(req, res, 204, {}, env);
        return;
      }

      const url = new URL(req.url, "http://localhost");
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/") {
        sendHtml(req, res, 200, homePage(), env);
        return;
      }

      const previewAsset = match(pathname, "/preview-assets/:filename");
      if (req.method === "GET" && previewAsset) {
        await sendPreviewAsset(req, res, previewAsset.filename, env);
        return;
      }

      if (req.method === "GET" && pathname === "/health") {
        send(req, res, 200, { ok: true, name: "mirage-server", store: env.MIRAGE_STORE || "json" }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/ready") {
        const state = await store.snapshot();
        send(
          req,
          res,
          200,
          {
            ok: true,
            name: "mirage-server",
            store: env.MIRAGE_STORE || "json",
            ai: options.engine?.aiGateway?.describe?.() || aiGateway.describe?.() || { provider: "custom", configured: true },
            reportAlerts: reportAlerts.describe?.() || { configured: false },
            users: state.users.length,
            games: state.games.length,
          },
          env,
        );
        return;
      }

      if (req.method === "GET" && pathname === "/admin") {
        sendHtml(req, res, 200, adminPage(), env);
        return;
      }

      if (req.method === "GET" && pathname === "/legal/privacy") {
        sendHtml(req, res, 200, privacyPage(env), env);
        return;
      }

      if (req.method === "GET" && pathname === "/legal/terms") {
        sendHtml(req, res, 200, termsPage(env), env);
        return;
      }

      if (req.method === "GET" && pathname === "/legal/community") {
        sendHtml(req, res, 200, communityPage(env), env);
        return;
      }

      if (req.method === "GET" && pathname === "/support") {
        sendHtml(req, res, 200, supportPage(env), env);
        return;
      }

      if (req.method === "POST" && pathname === "/auth/guest") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "auth",
          subject: clientIp(req, env),
          limit: rateLimitConfig(env, "RATE_LIMIT_AUTH_PER_MINUTE", 20),
        });
        const body = await readJson(req, maxBodyBytes);
        const user = await engine.createGuest({
          nickname: body.nickname,
          ageConfirmed: body.ageConfirmed,
          communityConfirmed: body.communityConfirmed,
        });
        send(req, res, 201, { user: publicUser(user), token: createSessionToken(user.id, secret) }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/auth/apple") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "auth",
          subject: clientIp(req, env),
          limit: rateLimitConfig(env, "RATE_LIMIT_AUTH_PER_MINUTE", 20),
        });
        const body = await readJson(req, maxBodyBytes);
        const identity = await verifyAppleIdentityToken(body.identityToken, {
          allowMock: env.AUTH_ALLOW_MOCK_APPLE === "true" || env.NODE_ENV !== "production",
          audience: env.APPLE_BUNDLE_ID,
        });
        const tokenExchange = await exchangeAppleAuthorizationCode(body.authorizationCode, {
          allowMock: env.AUTH_ALLOW_MOCK_APPLE === "true" || env.NODE_ENV !== "production",
          env,
        });
        const user = await engine.upsertAppleUser({
          appleSub: identity.appleSub,
          email: identity.email,
          nickname: body.nickname,
          appleRefreshToken: tokenExchange?.refreshToken || null,
          ageConfirmed: body.ageConfirmed,
          communityConfirmed: body.communityConfirmed,
        });
        send(req, res, 200, { user: publicUser(user), token: createSessionToken(user.id, secret) }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/auth/google") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "auth",
          subject: clientIp(req, env),
          limit: rateLimitConfig(env, "RATE_LIMIT_AUTH_PER_MINUTE", 20),
        });
        const body = await readJson(req, maxBodyBytes);
        const identity = await verifyGoogleIdentityToken(body.identityToken, {
          allowMock: env.AUTH_ALLOW_MOCK_GOOGLE === "true" || env.NODE_ENV !== "production",
          audience: env.GOOGLE_CLIENT_ID,
        });
        const user = await engine.upsertGoogleUser({
          googleSub: identity.googleSub,
          email: identity.email,
          nickname: body.nickname,
          ageConfirmed: body.ageConfirmed,
          communityConfirmed: body.communityConfirmed,
        });
        send(req, res, 200, { user: publicUser(user), token: createSessionToken(user.id, secret) }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/auth/wechat") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "auth",
          subject: clientIp(req, env),
          limit: rateLimitConfig(env, "RATE_LIMIT_AUTH_PER_MINUTE", 20),
        });
        const body = await readJson(req, maxBodyBytes);
        const identity = await verifyWeChatLoginCode(body.code, {
          allowMock: env.AUTH_ALLOW_MOCK_WECHAT === "true" || env.NODE_ENV !== "production",
          appId: env.WECHAT_APP_ID,
          appSecret: env.WECHAT_APP_SECRET,
        });
        const user = await engine.upsertWeChatUser({
          wechatSub: identity.wechatSub,
          unionId: identity.unionId,
          nickname: body.nickname || identity.nickname,
          ageConfirmed: body.ageConfirmed,
          communityConfirmed: body.communityConfirmed,
        });
        send(req, res, 200, { user: publicUser(user), token: createSessionToken(user.id, secret) }, env);
        return;
      }

      const user = await authenticate(req);

      if (req.method === "GET" && pathname === "/modes") {
        send(req, res, 200, { worldSetting, modes: engine.listModes() }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/topics") {
        send(req, res, 200, { topics: await engine.listTopics({ modeId: url.searchParams.get("modeId") || undefined }) }, env);
        return;
      }

      if (!user && !pathname.startsWith("/admin/")) {
        send(req, res, 401, { error: "unauthorized" }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/me") {
        send(req, res, 200, { user: publicUser(user) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/me/summary") {
        send(req, res, 200, { summary: await engine.userSummary(user.id) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/me/games") {
        send(req, res, 200, { games: await engine.userGames(user.id) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/leaderboard") {
        send(req, res, 200, { leaderboard: await engine.leaderboard(user.id) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/commerce/catalog") {
        send(req, res, 200, { catalog: publicCommerceCatalog() }, env);
        return;
      }

      const missionClaim = match(pathname, "/me/missions/:missionId/claim");
      const missionClaimAll = pathname === "/me/missions/claim-all";
      const cosmeticUnlock = match(pathname, "/me/cosmetics/:itemId/unlock");
      const cosmeticEquip = match(pathname, "/me/cosmetics/:itemId/equip");
      const playAction =
        Boolean(missionClaim) ||
        missionClaimAll ||
        pathname === "/matchmaking/start" ||
        pathname === "/quick-start" ||
        /^\/matchmaking\/[^/]+$/.test(pathname) ||
        pathname === "/rooms" ||
        pathname === "/rooms/join" ||
        pathname === "/reports" ||
        pathname === "/blocks" ||
        /^\/rooms\/[^/]+$/.test(pathname) ||
        /^\/games\/[^/]+$/.test(pathname) ||
        /^\/rooms\/[^/]+\/(ready|start|topic)$/.test(pathname) ||
        /^\/games\/[^/]+\/(task-card|messages|reactions|votes|finish-discussion)$/.test(pathname);
      if (playAction && user.bannedAt) {
        send(req, res, 403, { error: "user_banned" }, env);
        return;
      }

      if (req.method === "POST" && missionClaim) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:missions`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const summary = await engine.claimMissionReward({ userId: user.id, missionId: missionClaim.missionId });
        send(req, res, 200, { summary }, env);
        return;
      }

      if (req.method === "POST" && missionClaimAll) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:missions`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const summary = await engine.claimAllMissionRewards({ userId: user.id });
        send(req, res, 200, { summary }, env);
        return;
      }

      if (req.method === "POST" && cosmeticUnlock) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:cosmetics`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const summary = await engine.unlockCosmetic({ userId: user.id, itemId: cosmeticUnlock.itemId });
        send(req, res, 200, { summary }, env);
        return;
      }

      if (req.method === "POST" && cosmeticEquip) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:cosmetics`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const summary = await engine.equipCosmetic({ userId: user.id, itemId: cosmeticEquip.itemId });
        send(req, res, 200, { summary }, env);
        return;
      }

      if (req.method === "DELETE" && pathname === "/account") {
        let appleRevoke = { revoked: false, reason: "not_apple_account" };
        if (user.appleRefreshToken) {
          try {
            appleRevoke = await revokeAppleRefreshToken(user.appleRefreshToken, {
              allowMock: env.AUTH_ALLOW_MOCK_APPLE === "true" || env.NODE_ENV !== "production",
              env,
            });
          } catch (error) {
            appleRevoke = { revoked: false, reason: error.message || "apple_revoke_failed" };
          }
        }
        const deletedUser = await engine.deleteAccount(user.id);
        send(req, res, 200, { user: deletedUser, appleRevoke }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/matchmaking/start") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "matchmaking",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_MATCHMAKING_PER_MINUTE", 30),
        });
        const body = await readJson(req, maxBodyBytes);
        const result = await engine.startMatchmaking({ userId: user.id, modeId: body.modeId || "M01", topicId: body.topicId });
        send(req, res, result.status === "matched" ? 201 : 202, result, env);
        return;
      }

      if (req.method === "POST" && pathname === "/quick-start") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "matchmaking",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_MATCHMAKING_PER_MINUTE", 30),
        });
        const body = await readJson(req, maxBodyBytes);
        const result = await engine.quickStart({ userId: user.id, modeId: body.modeId || "M01", topicId: body.topicId });
        send(req, res, 201, result, env);
        return;
      }

      const matchmakingRoute = match(pathname, "/matchmaking/:ticketId");
      if (req.method === "GET" && matchmakingRoute) {
        const result = await engine.getMatchmakingStatus({ userId: user.id, ticketId: matchmakingRoute.ticketId });
        send(req, res, result.status === "matched" ? 200 : 202, result, env);
        return;
      }

      if (req.method === "DELETE" && matchmakingRoute) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "matchmaking",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_MATCHMAKING_PER_MINUTE", 30),
        });
        const result = await engine.cancelMatchmaking({ userId: user.id, ticketId: matchmakingRoute.ticketId });
        send(req, res, 200, result, env);
        return;
      }

      if (req.method === "POST" && pathname === "/rooms") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const body = await readJson(req, maxBodyBytes);
        const room = await engine.createRoom({
          userId: user.id,
          modeId: body.modeId || "M03",
          topicId: body.topicId,
          allowAiFill: body.allowAiFill !== false,
        });
        send(req, res, 201, { room }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/rooms/join") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const body = await readJson(req, maxBodyBytes);
        const room = await engine.joinRoom({ userId: user.id, inviteCode: body.inviteCode });
        send(req, res, 200, { room }, env);
        return;
      }

      const roomReady = match(pathname, "/rooms/:roomId/ready");
      if (req.method === "POST" && roomReady) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const body = await readJson(req, maxBodyBytes);
        const room = await engine.setReady({ userId: user.id, roomId: roomReady.roomId, ready: body.ready !== false });
        send(req, res, 200, { room }, env);
        return;
      }

      const roomStart = match(pathname, "/rooms/:roomId/start");
      if (req.method === "POST" && roomStart) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const result = await engine.startRoom({ userId: user.id, roomId: roomStart.roomId });
        send(req, res, 201, result, env);
        return;
      }

      const debugRoomFill = match(pathname, "/debug/rooms/:roomId/fill-and-start");
      if (req.method === "POST" && debugRoomFill && env.NODE_ENV !== "production") {
        const result = await engine.debugFillAndStartRoom({ userId: user.id, roomId: debugRoomFill.roomId });
        send(req, res, 201, result, env);
        return;
      }

      const roomTopic = match(pathname, "/rooms/:roomId/topic");
      if (req.method === "POST" && roomTopic) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const body = await readJson(req, maxBodyBytes);
        const room = await engine.setRoomTopic({ userId: user.id, roomId: roomTopic.roomId, topicId: body.topicId });
        send(req, res, 200, { room }, env);
        return;
      }

      const roomRematch = match(pathname, "/rooms/:roomId/rematch");
      if (req.method === "POST" && roomRematch) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const result = await engine.rematchRoom({ userId: user.id, roomId: roomRematch.roomId });
        send(req, res, result.created ? 201 : 200, { room: result.room }, env);
        return;
      }

      const roomRoute = match(pathname, "/rooms/:roomId");
      if (req.method === "DELETE" && roomRoute) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "rooms",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_ROOMS_PER_MINUTE", 30),
        });
        const room = await engine.leaveRoom({ roomId: roomRoute.roomId, userId: user.id });
        send(req, res, 200, { room }, env);
        return;
      }

      if (req.method === "GET" && roomRoute) {
        const room = await engine.getRoom({ roomId: roomRoute.roomId, userId: user.id });
        if (!room) return notFound(req, res, env);
        send(req, res, 200, { room }, env);
        return;
      }

      const gameGet = match(pathname, "/games/:gameId");
      if (req.method === "GET" && gameGet) {
        const game = await engine.getGame({ userId: user.id, gameId: gameGet.gameId });
        send(req, res, 200, { game }, env);
        return;
      }

      const taskCardPost = match(pathname, "/games/:gameId/task-card");
      if (req.method === "POST" && taskCardPost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:${taskCardPost.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const game = await engine.acknowledgeTaskCard({ userId: user.id, gameId: taskCardPost.gameId });
        send(req, res, 200, { game }, env);
        return;
      }

      const messagePost = match(pathname, "/games/:gameId/messages");
      if (req.method === "POST" && messagePost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "messages",
          subject: `${user.id}:${messagePost.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_MESSAGES_PER_MINUTE", 20),
        });
        const body = await readJson(req, maxBodyBytes);
        const game = await engine.sendMessage({ userId: user.id, gameId: messagePost.gameId, text: body.text });
        send(req, res, 201, { game }, env);
        return;
      }

      const reactionPost = match(pathname, "/games/:gameId/reactions");
      if (req.method === "POST" && reactionPost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:${reactionPost.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const body = await readJson(req, maxBodyBytes);
        const game = await engine.react({
          userId: user.id,
          gameId: reactionPost.gameId,
          messageId: body.messageId,
          type: body.type || "agree",
        });
        send(req, res, 201, { game }, env);
        return;
      }

      const votePost = match(pathname, "/games/:gameId/votes");
      if (req.method === "POST" && votePost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:${votePost.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const body = await readJson(req, maxBodyBytes);
        const game = await engine.vote({
          userId: user.id,
          gameId: votePost.gameId,
          targetPlayerId: body.targetPlayerId,
        });
        send(req, res, 200, { game }, env);
        return;
      }

      const finishDiscussionPost = match(pathname, "/games/:gameId/finish-discussion");
      if (req.method === "POST" && finishDiscussionPost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:${finishDiscussionPost.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const game = await engine.finishDiscussion({ userId: user.id, gameId: finishDiscussionPost.gameId });
        send(req, res, 200, { game }, env);
        return;
      }

      const replayPost = match(pathname, "/games/:gameId/replay");
      if (req.method === "POST" && replayPost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:${replayPost.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const game = await engine.viewReplay({ userId: user.id, gameId: replayPost.gameId });
        send(req, res, 200, { game }, env);
        return;
      }

      const shareCardGet = match(pathname, "/games/:gameId/share-card");
      if (req.method === "GET" && shareCardGet) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "game_actions",
          subject: `${user.id}:${shareCardGet.gameId}`,
          limit: rateLimitConfig(env, "RATE_LIMIT_GAME_ACTIONS_PER_MINUTE", 60),
        });
        const shareCard = await engine.getShareCard({ userId: user.id, gameId: shareCardGet.gameId });
        send(req, res, 200, { shareCard }, env);
        return;
      }

      const reportPost = pathname === "/reports";
      if (req.method === "POST" && reportPost) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "reports",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_REPORTS_PER_MINUTE", 10),
        });
        const body = await readJson(req, maxBodyBytes);
        const report = await engine.createReport({
          userId: user.id,
          gameId: body.gameId,
          roomId: body.roomId,
          messageId: body.messageId,
          targetUserId: body.targetUserId,
          reason: body.reason,
        });
        if (body.block && body.targetUserId) {
          await engine.blockUser({ userId: user.id, targetUserId: body.targetUserId });
        }
        const reportAlert = await notifyReportAlert({
          report,
          blockRequested: Boolean(body.block && body.targetUserId),
        });
        await engine.recordReportAlert({ reportId: report.id, alert: reportAlert });
        send(req, res, 201, { report }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/blocks") {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "reports",
          subject: user.id,
          limit: rateLimitConfig(env, "RATE_LIMIT_REPORTS_PER_MINUTE", 10),
        });
        const body = await readJson(req, maxBodyBytes);
        const block = await engine.blockUser({ userId: user.id, targetUserId: body.targetUserId });
        send(req, res, 201, { block }, env);
        return;
      }

      const debugAdvance = match(pathname, "/debug/games/:gameId/advance");
      if (req.method === "POST" && debugAdvance && env.NODE_ENV !== "production") {
        const body = await readJson(req, maxBodyBytes);
        const game = await engine.forceAdvance({ gameId: debugAdvance.gameId, seconds: body.seconds || 1, userId: user.id });
        send(req, res, 200, { game }, env);
        return;
      }

      if (pathname.startsWith("/admin/")) {
        assertRateLimit(req, env, rateLimiter, {
          bucket: "admin",
          subject: clientIp(req, env),
          limit: rateLimitConfig(env, "RATE_LIMIT_ADMIN_PER_MINUTE", 60),
        });
        if (!adminAccess(req, env)) {
          send(req, res, 403, { error: "admin_forbidden" }, env);
          return;
        }
      }

      if (req.method === "GET" && pathname === "/admin/session") {
        send(req, res, 200, { access: adminAccess(req, env) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/reports") {
        send(req, res, 200, {
          reports: await engine.listReports({
            status: url.searchParams.get("status"),
            reason: url.searchParams.get("reason"),
            gameId: url.searchParams.get("gameId"),
            targetUserId: url.searchParams.get("targetUserId"),
            limit: url.searchParams.get("limit"),
          }),
        }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/reports.csv") {
        sendCsv(
          req,
          res,
          200,
          "mirage-reports.csv",
          reportsCsv(
            await engine.listReports({
              status: url.searchParams.get("status"),
              reason: url.searchParams.get("reason"),
              gameId: url.searchParams.get("gameId"),
              targetUserId: url.searchParams.get("targetUserId"),
              limit: url.searchParams.get("limit"),
            }),
          ),
          env,
        );
        return;
      }

      if (req.method === "POST" && pathname === "/admin/reports/batch") {
        if (!requireAdminWrite(req, res, env)) return;
        const body = await readJson(req, maxBodyBytes);
        const reports = await engine.updateReportsBatch({
          reportIds: body.reportIds,
          status: body.status || "resolved",
          action: body.action || "reviewed",
        });
        send(req, res, 200, { reports }, env);
        return;
      }

      if (req.method === "POST" && pathname === "/admin/reports/batch-ban-targets") {
        if (!requireAdminWrite(req, res, env)) return;
        const body = await readJson(req, maxBodyBytes);
        const result = await engine.banReportTargetsBatch({
          reportIds: body.reportIds,
          reason: body.reason || "batch_report_confirmed",
        });
        send(req, res, 200, result, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/metrics") {
        send(req, res, 200, { metrics: await engine.metricsSummary({ reportSlaSeconds: env.REPORT_SLA_SECONDS }) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/trends") {
        send(req, res, 200, { trends: await engine.adminTrends({ days: url.searchParams.get("days") }) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/audit") {
        send(req, res, 200, { events: await engine.adminAuditEvents({ limit: url.searchParams.get("limit") }) }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/topics") {
        send(req, res, 200, { topics: await engine.adminTopics() }, env);
        return;
      }

      const adminTopic = match(pathname, "/admin/topics/:topicId");
      if (req.method === "PATCH" && adminTopic) {
        if (!requireAdminWrite(req, res, env)) return;
        const body = await readJson(req, maxBodyBytes);
        const topic = await engine.updateTopicSetting({
          topicId: adminTopic.topicId,
          enabled: body.enabled !== false,
        });
        send(req, res, 200, { topic }, env);
        return;
      }

      const adminReportContext = match(pathname, "/admin/reports/:reportId/context");
      if (req.method === "GET" && adminReportContext) {
        const context = await engine.getReportContext(adminReportContext.reportId);
        send(req, res, 200, context, env);
        return;
      }

      const adminReport = match(pathname, "/admin/reports/:reportId");
      if (req.method === "PATCH" && adminReport) {
        if (!requireAdminWrite(req, res, env)) return;
        const body = await readJson(req, maxBodyBytes);
        const report = await engine.updateReport({
          reportId: adminReport.reportId,
          status: body.status,
          action: body.action,
        });
        send(req, res, 200, { report }, env);
        return;
      }

      const adminReportBan = match(pathname, "/admin/reports/:reportId/ban-target");
      if (req.method === "POST" && adminReportBan) {
        if (!requireAdminWrite(req, res, env)) return;
        const body = await readJson(req, maxBodyBytes);
        const context = await engine.getReportContext(adminReportBan.reportId);
        if (!context.report.targetUserId) {
          send(req, res, 422, { error: "report_has_no_target_user" }, env);
          return;
        }
        const target = await engine.banUser({
          targetUserId: context.report.targetUserId,
          reportId: adminReportBan.reportId,
          reason: body.reason || context.report.reason,
        });
        send(req, res, 200, { user: target }, env);
        return;
      }

      if (req.method === "GET" && pathname === "/admin/rooms") {
        send(req, res, 200, { rooms: await engine.adminRooms() }, env);
        return;
      }

      const adminGame = match(pathname, "/admin/games/:gameId");
      if (req.method === "GET" && adminGame) {
        const game = await engine.adminGame(adminGame.gameId);
        if (!game) return notFound(req, res, env);
        send(req, res, 200, { game }, env);
        return;
      }

      notFound(req, res, env);
    } catch (error) {
      const status = error.status || 500;
      send(req, res, status, { error: error.message || "server_error" }, env);
    }
  });

  return { server, engine, store };
}

export async function createHttpServerAsync(options = {}) {
  const env = options.env || process.env;
  if (options.store || env.MIRAGE_STORE !== "postgres") {
    return createHttpServer(options);
  }
  const store = new PostgresStore({
    connectionString: env.MIRAGE_POSTGRES_URL || env.DATABASE_URL,
  });
  await store.init();
  return createHttpServer({ ...options, store });
}
