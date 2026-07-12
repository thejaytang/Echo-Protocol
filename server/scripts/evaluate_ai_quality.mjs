import assert from "node:assert/strict";
import { createHttpServer } from "../src/httpServer.mjs";
import { moderateText } from "../src/moderation.mjs";

async function request(baseUrl, method, path, body, token, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, payload };
}

async function startHarness(env = {}) {
  const adminToken = "ai-quality-admin-token-000000000000";
  const { server } = createHttpServer({
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "ai-quality-session-secret-000000000000",
      ADMIN_TOKEN: adminToken,
      AUTH_ALLOW_MOCK_APPLE: "true",
      AUTH_ALLOW_MOCK_GOOGLE: "true",
      MIRAGE_M01_OPPONENT_KIND: "ai",
      RATE_LIMIT_AUTH_PER_MINUTE: "1000",
      RATE_LIMIT_MATCHMAKING_PER_MINUTE: "1000",
      RATE_LIMIT_MESSAGES_PER_MINUTE: "1000",
      RATE_LIMIT_GAME_ACTIONS_PER_MINUTE: "1000",
      RATE_LIMIT_ADMIN_PER_MINUTE: "1000",
      ...env,
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

async function createAiReply(baseUrl, adminToken, nickname = "AI Quality") {
  const guest = await request(baseUrl, "POST", "/auth/guest", {
    nickname,
    ageConfirmed: true,
    communityConfirmed: true,
  });
  assert.equal(guest.status, 201);
  const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, guest.payload.token);
  assert.equal(match.status, 201);
  const gameId = match.payload.game.id;
  const taskCard = await request(baseUrl, "POST", `/games/${gameId}/task-card`, null, guest.payload.token);
  assert.equal(taskCard.status, 200);
  const sent = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我想看对方能不能解释具体判断标准。" }, guest.payload.token);
  assert.equal(sent.status, 201);
  const adminGame = await request(baseUrl, "GET", `/admin/games/${gameId}`, null, null, { "X-Admin-Token": adminToken });
  assert.equal(adminGame.status, 200);
  const rawAiMessage = [...adminGame.payload.game.messages].reverse().find((message) => message.aiSource);
  assert.ok(rawAiMessage, "AI reply should be present in the internal game state");
  const playerVisibleMessage = sent.payload.game.messages.find((message) => message.text === rawAiMessage.text);
  assert.ok(playerVisibleMessage, "AI reply should be visible as a player message");
  return { gameId, token: guest.payload.token, rawAiMessage, playerVisibleMessage };
}

function assertSafeReplyText(text) {
  const moderation = moderateText(text);
  assert.equal(moderation.allowed, true, `AI reply should pass moderation: ${moderation.reason}`);
  assert.ok(String(text).length <= 120, "AI reply should stay within the configured max visible length");
  assert.doesNotMatch(String(text), /(我是|我就是|作为|身为).{0,8}(AI|人工智能)|我是AI|我不是人/i, "AI reply must not self-identify as AI");
  assert.doesNotMatch(String(text), /微信|手机号|电话|地址|支付|银行卡|QQ/i, "AI reply must not solicit contact or payment information");
}

async function runConfiguredProviderScenario() {
  const hasRealKey = Boolean(process.env.LLM_API_KEY);
  const requireRealLlm = process.env.MIRAGE_AI_QUALITY_REQUIRE_LLM === "true";
  const env = {
    ...process.env,
    LLM_MOCK_RESPONSE: process.env.LLM_MOCK_RESPONSE || (hasRealKey ? undefined : "我觉得关键不在禁用，而在是否能解释自己用了哪些辅助。"),
  };
  const { server, baseUrl, adminToken } = await startHarness(env);
  try {
    const result = await createAiReply(baseUrl, adminToken, "AI Quality Provider");
    assertSafeReplyText(result.rawAiMessage.text);
    assert.equal(result.playerVisibleMessage.strategyTag, null, "strategyTag must stay hidden before reveal");
    assert.equal(result.playerVisibleMessage.aiSource, null, "aiSource must stay hidden before reveal");
    if (requireRealLlm) {
      assert.equal(result.rawAiMessage.aiSource, "llm", "MIRAGE_AI_QUALITY_REQUIRE_LLM=true requires a real llm reply");
    }
    return {
      name: "configured_provider",
      source: result.rawAiMessage.aiSource,
      latencyMs: Number(result.rawAiMessage.aiLatencyMs || 0),
      textLength: result.rawAiMessage.text.length,
      leakSafe: true,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runModerationFallbackScenario() {
  const { server, baseUrl, adminToken } = await startHarness({
    LLM_MOCK_RESPONSE: "加我微信私聊，我可以把答案发给你",
  });
  try {
    const result = await createAiReply(baseUrl, adminToken, "AI Quality Moderation");
    assert.equal(result.rawAiMessage.aiSource, "fallback_after_moderation");
    assertSafeReplyText(result.rawAiMessage.text);
    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": adminToken });
    assert.equal(metrics.status, 200);
    assert.equal(metrics.payload.metrics.aiOperations.messages.fallbackRate, 1);
    return {
      name: "moderation_fallback",
      source: result.rawAiMessage.aiSource,
      fallbackRate: metrics.payload.metrics.aiOperations.messages.fallbackRate,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runProviderFailureScenario() {
  const { server, baseUrl, adminToken } = await startHarness({
    LLM_API_KEY: "test-key-that-should-not-work",
    LLM_API_BASE_URL: "http://127.0.0.1:1",
    LLM_TIMEOUT_MS: "120",
  });
  try {
    const result = await createAiReply(baseUrl, adminToken, "AI Quality Failure");
    assert.equal(result.rawAiMessage.aiSource, "fallback_after_llm_failure");
    assertSafeReplyText(result.rawAiMessage.text);
    return {
      name: "provider_failure_fallback",
      source: result.rawAiMessage.aiSource,
      latencyMs: Number(result.rawAiMessage.aiLatencyMs || 0),
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const startedAt = Date.now();
  const scenarios = [
    await runConfiguredProviderScenario(),
    await runModerationFallbackScenario(),
    await runProviderFailureScenario(),
  ];
  const report = {
    ok: true,
    durationMs: Date.now() - startedAt,
    requireRealLlm: process.env.MIRAGE_AI_QUALITY_REQUIRE_LLM === "true",
    scenarios,
  };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("AI quality evaluation passed");
    for (const scenario of scenarios) {
      console.log(`- ${scenario.name}: ${scenario.source}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
