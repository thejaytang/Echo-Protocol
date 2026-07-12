export function adminPage() {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>图灵迷局 Admin</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f4efe6; color: #25282d; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 32px; }
    input, button, select { font: inherit; }
    input { padding: 10px 12px; border: 1px solid #d8d1c4; border-radius: 8px; min-width: 260px; }
    input.compact { min-width: 220px; }
    button { border: 0; border-radius: 8px; padding: 10px 14px; background: #ef9800; color: white; font-weight: 700; cursor: pointer; }
    button.secondary { background: #25282d; }
    button.danger { background: #c43824; }
    button:disabled { cursor: not-allowed; opacity: 0.48; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; }
    th, td { padding: 12px; border-bottom: 1px solid #eee8dd; text-align: left; font-size: 14px; vertical-align: top; }
    th { background: #25282d; color: white; }
    .muted { color: #777; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
    .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eee8dd; font-size: 12px; }
    .pill.write { background: #d9f0d3; color: #1f5a28; }
    .pill.read { background: #e7edf7; color: #234b78; }
    .pill.denied { background: #f8ddd8; color: #92301f; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .panel { margin-top: 22px; background: white; border: 1px solid #e5ded2; border-radius: 12px; padding: 18px; }
    .batch-panel { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 12px 0; }
    .metric-card { border: 1px solid #eee8dd; border-radius: 10px; padding: 12px; background: #fffaf2; }
    .metric-card span { display: block; color: #777; font-size: 12px; }
    .metric-card strong { display: block; margin-top: 6px; font-size: 22px; }
    .checkbox-cell { width: 32px; }
    .checkbox-cell input { min-width: auto; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f7f3ec; border-radius: 8px; padding: 12px; }
    .message { border-top: 1px solid #eee8dd; padding: 10px 0; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>图灵迷局 Admin</h1>
        <p class="muted">举报、房间和处理记录</p>
      </div>
      <div class="toolbar">
        <input id="token" placeholder="X-Admin-Token" />
        <span id="accessStatus" class="pill">未验证</span>
        <button id="load">加载举报</button>
        <button id="exportReports" class="secondary">导出 CSV</button>
        <button id="loadMetrics" class="secondary">加载指标</button>
        <button id="loadTrends" class="secondary">加载趋势</button>
        <button id="loadAudit" class="secondary">加载审计</button>
        <button id="loadRooms" class="secondary">加载房间</button>
        <button id="loadTopics" class="secondary">加载主题</button>
        <input id="gameId" class="compact" placeholder="Game ID" />
        <button id="lookupGame" class="secondary">查询对局</button>
      </div>
    </header>
    <section class="panel batch-panel">
      <div>
        <strong>批量处理</strong>
        <span class="muted">先查看上下文；确认违规后可批量标记处理或批量封禁目标。</span>
      </div>
      <div class="actions">
        <button id="selectOpen" class="secondary">选择 open 举报</button>
        <button id="bulkResolve" data-write-action>批量标记已处理</button>
        <button id="bulkBanTargets" class="danger" data-write-action>批量封禁目标</button>
      </div>
    </section>
    <section class="panel batch-panel">
      <div>
        <strong>举报筛选</strong>
        <span class="muted">按状态、原因、Game 或 Target 缩小运营队列。</span>
      </div>
      <div class="actions">
        <select id="reportStatusFilter" aria-label="举报状态">
          <option value="">全部状态</option>
          <option value="open">open</option>
          <option value="resolved">resolved</option>
        </select>
        <input id="reportReasonFilter" class="compact" placeholder="原因包含" />
        <input id="reportGameFilter" class="compact" placeholder="Game ID" />
        <input id="reportTargetFilter" class="compact" placeholder="Target User ID" />
        <button id="applyReportFilters" class="secondary">筛选举报</button>
        <button id="clearReportFilters" class="secondary">清空筛选</button>
      </div>
    </section>
    <table>
      <thead>
        <tr>
          <th class="checkbox-cell">选</th>
          <th>状态</th>
          <th>举报原因</th>
          <th>Game</th>
          <th>Message</th>
          <th>Reporter</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody id="rows">
        <tr><td colspan="7" class="muted">输入 admin token 后加载。</td></tr>
      </tbody>
    </table>
    <section id="context" class="panel" hidden>
      <h2>举报上下文</h2>
      <div id="contextBody"></div>
    </section>
    <section id="metrics" class="panel" hidden>
      <h2>运营指标</h2>
      <div id="metricsBody"></div>
    </section>
    <section id="trends" class="panel" hidden>
      <h2>长期趋势</h2>
      <div id="trendsBody"></div>
    </section>
    <section id="audit" class="panel" hidden>
      <h2>审计事件</h2>
      <div id="auditBody"></div>
    </section>
    <section id="rooms" class="panel" hidden>
      <h2>房间列表</h2>
      <div id="roomsBody"></div>
    </section>
    <section id="topics" class="panel" hidden>
      <h2>官方主题</h2>
      <div id="topicsBody"></div>
    </section>
    <section id="game" class="panel" hidden>
      <h2>对局详情</h2>
      <div id="gameBody"></div>
    </section>
  </main>
  <script>
    const tokenInput = document.querySelector("#token");
    const gameIdInput = document.querySelector("#gameId");
    const rows = document.querySelector("#rows");
    const reportStatusFilter = document.querySelector("#reportStatusFilter");
    const reportReasonFilter = document.querySelector("#reportReasonFilter");
    const reportGameFilter = document.querySelector("#reportGameFilter");
    const reportTargetFilter = document.querySelector("#reportTargetFilter");
    const contextPanel = document.querySelector("#context");
    const contextBody = document.querySelector("#contextBody");
    const metricsPanel = document.querySelector("#metrics");
    const metricsBody = document.querySelector("#metricsBody");
    const trendsPanel = document.querySelector("#trends");
    const trendsBody = document.querySelector("#trendsBody");
    const auditPanel = document.querySelector("#audit");
    const auditBody = document.querySelector("#auditBody");
    const roomsPanel = document.querySelector("#rooms");
    const roomsBody = document.querySelector("#roomsBody");
    const topicsPanel = document.querySelector("#topics");
    const topicsBody = document.querySelector("#topicsBody");
    const gamePanel = document.querySelector("#game");
    const gameBody = document.querySelector("#gameBody");
    const accessStatus = document.querySelector("#accessStatus");
    let adminAccessMode = null;
    tokenInput.value = sessionStorage.getItem("mirage-admin-token") || "";
    document.querySelector("#load").addEventListener("click", loadReports);
    document.querySelector("#exportReports").addEventListener("click", exportReportsCsv);
    document.querySelector("#loadMetrics").addEventListener("click", loadMetrics);
    document.querySelector("#loadTrends").addEventListener("click", loadTrends);
    document.querySelector("#loadAudit").addEventListener("click", loadAudit);
    document.querySelector("#loadRooms").addEventListener("click", loadRooms);
    document.querySelector("#loadTopics").addEventListener("click", loadTopics);
    document.querySelector("#lookupGame").addEventListener("click", lookupGame);
    document.querySelector("#selectOpen").addEventListener("click", selectOpenReports);
    document.querySelector("#bulkResolve").addEventListener("click", bulkResolveReports);
    document.querySelector("#bulkBanTargets").addEventListener("click", bulkBanReportTargets);
    document.querySelector("#applyReportFilters").addEventListener("click", loadReports);
    document.querySelector("#clearReportFilters").addEventListener("click", clearReportFilters);
    tokenInput.addEventListener("input", () => {
      adminAccessMode = null;
      renderAccessStatus();
    });

    function isReadOnly() {
      return adminAccessMode === "read";
    }

    function renderAccessStatus() {
      accessStatus.className = "pill";
      if (adminAccessMode === "write") {
        accessStatus.classList.add("write");
        accessStatus.textContent = "写入权限";
      } else if (adminAccessMode === "read") {
        accessStatus.classList.add("read");
        accessStatus.textContent = "只读模式";
      } else if (adminAccessMode === "denied") {
        accessStatus.classList.add("denied");
        accessStatus.textContent = "无权限";
      } else {
        accessStatus.textContent = "未验证";
      }
      document.querySelectorAll("[data-write-action]").forEach((element) => {
        element.disabled = adminAccessMode === "read";
        element.title = adminAccessMode === "read" ? "只读模式不可执行写操作" : "";
      });
    }

    async function refreshAccess() {
      try {
        const data = await api("/admin/session");
        adminAccessMode = data.access;
      } catch {
        adminAccessMode = "denied";
      }
      renderAccessStatus();
      return adminAccessMode;
    }

    async function api(path, options = {}) {
      const token = tokenInput.value.trim();
      sessionStorage.setItem("mirage-admin-token", token);
      const response = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
          ...(options.headers || {}),
        },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }

    function reportFilterQuery() {
      const params = new URLSearchParams();
      if (reportStatusFilter.value) params.set("status", reportStatusFilter.value);
      if (reportReasonFilter.value.trim()) params.set("reason", reportReasonFilter.value.trim());
      if (reportGameFilter.value.trim()) params.set("gameId", reportGameFilter.value.trim());
      if (reportTargetFilter.value.trim()) params.set("targetUserId", reportTargetFilter.value.trim());
      const query = params.toString();
      return query ? "?" + query : "";
    }

    function clearReportFilters() {
      reportStatusFilter.value = "";
      reportReasonFilter.value = "";
      reportGameFilter.value = "";
      reportTargetFilter.value = "";
      loadReports();
    }

    async function loadReports() {
      rows.innerHTML = '<tr><td colspan="7" class="muted">加载中...</td></tr>';
      try {
        await refreshAccess();
        const data = await api("/admin/reports" + reportFilterQuery());
        rows.innerHTML = data.reports.map(renderReport).join("") || '<tr><td colspan="7" class="muted">暂无举报。</td></tr>';
        renderAccessStatus();
      } catch (error) {
        rows.innerHTML = '<tr><td colspan="7">' + escapeHtml(error.message) + '</td></tr>';
      }
    }

    async function exportReportsCsv() {
      const token = tokenInput.value.trim();
      sessionStorage.setItem("mirage-admin-token", token);
      const response = await fetch("/admin/reports.csv" + reportFilterQuery(), {
        headers: { "X-Admin-Token": token },
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mirage-reports.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    async function loadMetrics() {
      metricsPanel.hidden = false;
      metricsBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        await refreshAccess();
        const data = await api("/admin/metrics");
        metricsBody.innerHTML = renderMetrics(data.metrics);
      } catch (error) {
        metricsBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    function renderMetrics(metrics) {
      const overdue = Number(metrics.reports?.overdueOpen || 0);
      const oldest = formatDuration(metrics.reports?.oldestOpenAgeSeconds || 0);
      const sla = formatDuration(metrics.reports?.slaSeconds || 0);
      return '<div class="metric-grid">' +
          renderMetricCard("Open 举报", metrics.reports?.open || 0) +
          renderMetricCard("超过 SLA", overdue) +
          renderMetricCard("最老等待", oldest) +
          renderMetricCard("AI 胜率", formatPercent(metrics.games?.aiWinRate)) +
          renderMetricCard("封禁用户", metrics.safety?.bannedUsers || 0) +
          renderMetricCard("告警失败", metrics.safety?.alertFailures || 0) +
          renderMetricCard("首局激活", formatPercent(metrics.funnel?.gameStartRate)) +
          renderMetricCard("复盘查看", formatPercent(metrics.funnel?.replayViewRate)) +
          renderMetricCard("复玩用户", metrics.retention?.repeatCompletedUsers || 0) +
          renderMetricCard("AI Fallback", formatPercent(metrics.aiOperations?.messages?.fallbackRate)) +
        '</div>' +
        (overdue > 0 ? '<p><strong>需要处理:</strong> 有举报超过 SLA。</p>' : '<p class="muted">当前没有超过 SLA 的 open 举报。</p>') +
        '<h3>产品漏斗</h3>' + renderFunnelStats(metrics.funnel || {}) +
        '<h3>留存 Proxy</h3>' + renderRetentionStats(metrics.retention || {}) +
        '<h3>经济系统</h3>' + renderEconomyStats(metrics.economy || {}) +
        '<h3>AI 运营</h3>' + renderAiOperations(metrics.aiOperations || {}) +
        '<h3>模式表现</h3>' + renderModeStats(metrics.modes || []) +
        '<h3>主题表现</h3>' + renderTopicStats(metrics.topics || []) +
        '<h3>Open 举报队列</h3>' + renderOpenReports(metrics.reports?.oldestOpen || []) +
        '<h3>举报原因</h3>' + renderReasonStats(metrics.reports?.byReason || []) +
        '<pre>' + escapeHtml(JSON.stringify(metrics, null, 2)) + '</pre>';
    }

    async function loadTrends() {
      trendsPanel.hidden = false;
      trendsBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        await refreshAccess();
        const data = await api("/admin/trends?days=14");
        trendsBody.innerHTML = renderTrendStats(data.trends);
      } catch (error) {
        trendsBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    function renderTrendStats(trends) {
      const totals = trends.totals || {};
      const days = Array.isArray(trends.days) ? trends.days : [];
      const rows = days.length
        ? days.map((day) => '<tr>' +
            '<td>' + escapeHtml(day.date) + '</td>' +
            '<td>' + escapeHtml(day.usersCreated) + '</td>' +
            '<td>' + escapeHtml(day.startedGames) + '</td>' +
            '<td>' + escapeHtml(day.completedGames) + '</td>' +
            '<td>' + escapeHtml(formatPercent(day.gameStartRate)) + '</td>' +
            '<td>' + escapeHtml(formatPercent(day.completionRate)) + '</td>' +
            '<td>' + escapeHtml(formatPercent(day.replayViewRate)) + '</td>' +
            '<td>' + escapeHtml(formatPercent(day.aiWinRate)) + '</td>' +
            '<td>' + escapeHtml(formatPercent(day.aiFallbackRate)) + '</td>' +
            '<td>' + escapeHtml(day.reports) + '</td>' +
            '<td>' + escapeHtml(day.bans) + '</td>' +
          '</tr>').join("")
        : '<tr><td colspan="11" class="muted">暂无趋势数据。</td></tr>';
      return '<p class="muted">窗口: ' + escapeHtml(trends.window?.startDate || "-") + ' 至 ' + escapeHtml(trends.window?.endDate || "-") + '</p>' +
        '<div class="metric-grid">' +
          renderMetricCard("新增账号", totals.usersCreated || 0) +
          renderMetricCard("开局", totals.startedGames || 0) +
          renderMetricCard("完赛", totals.completedGames || 0) +
          renderMetricCard("举报", totals.reports || 0) +
          renderMetricCard("封禁", totals.bans || 0) +
          renderMetricCard("AI 消息", totals.aiMessages || 0) +
          renderMetricCard("Token Proxy", totals.estimatedOutputTokens || 0) +
        '</div>' +
        '<table><thead><tr><th>日期</th><th>新增</th><th>开局</th><th>完赛</th><th>首局激活</th><th>完赛率</th><th>复盘率</th><th>AI 胜率</th><th>Fallback</th><th>举报</th><th>封禁</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<pre>' + escapeHtml(JSON.stringify(trends, null, 2)) + '</pre>';
    }

    function renderMetricCard(label, value) {
      return '<section class="metric-card"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></section>';
    }

    function formatPercent(value) {
      return value === null || value === undefined ? "-" : Math.round(Number(value) * 100) + "%";
    }

    function renderModeStats(modes) {
      if (!modes.length) return '<p class="muted">暂无模式数据。</p>';
      return '<table><thead><tr><th>模式</th><th>总局</th><th>完成</th><th>AI 胜率</th><th>举报</th></tr></thead><tbody>' +
        modes.map((mode) => '<tr>' +
          '<td>' + escapeHtml(mode.modeId + " · " + mode.name) + '</td>' +
          '<td>' + escapeHtml(mode.total) + '</td>' +
          '<td>' + escapeHtml(mode.completed) + '</td>' +
          '<td>' + escapeHtml(formatPercent(mode.aiWinRate)) + '</td>' +
          '<td>' + escapeHtml(mode.reports) + '</td>' +
        '</tr>').join("") +
      '</tbody></table>';
    }

    function renderFunnelStats(funnel) {
      return '<table><thead><tr><th>节点</th><th>用户数</th><th>转化</th></tr></thead><tbody>' +
        '<tr><td>活跃账号</td><td>' + escapeHtml(funnel.activeUsers || 0) + '</td><td>-</td></tr>' +
        '<tr><td>开始对局</td><td>' + escapeHtml(funnel.gameStarters || 0) + '</td><td>' + escapeHtml(formatPercent(funnel.gameStartRate)) + '</td></tr>' +
        '<tr><td>完成对局</td><td>' + escapeHtml(funnel.completedPlayers || 0) + '</td><td>' + escapeHtml(formatPercent(funnel.completionActivationRate)) + '</td></tr>' +
        '<tr><td>查看复盘</td><td>' + escapeHtml(funnel.replayViewers || 0) + '</td><td>' + escapeHtml(formatPercent(funnel.replayViewRate)) + '</td></tr>' +
        '<tr><td>创建好友房</td><td>' + escapeHtml(funnel.friendRoomCreators || 0) + '</td><td>' + escapeHtml(formatPercent(funnel.friendRoomCreatorRate)) + '</td></tr>' +
        '<tr><td>领取悬赏</td><td>' + escapeHtml(funnel.missionClaimers || 0) + '</td><td>-</td></tr>' +
        '<tr><td>解锁装扮</td><td>' + escapeHtml(funnel.cosmeticUnlockers || 0) + '</td><td>-</td></tr>' +
      '</tbody></table>';
    }

    function renderRetentionStats(retention) {
      return '<div class="metric-grid">' +
        renderMetricCard("完成用户", retention.completedPlayers || 0) +
        renderMetricCard("复玩用户", retention.repeatCompletedUsers || 0) +
        renderMetricCard("复玩率", formatPercent(retention.repeatCompletedRate)) +
        renderMetricCard("复盘查看率", formatPercent(retention.replayViewRate)) +
      '</div>';
    }

    function renderEconomyStats(economy) {
      const wallet = economy.wallet || {};
      const missionClaims = economy.missionClaims || {};
      const cosmetics = economy.cosmetics || {};
      const topItems = Array.isArray(cosmetics.topItems) ? cosmetics.topItems : [];
      const topItemRows = topItems.length
        ? topItems.map((item) => '<tr><td>' + escapeHtml(item.itemId) + '</td><td>' + escapeHtml(item.unlocks) + '</td></tr>').join("")
        : '<tr><td colspan="2" class="muted">暂无装扮解锁。</td></tr>';
      return '<div class="metric-grid">' +
          renderMetricCard("发放推理星", missionClaims.clueStarsGranted || 0) +
          renderMetricCard("消耗推理星", cosmetics.clueStarsSpent || 0) +
          renderMetricCard("当前推理星", wallet.clueStars || 0) +
          renderMetricCard("装扮解锁", cosmetics.unlocks || 0) +
        '</div>' +
        '<table><thead><tr><th>装扮</th><th>解锁次数</th></tr></thead><tbody>' + topItemRows + '</tbody></table>';
    }

    function renderAiOperations(aiOperations) {
      const messages = aiOperations.messages || {};
      const latency = aiOperations.latency || {};
      const costProxy = aiOperations.costProxy || {};
      const sourceRows = Array.isArray(messages.bySource) && messages.bySource.length
        ? messages.bySource.map((item) => '<tr><td>' + escapeHtml(item.source) + '</td><td>' + escapeHtml(item.count) + '</td></tr>').join("")
        : '<tr><td colspan="2" class="muted">暂无 AI 消息。</td></tr>';
      const tokensPerGame = costProxy.estimatedOutputTokensPerCompletedGame === null ||
        costProxy.estimatedOutputTokensPerCompletedGame === undefined
        ? "-"
        : Math.round(Number(costProxy.estimatedOutputTokensPerCompletedGame));
      return '<div class="metric-grid">' +
          renderMetricCard("AI 消息", messages.total || 0) +
          renderMetricCard("LLM 消息", messages.llm || 0) +
          renderMetricCard("Fallback", messages.fallback || 0) +
          renderMetricCard("Fallback Rate", formatPercent(messages.fallbackRate)) +
          renderMetricCard("平均延迟", latency.averageMs === null || latency.averageMs === undefined ? "-" : latency.averageMs + "ms") +
          renderMetricCard("Token 样本", costProxy.measuredMessages || 0) +
          renderMetricCard("Tokens / 完赛", tokensPerGame) +
        '</div>' +
        '<p class="muted">Token 为本地输出长度 proxy，用于估算成本趋势；生产环境仍应接入模型服务商账单或 usage 字段。</p>' +
        '<table><thead><tr><th>来源</th><th>消息数</th></tr></thead><tbody>' + sourceRows + '</tbody></table>';
    }

    function renderTopicStats(topics) {
      if (!topics.length) return '<p class="muted">暂无主题数据。</p>';
      return '<table><thead><tr><th>主题</th><th>状态</th><th>总局</th><th>AI 胜率</th><th>举报</th></tr></thead><tbody>' +
        topics.map((topic) => '<tr>' +
          '<td>' + escapeHtml(topic.title) + '<br /><span class="muted">' + escapeHtml(topic.topicId) + '</span></td>' +
          '<td><span class="pill">' + escapeHtml(topic.enabled ? "启用中" : "已停用") + '</span></td>' +
          '<td>' + escapeHtml(topic.total) + '</td>' +
          '<td>' + escapeHtml(formatPercent(topic.aiWinRate)) + '</td>' +
          '<td>' + escapeHtml(topic.reports) + '</td>' +
        '</tr>').join("") +
      '</tbody></table>';
    }

    function renderOpenReports(reports) {
      if (!reports.length) return '<p class="muted">暂无 open 举报。</p>';
      return '<table><thead><tr><th>Report</th><th>原因</th><th>等待</th><th>Game</th><th>Target</th></tr></thead><tbody>' +
        reports.map((report) => '<tr>' +
          '<td>' + escapeHtml(report.id) + '</td>' +
          '<td>' + escapeHtml(report.reason) + '</td>' +
          '<td>' + escapeHtml(formatDuration(report.ageSeconds)) + '</td>' +
          '<td>' + escapeHtml(report.gameId || "-") + '</td>' +
          '<td>' + escapeHtml(report.targetUserId || "-") + '</td>' +
        '</tr>').join("") +
      '</tbody></table>';
    }

    function renderReasonStats(reasons) {
      if (!reasons.length) return '<p class="muted">暂无举报原因。</p>';
      return '<div class="actions">' + reasons.map((item) =>
        '<span class="pill">' + escapeHtml(item.reason) + ': ' + escapeHtml(item.count) + '</span>'
      ).join("") + '</div>';
    }

    function formatDuration(seconds) {
      const value = Number(seconds || 0);
      if (value < 60) return value + "s";
      if (value < 3600) return Math.floor(value / 60) + "m";
      return Math.floor(value / 3600) + "h " + Math.floor((value % 3600) / 60) + "m";
    }

    async function loadAudit() {
      auditPanel.hidden = false;
      auditBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        await refreshAccess();
        const data = await api("/admin/audit?limit=80");
        auditBody.innerHTML = renderAudit(data.events);
      } catch (error) {
        auditBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    function renderAudit(events) {
      if (!events.length) return '<p class="muted">暂无审计事件。</p>';
      return '<table><thead><tr><th>时间</th><th>类型</th><th>Payload</th></tr></thead><tbody>' +
        events.map((event) => '<tr>' +
          '<td>' + escapeHtml(event.createdAt) + '</td>' +
          '<td><span class="pill">' + escapeHtml(event.type) + '</span></td>' +
          '<td><pre>' + escapeHtml(JSON.stringify(event.payload, null, 2)) + '</pre></td>' +
        '</tr>').join("") +
      '</tbody></table>';
    }

    async function loadRooms() {
      roomsPanel.hidden = false;
      roomsBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        await refreshAccess();
        const data = await api("/admin/rooms");
        roomsBody.innerHTML = renderRooms(data.rooms);
      } catch (error) {
        roomsBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    async function lookupGame() {
      const gameId = gameIdInput.value.trim();
      gamePanel.hidden = false;
      if (!gameId) {
        gameBody.innerHTML = '<p class="muted">请输入 Game ID。</p>';
        return;
      }
      gameBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        await refreshAccess();
        const data = await api("/admin/games/" + encodeURIComponent(gameId));
        gameBody.innerHTML = '<pre>' + escapeHtml(JSON.stringify(data.game, null, 2)) + '</pre>';
      } catch (error) {
        gameBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    function renderRooms(rooms) {
      if (!rooms.length) return '<p class="muted">暂无房间。</p>';
      return '<table><thead><tr><th>Room</th><th>邀请码</th><th>模式</th><th>状态</th><th>人数</th><th>Game</th></tr></thead><tbody>' +
        rooms.map((room) => '<tr>' +
          '<td>' + escapeHtml(room.id) + '</td>' +
          '<td>' + escapeHtml(room.inviteCode) + '</td>' +
          '<td>' + escapeHtml(room.modeId) + '</td>' +
          '<td><span class="pill">' + escapeHtml(room.status) + '</span></td>' +
          '<td>' + escapeHtml(room.players.length) + '</td>' +
          '<td>' + escapeHtml(room.gameId || "-") + '</td>' +
        '</tr>').join("") +
      '</tbody></table>';
    }

    async function loadTopics() {
      topicsPanel.hidden = false;
      topicsBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        await refreshAccess();
        const data = await api("/admin/topics");
        topicsBody.innerHTML = renderTopics(data.topics);
        renderAccessStatus();
      } catch (error) {
        topicsBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    function renderTopics(topics) {
      if (!topics.length) return '<p class="muted">暂无主题。</p>';
      return '<table><thead><tr><th>主题</th><th>分类</th><th>模式</th><th>风险</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        topics.map((topic) => '<tr>' +
          '<td>' + escapeHtml(topic.title) + '<br /><span class="muted">' + escapeHtml(topic.id) + '</span></td>' +
          '<td>' + escapeHtml(topic.category || "-") + '</td>' +
          '<td>' + escapeHtml((topic.modeIds || []).join(", ") || "全模式") + '</td>' +
          '<td><span class="pill">' + escapeHtml(topic.risk || "medium") + '</span></td>' +
          '<td><span class="pill">' + escapeHtml(topic.enabled === false ? "已停用" : "启用中") + '</span></td>' +
          '<td><button class="' + (topic.enabled === false ? "secondary" : "danger") + '" data-write-action data-topic-id="' + escapeHtml(topic.id) + '" data-topic-enabled="' + (topic.enabled === false ? "true" : "false") + '"' + (isReadOnly() ? " disabled" : "") + '>' + escapeHtml(topic.enabled === false ? "启用" : "停用") + '</button></td>' +
        '</tr>').join("") +
      '</tbody></table><p class="muted">停用主题会立刻从玩家开局选择中隐藏；系统会阻止把某个模式的主题全部停用。</p>';
    }

    function renderReport(report) {
      return '<tr>' +
        '<td class="checkbox-cell"><input type="checkbox" class="report-select" data-report-id="' + escapeHtml(report.id) + '" data-report-status="' + escapeHtml(report.status) + '"' + (isReadOnly() ? " disabled" : "") + ' /></td>' +
        '<td><span class="pill">' + escapeHtml(report.status) + '</span></td>' +
        '<td>' + escapeHtml(report.reason) + '</td>' +
        '<td>' + escapeHtml(report.gameId || "-") + '</td>' +
        '<td>' + escapeHtml(report.messageId || "-") + '</td>' +
        '<td>' + escapeHtml(report.reporterUserId) + '</td>' +
        '<td><div class="actions">' +
          '<button class="secondary" data-context-id="' + report.id + '">查看上下文</button>' +
          '<button data-write-action data-resolve-id="' + report.id + '"' + (isReadOnly() ? " disabled" : "") + '>标记已处理</button>' +
          '<button class="danger" data-write-action data-ban-id="' + report.id + '"' + (isReadOnly() ? " disabled" : "") + '>封禁目标</button>' +
        '</div></td>' +
      '</tr>';
    }

    function selectedReportIds() {
      return Array.from(document.querySelectorAll(".report-select:checked")).map((input) => input.dataset.reportId);
    }

    function selectOpenReports() {
      document.querySelectorAll(".report-select").forEach((input) => {
        input.checked = input.dataset.reportStatus === "open";
      });
    }

    async function bulkResolveReports() {
      if (isReadOnly()) {
        rows.insertAdjacentHTML("beforebegin", '<p class="muted">只读模式不可批量处理举报。</p>');
        return;
      }
      const reportIds = selectedReportIds();
      if (!reportIds.length) {
        rows.insertAdjacentHTML("beforebegin", '<p class="muted">请先选择要处理的举报。</p>');
        return;
      }
      await api("/admin/reports/batch", {
        method: "POST",
        body: JSON.stringify({ reportIds, status: "resolved", action: "reviewed" }),
      });
      await loadReports();
      await loadMetrics();
    }

    async function bulkBanReportTargets() {
      if (isReadOnly()) {
        rows.insertAdjacentHTML("beforebegin", '<p class="muted">只读模式不可批量封禁目标。</p>');
        return;
      }
      const reportIds = selectedReportIds();
      if (!reportIds.length) {
        rows.insertAdjacentHTML("beforebegin", '<p class="muted">请先选择要封禁目标的举报。</p>');
        return;
      }
      await api("/admin/reports/batch-ban-targets", {
        method: "POST",
        body: JSON.stringify({ reportIds, reason: "batch_report_confirmed" }),
      });
      await loadReports();
      await loadMetrics();
    }

    rows.addEventListener("click", async (event) => {
      const contextButton = event.target.closest("button[data-context-id]");
      if (contextButton) {
        await loadContext(contextButton.dataset.contextId);
        return;
      }
      const resolveButton = event.target.closest("button[data-resolve-id]");
      if (resolveButton) {
        if (isReadOnly()) return;
        await api("/admin/reports/" + resolveButton.dataset.resolveId, {
          method: "PATCH",
          body: JSON.stringify({ status: "resolved", action: "reviewed" }),
        });
        await loadReports();
        return;
      }
      const banButton = event.target.closest("button[data-ban-id]");
      if (!banButton) return;
      if (isReadOnly()) return;
      await api("/admin/reports/" + banButton.dataset.banId + "/ban-target", {
        method: "POST",
        body: JSON.stringify({ reason: "report_confirmed" }),
      });
      await loadReports();
    });

    topicsBody.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-topic-id]");
      if (!button) return;
      if (isReadOnly()) return;
      await api("/admin/topics/" + encodeURIComponent(button.dataset.topicId), {
        method: "PATCH",
        body: JSON.stringify({ enabled: button.dataset.topicEnabled === "true" }),
      });
      await loadTopics();
    });

    async function loadContext(reportId) {
      contextPanel.hidden = false;
      contextBody.innerHTML = '<p class="muted">加载中...</p>';
      try {
        const data = await api("/admin/reports/" + reportId + "/context");
        const players = data.game?.players || [];
        contextBody.innerHTML =
          '<p><strong>Report:</strong> ' + escapeHtml(data.report.id) + '</p>' +
          '<p><strong>Target:</strong> ' + escapeHtml(data.target ? data.target.nickname + " / " + data.target.id : "-") + '</p>' +
          '<p><strong>Game:</strong> ' + escapeHtml(data.game ? data.game.modeId + " / " + data.game.phase : "-") + '</p>' +
          '<h3>Players</h3>' +
          '<pre>' + escapeHtml(players.map((player) => player.nickname + " | " + player.kind + " | " + player.role + " | " + (player.userId || "-")).join("\\n")) + '</pre>' +
          '<h3>Messages</h3>' +
          data.messages.map((message) => {
            const sender = players.find((player) => player.id === message.senderPlayerId);
            return '<div class="message"><strong>' + escapeHtml(sender?.nickname || message.senderKind) + '</strong><br />' + escapeHtml(message.text) + '</div>';
          }).join("");
      } catch (error) {
        contextBody.innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char]));
    }
  </script>
</body>
</html>`;
}
