# 图灵迷局

图灵迷局是一个 iOS 端 AI 社交推理游戏工程。当前仓库包含三部分:

- `ios/Mirage`: 原生 **SwiftUI** iOS App 工程。
- `server`: 服务端权威 API、状态机、举报和后台 API。
- `mirage-prototype`: 早期 Vite 视觉原型，仅作为历史参考，不是正式客户端。

说明: `Mirage` 目前只作为内部工程目录、Swift 类型和配置 key 保留；用户可见产品名、App Store 名称和网页标题统一为“图灵迷局”。

## 本地运行后端

```bash
cd server
npm test
npm run balance
npm run smoke
npm run dev
```

默认后端地址是 `http://127.0.0.1:8787`。生产环境需要设置:

- `SESSION_SECRET`
- `ADMIN_TOKEN`
- `ADMIN_READONLY_TOKEN`
- `APPLE_BUNDLE_ID`
- `MIRAGE_STORE`
- `MIRAGE_POSTGRES_URL` 或 `DATABASE_URL`
- `REPORT_ALERT_WEBHOOK_URL`
- `MIRAGE_PUBLIC_BASE_URL`
- `MIRAGE_SUPPORT_EMAIL`
- `MIRAGE_SQLITE_PATH`
- `MIRAGE_STORAGE_PATH`
- `PORT`
- `HOST`
- Apple Developer 相关 `APPLE_*` 变量
- 微信开放平台相关 `WECHAT_*` 变量
- Google 登录相关 `GOOGLE_CLIENT_ID`
- **LLM** 相关 `LLM_*` 变量

本地运营后台:

```text
http://127.0.0.1:8787/admin
```

后台页面需要输入 `ADMIN_TOKEN`。

部署说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。生产数据库 schema 见 [docs/POSTGRES_SCHEMA.sql](docs/POSTGRES_SCHEMA.sql)。App Store 提交说明见 [docs/APP_STORE_SUBMISSION.md](docs/APP_STORE_SUBMISSION.md)。

本地发布门禁:

```bash
node scripts/release_gate.mjs
```

严格发布门禁会要求替换 App Store 占位配置:

```bash
RELEASE_STRICT=1 node scripts/release_gate.mjs
```

## 打开 iOS 工程

用完整 **Xcode** 打开:

```bash
ios/Mirage/Mirage.xcodeproj
```

配置文件分为:

- `ios/Mirage/Mirage/Debug.xcconfig`: 本地开发，默认指向 `http://127.0.0.1:8787`。
- `ios/Mirage/Mirage/Release.xcconfig`: App Store archive 使用，必须改成真实生产配置。
- `ios/Mirage/Mirage/Config.xcconfig`: 版本号和 deployment target 等共享配置。

Info plist 分为:

- `ios/Mirage/Mirage/Info.Debug.plist`: Debug 构建使用，保留 `localhost` 和 `127.0.0.1` 的本地 HTTP ATS 例外。
- `ios/Mirage/Mirage/Info.plist`: Release 构建使用，不包含本地 ATS 例外，必须配合 HTTPS production API。

发布前必须在 `ios/Mirage/Mirage/Release.xcconfig` 中改掉:

- `PRODUCT_BUNDLE_IDENTIFIER`
- `MIRAGE_API_BASE_URL`

同时在 Xcode 里设置 Apple Developer Team、**Sign in with Apple** capability、微信开放平台 iOS 应用配置、Release signing 和 App Store Connect metadata。

仓库已包含 shared scheme 和 `ios/Mirage/ExportOptions.plist`，完整 **Xcode** 环境中可按 `docs/APP_STORE_SUBMISSION.md` 执行 archive/export。

iOS session token 使用 Keychain 存储。App 冷启动会调用 `/me` 验证 token，失效后自动清除本地 token 并返回 onboarding；账号删除后也会清除本地 token。

客户端 API 地址解析使用 Debug/Release 分支: Debug 可回退到 `http://127.0.0.1:8787`，Release 必须读取 HTTPS production URL，缺失、HTTP 或 localhost 会显示配置错误并停止请求。

## 玩法基线

- 六个模式共享统一世界观（`GET /modes` 返回 `worldSetting`）：一张圆桌、一个话题，找出伪装成真人的 AI；模式只在人数、AI 数量和隐藏角色上变化。
- 对局流程统一为：任务卡 → 讨论 → 最终陈述 → 归票 → 揭晓 → 复盘。旧的怀疑度/证据笔记、中段表态、归票信心、角色技能和起手句话术模板已全部下线。
- 首页大厅显示全部六个模式，统一走“快速开始”（`POST /quick-start`）：单人点开即玩，缺的真人席位由脚本补位真人填充、AI 席位由 AI 填充，立即进入对局，不进匹配等待。M06/M08 单人开局时真人玩家保持侦探视角，卧底/诱饵由脚本补位真人扮演。好友房联机（建房、邀请码、凑真人）服务端能力保留但客户端暂不开发。今日悬赏在“我的”页，其中“创建好友房”悬赏已替换为“赢下 1 局”。
- 详见 [docs/GAME_MODE_BLUEPRINT.md](docs/GAME_MODE_BLUEPRINT.md) 与 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)。

## 当前验证

- 后端 `npm test`: 通过。
- 后端 `npm run balance`: 通过，覆盖 6 个已实现模式的固定策略对抗模拟。
- 后端 `npm run smoke`: 通过。
- `node scripts/release_gate.mjs`: 通过，仍提示 App Store 占位配置。
- iOS Debug/Release `Info.plist`、ATS 发布策略、Release API URL 策略、entitlements、privacy manifest、Xcode project plist、shared scheme、ExportOptions 校验: 通过。
- Swift 源码 `swiftc -typecheck`: 通过。
- 完整 iOS build/archive: 当前机器没有完整 **Xcode**，无法执行 `xcodebuild archive`。
