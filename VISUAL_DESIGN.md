# Visual Design: 图灵迷局

**Concept-Derived Visual Tags**: `composition-table-stage`, `lighting-low-key-deduction`, `motionviz-signal-pulse`

## 1. Visual Concept

暗色圆桌上的信号推理。画面应该像一局正在进行的社交推理游戏，而不是聊天工具或项目看板。中心永远服务于本局座位、阶段、发言和行动，其他成长、任务、账号、安全内容都退到大厅或复盘。

## 2. Color Palette

| Role | Color | Hex | Usage |
|:---|:---|:---|:---|
| Stage background | Deep ink | `#101522` | 主背景、局内桌面、夜间推理氛围 |
| Player agency | Warm gold | `#FFD46B` | 当前玩家可操作按钮、阶段推进、奖励确认 |
| Suspicion signal | Signal cyan | `#22D3EE` | 标线索、问细节、当前盯人、任务动作 |
| Risk and AI pressure | Ember red | `#FF5F57` | 倒计时风险、封禁、举报、误判提醒 |
| Evidence surface | Slate violet | `#2A2D3D` | 卡片、发言气泡、证据层 |

## 3. Object Rendering Specifications

- Seat: 用圆形头像、座位光环和状态徽标表达身份可见性。揭晓前隐藏身份时只显示席位状态，不用说明文解释“未知”机制。
- Message: 发言气泡按座位归属排列。可被操作的发言只显示小型动作按钮，例如“问细节”“标线索”，不放长说明。
- Task card: 作为开局行动门槛，使用任务标题、目标、赢法、工具和边界五块信息。卡片只讲玩家要做什么，不讲服务端如何结算。
- Vote card: 候选人、证据和信心必须在同一卡内完成选择。当前票、已选择、重选用状态徽标表达。
- Replay: 按“结果、任务、判断、身份、证据、下一局”顺序阅读。安全处理只在有真人目标时出现。

## 4. Background & Environment

局内背景保持低对比暗色桌面，中央留给座位和发言。周边可用微弱径向光、阶段脉冲和倒计时刻度，但不能出现装饰性大色块、说明卡堆叠或与玩法无关的图片。

大厅和战绩页可以更亮，但仍使用同一套金色行动、青色线索、红色风险语言。账号、安全、法律和客服入口使用收敛卡片，不抢开局主路径。

## 5. Feedback Effects

| Event | Visual Response | Tag Reference |
|:---|:---|:---|
| Task acknowledged | 任务卡收起，阶段条从任务点亮到讨论 | `motionviz-signal-pulse` |
| Mark clue | 发言气泡出现青色线索边和小徽标 | `lighting-low-key-deduction` |
| Ask detail | 输入框填入引用草稿，原发言短暂青色闪边 | `motionviz-signal-pulse` |
| Suspicion target changed | 被盯座位出现青色环，投票阶段可沿用 | `composition-table-stage` |
| Vote submitted | 候选卡金色确认态，票数只显示进度不泄露票型 | `lighting-low-key-deduction` |
| Reveal | 身份光环由隐藏态转为阵营色，结果卡进入首位 | `motionviz-signal-pulse` |
| Report or block | 红色确认态，只在局后玩家处理区出现 | `lighting-low-key-deduction` |

## 6. Relationship with Visual Tags

`composition-table-stage` 约束局内结构必须像一桌游戏，座位、阶段和行动永远比说明文字更重要。

`lighting-low-key-deduction` 约束暗色层级和低噪声卡片，让推理线索、投票和揭晓成为真正的亮点。

`motionviz-signal-pulse` 约束反馈使用短促状态变化，而不是弹出长文案。确认、标记、揭晓、奖励都应该有明确但克制的视觉响应。

## 7. AI-Generated Look Suppression Rules

### 7.1 Visual Hierarchy Rules

- Protagonist: 当前玩家的座位、输入框和可操作阶段按钮。
- Threat: 隐藏 AI、误导性特殊角色、倒计时和错误归票风险。
- Reward: 命中结果、任务完成、推理星、经验和再来一局。
- 2-second recognition check: 首屏必须在 2 秒内看出当前处于大厅、任务卡、讨论、投票、揭晓或复盘中的哪一个状态。

### 7.2 Limits on Familiar Template Symbols

- Adopted familiar elements (max 2): 圆桌座位、阶段条。
- Replaced unique element: 不使用狼人杀身份卡作为核心符号，改用任务卡和信号线索表达本游戏身份。

### 7.3 UI-Independent Feedback

| Event | Non-UI visual response | Intensity (Low/Med/High) |
| :---- | :--------------------- | :----------------------- |
| Score | 推理星和经验从奖励卡短促点亮 | Med |
| Damage | 误判、被举报或封禁用红色收缩态提示 | High |
| Near miss | 高怀疑但投错时在复盘中显示偏移线索 | Med |

### 7.4 Composition and Gaze Guidance

- Initial focal point: 当前阶段标题和座位桌。
- Visual flow: 阶段条到座位，再到发言，再到底部行动。
- Anti-center-clutter implementation: 中心不放营销卡、不放规则长文、不放账号安全入口；这些内容只出现在大厅二级区或复盘后区。

## 8. Acceptance Criteria

- 局内任何首屏不能像项目说明页。若出现“服务端”“本地”“模板”“机制说明”等词，应默认视为 UI 文案缺陷。
- 起手句只能填入草稿，不能替玩家发送。
- 任务卡和投票卡必须把目标、行动和结果闭合在同一流程中。
- 复盘必须解释结果，但不能暴露用户 ID、房号或内部事件名。
- Release 截图不能包含 debug、admin、localhost、占位域名或旧产品名。
