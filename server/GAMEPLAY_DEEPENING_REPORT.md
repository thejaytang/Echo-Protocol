# 玩法深化实施报告

对应 `docs/GAMEPLAY_DEEPENING_BRIEF_v1.md`。本报告记录实际改动、验证方法和结果对比。

## 1. 改了哪些文件

| 文件 | 改动内容 |
|---|---|
| `server/src/config.mjs` | M04/M06/M08 各新增 `midCheckSeconds: 30`，`flow` 数组插入"中段表态"，`rules` 补充中段表态说明。 |
| `server/src/aiGateway.mjs` | `fallbackReplies`（3 条固定文案）替换为按 4 个话题分组、每组低/高压力两档的模板库（`fallbackReplyBank`，共 28 条 + 4 条通用兜底 = 32 条）；新增 `pressureSignal()` 读取 `game.midChecks`/`game.suspicions`/消息数推断压力等级；`buildPrompt()` 补充话题化引导、压力等级提示、"有观点但不完美"语言风格要求，原有 5 条硬性安全约束原样保留。 |
| `server/scripts/simulate_balance.mjs` | 新增 `midCheckPhaseOccurred` 不变量：对配置了 `midCheckSeconds` 的模式场景，校验游戏确实进入过 `MID_CHECK`（不强制要求提交记录，因模拟脚本本身不提交 mid_check），并汇总进 `invariantCoverage.midCheckPhaseOccurredWhereConfigured`。 |
| `server/test/api.test.mjs` | 修复因新增 `MID_CHECK` 阶段导致 4 处 `debug advance` 断言需要多一次推进（M04 分票测试、M06/M08 阵营局测试、M06/M08 技能测试），并为 M04/M06/M08 新增 `midCheckSeconds`/flow/rules 的配置断言，与 M02/M03 已有断言对称。 |
| `docs/GAME_MODE_BLUEPRINT.md` | M04/M06/M08 流程阶段代码块加入 `MID_CHECK`；三个模式"关键不变量"各加一条中段表态说明；M06/M08 额外注明 `cover_ping`/`decoy_spike` 仍限定 `DISCUSSION`，不受影响；顶部总述段落更新为"M02/M03/M04/M06/M08 都会进入中段表态"。 |
| `docs/API_CONTRACT.md` | `midCheckSeconds` 字段说明从"M02 和 M03"更新为"M02/M03/M04/M06/M08"，并注明 M01 无此字段。 |

未改动：`server/src/gameEngine.mjs`（已验证 `modeHasMidCheck`/`enterMidCheck`/`midCheckAllSubmitted` 全部通用、配置驱动，无需改动逻辑）、`security.mjs`、`moderation.mjs`、`appleAuth.mjs`、`wechatAuth.mjs`、`googleAuth.mjs`、`commerce.mjs`。

## 2. 测试跑分对比（改动前 / 改动后）

基线来自临时目录（`/tmp/mirage_baseline/server`，因原始仓库无 git，采用文件复制还原基线）。

| 指标 | 改动前 | 改动后 |
|---|---|---|
| `npm test` 用例数 | 74 | 74 |
| `npm test` 通过数 | 74 | 74（首次跑因 3 个测试断言未更新一度失败，已修复） |
| `simulate_balance.mjs` skilledHumanWins | 7 | 7 |
| `simulate_balance.mjs` badPolicyHumanWins | 0 | 0 |
| `simulate_balance.mjs` advancedSkillReplayCount | 2 | 2 |
| `simulate_balance.mjs` modeCoverage | 6 (M01/M02/M03/M04/M06/M08) | 6（不变） |
| `simulate_balance.mjs` 新增不变量 midCheckPhaseOccurredWhereConfigured | 无该字段 | true |
| `evaluate_ai_quality.mjs` 三场景（configured_provider/moderation_fallback/provider_failure_fallback） | 全部通过，均判定安全 | 全部通过，均判定安全 |

胜率分布未发生漂移，符合简报预期（本轮未改变任何投票规则/身份分配/胜负判定逻辑）。`npm test` 首轮 3 个失败均为测试代码里对 `forceAdvance` 单次调用直达 `FINAL_STATEMENT` 的硬编码假设，与新增 `MID_CHECK` 阶段冲突，已在 `test/api.test.mjs` 中改为两次 `advance` 调用，非引擎缺陷。

## 3. AI 话术多样性样例对比

改动前：无论话题、无论压力，兜底话术永远是同一组 3 句固定文案，按 AI 自己发言次数循环。

改动后（跑 `ScriptedAIGateway` 实测）：

- `campus-ai-writing` 低压力："如果完全禁止，可能会让学生错过学习新工具的机会。"
- `campus-ai-writing` 高压力（模拟 2 名真人 mid_check 锁定）："算了这个话题聊太细了，不如说说别的标准怎么定。"
- `workplace-ai-decisions` 低压力："用 AI 参考数据可以，但最终拍板还是得有人负责。"
- `workplace-ai-decisions` 高压力："这块我们是不是可以先聊聊别的角度，别老卡这一点。"

四个话题各自独立模板库（低压力 3-4 条 + 高压力 3 条），新增话术共 28 条话题专属 + 4 条通用兜底 = 32 条，全部通过 `moderateText` 校验，也逐条核对不含自曝身份/索要联系方式模式（`evaluate_ai_quality.mjs` 里 `assertSafeReplyText` 使用的同款正则）。压力信号来自 `game.midChecks`/`game.suspicions` 里已公开或本地私有但不涉及角色身份的数据，未读取任何揭晓前应保密的信息（未新增"AI 互相通气"或"AI 感知真实隐藏身份"机制）。

`buildPrompt` 新增话题化引导（如"真实打工人聊这个话题容易带点情绪，而不是纯理性分析"）、压力等级提示、"有观点但不完美/不要太书面语"的风格要求；原有 5 条硬性安全约束逐字保留。

## 4. 遗留风险与建议

1. `simulate_balance.mjs` 目前不主动提交 `mid_check`，所以新增的 `midCheckPhaseOccurred` 不变量只验证"阶段确实经过"，未覆盖"真人提交了中段表态"路径；建议后续给至少一个 M04/M06/M08 场景增加真实 mid-check 提交，以覆盖 `midCheckSummary` 非空的完整链路。
2. 压力信号目前基于 `game.midChecks`/`game.suspicions` 的数量阈值（≥2 人锁定或讨论超过 10 条消息），阈值是经验值，未做真实用户数据调优，上线后应结合真实对局观察调整。
3. `fallbackReplyBank` 每个话题高压力档只有 3 条模板，比低压力档略少；如果高压力场景在长局中反复触发（同一 AI 被多次判定为高压力），仍有一定重复概率，后续可视真实回放数据决定是否再扩充。
4. 本轮验证使用临时目录（`/tmp/mirage_baseline`）做基线对比，因原始项目目录未初始化 git；建议后续为该仓库补上版本控制，便于类似改动做更严谨的回归对比。
