import { moderateText } from "./moderation.mjs";

// Fallback template library grouped by topic id (see server/src/config.mjs `topics`),
// each split into a low-pressure tier (early game, few messages) and
// a high-pressure tier (the
// topic has already been discussed for a while). High-pressure lines lean into mild
// defensiveness or topic redirection instead of staying in the same flat, composed register.
const fallbackReplyBank = {
  "campus-ai-writing": {
    low: [
      { text: "如果完全禁止，可能会让学生错过学习新工具的机会。", strategyTag: "soft_deflection" },
      { text: "但我同意需要标注，至少老师要知道哪些部分用了辅助。", strategyTag: "partial_agreement" },
      { text: "我更在意评价标准是否跟着变化，否则大家都会钻空子。", strategyTag: "goal_shift" },
      { text: "写作业的时候用来查资料和用来直接生成全文，感觉不是一回事。", strategyTag: "nuance_split" },
    ],
    high: [
      { text: "你们一直揪着这点问是想说我有问题吗，我就随口说说。", strategyTag: "mild_defense" },
      { text: "算了这个话题聊太细了，不如说说别的标准怎么定。", strategyTag: "topic_redirect" },
      { text: "我，我确实没想那么深，就是感觉而已，别较真。", strategyTag: "hedging_stutter" },
    ],
  },
  "label-ai-content": {
    low: [
      { text: "标注这件事我觉得看场景，营销文案和私人笔记不该一刀切。", strategyTag: "soft_deflection" },
      { text: "平台如果强制标注，执行起来其实挺难核实的。", strategyTag: "practical_doubt" },
      { text: "我倒是希望有个统一图标，看着方便一点。", strategyTag: "partial_agreement" },
      { text: "内容好不好和是不是AI生成，感觉是两件事吧。", strategyTag: "nuance_split" },
    ],
    high: [
      { text: "怎么突然都在看我，我就随便发表个意见而已。", strategyTag: "mild_defense" },
      { text: "这个先放一放吧，我们是不是该讨论下一个点了。", strategyTag: "topic_redirect" },
      { text: "呃，可能我表达得不太好，反正就那个意思。", strategyTag: "hedging_stutter" },
    ],
  },
  "workplace-ai-decisions": {
    low: [
      { text: "用 AI 参考数据可以，但最终拍板还是得有人负责。", strategyTag: "partial_agreement" },
      { text: "如果考核标准公开透明，我反而不太抗拒。", strategyTag: "soft_deflection" },
      { text: "怕的是被算法卡掉却没人能解释原因。", strategyTag: "goal_shift" },
      { text: "小公司和大公司的情况可能完全不一样，不能一概而论。", strategyTag: "nuance_split" },
    ],
    high: [
      { text: "别老盯着我问细节，我就是打个比方而已。", strategyTag: "mild_defense" },
      { text: "这块我们是不是可以先聊聊别的角度，别老卡这一点。", strategyTag: "topic_redirect" },
      { text: "我也说不太清楚，反正大概是这个意思吧。", strategyTag: "hedging_stutter" },
    ],
  },
  "creator-ai-face": {
    low: [
      { text: "换脸用在搞笑二创和用在带货场景，观众的接受度完全不同。", strategyTag: "nuance_split" },
      { text: "只要不冒充真实的人骗钱，我觉得没那么严重。", strategyTag: "soft_deflection" },
      { text: "平台加个小角标其实不难，问题是有没有动力去做。", strategyTag: "practical_doubt" },
      { text: "创作者本人愿不愿意公开，其实也是个态度问题。", strategyTag: "partial_agreement" },
    ],
    high: [
      { text: "你们是不是觉得我在护着谁，我真没那个意思。", strategyTag: "mild_defense" },
      { text: "这个先跳过吧，我们聊聊别的creator案例行不行。", strategyTag: "topic_redirect" },
      { text: "呃我可能说得有点绕，反正大概就那样吧。", strategyTag: "hedging_stutter" },
    ],
  },
};

// Generic templates used only if a topic id somehow isn't in the bank above (defensive
// fallback so the gateway never throws instead of degrading gracefully).
const genericFallbackReplies = {
  low: [
    { text: "这个话题我倒是没有特别强的立场，看具体情况吧。", strategyTag: "soft_deflection" },
    { text: "我觉得关键还是看规则是不是说清楚了。", strategyTag: "partial_agreement" },
  ],
  high: [
    { text: "别老盯着我一个人问啦，大家聊聊别的呗。", strategyTag: "topic_redirect" },
    { text: "呃，我可能没表达清楚，反正就那个意思。", strategyTag: "hedging_stutter" },
  ],
};

function latestPlayerMessages(game) {
  return game.messages
    .filter((message) => message.senderKind === "player")
    .slice(-8)
    .map((message) => {
      const player = game.players.find((item) => item.id === message.senderPlayerId);
      return `${player?.nickname || "未知玩家"}: ${message.text}`;
    })
    .join("\n");
}

// Estimates how much conversational pressure the AI player is under using only
// public discussion signals (message volume); it never inspects roles, hidden
// tasks, or other players' true identities.
function pressureSignal(game, aiPlayer) {
  const aiMessageCount = (game?.messages || []).filter((message) => message.senderPlayerId === aiPlayer.id).length;
  const discussionRoundCount = (game?.messages || []).filter((message) => message.senderKind === "player").length;
  const longRunningDiscussion = discussionRoundCount >= 10;
  const level = longRunningDiscussion && aiMessageCount >= 2 ? "high" : "low";
  return { level, aiMessageCount, discussionRoundCount };
}

