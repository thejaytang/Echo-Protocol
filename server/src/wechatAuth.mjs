export async function verifyWeChatLoginCode(code, options = {}) {
  const { allowMock = false, appId, appSecret, fetchImpl = fetch } = options;
  if (allowMock && code?.startsWith("mock.wechat.")) {
    const mockSub = code.replace("mock.wechat.", "");
    return {
      wechatSub: mockSub,
      unionId: `union-${mockSub}`,
      nickname: null,
    };
  }

  if (!appId) throw new Error("missing_wechat_app_id");
  if (!appSecret) throw new Error("missing_wechat_app_secret");
  if (!code) throw new Error("missing_wechat_code");

  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetchImpl(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.errcode) {
    throw new Error(json.errmsg || json.error || "invalid_wechat_code");
  }
  if (!json.openid) throw new Error("invalid_wechat_openid");

  return {
    wechatSub: json.unionid || json.openid,
    unionId: json.unionid || null,
    openId: json.openid,
    nickname: null,
  };
}
