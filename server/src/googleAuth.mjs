export async function verifyGoogleIdentityToken(identityToken, options = {}) {
  const { allowMock = false, audience, fetchImpl = fetch } = options;
  if (allowMock && identityToken?.startsWith("mock.google.")) {
    const mockSub = identityToken.replace("mock.google.", "");
    return {
      googleSub: mockSub,
      email: `${mockSub || "user"}@google.local`,
    };
  }

  if (!audience) throw new Error("missing_google_client_id");
  const response = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(identityToken || ""))}`);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || "invalid_google_identity_token");
  }
  if (json.aud !== audience) throw new Error("invalid_google_audience");
  if (json.iss !== "accounts.google.com" && json.iss !== "https://accounts.google.com") {
    throw new Error("invalid_google_issuer");
  }
  if (json.exp && Number(json.exp) < Math.floor(Date.now() / 1000)) {
    throw new Error("expired_google_token");
  }
  if (!json.sub) throw new Error("invalid_google_subject");
  return {
    googleSub: json.sub,
    email: json.email || null,
  };
}
