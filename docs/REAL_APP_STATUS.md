# 图灵迷局 Real App Status

本文档说明“图灵迷局”当前工程离“真实可上线 App”的距离。结论先说清楚: 现在已经不是单纯 demo，已经有原生 iOS 工程和可运行后端，但还没有完成 App Store 可提交状态。

## 已完成

### iOS 客户端

- 新增原生 **SwiftUI** 工程: `ios/Mirage/Mirage.xcodeproj`。
- 客户端通过 `URLSession` 调用后端，不再依赖本地 mock 数据。
- 已覆盖 P0 路径:
  - **Sign in with Apple** UI 入口。
  - Google 登录入口，本地 Debug 使用 mock token；Release 不展示未启用入口，正式 Google SDK 待接。
  - 微信登录入口，本地 Debug 使用 mock code；Release 不展示未启用入口，正式微信开放平台 SDK 待接。
  - guest 仅作为服务端自动化测试和审核演示接口，不在玩家入口展示。
  - 年龄确认。
  - AI 参与说明。
  - 社区规范确认。
  - 首页快速开始。
  - 大厅、战绩、我的三个游戏式首页分区；榜单并入战绩，今日悬赏收敛到大厅/局后，背包装扮并入我的。
  - 大厅玩法规则入口和模式规则面板。
  - 模式详情开局确认。
  - M01 匹配，支持真假未知对手和“判断 AI / 判断真人”结算。
  - M02 等待两名真人。
  - M02 等待兜底切换。
  - 好友房创建、加入、准备、房主开始。
  - 游戏聊天。
  - 举报和拉黑入口。
  - 投票。
  - 揭晓和复盘。
  - 设置页删除账号入口。
- 已加入 App icon asset catalog。
- 已加入 `Mirage.entitlements`，包含 **Sign in with Apple** entitlement。
- 已加入 `PrivacyInfo.xcprivacy`，并声明 Name、Email Address、User ID、Gameplay Content、Other User Content、Customer Support 和 Product Interaction 均用于 App Functionality、非 tracking。
- 新增 `docs/PRIVACY_DATA_MAP.md`，把 App Store Connect privacy answers、`PrivacyInfo.xcprivacy`、隐私政策和当前后端数据来源对齐；当前不采集通讯录、定位、相册/相机、麦克风、广告标识符或支付信息。
- onboarding 已提供登录前隐私政策、服务条款和社区规范链接，设置页也保留法律/支持入口。
- iOS onboarding 已从系统表单改为游戏式入场页，包含品牌 hero、入场名片、年龄/社区确认、Apple 登录和法律链接；Debug 保留微信/Google 预览入口，Release 不展示未启用入口，也不暴露游客或本地试玩入口。
- session token 已从 `UserDefaults` 迁移到 Keychain，删除账号时同步清除本地 token。
- 账号删除会匿名化用户资料，清空 Apple/微信/Google/email 关联，移除未开局匹配和 lobby 席位，清理 block 关系，并把历史对局玩家昵称改成 `已删除用户`。
- 设置页删除账号入口已增加确认对话，说明会匿名化账号资料、移除未开始匹配/房间并清除本地登录状态。
- Web 和 iOS 我的页首屏已从玩家等级卡改为“账号与安全”卡，并把个人资料里的举报/拉黑统计收敛为“安全中心”入口，避免把战绩成长和局后处理文案放在账号页顶部。
- Web 和 iOS 复盘页已支持“举报”“拉黑”“举报并拉黑”三种局后处理动作；单独拉黑会调用 `/blocks`，不创建举报记录。
- iOS 复盘页已把“身份结果”从投票卡中拆出，和 Web 一样按胜负原因、任务结果、判断校准、身份结果、证据与任务动作推进，避免复盘信息混在一个卡片里。
- iOS 设置页已从默认列表改为游戏内安全中心样式，分组展示账号状态、法律/客服入口和账号数据操作。

### 后端

- 新增 `server/`，使用 Node 内置模块实现，不依赖原型前端。
- 已实现服务端权威能力:
  - guest auth，自动化测试和审核演示专用，不作为玩家入口。
  - Apple identity token 验证入口，本地开发允许 mock Apple token。
  - Google identity token 验证入口，本地开发允许 mock Google token。
  - 微信开放平台登录 code 验证入口，本地开发允许 mock WeChat code。
  - session token。
  - 模式配置 M01/M02/M03/M04/M06/M08。
  - M01 immediate AI game。
  - M02 两真人匹配后创建 2 human + 1 AI game。
  - 好友房创建、邀请码加入、准备、开始。
  - 服务端身份分配。
  - 服务端阶段推进。
  - 服务端投票校验、重复投票覆盖、结算。
  - AI scripted fallback。
