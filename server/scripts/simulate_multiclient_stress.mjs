import assert from "node:assert/strict";
import { createHttpServer } from "../src/httpServer.mjs";

function makeRng(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function weakDelay(rng) {
  return Math.floor(15 + rng() * 85);
}

function friendRoomHumanSeatCount(modeId) {
  if (modeId === "M03") return 3;
  if (modeId === "M04" || modeId === "M06" || modeId === "M08") return 4;
  throw new Error(`unsupported_friend_room_mode:${modeId}`);
}

async function request(baseUrl, metrics, rng, method, path, body, token, headers = {}, expected = [200, 201, 202]) {
  const plannedDelayMs = weakDelay(rng);
  await sleep(plannedDelayMs);
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const latencyMs = Date.now() - startedAt + plannedDelayMs;
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  metrics.requests += 1;
  metrics.latencies.push(latencyMs);
  metrics.statuses[response.status] = (metrics.statuses[response.status] || 0) + 1;
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} expected ${expected.join("/")} got ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { status: response.status, payload, latencyMs };
}

async function createUser(baseUrl, metrics, rng, nickname) {
  const response = await request(baseUrl, metrics, rng, "POST", "/auth/guest", {
    nickname,
    ageConfirmed: true,
    communityConfirmed: true,
  });
  return { token: response.payload.token, user: response.payload.user };
}

async function startServer() {
  const adminToken = "stress-admin-token-000000000000";
  const { server } = createHttpServer({
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "stress-session-secret-000000000000000000",
      ADMIN_TOKEN: adminToken,
      AUTH_ALLOW_MOCK_APPLE: "true",
      AUTH_ALLOW_MOCK_GOOGLE: "true",
      LLM_MOCK_RESPONSE: "我认为可以有限度使用 AI，但必须标注并能解释。",
      RATE_LIMIT_AUTH_PER_MINUTE: "1000",
      RATE_LIMIT_MATCHMAKING_PER_MINUTE: "1000",
      RATE_LIMIT_ROOMS_PER_MINUTE: "1000",
      RATE_LIMIT_MESSAGES_PER_MINUTE: "1000",
      RATE_LIMIT_GAME_ACTIONS_PER_MINUTE: "1000",
      RATE_LIMIT_REPORTS_PER_MINUTE: "1000",
      RATE_LIMIT_ADMIN_PER_MINUTE: "1000",
    },
  });
  const baseUrl = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
  return { server, baseUrl, adminToken };
}

async function publicMatchmakingRace(baseUrl, metrics, rng, users) {
  const starts = await Promise.all(
    users.slice(0, 4).map((user) =>
      request(baseUrl, metrics, rng, "POST", "/matchmaking/start", { modeId: "M02" }, user.token),
    ),
  );
  const matchedGameIds = new Set();
  const waitingTickets = [];
  for (const start of starts) {
    if (start.status === 201) matchedGameIds.add(start.payload.game.id);
    if (start.status === 202) waitingTickets.push(start.payload.ticketId);
  }
  for (let index = 0; index < waitingTickets.length; index += 1) {
    const ticketId = waitingTickets[index];
    const polled = await request(baseUrl, metrics, rng, "GET", `/matchmaking/${ticketId}`, null, users[index].token);
    if (polled.status === 200) matchedGameIds.add(polled.payload.game.id);
  }
  assert.equal(matchedGameIds.size, 2, "four M02 users should form two games under concurrent start pressure");
  return [...matchedGameIds];
}

async function adminGame(baseUrl, metrics, rng, adminToken, gameId) {
  const response = await request(baseUrl, metrics, rng, "GET", `/admin/games/${gameId}`, null, null, {
    "X-Admin-Token": adminToken,
  });
  return response.payload.game;
}

function tokenForUser(users, userId) {
  const user = users.find((item) => item.user.id === userId);
  if (!user) throw new Error(`missing_user_token:${userId}`);
  return user.token;
}

async function acknowledgeTaskCards(baseUrl, metrics, rng, users, gameId, players) {
  await Promise.all(
    players
      .filter((player) => player.kind === "human" && player.userId)
      .map((player) =>
        request(baseUrl, metrics, rng, "POST", `/games/${gameId}/task-card`, null, tokenForUser(users, player.userId)),
      ),
  );
}

function assertSpecialRoleAssigned(modeId, rawGame) {
  const roleByMode = {
    M06: "human_undercover",
    M08: "fake_ai",
  };
  const role = roleByMode[modeId];
  if (!role) return;
  const player = rawGame.players.find((item) => item.role === role && item.userId);
  assert.ok(player, `${modeId} stress game should assign ${role} to a real user`);
}

