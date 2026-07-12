# 图灵迷局 Code And Function Review

本文档是当前仓库的代码审查和功能审查结论。它不替代 TestFlight 真机验收，也不把外部配置项视为已完成；它用于回答“除用户必须手动配置和真实环境事项外，当前 demo 是否已具备上线准备闭环”。

## Review Verdict

本地代码和功能审查结论: **Pass with external release blockers**。

本地自动化和静态门禁证明核心游戏、Web 预览、iOS 源码结构、后端、安全、运营、玩法平衡和发布材料已经形成闭环。仍未 Go 的事项只包含外部配置或真实环境验收: Bundle ID、Team ID、production API 域名、App Store URL、TestFlight 真机、真实 PostgreSQL、真实 LLM key、生产告警接收端和 App Store Connect metadata。

## Required Evidence

发布前本地必须通过以下命令:

```bash
npm test --prefix server
npm run balance --prefix server
npm run ai:quality --prefix server
npm run stress --prefix server
node server/scripts/smoke.mjs
node scripts/release_gate.mjs
```

严格发布模式在真实 Bundle ID、Team ID、production HTTPS API 和 App Store URL 配好后执行:

```bash
RELEASE_STRICT=1 node scripts/release_gate.mjs
```

普通本地 gate 通过说明仓库内实现和文档一致；严格 gate 未通过时不能提交 App Store。

## Final Delivery Review

| PRD final delivery item | Current local evidence | Review status |
|---|---|---|
| 1. 用户可以用 Apple、微信或 Google 登录进入并完成第一局 | `fixed account login release contract`、`web onboarding gates entry before auth request`、Apple entitlement、Google/WeChat 服务端 auth、iOS Debug mock 入口、Release 隐藏未接 SDK 入口 | Pass locally；微信/Google 原生 Release 入口等正式 SDK |
| 2. 用户可以玩 2 人真假局 | `M01 can complete the server-authoritative core loop`、`M01 is a truth-test game, not a deterministic AI target`、`npm run balance` | Pass |
| 3. 用户可以玩 3 人找 AI | `M02 waits for two human users`、`M02 mid-check locks one public suspect`、`npm run stress` | Pass |
| 4. 用户可以创建 4 人和 6 人好友房 | `friend room members can observe lobby changes`、`friend-room fixed seat caps stay enforced`、`npm run stress` 覆盖 M03/M04/M06/M08 | Pass |
| 5. AI 可以作为玩家混入并执行隐藏任务 | `npm run ai:quality`、`advanced role task skills stay private until reveal`、`gameplay balance invariant report stays inspectable` | Pass locally；真实 provider 需 production key 长测 |
| 6. 每局都有任务卡、聊天、投票、揭晓和复盘 | `opening task card gates discussion start`、`vote confirmation prevents accidental submit`、`post-game settlement closes the game loop` | Pass |
| 7. 每个模式有明确人数、角色、任务、胜利条件和评分 | `docs/GAME_MODE_BLUEPRINT.md`、`npm run balance -- --json` 的 `invariantCoverage`、`modes expose player-facing rules and flow metadata` | Pass |
| 8. 用户可以举报、拉黑、退出和删除账号 | `post-game reports do not show empty safety state`、`iOS safety UX gates`、account deletion tests、block/rematch tests | Pass |
| 9. 运营可以在后台处理举报、主题和房间记录 | admin reports/rooms/games/topics tests、`admin operations dashboard and batch moderation are covered`、CSV/audit/trends checks | Pass locally；真实运营排班和告警接收端待配置 |
| 10. 产品可以通过数据判断留存、复盘价值、好友传播和 AI 成本 | `/admin/metrics`、`/admin/trends`、AI fallback/token proxy、missions/commerce metrics、`operations runbook stays aligned` | Pass locally；生产 BI 和账单级成本监控待接 |

## Code Review Scope

本次本地代码审查关注以下风险:

- 服务端权威: 身份、任务、任务卡确认、投票、技能、结算、举报、拉黑和封禁均由后端校验。
- 信息隐藏: `REVEAL` 前不暴露其他玩家 `userId`、真实 `kind`、角色、隐藏任务、AI strategy tag 或 AI source。
- 入口合规: 玩家 UI 不出现 guest、本地试玩、未启用 Release 微信/Google、旧产品名或 debug/admin 入口。
- 状态恢复: iOS 回到 active 时刷新 `/me`、大厅数据、等待 ticket、好友房或当前对局。
- 安全闭环: 高风险文本拦截、局后举报/拉黑、后台处理、审计、SLA 和告警 webhook 合同存在。
- 玩法公平: M01/M02/M03/M04/M06/M08 通过固定策略和不变量模拟，熟练策略优于无脑/误导策略。

结论: 当前未发现本地代码层 stop-ship 问题。每次触及以上风险面必须重新跑 `node scripts/release_gate.mjs`。

## Function Review Scope

本次本地功能审查关注以下玩家路径:

- 首次进入、固定账号、年龄和社区确认。
- 大厅、战绩、我的三主 tab。
- M01/M02 公开局。
- M03/M04/M06/M08 好友房。
- 任务卡、聊天、起手句、问细节、标线索、证据笔记。
- 中段表态、最终陈述、投票、揭晓、复盘、再来一局、分享战报。
- 局后举报、拉黑、封禁、账号删除。
- 后台报告、房间、对局、主题、指标、趋势和审计。

结论: 当前本地功能闭环通过。真机仍必须按 `docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md` 记录 MQ-001 到 MQ-008。

## External Blockers

以下事项不应由代码改动伪造完成:

1. Apple Developer Team、真实 Bundle ID、Sign in with Apple capability 和 Team ID。
2. production HTTPS API 域名、真实 privacy/support URL 和 App Store Connect metadata。
3. TestFlight archive、签名、上传和真机 smoke。
4. 真实 PostgreSQL 实例、迁移、备份和恢复演练。
5. 真实 LLM provider key、provider 长测和账单级成本监控。
6. 真实举报告警接收端和运营排班。
7. 任何未来付费权益的 Apple IAP 商品和审核材料。

## Go / No-Go

- Local repository Go: `node scripts/release_gate.mjs` 通过。
- App Store Go: Local repository Go + `RELEASE_STRICT=1 node scripts/release_gate.mjs` 通过 + TestFlight manual QA 全部 Pass + 外部阻塞项完成。
