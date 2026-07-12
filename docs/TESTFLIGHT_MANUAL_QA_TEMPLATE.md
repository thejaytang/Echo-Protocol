# 图灵迷局 TestFlight Manual QA Template

本文档用于 TestFlight 前真机验收留痕。每次准备上传或扩大测试范围前，按本模板复制一份记录，填写设备、构建号、账号、结果和证据链接。自动化测试通过不替代本模板。

## Run Metadata

| 字段 | 填写 |
|---|---|
| Build |  |
| Date |  |
| Tester |  |
| API Origin |  |
| Store | PostgreSQL / SQLite |
| AI Provider | LLM / scripted fallback |
| Devices |  |
| Network | Wi-Fi / 5G / weak network |

## Stop-Ship Summary

| 项目 | 结果 | 备注 |
|---|---|---|
| 是否出现游客/本地试玩玩家入口 | Pass / Fail |  |
| 是否出现旧产品名“狼人杀”或“找AI”作为产品名 | Pass / Fail |  |
| 是否出现 debug、admin、localhost、占位域名或 token | Pass / Fail |  |
| 是否发生身份、特殊任务或 AI 策略提前泄露 | Pass / Fail |  |
| 是否发生投票、结算或账号删除错误 | Pass / Fail |  |

## MQ-001 Fixed Account Login

设备: iPhone 小屏、大屏。环境: 真实 Apple 配置；微信 / Google 仅在 Release SDK 接入后测试。

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 首次安装打开 App | 进入游戏式入场页 | Pass / Fail |  |
| 未勾选年龄/社区确认直接登录 | 不能进入 | Pass / Fail |  |
| Apple 登录 | 进入大厅，战绩绑定固定账号 | Pass / Fail |  |
| 关闭重开 App | 保持登录或按失效会话回到登录 | Pass / Fail |  |
| Release 未接微信/Google SDK 时 | 不展示未启用入口 | Pass / Fail |  |

## MQ-002 M01 First Game

目标: 60 秒内完成首局，并经历完整 **core loop**。

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 从大厅进入 M01 | 出现任务卡，不是身份卡 | Pass / Fail |  |
| 发送一条发言 | 聊天流更新，无策略提示泄露 | Pass / Fail |  |
| 标记怀疑/标记发言 | 投票页和复盘能带入 | Pass / Fail |  |
| 最终陈述 | 只能补一句并进入归票 | Pass / Fail |  |
| 投票判断 AI / 真人 | 进入揭晓和复盘 | Pass / Fail |  |
| 再来一局 | 能回到同模式开局路径 | Pass / Fail |  |

## MQ-003 M02 Multi-Human Match

设备: 两台以上真机或 TestFlight 测试用户。

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 玩家 A 进入 M02 | 显示等待真人和已等待时间 | Pass / Fail |  |
| 玩家 B 进入 M02 同主题 | 两端进入同一局 | Pass / Fail |  |
| 中段表态 | 表态公开，但不泄露身份 | Pass / Fail |  |
| 最终陈述和归票 | 阶段一致，票型不提前泄露 | Pass / Fail |  |
| 一端后台切换再回来 | 可继续当前局 | Pass / Fail |  |

## MQ-004 Friend Room Modes

设备: 三台以上真机，覆盖 M03/M04/M06/M08。

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 房主创建好友房 | 展示邀请码、座位和 ready 状态 | Pass / Fail |  |
| 成员加入和准备 | 所有端座位同步 | Pass / Fail |  |
| 非房主查看开局入口 | 只能等待房主 | Pass / Fail |  |
| 房主后台切换再回来 | 房间状态不丢 | Pass / Fail |  |
| 满足人数后开局 | 进入对应模式，不超员 | Pass / Fail |  |
| M06/M08 特殊任务 | 只对本人可见，复盘后公开任务动作 | Pass / Fail |  |
| 完成后 rematch | 返回同一保留成员 lobby | Pass / Fail |  |

## MQ-005 Weak Network And Resume

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 弱网进入匹配 | 不重复创建 ticket | Pass / Fail |  |
| 弱网重复点击准备/开局/投票 | 状态幂等或有可读错误 | Pass / Fail |  |
| 对局中杀 App 重开 | 首页出现继续上一局 | Pass / Fail |  |
| 完成局后弱网看复盘 | 复盘可刷新恢复 | Pass / Fail |  |

## MQ-006 Safety: Report, Block, Ban

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 局后举报玩家 | 后台可看到上下文 | Pass / Fail |  |
| 单独拉黑玩家 | 不创建举报，之后不再同桌 | Pass / Fail |  |
| 举报并拉黑 | 举报创建且 block 生效 | Pass / Fail |  |
| Admin 封禁目标 | 被封禁账号不能继续游戏 | Pass / Fail |  |
| 高风险文本 | 被拦截并显示玩家可读提示 | Pass / Fail |  |

## MQ-007 Account Deletion

| 步骤 | 预期 | 结果 | 证据 |
|---|---|---|---|
| 设置页发起删除 | 出现明确确认对话 | Pass / Fail |  |
| 确认删除 | Keychain token 清除并回到登录 | Pass / Fail |  |
| 服务端检查 | 用户匿名化，未开始匹配/房间清理 | Pass / Fail |  |
| 重新打开 App | 不自动进入旧账号 | Pass / Fail |  |

## MQ-008 App Store Screenshots

| 截图 | 预期 | 结果 | 文件 |
|---|---|---|---|
| 入场页 | 产品名为图灵迷局，固定账号入口 | Pass / Fail |  |
| 大厅 | 开局主路径清晰，无项目说明式文案 | Pass / Fail |  |
| 任务卡 | 显示任务卡，不是身份卡 | Pass / Fail |  |
| 局内聊天 | 座位、阶段、发言和动作闭环 | Pass / Fail |  |
| 投票/揭晓 | 不泄露未公开信息 | Pass / Fail |  |
| 复盘 | 任务结果、判断校准、身份、证据和下一局 | Pass / Fail |  |

## Final Decision

| 决策 | 填写 |
|---|---|
| Go / No-Go |  |
| Remaining Issues |  |
| Required Fix Owner |  |
| Re-test Scope |  |
