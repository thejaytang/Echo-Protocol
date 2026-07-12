# 图灵迷局 Operations Runbook

本文档是 Agent 3 Engineering、Agent 5 QA 和 Agent 1 PM 的生产运营手册。它补充 `docs/DEPLOYMENT.md`，用于 TestFlight、App Store review 和首发后的日常巡检、举报处理、事故响应、备份恢复和回滚。

## Operating Principles

1. 玩家安全优先于局数、留存和商业化。
2. 任何会影响身份隐藏、投票公平、举报处理、账号删除或登录恢复的异常都按高优先级处理。
3. Admin 写操作只允许使用 `ADMIN_TOKEN`；只读巡检优先使用 `ADMIN_READONLY_TOKEN`。
4. 不把 `X-Admin-Token` 保存到长期浏览器存储；后台页面只允许 session 级保存。
5. 所有生产变更前先跑 `node scripts/release_gate.mjs`；涉及真实配置时再跑 `RELEASE_STRICT=1 node scripts/release_gate.mjs`。

## Daily Checks

每日值班至少检查一次:

| 检查项 | 命令或入口 | 通过标准 |
|---|---|---|
| API health | `GET /health` | `ok=true` |
| Readiness | `GET /ready` | `store=postgres`，AI configured 或有明确 fallback，reportAlerts configured |
| Admin metrics | `GET /admin/metrics` | active/completed games、AI win rate、report SLA、fallback rate 无异常跳变 |
| Admin trends | `GET /admin/trends?days=14` | 开局、完赛、复盘、举报、封禁和 AI fallback 日趋势没有异常跳变 |
| Open 举报队列 | `/admin` 或 `/admin/reports?status=open` | 无超过 `REPORT_SLA_SECONDS` 的 open 举报 |
| Report alert | `/admin/audit` | 没有连续 `report.alert.failed` |
| AI 运营 | `/admin/metrics` | fallback rate、平均 latency、output-token proxy 在预期范围内 |
| 主题和模式 | `/admin/topics` | 没有误停用所有可用主题 |

## Report Moderation Flow

举报处理必须在 `REPORT_SLA_SECONDS` 内完成:

1. 打开 `/admin`，用 `ADMIN_TOKEN` 登录。
2. 用举报筛选查看 open 举报队列、特定原因、特定 Game 或 Target，并优先处理超过 SLA 的举报。
3. 对单条举报打开 `/admin/reports/:reportId/context`，查看 game、room、reporter、target 和附近消息上下文。
4. 选择处理:
   - 无违规: 标记 `resolved/reviewed`。
   - 轻度扰局: 标记 `resolved/warned`，必要时保留审计。
   - 明确骚扰、威胁、自伤风险、诈骗或隐私泄露: 使用 ban target，并记录原因。
5. 需要批量处理无账号处罚的举报时使用 `/admin/reports/batch`。
6. 对已经逐条查看上下文且结论一致的明确违规举报，可以使用 `/admin/reports/batch-ban-targets` 批量封禁目标；不要对未查看上下文的举报批量封禁。
7. 对自伤风险和暴力威胁，按真实运营渠道升级，不只依赖游戏内封禁。

## Incident Severity

| Severity | 条件 | 立即动作 |
|---|---|---|
| SEV-1 | 身份/隐藏任务提前泄露、投票结算错误、账号删除失败、举报后台不可用、生产登录全量失败 | 暂停发布或回滚；关闭风险模式/主题；通知 PM 和 QA；保留日志 |
| SEV-2 | AI fallback rate 急升、部分模式匹配失败、举报告警失败、PostgreSQL 延迟或错误升高 | 切换降级策略；减少高成本模式；修复后跑 `npm run verify:production` |
| SEV-3 | 单个主题配置错误、UI 文案错漏、个别举报处理延迟但未超 SLA | 修复配置或排队处理；记录到复盘 |

## AI Fallback Response

当 `/ready` 显示 AI provider 不可用、`/admin/metrics` 显示 fallback rate 异常升高，或 `npm run ai:quality` 失败:

1. 确认 `LLM_API_KEY`、`LLM_API_BASE_URL`、`LLM_MODEL` 和 `LLM_TIMEOUT_MS`。
2. 保持 scripted fallback 开启，不能让 AI provider 失败阻塞游戏阶段。
3. 检查 `report.alert.failed` 和 moderation block 是否同时升高，排除输出安全问题。
4. 真实 provider 恢复后运行:

```bash
cd server
MIRAGE_AI_QUALITY_REQUIRE_LLM=true LLM_API_KEY=replace-with-llm-api-key npm run ai:quality
```

5. 通过后再恢复常规流量或扩量。

## Backup And Restore

生产恢复只允许使用 **PostgreSQL** runtime snapshot 流程:

```bash
cd server
MIRAGE_BACKUP_PATH=backups/mirage-state.json npm run backup:postgres
```

恢复前必须先暂停写流量或进入维护窗口:

```bash
cd server
MIRAGE_BACKUP_PATH=backups/mirage-state.json npm run restore:postgres
```

恢复后必须执行:

```bash
cd server
MIRAGE_PRODUCTION_BASE_URL=https://api.your-domain.com \
MIRAGE_VERIFY_ADMIN_TOKEN=$ADMIN_TOKEN \
MIRAGE_VERIFY_ADMIN_READONLY_TOKEN=$ADMIN_READONLY_TOKEN \
npm run verify:production
```

如果 `/ready`、`/admin/metrics`、举报队列或最近未完成局异常，不要重新开放流量。

## Rollback

需要回滚时:

1. 确认回滚目标版本的 Docker image、环境变量和数据库 schema 兼容。
2. 回滚前导出 `backup:postgres`。
3. 先回滚 API，再验证 `/health`、`/ready`、`/legal/privacy`、`/support` 和 `/admin/metrics`。
4. 如果回滚涉及客户端 API contract，暂停 TestFlight 分发，避免新版客户端打到旧 API。
5. 回滚完成后记录原因、影响范围、用户可见症状、恢复时间和补救测试。

## Launch Day Checklist

首发当天按顺序执行:

1. `npm test`
2. `npm run balance`
3. `npm run ai:quality`
4. `npm run stress`
5. `node scripts/release_gate.mjs`
6. `RELEASE_STRICT=1 node scripts/release_gate.mjs`
7. `npm run migrate:postgres`
8. `npm run verify:production`
9. TestFlight 真机 smoke: 固定账号登录、M01、M02、好友房、举报、账号删除。
10. 确认 `REPORT_ALERT_WEBHOOK_URL` 告警接收端有人值守。
11. 确认 App Store metadata、privacy answers、support URL 和 review notes 与当前版本一致。

## Ownership

| Area | Primary | Backup |
|---|---|---|
| 发布判断、scope、App Review 沟通 | Agent 1 PM | Agent 5 QA |
| 玩法公平、模式开关、主题风险 | Agent 2 Game Design | Agent 1 PM |
| API、数据库、部署、回滚、AI provider | Agent 3 Engineering | Agent 5 QA |
| 玩家可见文案、截图、局内/局后体验 | Agent 4 UI/UX | Agent 1 PM |
| 自动化测试、release gate、TestFlight 验收 | Agent 5 QA | Agent 3 Engineering |
| 权益预告、IAP 前置检查、公平商业化 | Agent 6 Commercialization | Agent 1 PM |
