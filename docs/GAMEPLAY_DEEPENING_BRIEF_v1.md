# 玩法深化简报 v1（Leader + 游戏设计 联合产出）

对应用户诉求：不新增游戏模式，聚焦「深化现有模式核心互动」「优化 AI 对手行为策略」「平衡性测试与数值调优」三点。

## 0. 诊断结论

审阅 `server/src/config.mjs`、`server/src/gameEngine.mjs`、`server/src/aiGateway.mjs`、`docs/GAME_MODE_BLUEPRINT.md`、`server/scripts/simulate_balance.mjs`、`server/scripts/evaluate_ai_quality.mjs` 后发现两个具体、可执行、风险可控的深化点：

1. **中段表态（MID_CHECK）目前只在 M02/M03 生效**，M04（6人双AI立场局）、M06（人类卧底护AI）、M08（伪AI诱饵局）完全没有这个阶段——讨论结束直接跳最终陈述。这三个模式恰恰是博弈最复杂、最需要"提前公开表态制造张力"的模式，却缺了这个工具。工程上这是纯配置驱动的机制（`gameEngine.mjs` 里 `modeHasMidCheck(mode)` 只看 `mode.midCheckSeconds > 0`，`enterMidCheck`/`midCheckAllSubmitted` 完全通用，没有任何硬编码的模式判断），扩展风险很低。
2. **AI 对手的回复质量偏薄，尤其是没有配置真实 LLM key 时的兜底话术**（`aiGateway.mjs` 的 `fallbackReplies`）：目前无论什么话题、什么模式，兜底回复永远是同样 3 句固定文案，按 AI 自己发言次数循环。真实生产环境如果没有 LLM key（PRD 里明确写了"真实 LLM key"是外部未完成项），玩家会在同一个话题下反复看到一模一样的兜底句子，AI 会被瞬间识破，这直接破坏"AI能自然混入"这个核心卖点。同时 `buildPrompt` 给 LLM 的策略指导也很单薄，没有话题差异化、没有压力感知（比如被多名真人 mid_check 锁定后要不要调整策略）、没有让每局 AI 呈现不同"性格"。

## 1. 深化现有模式核心互动：M04 / M06 / M08 启用中段表态

### 改动内容

在 `server/src/config.mjs` 给 M04、M06、M08 三个模式各加一个 `midCheckSeconds` 字段（参考 M02=25、M03=30 的量级，M04/M06/M08 人数更多、讨论更长，建议 30-35 秒），并在对应 `flow` 数组里插入"中段表态"（位置在"讨论发言"之后、"最终陈述"之前，与 M02/M03 保持一致的顺序）。

`gameEngine.mjs` 本身不需要改动逻辑——`modeHasMidCheck`/`enterMidCheck`/`midCheckAllSubmitted`/`midCheckState`/`serializeMidCheck` 都已经是通用实现，只由 `mode.midCheckSeconds` 驱动。**但要检查并确认**：

1. `docs/GAME_MODE_BLUEPRINT.md` 里 M04/M06/M08 各自的"流程阶段"代码块要同步加上 `MID_CHECK`，"关键不变量"里要加一条类似 M02/M03 的表述："M04/M06/M08 讨论结束后进入中段表态，每名真人公开锁定一次当前怀疑对象，不计入最终胜负，但复盘要对比中段表态和最终投票"。
2. `docs/API_CONTRACT.md` 里如果有按模式列出"是否有 MID_CHECK 阶段"的表格或字段说明，要同步更新。
3. `server/scripts/simulate_balance.mjs` 目前用 `advanceToVoting` 循环 `forceAdvance` 直到进入 VOTING，理论上不需要改就能兼容新增的 MID_CHECK 阶段（forceAdvance 是时间驱动的通用推进），但**必须实际跑一遍确认**，并且建议给 M04/M06/M08 的 `scenarioInvariants` 里新增一条判断："如果 mode 配置了 midCheckSeconds，replay 的 `midCheckSummary` 应该非空"（除非本局所有真人都没提交，需要判断这是否会导致场景失败——如果测试场景本身不主动提交 mid_check，可以放宽为"阶段确实存在过"而不强制要求提交记录）。
4. M06/M08 的阵营技能（`cover_ping`/`decoy_spike`）目前限定在 `DISCUSSION` 阶段使用；新增 MID_CHECK 阶段后确认这些技能的可用阶段窗口没有意外收窄或冲突。

### 为什么这是"深化"而不是"新增模式"

