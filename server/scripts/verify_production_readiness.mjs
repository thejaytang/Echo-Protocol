function placeholder(value) {
  return !value || /^replace-|^YOUR_|example\.com|your-domain/i.test(String(value));
}

function resolveBaseURL(env) {
  const raw = process.argv[2] || env.MIRAGE_PRODUCTION_BASE_URL || env.MIRAGE_PUBLIC_BASE_URL || env.MIRAGE_API_BASE_URL;
  if (placeholder(raw)) {
    throw new Error("MIRAGE_PRODUCTION_BASE_URL or CLI URL must be set to the deployed API origin");
  }
  const url = new URL(raw);
  const allowHttp = env.MIRAGE_VERIFY_ALLOW_HTTP === "true";
  const host = url.hostname.toLowerCase();
  if (!allowHttp && url.protocol !== "https:") {
    throw new Error("production readiness URL must use HTTPS");
  }
  if (!allowHttp && (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local"))) {
    throw new Error("production readiness URL must not point to localhost");
  }
  return url.origin;
}

async function request(baseURL, path, { headers = {}, json = true, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseURL}${path}`, {
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = json || contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(`${path} returned HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function expectHttpStatus(baseURL, path, expectedStatus, { headers = {}, method = "GET", body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    if (response.status !== expectedStatus) {
      throw new Error(`${path} returned HTTP ${response.status}, expected ${expectedStatus}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const env = process.env;
  const baseURL = resolveBaseURL(env);
  const expectedStore = env.MIRAGE_EXPECT_STORE || "postgres";
  const allowAiFallback = env.MIRAGE_VERIFY_ALLOW_AI_FALLBACK === "true";
  const allowMissingReportAlerts =
    env.MIRAGE_VERIFY_ALLOW_MISSING_REPORT_ALERTS === "true" || env.REPORT_ALERTS_DISABLED_IN_PRODUCTION === "true";

  const health = await request(baseURL, "/health");
  assert(health.ok === true, "/health must return ok=true");

  const ready = await request(baseURL, "/ready");
  assert(ready.ok === true, "/ready must return ok=true");
  assert(ready.store === expectedStore, `/ready store must be ${expectedStore}`);
  assert(ready.ai?.configured === true || (allowAiFallback && ready.ai?.fallbackEnabled === true), "/ready ai must be configured");
  assert(ready.reportAlerts?.configured === true || allowMissingReportAlerts, "/ready reportAlerts must be configured");

  for (const path of ["/legal/privacy", "/legal/terms", "/legal/community", "/support"]) {
    const text = await request(baseURL, path, { json: false });
    assert(String(text).includes("图灵迷局"), `${path} must return a 图灵迷局 page`);
  }

  const adminToken = env.MIRAGE_VERIFY_ADMIN_TOKEN || env.ADMIN_TOKEN;
  if (adminToken) {
    const metrics = await request(baseURL, "/admin/metrics", {
      headers: { "X-Admin-Token": adminToken },
    });
    assert(metrics.metrics?.reports, "/admin/metrics must return report metrics when admin token is provided");
  }

  const readonlyToken = env.MIRAGE_VERIFY_ADMIN_READONLY_TOKEN || env.ADMIN_READONLY_TOKEN;
  if (readonlyToken) {
    const readonlyHeaders = { "X-Admin-Token": readonlyToken };
    const session = await request(baseURL, "/admin/session", { headers: readonlyHeaders });
    assert(session.access === "read", "/admin/session must return read for the readonly admin token");
    const metrics = await request(baseURL, "/admin/metrics", { headers: readonlyHeaders });
    assert(metrics.metrics?.reports, "/admin/metrics must be readable with the readonly admin token");
    await expectHttpStatus(baseURL, "/admin/reports/batch", 403, {
      method: "POST",
      headers: { ...readonlyHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ reportIds: ["verify-readonly-noop"], status: "resolved" }),
    });
  }

  console.log(`production readiness verified: ${baseURL}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
