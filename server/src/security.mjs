const defaultAllowedMethods = "GET, POST, PATCH, DELETE, OPTIONS";
const defaultAllowedHeaders = "Authorization, Content-Type, X-Admin-Token";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPlaceholder(value) {
  return !value || /^replace-|^YOUR_|^your-|example\.com|your-domain/i.test(String(value));
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

export function validateProductionEnv(env) {
  if (env.NODE_ENV !== "production" || env.MIRAGE_SKIP_PRODUCTION_VALIDATION === "true") {
    return;
  }
  const failures = [];
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.includes("dev-session")) {
    failures.push("SESSION_SECRET must be at least 32 characters and not the dev default");
  }
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24 || isPlaceholder(env.ADMIN_TOKEN)) {
    failures.push("ADMIN_TOKEN must be set to a strong token");
  }
  if (env.ADMIN_READONLY_TOKEN) {
    if (env.ADMIN_READONLY_TOKEN.length < 24 || isPlaceholder(env.ADMIN_READONLY_TOKEN)) {
      failures.push("ADMIN_READONLY_TOKEN must be strong when configured");
    }
    if (env.ADMIN_READONLY_TOKEN === env.ADMIN_TOKEN) {
      failures.push("ADMIN_READONLY_TOKEN must be different from ADMIN_TOKEN");
    }
  }
  for (const key of ["APPLE_BUNDLE_ID", "APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]) {
    if (isPlaceholder(env[key])) failures.push(`${key} must be configured for Sign in with Apple`);
  }
  if (env.AUTH_ALLOW_MOCK_APPLE === "true") {
    failures.push("AUTH_ALLOW_MOCK_APPLE must be false in production");
  }
  if (isPlaceholder(env.GOOGLE_CLIENT_ID)) {
    failures.push("GOOGLE_CLIENT_ID must be configured for Google Sign-In");
  }
  if (env.AUTH_ALLOW_MOCK_GOOGLE === "true") {
    failures.push("AUTH_ALLOW_MOCK_GOOGLE must be false in production");
  }
  if (isPlaceholder(env.WECHAT_APP_ID)) {
    failures.push("WECHAT_APP_ID must be configured for WeChat login");
  }
  if (isPlaceholder(env.WECHAT_APP_SECRET)) {
    failures.push("WECHAT_APP_SECRET must be configured for WeChat login");
  }
  if (env.AUTH_ALLOW_MOCK_WECHAT === "true") {
    failures.push("AUTH_ALLOW_MOCK_WECHAT must be false in production");
  }
  if (isPlaceholder(env.LLM_API_KEY) && env.LLM_ALLOW_SCRIPTED_FALLBACK_IN_PRODUCTION !== "true") {
    failures.push("LLM_API_KEY must be configured, or explicitly set LLM_ALLOW_SCRIPTED_FALLBACK_IN_PRODUCTION=true");
  }
  if (!env.CORS_ALLOWED_ORIGINS) {
    failures.push("CORS_ALLOWED_ORIGINS must be set in production");
  }
  if (env.RATE_LIMIT_DISABLED === "true") {
    failures.push("RATE_LIMIT_DISABLED must not be true in production");
  }
  if (isPlaceholder(env.MIRAGE_PUBLIC_BASE_URL) || !isHttpsUrl(env.MIRAGE_PUBLIC_BASE_URL)) {
    failures.push("MIRAGE_PUBLIC_BASE_URL must be set to a production HTTPS URL");
  }
  if (isPlaceholder(env.MIRAGE_SUPPORT_EMAIL) || !isEmail(env.MIRAGE_SUPPORT_EMAIL)) {
    failures.push("MIRAGE_SUPPORT_EMAIL must be set to a real support email");
  }
  if (env.MIRAGE_SUPPORT_URL && (isPlaceholder(env.MIRAGE_SUPPORT_URL) || !isHttpsUrl(env.MIRAGE_SUPPORT_URL))) {
    failures.push("MIRAGE_SUPPORT_URL must be a production HTTPS URL when set");
  }
  if (env.REPORT_ALERT_WEBHOOK_URL) {
    if (isPlaceholder(env.REPORT_ALERT_WEBHOOK_URL) || !isHttpsUrl(env.REPORT_ALERT_WEBHOOK_URL)) {
      failures.push("REPORT_ALERT_WEBHOOK_URL must be a production HTTPS URL when set");
    }
  } else if (env.REPORT_ALERTS_DISABLED_IN_PRODUCTION !== "true") {
    failures.push("REPORT_ALERT_WEBHOOK_URL must be set, or explicitly set REPORT_ALERTS_DISABLED_IN_PRODUCTION=true");
  }
  const store = env.MIRAGE_STORE || "json";
  if (store === "postgres") {
    if (isPlaceholder(env.MIRAGE_POSTGRES_URL || env.DATABASE_URL)) {
      failures.push("MIRAGE_POSTGRES_URL or DATABASE_URL must be set when MIRAGE_STORE=postgres");
    }
  } else if (store === "sqlite") {
    if (env.MIRAGE_ALLOW_SINGLE_INSTANCE_SQLITE_IN_PRODUCTION !== "true") {
      failures.push("MIRAGE_ALLOW_SINGLE_INSTANCE_SQLITE_IN_PRODUCTION=true is required when MIRAGE_STORE=sqlite in production");
    }
    if (isPlaceholder(env.MIRAGE_SQLITE_PATH)) {
      failures.push("MIRAGE_SQLITE_PATH must be set when MIRAGE_STORE=sqlite in production");
    }
  } else {
    failures.push("MIRAGE_STORE must be postgres in production unless sqlite is explicitly allowed for single-instance deployment");
  }
  if (failures.length) {
    throw Object.assign(new Error(`production_env_invalid:${failures.join("; ")}`), { status: 500 });
  }
}

export function requestLimitBytes(env) {
  return Number(env.REQUEST_BODY_LIMIT_BYTES || 32 * 1024);
}

export function corsHeaders(req, env) {
  const origin = req.headers.origin;
  const allowedOrigins = splitCsv(env.CORS_ALLOWED_ORIGINS);
  const dev = env.NODE_ENV !== "production";
  const headers = {
    "Access-Control-Allow-Headers": defaultAllowedHeaders,
    "Access-Control-Allow-Methods": defaultAllowedMethods,
  };
  if (dev && !allowedOrigins.length) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function securityHeaders({ html = false, env = {} } = {}) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };
  if (env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = `max-age=${Number(env.HSTS_MAX_AGE_SECONDS || 31_536_000)}`;
  }
  if (html) {
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join("; ");
  }
  return headers;
}
