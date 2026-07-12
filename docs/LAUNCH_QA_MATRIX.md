# 图灵迷局 Launch QA Matrix

本文档是 Agent 5 QA 的上线验收矩阵，用于把 PRD、玩法蓝图、Web/iOS 实现、商业化预告、安全合规和发布门禁串成可执行检查。每次改动影响首发路径时，必须更新对应场景、自动化证据或人工验收缺口。

## Gate Policy

发布前必须满足:

1. `npm test` 通过。
2. `npm run balance` 通过，覆盖 M01/M02/M03/M04/M06/M08，并输出固定人数、固定 AI 数、最低真人数、任务卡确认、特殊角色真人分配、投票数和技能复盘等不变量证据。
3. `npm run ai:quality` 通过，覆盖 **LLM** 输出安全、揭晓前信息隐藏和 fallback。
4. `npm run stress` 通过，覆盖多端弱网公开匹配 M02、M03/M04/M06/M08 好友房、复盘和 rematch 收敛。
5. `node scripts/release_gate.mjs` 通过。
6. 真实 Bundle ID、Team ID、production HTTPS API 和 App Store URL 配好后，`RELEASE_STRICT=1 node scripts/release_gate.mjs` 通过；普通本地 gate 通过不等于可提交归档。
7. TestFlight 前补真机人工验收: iPhone 小屏、大屏、弱网、后台切换、首次安装、重新登录和账号删除。

## Automated QA Coverage

| ID | 场景 | Owner | 自动化证据 | 发布判断 |
|---|---|---|---|---|
| QA-001 | 固定账号入口只展示 Apple / 微信 / Google 体系，guest 不出现在玩家 UI；iOS Release 只开启已接正式 SDK 的入口 | Agent 3 Engineering + Agent 4 UI/UX + Agent 5 QA | `npm test` home page preview；`fixed account login release contract`；`web onboarding gates entry before auth request` | 任一入口回退到 guest / 本地试玩，或 Release 开启未接 SDK 的微信 / Google 按钮则 stop-ship |
| QA-002 | 登录前年龄确认和社区规范由服务端强制校验 | Agent 3 Engineering + Agent 5 QA | `auth requires server-side onboarding confirmations` | 可绕过则 stop-ship |
| QA-003 | M01 2 人真假局可完整跑通，且不是固定抓 AI 的确定性目标 | Agent 2 Game Design + Agent 3 Engineering + Agent 5 QA | `M01 can complete the server-authoritative core loop`；`M01 is a truth-test game, not a deterministic AI target` | 失败则 stop-ship |
| QA-004 | M02 3 人抓伪装者等待两名真人，中段表态和最终陈述可用 | Agent 2 Game Design + Agent 3 Engineering + Agent 5 QA | `M02 waits for two human users`；`M02 mid-check locks one public suspect`；`final statement phase is playable before voting` | 失败则 stop-ship |
| QA-005 | M03/M04/M06/M08 好友房可开局、准备、开始、投票、复盘、再来一局 | Agent 2 Game Design + Agent 3 Engineering + Agent 5 QA | `friend room members can observe lobby changes`；`advanced modes are playable special-role friend rooms`；`completed friend rooms can rematch` | 失败则 stop-ship |
| QA-005A | 大厅能把最近复盘和同模式再来一局带回开局主路径 | Agent 1 PM + Agent 4 UI/UX + Agent 5 QA | `user home page is available for local product preview`；`home information architecture uses three primary tabs` | 最近复盘只能藏在战绩页或再来一局入口缺失则 stop-ship |
| QA-006 | 高级角色任务只在揭晓/复盘后公开，任务动作进入复盘 | Agent 2 Game Design + Agent 5 QA | `advanced role task skills stay private until reveal`；`hidden roles stay hidden before reveal` | 泄露身份/任务则 stop-ship |
| QA-007 | 细节追问留在聊天输入，不作为独立追问技能 | Agent 1 PM + Agent 2 Game Design + Agent 4 UI/UX + Agent 5 QA | `discussion questions stay in chat instead of a separate probe skill`；`web discussion exposes evidence notes` | 独立追问技能回归则 stop-ship |
| QA-007A | 讨论阶段可私有标记关键发言，投票和复盘能带入“我标记的发言” | Agent 2 Game Design + Agent 3 Engineering + Agent 4 UI/UX + Agent 5 QA | `M01 can complete the server-authoritative core loop`；`web discussion exposes evidence notes`；`vote confirmation prevents accidental submit` | 标记泄露为公共票型或投票页不带入则 stop-ship |
| QA-008 | 任务卡不是身份卡，人类玩家不会被展示成可能拿到 AI 身份 | Agent 1 PM + Agent 2 Game Design + Agent 4 UI/UX + Agent 5 QA | `opening task card gates discussion start`；`iOS phase rail starts with task card`；`player-facing human role copy uses detective label` | 文案回退则 stop-ship |
| QA-009 | 局后举报/拉黑关联整局上下文，局内不做逐条发言举报 | Agent 3 Engineering + Agent 4 UI/UX + Agent 5 QA | `post-game reports do not show empty safety state`；admin report context tests；`iOS safety UX gates` | 局内逐条举报回归则 stop-ship |
| QA-010 | 文本审核覆盖联系方式、隐私、骚扰、暴力威胁、自伤、成人和诈骗 | Agent 3 Engineering + Agent 5 QA | `message moderation blocks harassment, scam, threat and self-harm categories`；`high-risk text moderation covers threat and self-harm` | 高风险内容未拦截则 stop-ship |
| QA-011 | AI 输出不会泄露策略，失败或审核拦截时 fallback 不阻塞游戏 | Agent 2 Game Design + Agent 3 Engineering + Agent 5 QA | `npm run ai:quality`；`configured LLM gateway generates AI replies without leaking strategy`；`blocked AI gateway output falls back` | 泄露策略或阻塞流程则 stop-ship |
| QA-012 | 玩法平衡模拟验证熟练策略优于无脑或误导策略，并证明模式人数、AI 数、任务卡、特殊角色、票型和技能复盘不变量成立 | Agent 2 Game Design + Agent 5 QA | `npm run balance`；`gameplay balance simulation rewards skilled play and rejects bad policies`；`gameplay balance invariant report stays inspectable` | 策略无差异、无脑占优或不变量证据缺失则 stop-ship |
| QA-013 | 弱网多端压力覆盖公开匹配 M02、M03/M04/M06/M08 好友房、讨论、投票、复盘、rematch 和 cover_ping / decoy_spike 复盘入账 | Agent 3 Engineering + Agent 5 QA | `npm run stress`；`multiclient weak-network stress` | 竞态或状态不收敛则 stop-ship |
| QA-014 | 商业化权益预告不出售胜率、身份信息、投票提示、匹配优势或结算优势 | Agent 1 PM + Agent 2 Game Design + Agent 6 Commercialization + Agent 5 QA | `/commerce/catalog` tests；`commercialization preview does not sell gameplay advantage` | pay-to-win 回归则 stop-ship |
| QA-015 | `PrivacyInfo.xcprivacy`、privacy data map、隐私政策和 App Store 提交说明一致 | Agent 1 PM + Agent 3 Engineering + Agent 5 QA | `iOS privacy manifest data declarations`；`privacy data map stays aligned`；`App Store submission notes stay aligned` | privacy answers 不一致则 stop-ship |
| QA-016 | 生产部署安全基线拒绝 unsafe defaults、占位配置、mock auth 和不安全存储 | Agent 3 Engineering + Agent 5 QA | production env validation tests；`Docker production baseline`；`PostgreSQL runtime schema contract` | 生产安全校验失效则 stop-ship |

