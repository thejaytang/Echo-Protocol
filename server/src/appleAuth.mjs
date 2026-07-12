import crypto from "node:crypto";

function decodeBase64Json(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

async function fetchAppleKeys(fetchImpl) {
  const response = await fetchImpl("https://appleid.apple.com/auth/keys");
  if (!response.ok) throw new Error("apple_keys_fetch_failed");
  return response.json();
}

export async function verifyAppleIdentityToken(identityToken, options = {}) {
  const { allowMock = false, fetchImpl = fetch, audience } = options;
  if (allowMock && identityToken?.startsWith("mock.apple.")) {
    return {
      appleSub: identityToken.replace("mock.apple.", ""),
      email: "mock@apple.local",
    };
  }

  const parts = String(identityToken || "").split(".");
  if (parts.length !== 3) throw new Error("invalid_apple_identity_token");
  const [headerRaw, payloadRaw, signatureRaw] = parts;
  const header = decodeBase64Json(headerRaw);
  const payload = decodeBase64Json(payloadRaw);
  if (payload.iss !== "https://appleid.apple.com") throw new Error("invalid_apple_issuer");
  if (audience && payload.aud !== audience) throw new Error("invalid_apple_audience");
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error("expired_apple_token");

  const keys = await fetchAppleKeys(fetchImpl);
  const jwk = keys.keys?.find((item) => item.kid === header.kid);
  if (!jwk) throw new Error("apple_key_not_found");

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerRaw}.${payloadRaw}`);
  verifier.end();
  const valid = verifier.verify(publicKey, Buffer.from(signatureRaw, "base64url"));
  if (!valid) throw new Error("invalid_apple_signature");

  return {
    appleSub: payload.sub,
    email: payload.email,
  };
}

function assertAppleClientEnv(env) {
  const required = ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_CLIENT_ID", "APPLE_PRIVATE_KEY"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`missing_apple_client_env:${missing.join(",")}`);
  }
}

function createAppleClientSecret(env, clock = Date) {
  assertAppleClientEnv(env);
  const now = Math.floor(clock.now() / 1000);
  const header = {
    alg: "ES256",
    kid: env.APPLE_KEY_ID,
  };
  const payload = {
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
    aud: "https://appleid.apple.com",
    sub: env.APPLE_CLIENT_ID,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKey = String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, "\n");
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function postAppleForm(fetchImpl, body) {
  const response = await fetchImpl("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || "apple_token_request_failed");
  }
  return json;
}

export async function exchangeAppleAuthorizationCode(authorizationCode, options = {}) {
  const { env = process.env, fetchImpl = fetch, allowMock = false, clock = Date } = options;
  if (!authorizationCode) return null;
  if (allowMock && String(authorizationCode).startsWith("mock.code.")) {
    return {
      refreshToken: `mock.refresh.${authorizationCode.slice("mock.code.".length)}`,
    };
  }
  const clientSecret = createAppleClientSecret(env, clock);
  const json = await postAppleForm(fetchImpl, {
    client_id: env.APPLE_CLIENT_ID,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });
  return {
    refreshToken: json.refresh_token || null,
  };
}

export async function revokeAppleRefreshToken(refreshToken, options = {}) {
  const { env = process.env, fetchImpl = fetch, allowMock = false, clock = Date } = options;
  if (!refreshToken) return { revoked: false, reason: "missing_refresh_token" };
  if (allowMock && String(refreshToken).startsWith("mock.refresh.")) {
    return { revoked: true };
  }
  const clientSecret = createAppleClientSecret(env, clock);
  const response = await fetchImpl("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error || "apple_revoke_failed");
  }
  return { revoked: true };
}
