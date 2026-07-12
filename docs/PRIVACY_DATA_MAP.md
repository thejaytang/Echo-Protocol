# 图灵迷局 Privacy Data Map

本文档用于对齐 App Store Connect privacy answers、`PrivacyInfo.xcprivacy`、隐私政策和当前后端实现。任何新增 analytics、payments、广告、第三方 SDK、语音、图片上传或设备权限前，必须先更新本文档、`PrivacyInfo.xcprivacy`、隐私政策和 release gate。

## 当前隐私口径

1. `NSPrivacyTracking=false`。
2. `NSPrivacyTrackingDomains=[]`。
3. 当前只声明 **App Functionality** 用途，不声明 tracking、广告、第三方数据经纪或跨 App / 网站追踪。
4. 玩家入口只使用固定账号体系。当前 iOS Release 可提交入口为 Apple；微信 / Google 服务端合同已具备，原生 SDK 接入后开启 Release 按钮。guest 仅用于服务端自动化测试和审核演示接口，不出现在玩家 UI。
5. 账号删除入口在 App 设置中提供；删除后账号资料匿名化，未开始匹配和房间移除该用户，历史对局玩家昵称替换为 `已删除用户`，安全和合规所需的最小审计记录保留。

## Collected Data Types

| `PrivacyInfo.xcprivacy` 类型 | App Store Connect 数据类别 | 是否 linked | 是否 tracking | 用途 | 当前来源 | 删除/保留 |
|---|---|---:|---:|---|---|---|
| `NSPrivacyCollectedDataTypeName` | Name | Yes | No | App Functionality | Apple full name、玩家昵称、微信/Google 昵称、本地默认昵称 | 账号删除时匿名化；历史对局显示 `已删除用户` |
| `NSPrivacyCollectedDataTypeEmailAddress` | Email Address | Yes | No | App Functionality | Apple / Google 登录返回的 email；微信通常不返回 email | 账号删除时清空账号关联 email |
| `NSPrivacyCollectedDataTypeUserID` | User ID | Yes | No | App Functionality | 服务端 user id、Apple sub、微信 openid/unionid、Google sub、session token | 账号删除时清空平台关联标识并移除本地 token；安全审计保留最小必要引用 |
| `NSPrivacyCollectedDataTypeGameplayContent` | Gameplay Content | Yes | No | App Functionality | 房间、模式、身份、任务卡、投票、揭晓、复盘、任务动作 | 用于游戏运行、复盘和安全处理；删除账号后玩家昵称匿名化 |
| `NSPrivacyCollectedDataTypeOtherUserContent` | Other User Content | Yes | No | App Functionality | 局内发言、最终陈述、证据笔记、举报理由 | 用于房间发言、审核、举报上下文和复盘；违规/举报上下文按安全合规最小必要保留 |
| `NSPrivacyCollectedDataTypeCustomerSupport` | Customer Support | Yes | No | App Functionality | 客服入口、账号申诉、举报处理状态、admin 处理记录 | 用于支持和安全处理；账号删除后保留最小安全审计记录 |
| `NSPrivacyCollectedDataTypeProductInteraction` | Product Interaction | Yes | No | App Functionality | 登录、开局、完成局、复盘查看、任务领取、装扮解锁、好友房创建、AI fallback/latency 运营指标 | 用于运行状态、质量监控和产品功能改进；不用于 tracking |

## Not Collected In v1.0

| 数据或权限 | 当前状态 |
|---|---|
| Contacts | 不采集通讯录 |
| Location | 不采集定位 |
| Photos / Camera | 不请求相册或相机权限 |
| Microphone / Speech | v1.0 不做语音局，不请求麦克风或语音识别 |
| Advertising ID | 不使用广告标识符 |
| Payment Information | 当前 `paymentsEnabled=false`，没有真实支付；未来付费必须走 Apple **IAP** 并重新核对 privacy answers |
| Third-party analytics SDK | 当前没有接入；接入前必须更新 privacy map、manifest 和 App Store Connect |
| Tracking domains | 当前为空 |

## Implementation Evidence

| 证据 | 文件 |
|---|---|
| iOS privacy manifest | `ios/Mirage/Mirage/PrivacyInfo.xcprivacy` |
| 玩家隐私政策页面 | `server/src/legalPages.mjs` |
| 账号删除实现和测试 | `server/src/httpServer.mjs`、`server/test/api.test.mjs` |
| 固定账号登录合同 | `docs/API_CONTRACT.md`、`docs/APP_STORE_SUBMISSION.md` |
| 商业化公平边界 | `server/src/commerce.mjs`、`docs/API_CONTRACT.md` |
| 发布门禁 | `scripts/release_gate.mjs` |