## Manual QA Before TestFlight

这些不能在当前本地环境完全证明，但进入 TestFlight 前必须执行并记录。执行时复制 `docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md`，填写 build、设备、结果和证据链接。

| ID | 场景 | 设备/环境 | 通过标准 |
|---|---|---|---|
| MQ-001 | 首次安装和固定账号登录 | iPhone 小屏、大屏，真实 Apple 配置；微信 / Google 在原生 SDK 接入后追加真机验收 | 当前提交包可完成 Apple 登录；微信 / Google Release 按钮在 SDK 未接入前保持禁用，接入后可完成登录并能切换另一种固定账号 |
| MQ-002 | M01 首局 60 秒内进入并完成 | 真机 + production HTTPS API | 能经历任务卡、发言、归票、揭晓、复盘、再来一局 |
| MQ-003 | M02 多真人匹配 | 两台以上真机或 TestFlight 测试用户 | 等待、匹配、发言、表态、最终陈述、归票状态一致 |
| MQ-004 | M03/M04/M06/M08 好友房 | 三台以上真机，含房主后台切换 | 邀请码、ready、房主开始、rematch、成员离开/重回一致 |
| MQ-005 | 弱网与后台切换 | Network Link Conditioner 或真实弱网 | 不丢登录态；未完成局可继续；重复点击不创建重复局 |
| MQ-006 | 局后举报、拉黑、封禁 | 真机 + admin 后台 | 举报关联上下文；拉黑后不再匹配；封禁后阻止继续游戏 |
| MQ-007 | 账号删除 | 真机 + 固定账号 | Keychain token 清除；服务端账号匿名化；重新打开回到登录 |
| MQ-008 | App Store 截图 | App Store 要求尺寸 | 截图只展示真实游戏 UI，不展示 debug、admin、占位域名或测试文案 |

## Regression Triggers

以下改动必须重新跑完整 `node scripts/release_gate.mjs`，并至少抽查对应人工场景:

| 改动 | 需要抽查 |
|---|---|
| 账号、登录、token、删除账号 | QA-001、QA-002、QA-015、MQ-001、MQ-007 |
| 模式配置、阶段、投票、胜负 | QA-003 到 QA-008、QA-012、MQ-002 到 MQ-004 |
| 聊天、AI、审核、举报、拉黑、封禁 | QA-009 到 QA-011、MQ-006 |
| 首页、局内 UI、复盘、文案 | QA-001、QA-007、QA-008、MQ-008 |
| 商业化、权益、奖励、装扮 | QA-014、QA-015 |
| 部署、数据库、环境变量、CI | QA-013、QA-016 |