- 文本安全过滤。
- 文本安全过滤已从联系方式扩展为基础分类规则，覆盖个人联系/隐私信息、骚扰辱骂、暴力威胁、自伤风险、成人内容、广告诈骗。
- Web 和 iOS 已把 `message_blocked:*` 错误码映射成玩家可读的安全提示；自伤风险提示会引导用户立即联系当地紧急服务或可信赖的人。
- 举报接口支持关联整局上下文，iOS 入口已收敛为局后玩家举报。
  - 拉黑记录。
  - 账号删除。
  - 后台 reports、rooms、game trace API。
- 已防止讨论阶段泄露 AI `strategyTag`。
- 已新增 `/me/summary` 用户首页摘要接口，用于驱动 iOS 战绩和我的分区，数据从现有 games、rooms、reports 和 blocks 只读计算。
- 今日悬赏已从独立任务页收敛到开局大厅下方和局后奖励卡；服务端通过 `/me/missions/:missionId/claim` 持久化每个用户每天的领取记录，并返回推理星和经验余额。
- 今日悬赏已新增一键领取闭环，服务端通过 `/me/missions/claim-all` 一次领取当前全部可领取悬赏，Web 和 iOS 大厅领奖卡都会展示一键领取入口和合计奖励反馈。
- Web 和 iOS 领取任务奖励后会对比领奖前后的等级成长数据；如果经验触发升级，会显示“称号升级”反馈，而不是只展示资源数字。
- 用户摘要已新增等级成长数据，经验会映射为 Lv、称号、下一级进度；首页和“我的”页会展示账号成长状态，让任务奖励进入可见的游戏账号循环。
- Web 本地预览首页也已接入 `/me/summary`，战绩和我的分区不再依赖硬编码样例数值。
- 已新增 `/me/games` 最近对局摘要接口，iOS 和 Web 战绩页可以展示历史列表，并通过现有 `GET /games/:gameId` 重新打开进行中对局或局后复盘。
- 首页已新增“继续上一局”入口，iOS 和 Web 会把 `/me/games` 中未完成的对局提升到首页，用户断线或退出后可直接回到当前对局。
- iOS 和 Web 大厅已新增最近复盘回流卡；完成过对局的玩家能从开局页直接看最近复盘或同模式再来一局，不必先进战绩页。
- 已用 Node test 覆盖核心闭环。
- 已新增 `/admin` 运营后台页面，可用 `ADMIN_TOKEN` 查看并处理举报、查看举报上下文、封禁目标、查看指标、加载房间和查询对局；可选 `ADMIN_READONLY_TOKEN` 只能读取后台数据，不能处理举报、封禁、批量操作或启停主题。后台页面会通过 `/admin/session` 显示“写入权限”或“只读模式”，并在只读模式提前禁用写操作按钮。
- Admin 可查看举报上下文消息、玩家列表、目标用户，并可封禁目标用户。
- Admin metrics 已增加举报 SLA 状态，包含 open 举报数、超过 SLA 数、最老 open 举报等待时长和 `REPORT_SLA_SECONDS` 阈值。
- Admin 已新增 `/admin/audit` 和页面审计入口，可查看举报创建、举报处理、消息拦截、用户拉黑和封禁事件；举报处理事件记录变更前后状态和 `actor`。
- 举报创建已支持可配置 `REPORT_ALERT_WEBHOOK_URL` 告警，投递成功会写入 `report.alert.sent`，投递失败会写入 `report.alert.failed`，并且不会阻塞用户提交举报。
- 后端 production 校验已要求配置举报告警 webhook，或显式设置 `REPORT_ALERTS_DISABLED_IN_PRODUCTION=true` 来确认另有真实运营告警渠道。
- Admin 页面不再用 `localStorage` 长期保存 `X-Admin-Token`，改为浏览器 session 级保存，并由 release gate 检查。
- Admin API 已增加 IP 级 rate limit，错误 token 重试也会被 `rate_limited:admin` 拦截。
- onboarding 年龄确认和社区规范确认已从本地 UI 控制升级为服务端 auth 强校验并持久化，guest、Apple、微信和 Google auth 未确认会返回 `onboarding_confirmation_required`。
- 用户提交 `block: true` 举报后会建立 block 关系；被 block 的两名用户不会被公开匹配到同局，也不能加入同一个好友房 lobby。
- M02 公开匹配已补 ticket/status 闭环，第一位等待用户可以轮询 `/matchmaking/:ticketId`，匹配成功后自动进入同一局。
- M02 等待页已补取消闭环，用户返回首页时会调用 `DELETE /matchmaking/:ticketId` 清理服务端队列；如果取消时已匹配，服务端会返回 game，客户端直接进局。
- M02 等待页已补兜底动作，iOS 和 Web 都可以从等待页切到 2 人真假局或创建好友房；切换前会取消当前 ticket，如果取消瞬间已经匹配成功，则优先进入已匹配对局。
- M02 等待页已补等待时长和超时建议：matchmaking API 返回 ticket `createdAt`，iOS 和 Web 展示“已等待”，超过 45 秒明确建议切到 2 人真假局或好友房。
- 好友房等待页已补等待时长和超时建议：iOS 和 Web 根据 `room.createdAt` 展示已等待时长，超过 90 秒提示先玩 2 人真假局或继续复制房号拉人。
- 公开匹配入口已收敛为 M01/M02；M03/M04 作为好友房模式，iOS 和网页预览都会创建对应 mode 的好友房，后端会拒绝把好友房模式直接塞进公开匹配。
- iOS 公开匹配等待页已改为游戏式队列座位呈现，展示本人、等待真人玩家和隐藏 AI 补位。
- 好友房 iOS 页面已补 `GET /rooms/:roomId` 轮询，成员加入、准备状态和房主开局后 `gameId` 会同步到客户端，非房主也会自动进入对局。
- 好友房已补离开 lobby 闭环，用户返回首页会调用 `DELETE /rooms/:roomId`；host 离开会转移房主，无成员时房间关闭，已开局房间不能通过该接口退出。
- iOS `MirageRoom.hostUserId` 已与后端合同对齐为可选值，能正确解码最后一名成员离开后返回的 `hostUserId: null` 闭房状态。
- iOS 好友房 lobby 已改为邀请码面板、房间座位桌和开局操作区，准备/房主开始入口按 host 与 ready 状态展示。
- 好友房已补邀请码复制闭环，iOS 可从房间头部复制邀请码；Web 本地预览会优先自动复制，若浏览器限制剪贴板写入则切换为“手动复制 房号”的明确 fallback，降低创建房间后无法邀请好友的断点。
- 好友房 iOS 页面已按当前用户是否为 host 控制“房主开始”入口，非房主只显示等待房主开始，避免触发 `only_host_can_start`。
- 好友房 iOS 页面已按 lobby 状态、当前用户准备状态和所有真人成员 ready 状态控制“我已准备”和“房主开始”按钮，避免触发 `not_all_ready` 或非 lobby 开局错误。
- iOS 已补前后台恢复刷新：App 回到 active 时会按当前路径刷新 `/me`、大厅数据、等待 ticket、好友房或当前对局；好友房已开局时会自动拉取 game 并进入对局，降低真机后台切换后的状态断点。
- 好友房开局已按 mode 的最低真人数强校验，M03 至少 2 名真人、M04 至少 3 名真人；AI/scripted 只补足剩余座位，不能替代最低真人门槛。
- 被封禁用户会被服务端拒绝继续匹配、进房、读房间/对局、发言、投票、举报等游戏动作，但仍可进入 `/me` 和删除账号。
- iOS Home 已新增封禁账号提示，封禁用户不能从客户端发起公开匹配、创建好友房或加入好友房，仍可进入设置查看规则、联系客服和删除账号。
- iOS 和 Web 首页已新增“玩法速览”入口，玩家可在开局前查看任务卡、开聊、归票、揭晓、复盘的完整节奏，以及每个模式的人数、胜负目标和收局处理规则。
- iOS 和 Web 对局页已新增本局“看玩法”入口，玩家可在当前房间直接打开本模式规则并返回对局。
- iOS 和 Web 大厅模式入口已从“一点就开”改为模式详情确认，开局前展示人数、AI 数量、讨论/投票时长、规则和收局安全提示，再由玩家确认公开匹配或创建好友房。
- iOS 和 Web 已接入官方主题库：开局前可按模式选择主题，M02 会按相同 `topicId` 匹配，好友房保存 `topicId`，房主可在 lobby 换主题并让非房主成员重新 ready，再来一局会继承上一局主题。
- iOS 和 Web 复盘页已补“再来一局”闭环：公开模式复用上一局 `modeId` 重新匹配，好友房完成局会调用 `/rooms/:roomId/rematch` 创建或返回原成员同模式新 lobby；完成局响应会暴露当前用户可见的 `rematchRoomId`，让其他成员在复盘页进入已有再来一局房间，而不是重复创建。
- iOS 和 Web 复盘页已新增“复盘校准”：用最终票、信心值和最高怀疑标记对照真实 AI，反馈高信心命中、高信心误判或判断失准，让怀疑标记和信心值在局后形成学习闭环。
- iOS 和 Web 第一局复盘后已新增账号保护提示：Apple 登录显示“Apple 已保护战绩”，微信/Google 固定账号提示战绩已保存并建议 iOS 优先使用 Apple 登录；iOS 会回到“我的”，Web 会打开账号页。
- 好友房 rematch 已补本地并发回归测试：多名成员在局后重复点击 `/rooms/:roomId/rematch` 时只会得到同一个保留成员 lobby 和同一个邀请码，旧局复盘也会指向同一个 `rematchRoomId`。
- iOS 和 Web 复盘页已补匿名“分享战报”传播闭环：分享内容和分享前预览卡只包含模式、话题、结果、关键线索和 `mode/topic` 落地链接，不带真实昵称、用户 ID、game ID、房号或原房间号；Web 打开链接后会在登录完成或已有会话下进入对应模式面板，不进入原房间聊天记录。
- 新增 `npm run stress` 本地多端弱网压力脚本，会启动内存后端并用确定性 jitter 覆盖公开匹配 M02、M03/M04/M06/M08 好友房 join/ready/start、讨论、最终陈述、投票、复盘、cover_ping / decoy_spike 复盘入账和 rematch 幂等收敛。
- iOS 和 Web 玩家端文案已进一步收敛为游戏 UI 口吻，避免把内部机制说明放在主路径里。
- 新增 `VISUAL_DESIGN.md`，统一局内圆桌、阶段条、任务卡、线索、投票和复盘的视觉层级，明确玩家 UI 不应出现“服务端”“本地”“模板”等项目说明式文案。
- iOS 和 Web 战绩页已从统计清单升级为赛季/段位入口，展示 S1 推理赛季、等级称号进度、胜率/完赛/线索指标、段位路径，以及领取奖励、快速上桌或再来一局的上下文动作。
- iOS 和 Web 战绩页的排行榜已改为完成 3 局后露出；新玩家未满 3 局时只看到解锁进度和继续开局动作，避免首屏被赛季排名分散注意力。
- iOS 对局页已从顺序列表重组为座位制推理房间结构，包含房间顶栏、阶段进度、座位桌面、话题指令、发言流、阶段动作区和底部发言栏。
- iOS 和 Web 任务卡已补齐结构化任务说明：主标题按角色显示“侦探任务 / 阵营任务 / 诱饵任务 / 伪装任务”，卡内展示任务目标、赢法、可用工具和禁忌，并支持局内通过“我的任务”回看。
- iOS 和 Web 任务卡确认已改为服务端权威状态：讨论阶段发言、标线索、盯人和角色任务动作都会在未确认任务卡时返回 `task_card_not_acknowledged`，避免只靠本地弹层造成状态断点。
- iOS ViewModel 已集中处理服务端 `unauthorized` / `user_not_found` / `user_banned` 错误：失效会话会清除 Keychain 并回到 onboarding，被封禁账号会刷新 `/me`、回到 Home 并显示封禁状态。
- 对局和房间读取已增加成员校验，非成员不能通过猜测 `game_id` 或 `room_id` 读取内容。
- 对局序列化已补局中身份隐藏：`REVEAL` 前只暴露当前玩家自己的 `userId`、真实 `kind`、角色和任务；其他座位统一返回 `userId: null`、`kind: "unknown"`、`role: "hidden"`，避免通过响应体推断真人、AI 或特殊真人角色。
- Web 和 iOS 局内发言流不再渲染服务端 `strategyTag` 或“可疑点”提示；揭晓前只展示玩家自己的“我的怀疑标记”，系统线索只进入局后复盘。
- Web 和 iOS 讨论阶段已支持把别人的某条发言“标为线索”；该标记作为当前用户私有 `reactionType=clue` 返回，会进入投票候选卡和局后“我标记的发言”复盘。
- Web 和 iOS 讨论阶段已支持从对方发言气泡点击“问细节”，引用该句生成输入框草稿；该动作不直接发送，也不是独立技能。
- Web 和 iOS 投票阶段会沿用讨论阶段的盯人目标作为默认候选，并显示“已沿用盯人目标 / 重选”，避免讨论选择和投票选择语义断开。
- Web 和 iOS 投票候选卡已把中段表态压进证据 pill，和我的怀疑标记、标记发言一起呈现，避免玩家归票时丢失中段公开判断。
- Web 和 iOS 已把讨论阶段盯人目标、中段表态目标和投票阶段目标拆成独立本地状态；投票阶段只能读取投票目标、已提交投票或显式沿用的盯人目标，避免同一个选择状态跨阶段误用。
- Web 和 iOS 的“起手句”只填入草稿，不会直接替玩家发送，避免快捷短句变成机械刷屏入口；release gate 会防止起手句回退成一键发言。
- M06 人类卧底和 M08 伪 **AI** 真人的特殊角色已改为服务端从真实用户中按每局座位随机性稳定选择，不再按最后入座或固定座位分配。
- iOS 已取消对局中逐条消息举报；举报入口收敛到局后玩家举报，只针对本局真人玩家提交并关联整局上下文。
- 已新增法律/支持页面:
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/community`
  - `/support`
- 法律/支持页面已支持生产配置: `MIRAGE_PUBLIC_BASE_URL`、`MIRAGE_SUPPORT_EMAIL`、`MIRAGE_SUPPORT_URL`，production 会拒绝占位或非 HTTPS 公网 URL。
- 已新增 Dockerfile、`.dockerignore`、`server/.env.example` 和部署文档。
- `server/.env.example` 已覆盖 production 必填样板，包括 `ADMIN_READONLY_TOKEN`、Apple / 微信 / Google 固定账号配置、`AUTH_ALLOW_MOCK_* = false`、**LLM**、CORS、法律/支持 URL、举报告警、**PostgreSQL** 和备份路径。
- 已新增 **PostgreSQL** runtime snapshot adapter 和 schema: `docs/POSTGRES_SCHEMA.sql`。
- `docs/POSTGRES_SCHEMA.sql` 已改为幂等 DDL，可在环境 bootstrap 或恢复时重复执行；release gate 会检查 `state_snapshots` JSONB 合同、幂等 table/index DDL 和 runtime advisory lock。
- 已新增 `npm run migrate:postgres` 部署入口，会读取 `MIRAGE_POSTGRES_URL` 或 `DATABASE_URL`，拒绝空值/占位连接串，并在事务中执行 `docs/POSTGRES_SCHEMA.sql`。
- 已新增 `npm run verify:production` 部署后验证入口，会检查 HTTPS、`/health`、`/ready`、`store=postgres`、AI readiness、举报告警 readiness、法律/支持页面，以及可选的 `/admin/metrics`。
- 已新增 `npm run backup:postgres` 和 `npm run restore:postgres`，可导出/恢复当前 runtime `state_snapshots` `main` 快照；恢复使用 advisory lock 和事务，恢复后应运行 `npm run verify:production`。
- Apple 登录已从 identity token 验证扩展到 authorization code exchange，删除账号时可 revoke Apple refresh token。
- Apple client secret 生成已用测试覆盖真实 P-256 ES256 签名、authorization code exchange 表单、refresh token revoke 表单，以及 `APPLE_PRIVATE_KEY` 中 `\\n` 转换。
- AI 玩家已从纯脚本扩展为可配置 OpenAI-compatible **LLM** gateway，并保留超时/失败/审核降级 fallback。
- 后端已新增 SQLite snapshot store，支持单实例 MVP 持久化和跨重启恢复；生产路径可切到 `MIRAGE_STORE=postgres`。
- 已新增 shared Xcode scheme、`ExportOptions.plist` 和 App Store 提交说明: `docs/APP_STORE_SUBMISSION.md`。
- App Store 提交说明已同步当前固定账号策略: Apple 是当前可提交的 iOS 固定账号入口，微信/Google 服务端合同已具备但 Release 原生入口在正式 SDK 配好前不展示，guest 不出现在玩家 UI；审核账号需要走 provider-backed 固定账号说明，未来付费必须使用 Apple **IAP** 且不出售玩法优势。
- 新增 `docs/APP_STORE_METADATA.md`，提供 zh-Hans / en-US metadata、字段长度 guardrails、review notes、截图计划、年龄分级草案和 metadata stop-ship checks；真实提交前仍需替换生产 URL 并用真机截图。
- iOS 已拆分 Debug/Release Info plist: Debug 保留 `localhost` / `127.0.0.1` 本地 HTTP ATS 例外，Release `Info.plist` 不包含本地 ATS 例外。
- iOS 客户端已将本地 API 地址回退限制在 Debug；Release 缺失生产 API、使用 HTTP 或 localhost 时会显示配置错误并停止请求。
- 后端新增生产环境校验，不安全默认 secret、缺 Apple 配置、缺 Google client ID、缺 **LLM** key、缺 CORS 白名单时会拒绝启动。
- 后端 production 校验已要求显式持久层: 默认必须使用 **PostgreSQL**，单实例 SQLite 需要显式开关，JSON store 不允许作为 production 默认。
- 后端新增安全响应头、CORS 白名单、请求体大小限制和 `invalid_json` / `request_body_too_large` 错误。
- 后端 production 响应已加入 `Strict-Transport-Security`，`HSTS_MAX_AGE_SECONDS` 默认一年。
- 后端 JSON 和 HTML 响应已加 `Cache-Control: no-store`，避免用户、房间、消息、举报和 admin 内容被缓存。
- 后端新增 `/ready` readiness endpoint，会读取当前 store，并返回不含密钥的 AI provider 和举报告警配置状态，用于部署平台检测持久层可用性、**LLM** 配置状态和运营告警配置状态。
- 后端启动入口已处理 `SIGTERM` / `SIGINT`，会停止 HTTP server 并关闭 active store，适配容器平台滚动部署和关停。
- Admin 新增 `/admin/metrics`、`/admin/rooms` 和 `/admin/games/:gameId` UI 入口，可查看用户、游戏、AI 胜率、举报、安全拦截、AI 运营、房间和单局详情。
- Admin 指标页已从基础 JSON 升级为运营看板，展示 open 举报、SLA 风险、模式表现、主题表现、举报原因、AI fallback/延迟/输出 token proxy 和最老 open 举报队列；同时保留原始 JSON 方便排查。
- Admin 指标页已新增产品漏斗、留存 proxy 和虚拟经济统计，覆盖首局激活、完成局玩家、复盘查看、好友房创建、悬赏领取、装扮解锁、推理星发放/消耗和热门装扮，用于本地验证商业化与留存闭环。
- Admin 新增 `/admin/trends?days=14` 和页面“长期趋势”入口，按日聚合新增账号、活跃、开局、完赛、复盘、举报、封禁、AI 胜率、AI fallback rate 和 output-token proxy，帮助 Agent 1/5/6 在首发前后看健康度变化。
- 已新增 `/commerce/catalog` 只读权益预告，Web 和 iOS 我的页展示 Phase 2 商业化方向；当前 `paymentsEnabled=false`，只规划外观、复盘和好友房便利，并由 release gate 检查不出售胜率、身份信息、投票提示、匹配优势或结算优势。
- Admin 新增 `/admin/reports/batch` 和页面批量处理入口，可一次标记最多 50 条举报状态，并写入 `report.batch.updated` 审计事件；已新增 `/admin/reports/batch-ban-targets` 和页面批量封禁目标入口，要求先查看上下文，执行后会封禁唯一 target user、更新举报状态并写入审计事件。
- Admin 新增 `/admin/reports.csv` 和页面导出入口，可下载举报流程状态、关联 ID 和时间戳，用于运营交接和审核留痕；CSV 不包含消息正文。
- Admin 新增 `/admin/topics` 运营入口，可停用或启用官方主题；公开 `/topics`、公开匹配、好友房换主题和新开局都会尊重该设置，并阻止把某个模式的可用主题全部停用。
- 后端新增基础 rate limit，覆盖 auth、公开匹配、好友房、发言、游戏动作和举报，超限返回 `429 rate_limited:*`。
- IP 级 rate limit 默认不信任 `X-Forwarded-For`，只有 `TRUST_PROXY_HEADERS=true` 时才读取可信代理注入的转发 IP。
- server 已新增 `package-lock.json`，Dockerfile 改为 `npm ci --omit=dev --ignore-scripts`，CI 会先执行 `npm ci`。
- Dockerfile 已改为非 root `node` 用户运行，创建 `/data` 挂载目录，并包含 `/health` 容器 HEALTHCHECK。
- 新增后端 HTTP smoke 脚本: `server/scripts/smoke.mjs`。
- 新增本地玩法平衡模拟脚本: `server/scripts/simulate_balance.mjs`，可通过 `npm run balance` 覆盖 M01/M02/M03/M04/M06/M08 的固定策略对抗，验证熟练策略能赢、无脑/被误导策略会输，并输出固定人数、固定 AI 数、最低真人数、任务卡确认、特殊角色真人分配、投票数和技能复盘等不变量证据。
- 本地 debug 预览新增好友房“补齐试玩”：M04/M06/M08 在正式 `/rooms/:roomId/start` 仍要求足够真人，但 `?debug` 下可用 `/debug/rooms/:roomId/fill-and-start` 以脚本真人补齐席位，单人跑通高级模式、特殊任务和复盘。
- VOTING 阶段新增 `voteState` 进度摘要；Web 和 iOS 投票状态现在显示“已投/可改”和“还差几名真人交票”，同时继续隐藏其他玩家具体票型。归票倒计时结束后，Web 和 iOS 会进入等待揭晓状态并禁用确认投票。
- 新增本地 release gate: `scripts/release_gate.mjs`。默认模式通过，严格模式会在 App Store 占位配置未替换时失败。
- release gate 已新增 `iOS safety UX gates`，检查封禁账号 UX、服务端错误恢复、局后举报/拉黑入口保护、好友房 host 合同、非房主开局入口保护以及 ready/start 状态保护，避免客户端合规和房间合同回退。
- release gate 已新增固定账号登录 release contract，检查 Apple entitlement、Xcode signing entitlements 引用、Release Bundle ID 配置、Apple / 微信 / Google env 文档、服务端 Google / 微信 auth、iOS Debug 微信/Google mock 入口、Release 不展示未启用微信/Google 入口，并阻止玩家入口暴露 guest / 本地试玩。
- release gate 已新增 `npm run ai:quality`，覆盖 AI 输出安全、揭晓前信息隐藏、审核降级和 provider 失败降级；真实 **LLM** key 可用时可用 `MIRAGE_AI_QUALITY_REQUIRE_LLM=true` 强制验证真实 provider 输出。
- 新增 `docs/MULTI_AGENT_LAUNCH_PLAN.md`，把 Agent 1 PM、Agent 2 Game Design、Agent 3 Engineering、Agent 4 UI/UX、Agent 5 QA 和 Agent 6 Commercialization 的本地交付物、完成证据、跨角色同步规则、Stop-Ship Invariants 和外部阻塞统一到上线协作合同。
- 新增 `docs/LAUNCH_QA_MATRIX.md`，把 P0 自动化场景、TestFlight 前人工真机验收、回归触发规则和 stop-ship 条件对齐到 Agent 5 QA 的上线验收合同。
- 新增 `docs/TESTFLIGHT_MANUAL_QA_TEMPLATE.md`，把 TestFlight 前真机验收从说明变成可填写记录，覆盖固定账号、M01、M02、好友房、弱网恢复、安全处理、账号删除和 App Store 截图。
- 新增 `docs/CODE_FUNCTION_REVIEW.md`，把 PRD 最终交付 10 条、代码审查范围、功能审查范围、外部阻塞和 Go/No-Go 结论映射到当前自动化证据。
- 新增 `docs/COMPLETION_AUDIT.md`，把原始目标的功能闭环、玩法对抗、iOS 基本能力、代码/功能审查和打包上线准备逐项映射到当前证据，并明确 Local scope complete with external release blockers。
- 新增 `docs/OPERATIONS_RUNBOOK.md`，覆盖日常巡检、举报 SLA、事故分级、AI fallback、PostgreSQL 备份恢复、回滚、首发日 checklist 和六 agent 运营职责。
- 新增 GitHub Actions CI: `.github/workflows/ci.yml`，Ubuntu job 覆盖后端测试、smoke 和 Docker image build；macOS job 覆盖本地 release gate、iOS 结构校验、Swift typecheck 和 Xcode simulator build。

## 当前未完成

这些不是小修，是上线前必须完成的工作:

- 当前机器没有完整 **Xcode**，无法验证 iOS simulator build、archive、signing 和 TestFlight 上传。
- 当前机器没有 Docker CLI，无法本地验证 Docker image build；CI 已加入 `docker build -t mirage-server:ci .` 作为容器构建验证。
- `ios/Mirage/Mirage/Release.xcconfig` 里的 `PRODUCT_BUNDLE_IDENTIFIER` 仍是占位值 `com.mirage.app`。
- `ios/Mirage/Mirage/Release.xcconfig` 里的 `MIRAGE_API_BASE_URL` 仍是占位值 `https://api.mirage.example.com`。
- `ios/Mirage/ExportOptions.plist` 里的 `teamID` 仍是占位值 `YOUR_TEAM_ID`。
- 还没有真正部署到 production。当前已有 Docker 部署形态，但还没有 HTTPS 域名、运行实例、日志和备份。
- **PostgreSQL** adapter 已接入运行时代码，但当前环境没有真实数据库，尚未完成 live **PostgreSQL** 连接、迁移、备份和恢复演练。
- **LLM** gateway 已接入 OpenAI-compatible API 形态，并已有本地 AI 质量门禁；但还没有真实 production key、服务商账单级成本监控和真实 provider 长测。
- 运营后台目前覆盖举报列表、按状态/原因/Game/Target 筛选、上下文查看、单条处理、批量标记处理、批量封禁目标、筛选后 CSV 导出、目标用户封禁、运营看板、长期趋势、审计事件、房间列表、对局查询、官方主题启停和只读/写入权限分级；还没有接入真实生产 BI 仓库和跨版本长期 cohort 报表。
- App Store 需要的 privacy policy/support 页面已有服务端路径，metadata、review notes 和年龄分级口径已有草案；但还没有真实域名、真实客服邮箱，草案尚未填入 App Store Connect，也未替换最终 URL、真机截图和最终年龄分级。
- 已有本地固定策略玩法平衡模拟、多端弱网 API 压力验证、`npm run ai:quality`、商业化权益预告和 admin AI 运营 proxy，可观察 **LLM** 来源、fallback rate、延迟和输出 token 量级；但还没有真实设备真人压力测试、真实生产 **LLM** 模型胜率评估、服务商账单级成本监控、真实 **IAP** 商品和长期 **AI Win Rate** 看板。举报 SLA metrics、告警 webhook 和测试已具备，但还需要真实运营排班和告警接收端。
- 好友房 rematch 已保留原真人成员和模式，并能让复盘页进入已创建的新 lobby；成员仍需要重新 ready。本地已覆盖多人重复点击幂等性，并新增 `npm run stress` 做多端弱网 API 压力验证；iOS 已补回前台刷新当前房间/对局，但上线前仍需要真实设备后台切换验收和更主动的消息通知体验验证。