不新增任何模式、不新增任何身份、不新增任何投票类型，只是把已经在 M02/M03 验证过的机制（提前公开表态、复盘对比中段/最终判断是否一致）复用到另外三个模式，完全符合用户"不新增玩法模式，深化现有模式"的要求。

## 2. AI 对手行为策略优化（`server/src/aiGateway.mjs`）

### 2.1 兜底话术（无 LLM key 时的真实生产状态）扩容

把 `fallbackReplies` 从 3 条固定文案，扩展为**按话题分组、每组至少 4-5 条、且带轻微压力分级**的模板库。具体要求：

1. 按 `server/src/config.mjs` 里的 4 个话题（`campus-ai-writing`、`label-ai-content`、`workplace-ai-decisions`、`creator-ai-face`）各自准备一组话术，不能跨话题混用通用空话。
2. 每组内区分"低压力"（游戏早期，AI 消息数少）和"高压力"（AI 被多次 `mid_check` 锁定、或话题已经讨论多轮）两档，高压力档要体现"轻微防御/转移话题"的语气变化，而不是永远同一种平静语气。
3. `fallbackReply(game, aiPlayer)` 的选择逻辑要同时看 `game.topic.id` 和"当前 AI 被多少名真人在最近一次 mid_check/suspicion 里锁定为目标"（如果这个信号已经在 `game` 对象上可以拿到就用，拿不到就退化为只按话题+消息计数选择，但不能像现在这样忽略话题）。
4. 保留现有的安全约束：不自曝身份、不索要联系方式/支付信息——这些必须原样保留，新增内容要过 `sanitizeReply`/`moderateText` 检查。

### 2.2 LLM 路径的 prompt 策略升级（`buildPrompt`）

在现有基础上补充：

1. 按话题传入更具体的"这个话题下真实人类通常会怎么回答"的提示（避免 AI 给出过于教科书式、滴水不漏的回答——这反而是最大的破绽来源）。
2. 传入一个"压力等级"变量（同 2.1 的信号来源），压力高时提示 AI 采用更口语化、略带情绪化或转移话题的策略，而不是稳定输出论述。
3. 明确要求 AI 的语言呈现出"有观点但不完美"——允许轻微的口语化重复、犹豫词，避免过于工整的书面语（这是当前 prompt 完全没提到的点，也是真实社交推理游戏里 AI 最容易被识破的地方）。
4. 保留现有的 5 条硬性安全约束不变。

### 2.3 不要做的事

不要引入"AI 之间互相通气""AI 感知其他玩家真实身份"这类违反 `GAME_MODE_BLUEPRINT.md` 隐藏信息边界的机制（尤其 M06/M08 里 AI 本来就不知道人类卧底/伪AI真人身份，这条边界必须保持）。不要让 prompt 或 fallback 逻辑读取任何揭晓后才应该可见的信息。

## 3. 平衡性测试与数值调优

1. 改动完成后必须跑：`cd server && npm test`（现有 74+ 用例）、`node scripts/simulate_balance.mjs --json`、`node scripts/evaluate_ai_quality.mjs --json`，且**都要跑「改动前」和「改动后」各一次做对比**（可以用 git stash 或临时目录还原基线）。
2. 重点关注：`simulate_balance.mjs` 里 `skilledWins`（技巧策略应继续在多数场景获胜）、`badPolicyWins`（应保持为 0，无脑/被误导策略不该意外获胜）不能因为新增 MID_CHECK 或话术变化而回归。
3. 由于本轮不改变任何投票规则、身份分配或胜负判定逻辑，理论上胜率分布不应该发生实质变化——如果测试后发现胜率漂移，需要在报告里解释原因（例如 MID_CHECK 是否意外影响了 `forceAdvance` 的推进节奏导致讨论时间变短）。
4. 产出一份 `server/GAMEPLAY_DEEPENING_REPORT.md`，包含：改了哪些文件、测试跑分对比（改动前后表格）、AI 话术多样性的具体样例对比（新增话术条数、是否话题区分开）、遗留风险或建议。

## 4. 合规与范围边界

- 不新增游戏模式、不新增身份角色、不新增投票类型。
- 不修改 `security.mjs`、`moderation.mjs`、`appleAuth.mjs`、`wechatAuth.mjs`、`googleAuth.mjs`、`commerce.mjs` 核心逻辑。
- AI 相关改动必须继续通过 `moderateText`/`sanitizeReply` 安全检查，`evaluate_ai_quality.mjs` 的三个场景（配置正常/命中审核兜底/LLM请求失败兜底）必须继续通过。
- 保持 `GAME_MODE_BLUEPRINT.md` 共用约束第 3 条："任何技能不得直接暴露真实身份"。
