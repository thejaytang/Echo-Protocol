# 图灵迷局 Multi-Agent Launch Plan

本文档是本地上线准备的协作合同。六个 agent 的工作必须以当前 PRD、玩法蓝图、API contract、真实状态文档和 **release gate** 为准，不能只依赖口头同步。

## 当前完成口径

本地可完成的首发范围是:

1. Web 和 iOS 均以“图灵迷局”为用户可见产品名。
2. Apple / 微信 / Google 是固定账号体系；当前 iOS Release 可提交入口为 Apple，微信 / Google 服务端合同已具备，原生 SDK 接入后开启 Release 按钮；guest 仅作为服务端自动化测试和审核演示接口，不出现在玩家入口。
3. M01/M02 公开局和 M03/M04/M06/M08 好友房均有服务端权威流程、局内发言、任务卡、投票、揭晓、复盘和再来一局。
4. 细节追问不是独立技能，玩家直接在聊天输入框追问。
5. 局内不做逐条发言举报；举报和拉黑在局后对玩家处理，并关联整局上下文。
6. 商业化只展示 Phase 2 权益预告，不出售胜率、身份信息、投票提示、匹配优势或结算优势。
7. 当前本地上线证据必须通过 `npm test`、`npm run balance`、`npm run ai:quality`、`npm run stress` 和 `node scripts/release_gate.mjs`。

## 六 Agent 责任矩阵

| Agent | 角色 | 本地交付物 | 完成证据 |
|---|---|---|---|
| Agent 1 PM | 组织范围、优先级、上线口径和跨角色同步 | `Mirage_PRD_v1.0.md`、`docs/REAL_APP_STATUS.md`、本计划 | PRD 当前实现基线清楚列出首发模式、交互口径、验收口径 |
| Agent 2 Game Design | 玩法、模式、胜负、任务卡、平衡和反单调策略 | `docs/GAME_MODE_BLUEPRINT.md`、`server/src/config.mjs`、`server/scripts/simulate_balance.mjs` | `npm run balance` 覆盖 M01/M02/M03/M04/M06/M08，验证熟练策略优于无脑或误导策略 |
| Agent 3 Engineering | Web/iOS/后端实现、API、认证、房间、持久化和生产安全 | `server/src/`、`ios/Mirage/Mirage/`、`docs/API_CONTRACT.md`、`docs/POSTGRES_SCHEMA.sql` | `npm test`、Swift typecheck、HTTP smoke、生产环境校验均由 **release gate** 调用 |
| Agent 4 UI/UX | 首页信息架构、局内交互、局后闭环、文案真实感和视觉一致性 | `server/src/homePage.mjs`、`ios/Mirage/Mirage/MirageViews.swift`、`docs/UX_INTERACTION_AUDIT.md` | **release gate** 检查产品名、项目说明式文案、三主 tab、任务卡、局后处理、固定账号入口 |
| Agent 5 QA | 自动化测试、压力测试、发布门禁、回归风险和停止上线条件 | `server/test/`、`server/scripts/`、`scripts/release_gate.mjs`、`.github/workflows/ci.yml` | `npm test`、`npm run stress`、`node scripts/release_gate.mjs` 全部通过 |
| Agent 6 Commercialization | 付费空间、权益边界、平台合规和公平性保护 | `server/src/commerce.mjs`、Web/iOS 我的页权益预告、`docs/API_CONTRACT.md` | `/commerce/catalog` 只读，`paymentsEnabled=false`，**release gate** 检查不出售玩法优势 |

## 跨 Agent 同步规则

每次改动至少归属一个 agent，但上线口径必须按影响面同步:

| 改动类型 | 必须同步 |
|---|---|
| 玩法、模式、胜负、阶段或任务动作变化 | Agent 1 PM、Agent 2 Game Design、Agent 3 Engineering、Agent 5 QA |
| 登录、账号、删除、举报、拉黑、安全、隐私变化 | Agent 1 PM、Agent 3 Engineering、Agent 4 UI/UX、Agent 5 QA |
| 首页、局内、复盘、文案、可见产品名变化 | Agent 1 PM、Agent 4 UI/UX、Agent 5 QA |
| 商业权益、奖励、装扮、复盘增值、好友房便利变化 | Agent 1 PM、Agent 2 Game Design、Agent 5 QA、Agent 6 Commercialization |
| 生产环境、部署、CI、数据库、密钥、平台配置变化 | Agent 1 PM、Agent 3 Engineering、Agent 5 QA |

## Stop-Ship Invariants

以下任一项失败时不得发布:

1. 玩家入口出现“狼人杀”“找AI”“游客进场”“本地试玩”或其他不一致产品名/入口。
2. 固定账号入口缺失，Release 开启未接正式 SDK 的微信 / Google 按钮，或登录前年龄与社区确认绕过服务端校验。
3. 揭晓前暴露其他玩家身份、用户 id、隐藏任务或 AI 真实策略。
4. 局内出现逐条发言举报入口，而不是局后对玩家处理。
5. 任务卡被写成身份卡，或人类玩家被展示成可能拿到 AI 身份。
6. 商业化出售胜率、身份信息、投票提示、匹配优势或结算优势。
7. Admin token 被持久化到 `localStorage`，或举报、封禁、账号删除缺少审计证据。
8. `npm test`、`npm run balance`、`npm run ai:quality`、`npm run stress` 或 `node scripts/release_gate.mjs` 任一失败。

## 外部阻塞

这些事项不能在本地仓库内完全闭环，进入真实上线前必须由账号、平台或生产环境补齐:

1. Apple Developer Team、真实 Bundle ID、**Sign in with Apple** capability、App Store Connect metadata 和 TestFlight 提交。
2. 微信开放平台 iOS 应用、Universal Links、正式 App ID / secret 和真实 SDK 回调。
3. Google OAuth client、正式 Google SDK 和生产 token audience。
4. production HTTPS API 域名、CORS origin、监控、日志和客服邮箱。
5. production **PostgreSQL**、备份恢复演练和迁移执行权限。
6. production **LLM** provider key、限流预算、质量抽检和 fallback 策略确认。
7. Apple **IAP** 商品、价格、退款说明和审核材料；当前仓库仅允许权益预告。

## 本地验收命令

```bash
cd server && npm test
cd server && npm run balance
cd server && npm run ai:quality
cd server && npm run stress
node scripts/release_gate.mjs
```

`node scripts/release_gate.mjs` 是本地发布前总门禁。严格发布模式可用 `RELEASE_STRICT=1 node scripts/release_gate.mjs`，但在真实 Bundle ID、Team ID 和生产 API 域名未提供前会失败，这是预期行为。
