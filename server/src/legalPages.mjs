function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function legalConfig(env = {}) {
  const publicBaseUrl = String(env.MIRAGE_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  return {
    lastUpdated: env.MIRAGE_LEGAL_LAST_UPDATED || "2026-06-09",
    legalName: env.MIRAGE_LEGAL_NAME || "图灵迷局",
    supportEmail: env.MIRAGE_SUPPORT_EMAIL || "support@mirage.local",
    supportUrl: env.MIRAGE_SUPPORT_URL || (publicBaseUrl ? `${publicBaseUrl}/support` : "/support"),
  };
}

function shell({ title, body, env }) {
  const config = legalConfig(env);
  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - 图灵迷局</title>
  <style>
    body { margin: 0; background: #f4efe6; color: #25282d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.65; }
    main { max-width: 780px; margin: 0 auto; padding: 36px 20px 56px; }
    h1 { font-size: 34px; line-height: 1.15; margin: 0 0 10px; }
    h2 { margin-top: 30px; }
    p, li { font-size: 16px; }
    a { color: #0b7790; }
    .meta { color: #706b62; margin-bottom: 28px; }
    .card { background: white; border-radius: 12px; padding: 22px; border: 1px solid #e5ded2; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p class="meta">Last updated: ${escapeHtml(config.lastUpdated)}</p>
    <section class="card">${body}</section>
  </main>
</body>
</html>`;
}

export function privacyPage(env) {
  const config = legalConfig(env);
  return shell({
    title: "隐私政策",
    env,
    body: `
      <p>${escapeHtml(config.legalName)} 是一款 AI 社交推理游戏。我们只收集运行游戏、安全处理和账号恢复所需的数据。</p>
      <h2>我们收集的数据</h2>
      <ul>
        <li>账号信息: Apple / 微信 / Google 登录标识、昵称、头像 key。服务端自动化测试和审核演示接口可能生成 guest id，但不作为玩家入口。</li>
        <li>游戏数据: 房间、身份、消息、投票、举报、复盘和基础事件日志。</li>
        <li>安全数据: 举报原因、处理状态、拉黑关系和违规拦截记录。</li>
      </ul>
      <h2>我们如何使用数据</h2>
      <ul>
        <li>创建和恢复账号。</li>
        <li>运行游戏状态机、投票、揭晓和复盘。</li>
        <li>处理举报、拉黑、账号删除和安全审核。</li>
        <li>分析完成率、复盘查看率、AI 胜率和举报率。</li>
      </ul>
      <h2>账号删除</h2>
      <p>用户可以在 App 设置中删除账号。删除后，账号资料会被匿名化，未开始房间和匹配队列会移除该用户，历史对局中的玩家昵称会显示为已删除用户。运营记录只保留安全和合规所需的最小记录。</p>
      <h2>联系我们</h2>
      <p>支持入口: <a href="${escapeHtml(config.supportUrl)}">${escapeHtml(config.supportUrl)}</a></p>
    `,
  });
}

export function termsPage(env) {
  const config = legalConfig(env);
  return shell({
    title: "服务条款",
    env,
    body: `
      <p>使用 ${escapeHtml(config.legalName)} 即表示你同意按照游戏规则参与限时 AI 社交推理房间。</p>
      <h2>基本规则</h2>
      <ul>
        <li>每局可能包含 AI 玩家，局后会揭晓身份和任务。</li>
        <li>不得骚扰、欺骗、发布广告、索要联系方式或分享个人敏感信息。</li>
        <li>不得尝试绕过安全系统、爬取服务或干扰其他玩家。</li>
      </ul>
      <h2>内容处理</h2>
      <p>我们可以拦截违规消息，处理举报，限制、暂停或删除违规账号。</p>
      <h2>服务变化</h2>
      <p>我们会根据对局体验和安全反馈调整模式、话题、AI 行为和线索形式。</p>
    `,
  });
}

export function communityPage(env) {
  return shell({
    title: "社区规范",
    env,
    body: `
      <p>图灵迷局的聊天是游戏内讨论，不是开放式陌生人聊天室。</p>
      <h2>禁止行为</h2>
      <ul>
        <li>分享电话、住址、学校、支付信息、邮箱或其他个人敏感信息。</li>
        <li>骚扰、辱骂、暴力威胁、自伤表达、仇恨、成人内容、广告或诈骗。</li>
        <li>诱导玩家离开游戏到外部平台继续联系。</li>
      </ul>
      <h2>遇到问题</h2>
      <p>可以在每局结束后的玩家入口提交举报，并可拉黑用户。举报会关联房间、对局、玩家和消息上下文，运营可追溯处理。</p>
    `,
  });
}

export function supportPage(env) {
  const config = legalConfig(env);
  return shell({
    title: "支持与反馈",
    env,
    body: `
      <p>如果你遇到账号、举报、删除账号、游戏异常或安全问题，请通过以下方式联系支持。</p>
      <ul>
        <li>Email: <a href="mailto:${escapeHtml(config.supportEmail)}">${escapeHtml(config.supportEmail)}</a></li>
        <li>Support URL: <a href="${escapeHtml(config.supportUrl)}">${escapeHtml(config.supportUrl)}</a></li>
        <li>请提供你的昵称、发生时间、房间邀请码或 game id。</li>
      </ul>
    `,
  });
}
