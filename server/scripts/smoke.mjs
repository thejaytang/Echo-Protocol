import assert from "node:assert/strict";
import { createHttpServer } from "../src/httpServer.mjs";

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
  return { response, payload };
}

async function main() {
  const adminToken = "smoke-admin-token-000000000000";
  const { server } = createHttpServer({
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "smoke-session-secret-000000000000000000",
      ADMIN_TOKEN: adminToken,
      AUTH_ALLOW_MOCK_APPLE: "true",
      LLM_MOCK_RESPONSE: "我认为可以有限度使用 AI，但提交前必须自己解释。",
    },
  });

  const baseUrl = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

  try {
    const health = await request(baseUrl, "GET", "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.ok, true);

    const ready = await request(baseUrl, "GET", "/ready");
    assert.equal(ready.response.status, 200);
    assert.equal(ready.payload.ok, true);

    const guest = await request(baseUrl, "POST", "/auth/guest", {
      nickname: "Smoke",
      ageConfirmed: true,
      communityConfirmed: true,
    });
    assert.equal(guest.response.status, 201);
    const token = guest.payload.token;

    const match = await request(baseUrl, "POST", "/matchmaking/start", { modeId: "M01" }, token);
    assert.equal(match.response.status, 201);
    const gameId = match.payload.game.id;

    const taskCard = await request(baseUrl, "POST", `/games/${gameId}/task-card`, null, token);
    assert.equal(taskCard.response.status, 200);

    const message = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我觉得可以用，但必须标注。" }, token);
    assert.equal(message.response.status, 201);
    assert.ok(message.payload.game.messages.some((item) => item.text.includes("有限度使用 AI")));

    await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, token);
    const finalStatement = await request(baseUrl, "POST", `/games/${gameId}/messages`, { text: "我的最终判断不变，AI 更像是隐藏发言者。" }, token);
    assert.equal(finalStatement.response.status, 201);
    assert.equal(finalStatement.payload.game.phase, "VOTING");
    const ai = message.payload.game.players.find((player) => player.kind === "unknown");
    const vote = await request(baseUrl, "POST", `/games/${gameId}/votes`, { targetPlayerId: ai.id }, token);
    assert.equal(vote.response.status, 200);
    assert.equal(vote.payload.game.phase, "REVEAL");

    const complete = await request(baseUrl, "POST", `/debug/games/${gameId}/advance`, { seconds: 1 }, token);
    assert.equal(complete.response.status, 200);
    assert.equal(complete.payload.game.phase, "COMPLETED");
    assert.ok(complete.payload.game.replay);

    const report = await request(
      baseUrl,
      "POST",
      "/reports",
      { gameId, messageId: complete.payload.game.messages[1].id, reason: "smoke_report" },
      token,
    );
    assert.equal(report.response.status, 201);

    const metrics = await request(baseUrl, "GET", "/admin/metrics", null, null, { "X-Admin-Token": adminToken });
    assert.equal(metrics.response.status, 200);
    assert.equal(metrics.payload.metrics.games.completed, 1);
    assert.equal(metrics.payload.metrics.reports.total, 1);

    for (const path of ["/legal/privacy", "/legal/terms", "/legal/community", "/support"]) {
      const page = await request(baseUrl, "GET", path);
      assert.equal(page.response.status, 200);
      assert.equal(typeof page.payload, "string");
      assert.ok(page.payload.includes("图灵迷局"));
    }

    console.log(`smoke passed: ${baseUrl}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