## Apple 官方要求映射

- 用户生成内容: Apple App Review Guidelines 1.2 要求过滤、举报、及时处理和屏蔽用户。当前后端已有文本过滤、举报、拉黑、admin report API、后台处理 UI、举报 SLA metrics、审计事件和举报 webhook 告警；上线前还需要确定真实运营排班与告警接收端。
- 账号删除: Apple account deletion guidance 要求支持账号创建的 App 在 App 内发起删除。当前设置页有删除入口，后端有 `DELETE /account`，Apple 登录会在删除账号时尝试 revoke Apple refresh token；如果 Apple revoke 失败，本地账号删除和数据匿名化仍会继续执行，并返回 `appleRevoke` 状态。
- 隐私清单: Apple privacy manifest documentation 要求 App bundle 可包含 `PrivacyInfo.xcprivacy` 来声明收集数据和 required reason APIs。当前已按现有功能声明基础收集数据；等接入 analytics、payments、第三方 SDK 后必须重新核对，并在 App Store Connect 隐私问卷中填写一致信息。

参考:

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app
- https://developer.apple.com/documentation/bundleresources/privacy-manifest-files

## 下一步建议

1. 安装完整 **Xcode**，跑 `xcodebuild -project ios/Mirage/Mirage.xcodeproj -scheme Mirage -destination 'platform=iOS Simulator,name=iPhone 16' build`。
2. 准备真实 **PostgreSQL** 实例，设置 `MIRAGE_STORE=postgres` 和 `MIRAGE_POSTGRES_URL`，跑迁移、备份和恢复演练。
3. 部署后端 HTTPS 域名，回填 `MIRAGE_API_BASE_URL`。
4. 配置真实 **LLM** provider key，补成本监控和 AI 胜率评估。
5. 扩展 admin Web UI，补生产 BI 接入、跨版本 cohort 报表和更细的运营分群。
6. 补 App Store metadata、真实 privacy policy URL、support URL 和 TestFlight 内测。