async function completeFriendRoom(baseUrl, metrics, rng, adminToken, users, modeId) {
  const host = users[0];
  const created = await request(baseUrl, metrics, rng, "POST", "/rooms", { modeId, topicId: "label-ai-content" }, host.token);
  const roomId = created.payload.room.id;
  const inviteCode = created.payload.room.inviteCode;
  const joinedUsers = users.slice(1, friendRoomHumanSeatCount(modeId));

  await Promise.all(
    joinedUsers.map((user) =>
      request(baseUrl, metrics, rng, "POST", "/rooms/join", { inviteCode }, user.token),
    ),
  );
  await Promise.all([
    ...joinedUsers.map((user) =>
      request(baseUrl, metrics, rng, "POST", `/rooms/${roomId}/ready`, { ready: true }, user.token),
    ),
    request(baseUrl, metrics, rng, "GET", `/rooms/${roomId}`, null, host.token),
  ]);
  const started = await request(baseUrl, metrics, rng, "POST", `/rooms/${roomId}/start`, null, host.token);
  const gameId = started.payload.game.id;
  let raw = await adminGame(baseUrl, metrics, rng, adminToken, gameId);
  const humans = raw.players.filter((player) => player.kind === "human" && player.userId);
  const minimumHumans = modeId === "M03" ? 2 : modeId === "M04" ? 3 : 4;
  assert.ok(humans.length >= minimumHumans, `${modeId} stress game should include at least ${minimumHumans} real users`);
  await acknowledgeTaskCards(baseUrl, metrics, rng, users, gameId, humans);
  assertSpecialRoleAssigned(modeId, raw);

  await Promise.all(
    humans.map((player, index) =>
      request(
        baseUrl,
        metrics,
        rng,
        "POST",
        `/games/${gameId}/messages`,
        { text: `第 ${index + 1} 位玩家给出线索，我会看解释是否稳定。` },
        tokenForUser(users, player.userId),
      ),
    ),
  );
  await Promise.all(humans.map((player) => request(baseUrl, metrics, rng, "GET", `/games/${gameId}`, null, tokenForUser(users, player.userId))));

  const phaseResponse = await request(baseUrl, metrics, rng, "POST", `/debug/games/${gameId}/advance`, { seconds: 999 }, host.token);
  assert.equal(phaseResponse.payload.game.phase, "FINAL_STATEMENT");
  await Promise.all(
    humans.map((player, index) =>
      request(
        baseUrl,
        metrics,
        rng,
        "POST",
        `/games/${gameId}/messages`,
        { text: `最终陈述 ${index + 1}：我投最像隐藏发言者的位置。` },
        tokenForUser(users, player.userId),
      ),
    ),
  );

  raw = await adminGame(baseUrl, metrics, rng, adminToken, gameId);
  const ai = raw.players.find((player) => player.role === "ai");
  assert.ok(ai, "friend room stress game should contain an AI target");
  await Promise.all(
    humans.map((player) =>
      request(
        baseUrl,
        metrics,
        rng,
        "POST",
        `/games/${gameId}/votes`,
        { targetPlayerId: ai.id },
        tokenForUser(users, player.userId),
      ),
    ),
  );
  const replay = await request(baseUrl, metrics, rng, "POST", `/games/${gameId}/replay`, null, host.token);
  assert.equal(replay.payload.game.phase, "COMPLETED");
  assert.ok(replay.payload.game.replay);

  const rematches = await Promise.all([
    request(baseUrl, metrics, rng, "POST", `/rooms/${roomId}/rematch`, null, host.token),
    request(baseUrl, metrics, rng, "POST", `/rooms/${roomId}/rematch`, null, users[1].token),
    request(baseUrl, metrics, rng, "POST", `/rooms/${roomId}/rematch`, null, users[2].token),
    request(baseUrl, metrics, rng, "POST", `/rooms/${roomId}/rematch`, null, host.token),
  ]);
  const rematchRoomIds = new Set(rematches.map((item) => item.payload.room.id));
  assert.equal(rematchRoomIds.size, 1, "rematch race should converge to one retained lobby");
  assert.equal(rematches.filter((item) => item.status === 201).length, 1, "only one rematch request should create the lobby");
  assert.ok(rematches.every((item) => item.payload.room.status === "LOBBY"));
  return { modeId, roomId, gameId, rematchRoomId: rematches[0].payload.room.id };
}

async function main() {
  const rng = makeRng(Number(process.env.MIRAGE_STRESS_SEED || 20260615));
  const metrics = { requests: 0, statuses: {}, latencies: [] };
  const startedAt = Date.now();
  const { server, baseUrl, adminToken } = await startServer();
  try {
    const users = await Promise.all(
      Array.from({ length: 6 }, (_, index) => createUser(baseUrl, metrics, rng, `Stress ${index + 1}`)),
    );
    const publicGameIds = await publicMatchmakingRace(baseUrl, metrics, rng, users);
    const friendRooms = [];
    for (const modeId of ["M03", "M04", "M06", "M08"]) {
      friendRooms.push(await completeFriendRoom(baseUrl, metrics, rng, adminToken, users, modeId));
    }
    const modeCoverage = ["M02", ...friendRooms.map((room) => room.modeId)];
    const adminMetrics = await request(baseUrl, metrics, rng, "GET", "/admin/metrics", null, null, {
      "X-Admin-Token": adminToken,
    });
    assert.ok(adminMetrics.payload.metrics.games.completed >= friendRooms.length);
    const report = {
      ok: true,
      seed: Number(process.env.MIRAGE_STRESS_SEED || 20260615),
      durationMs: Date.now() - startedAt,
      weakNetwork: {
        minDelayMs: 15,
        maxDelayMs: 99,
        p95RequestLatencyMs: percentile(metrics.latencies, 95),
        maxRequestLatencyMs: Math.max(...metrics.latencies),
      },
      requests: metrics.requests,
      statuses: metrics.statuses,
      publicGameIds,
      friendRoom: friendRooms[0],
      friendRooms,
      modeCoverage,
      completedGames: adminMetrics.payload.metrics.games.completed,
      rematchConverged: true,
    };
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("Multiclient weak-network stress passed");
      console.log(`Requests: ${report.requests}`);
      console.log(`Statuses: ${JSON.stringify(report.statuses)}`);
      console.log(`p95 latency: ${report.weakNetwork.p95RequestLatencyMs}ms`);
      console.log(`Mode coverage: ${modeCoverage.join(", ")}`);
      console.log(`Public games: ${publicGameIds.join(", ")}`);
      console.log(`Rematch rooms: ${friendRooms.map((room) => `${room.modeId}:${room.rematchRoomId}`).join(", ")}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