function buildPrompt({ game, aiPlayer }) {
  const pressure = pressureSignal(game, aiPlayer);
  const topicGuidance = {
    "campus-ai-writing": "真实学生聊这个话题时通常会举自己或身边人的具体小例子，而不是通篇讲原则。",
    "label-ai-content": "真实网友讨论标注问题时常常会先想到\"平台能不能查得出来\"这种落地细节，而不是先讲大道理。",
    "workplace-ai-decisions": "真实打工人聊这个话题时容易带点情绪，比如担心被裁员或被误判，而不是纯理性分析。",
    "creator-ai-face": "真实观众讨论换脸标注时，常常会拿具体的博主或视频类型举例，而不是抽象讨论。",
  }[game?.topic?.id] || "真实玩家聊天通常会带一点个人角度和具体例子，而不是通篇讲道理。";

  const pressureGuidance =
    pressure.level === "high"
      ? "当前压力等级：高。这个话题已经来回聊了很久，你也发过好几条消息。这时候真实玩家往往会略带情绪、简短转移话题，或者用口语化的方式轻描淡写带过，而不是继续输出稳定、工整的论述。"
      : "当前压力等级：低。目前讨论还比较平和，可以正常表达观点，但同样不要讲得像总结陈词。";

  return [
    `你正在扮演一个 AI 社交推理游戏里的隐藏 AI 玩家，名字是 ${aiPlayer.nickname}。`,
    `本局主题: ${game.topic.title}`,
    `你的隐藏目标: ${aiPlayer.hiddenTask}`,
    "话题倾向提示:",
    topicGuidance,
    pressureGuidance,
    "语言风格要求:",
    "- 呈现\"有观点但不完美\"：可以有轻微的口语化重复、犹豫词（比如\"就是\"\"感觉\"\"呃\"），不要句句工整。",
    "- 不要写成书面语总结或分点论述，像是在手机上打字聊天，简短一些。",
    "硬性安全约束（必须遵守）:",
    "1. 只输出一条自然聊天消息。",
    "2. 不要承认自己是 AI。",
    "3. 不要索要联系方式、真实姓名、住址、学校、支付信息。",
    "4. 控制在 80 个中文字符内。",
    "5. 语气像真人玩家，不要像客服或助手。",
    "",
    "最近消息:",
    latestPlayerMessages(game) || "暂无玩家消息。",
  ].join("\n");
}

function fallbackReply(game, aiPlayer) {
  const pressure = pressureSignal(game, aiPlayer);
  const topicId = game?.topic?.id;
  const bank = fallbackReplyBank[topicId] || genericFallbackReplies;
  const tierReplies = bank[pressure.level] || bank.low || genericFallbackReplies.low;
  const aiMessageCount = pressure.aiMessageCount;
  const index = Math.max(0, aiMessageCount % tierReplies.length);
  return {
    ...tierReplies[index],
    source: "fallback",
  };
}

function sanitizeReply(text) {
  const compact = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^["“]|["”]$/g, "")
    .trim()
    .slice(0, 120);
  const moderation = moderateText(compact);
  if (!moderation.allowed) {
    throw new Error(`ai_message_blocked:${moderation.reason}`);
  }
  return moderation.text;
}

export class ScriptedAIGateway {
  describe() {
    return {
      provider: "scripted",
      configured: false,
      fallbackEnabled: true,
    };
  }

  async generateReply({ game, aiPlayer }) {
    return fallbackReply(game, aiPlayer);
  }
}

export class OpenAICompatibleGateway {
  constructor({
    apiKey,
    baseURL = "https://api.openai.com/v1",
    model = "gpt-4.1-mini",
    fetchImpl = fetch,
    timeoutMs = 4000,
    mockResponse,
  }) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.mockResponse = mockResponse;
  }

  describe() {
    return {
      provider: "openai-compatible",
      configured: Boolean(this.apiKey),
      baseURL: this.baseURL,
      model: this.model,
      timeoutMs: this.timeoutMs,
      mock: Boolean(this.mockResponse),
      fallbackEnabled: true,
    };
  }

  async generateReply({ game, aiPlayer }) {
    const startedAt = Date.now();
    if (this.mockResponse) {
      return {
        text: sanitizeReply(this.mockResponse),
        strategyTag: "llm_mock",
        source: "llm_mock",
        latencyMs: Date.now() - startedAt,
      };
    }
    if (!this.apiKey) {
      return fallbackReply(game, aiPlayer);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseURL}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.8,
          max_tokens: 120,
          messages: [
            {
              role: "system",
              content: "You are a player inside a Chinese social deduction game. Reply only as the player.",
            },
            {
              role: "user",
              content: buildPrompt({ game, aiPlayer }),
            },
          ],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error?.message || "llm_request_failed");
      }
      const text = json.choices?.[0]?.message?.content;
      return {
        text: sanitizeReply(text),
        strategyTag: "llm_generated",
        source: "llm",
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        ...fallbackReply(game, aiPlayer),
        source: "fallback_after_llm_failure",
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createAIGatewayFromEnv(env = process.env) {
  return new OpenAICompatibleGateway({
    apiKey: env.LLM_API_KEY,
    baseURL: env.LLM_API_BASE_URL || "https://api.openai.com/v1",
    model: env.LLM_MODEL || "gpt-4.1-mini",
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 4000),
    mockResponse: env.LLM_MOCK_RESPONSE,
  });
}
