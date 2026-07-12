# 图灵迷局 Completion Audit

本文档用于判断当前工程是否满足原始目标: 做一款 **AI** 混入人类聊天、人类识别 **AI** 的 iOS 社交推理游戏，并达到“除手动外部配置外，完成打包上线准备”的本地交付状态。

结论: **Local scope complete with external release blockers**。

本地代码、玩法、Web 预览、iOS 源码、后端、运营、安全、文档和自动化门禁已经闭环。仍未完成的内容均属于外部配置或真实环境验收: Apple Developer Team、真实 Bundle ID、Team ID、production HTTPS API、真实 **PostgreSQL**、真实 **LLM** key、真实举报告警接收端、TestFlight 真机验收、App Store Connect metadata 和最终截图。

## Requirement Audit

| 原始要求 | 当前证据 | 判定 |
|---|---|---|
| 功能模块、交互、文本和 UI 显示闭环 | `docs/UX_INTERACTION_AUDIT.md`、`VISUAL_DESIGN.md`、`server/src/homePage.mjs`、`ios/Mirage/Mirage/MirageViews.swift`、`scripts/release_gate.mjs` 的 home IA、player-facing copy、task card、post-game、safety UX、fixed login 检查 | Pass |
| 避免内容冗余、分组混乱、交互重复或不闭环 | 首页已收敛为大厅 / 战绩 / 我的；局内区分盯人目标、中段表态、投票目标；追问不再是独立技能；举报收敛为局后对玩家处理；任务卡由服务端确认 | Pass |
| 玩法存在对抗性和成就感 | `docs/GAME_MODE_BLUEPRINT.md` 固定 M01/M02/M03/M04/M06/M08；`server/src/config.mjs` 和 `server/src/gameEngine.mjs` 落地阶段、角色、任务、投票、技能和结算 | Pass |
| 存在类似狼人杀的环节、技能和影响 | 已有任务卡、讨论、M02/M03 中段表态、最终陈述、投票、揭晓、复盘；M06 `cover_ping` 和 M08 `decoy_spike` 只制造公开行动和复盘线索，不直接暴露身份 | Pass |
| 约 6 种游戏模式 | M01 2 人真假局、M02 3 人猎 **AI**、M03 4 人经典混聊、M04 6 人双 **AI** 立场局、M06 5 人卧底护 **AI**、M08 5 人伪 **AI** 诱饵 | Pass |
| iOS 游戏基本功能具备 | 原生 **SwiftUI** 工程、Apple entitlement、Keychain token、前后台恢复、隐私清单、App icon、账号删除、法律入口、固定账号登录合同、Release API 策略 | Pass locally |
| 代码审查通过 | `docs/CODE_FUNCTION_REVIEW.md`，以及 `node scripts/release_gate.mjs` 中代码和功能审查一致性检查 | Pass locally |
| 功能审查通过 | `docs/CODE_FUNCTION_REVIEW.md` 覆盖首次进入、开局、公开局、好友房、局内、投票、复盘、安全、后台和数据指标；TestFlight 真机记录模板在 `docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md` | Pass locally；真机待执行 |
| 完成设计 demo，而不是停留在静态原型 | `server/` 可运行后端、Web 预览接真实 API、`ios/Mirage/` 原生客户端接后端、`server/test/api.test.mjs` 覆盖核心 API，原型仅保留为视觉参考和泄露检查对象 | Pass |
| 达到完成打包上线的所有准备工作，除手动配置外 | `docs/APP_STORE_SUBMISSION.md`、`docs/APP_STORE_METADATA.md`、`docs/DEPLOYMENT.md`、`docs/OPERATIONS_RUNBOOK.md`、`.github/workflows/ci.yml`、Dockerfile、production env、release gate、strict placeholder gate | Pass locally；App Store Go 仍需外部配置 |

## Evidence Commands

本地发布前必须通过:

```bash
npm test --prefix server
npm run balance --prefix server
npm run ai:quality --prefix server
npm run stress --prefix server
node server/scripts/smoke.mjs
node scripts/release_gate.mjs
```

真实配置替换后必须通过:

```bash
RELEASE_STRICT=1 node scripts/release_gate.mjs
```

`RELEASE_STRICT=1` 不通过时不能提交 App Store。普通本地 gate 通过只能证明仓库内实现、文档和本地打包准备一致。

## External Release Blockers

以下内容不能由代码伪造完成，也不应被本地审计标记为已完成:

1. Apple Developer Team、真实 Bundle ID、Team ID、签名和 TestFlight archive。
2. production HTTPS API 域名、真实 privacy/support URL 和 App Store Connect metadata。
3. 真实 **PostgreSQL** 实例、迁移、备份和恢复演练。
4. 真实 **LLM** provider key、长测、胜率评估和账单级成本监控。
5. 真实举报告警接收端和运营排班。
6. 微信 / Google 原生 iOS SDK 接入后再开启 Release 按钮。
7. 任何未来付费权益的 Apple **IAP** 商品和审核材料。

## Completion Decision

本地目标已达到: 当前仓库已经具备完整游戏设计、服务端权威实现、Web 预览、原生 iOS 源码、运营后台、安全合规、QA 文档、发布门禁和上线材料。

App Store 目标尚不能 Go: 只有在外部阻塞全部完成、`RELEASE_STRICT=1 node scripts/release_gate.mjs` 通过、TestFlight manual QA 全部 Pass 后，才能判定真实商店提交就绪。
