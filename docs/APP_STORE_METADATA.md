# 图灵迷局 App Store Metadata Draft

本文档用于准备 App Store Connect metadata、review notes、截图说明和年龄分级口径。正式提交前必须用真实生产 URL、真实 support URL、真实 TestFlight build 和真机截图替换占位项。

## Field Length Guardrails

本地发布门禁会按下表检查 zh-Hans 和 en-US 草案。这里使用 JavaScript `length` 做保守检查；App Store Connect 的最终 UI 仍需在提交前再确认一次。

| Field | Limit |
|---|---:|
| App Name | <=30 characters |
| Subtitle | <=30 characters |
| Promotional Text | <=170 characters |
| Keywords | <=100 characters |
| Description | <=4000 characters |
| What's New | <=4000 characters |

## zh-Hans Metadata

| 字段 | 草案 |
|---|---|
| App Name | 图灵迷局 |
| Subtitle | 找出混在局里的 AI |
| Category | Games |
| Subcategory | Trivia / Word |
| Promotional Text | 每一局都是限时推理房间。听发言、记证据、归票，判断谁是真人，谁在伪装。 |
| Keywords | AI推理,社交推理,文字游戏,好友房,投票,复盘,找AI,派对游戏 |
| Description | 图灵迷局是一款文字版 AI 社交推理游戏。玩家进入限时房间，围绕同一个话题发言、观察、记录证据，并在归票阶段找出隐藏的 AI 或完成本局阵营任务。每局都有明确规则、任务卡、计时阶段、投票、揭晓和复盘。你可以快速开始，也可以创建好友房，和熟人一起测试谁更会识破伪装。游戏提供局后举报、拉黑、账号删除和隐私入口，所有聊天都发生在有规则、有结算的游戏房间中，不是开放随机聊天产品。 |
| What's New | 首发版本提供固定账号登录、快速局、好友房、任务卡、投票、揭晓、复盘、局后举报和安全处理。 |
| Support URL | `https://your-domain.com/support` |
| Privacy Policy URL | `https://your-domain.com/legal/privacy` |
| Community Guidelines URL | `https://your-domain.com/legal/community` |

## en-US Metadata

| Field | Draft |
|---|---|
| App Name | Turing Mirage |
| Subtitle | Find the hidden AI player |
| Category | Games |
| Subcategory | Trivia / Word |
| Promotional Text | Enter short deduction rooms, read the chat, track evidence, and vote before the reveal. |
| Keywords | AI deduction,social deduction,word game,party game,voting,replay,friends room |
| Description | Turing Mirage is a text-based social deduction game about spotting AI players in short rule-based rooms. Each match has a topic, task card, timed discussion, voting, reveal, replay, and post-game safety controls. Play quick rounds or create a friends room, then review the evidence after the reveal. The app is not an open random chat service. Conversations happen only inside structured game rooms with reporting, blocking, account deletion, and moderation support. |
| What's New | Initial release with fixed account login, quick matches, friends rooms, task cards, voting, reveal, replay, post-game reports, and safety tools. |
| Support URL | `https://your-domain.com/support` |
| Privacy Policy URL | `https://your-domain.com/legal/privacy` |
| Community Guidelines URL | `https://your-domain.com/legal/community` |

## Review Notes

Use this as the starting point for App Review notes:

```text
图灵迷局 is a rule-based text social deduction game, not an open random chat app. Every conversation happens inside a timed game room with a topic, task card, voting, reveal, replay, and post-game safety controls.

Login uses Sign in with Apple as the production-ready iOS login entry. Guest entry is not shown in the player-facing app. WeChat and Google native iOS login require production SDK configuration before their Release entries are shown. If App Review needs a prepared account, provide a provider-backed review account here before submission.

Safety controls:
- User messages are moderated before entering a room.
- AI output is moderated and falls back safely if provider output fails or is blocked.
- Reports are submitted after a match against a player and are linked to game, room, reporter, target, and match context.
- Users can block reported players.
- Account deletion is available in Settings and clears the local Keychain token.

Production API:
MIRAGE_API_BASE_URL must point to the HTTPS production backend before archive.
```

## Screenshot Plan

Screenshots must show real player-facing UI only. Do not show debug buttons, admin pages, localhost URLs, placeholder domains, raw tokens, internal project notes, or old product names.

| Slot | Screen | Purpose |
|---|---|---|
| 1 | Onboarding with Apple login | Shows fixed account entry and game premise |
| 2 | Lobby / quick start | Shows first-session path and mode cards |
| 3 | Task card | Shows the correct “任务卡” framing, not identity card |
| 4 | Discussion room | Shows player chat, evidence notes, and game phase |
| 5 | Voting confirmation | Shows deliberate归票 flow and avoids accidental votes |
| 6 | Reveal / replay | Shows outcome, AI reveal, evidence, and rematch |
| 7 | Post-game report sheet | Shows safety flow after the match, not per-message reporting |
| 8 | Profile / account safety | Shows legal links, account deletion, and rights preview |

## Age Rating Draft

Target: 13+ or higher, subject to final App Store Connect questionnaire and production topic set.

Current rationale:

- No gambling.
- No real-money gameplay advantage.
- No user-generated public feed.
- No voice, camera, microphone, location, contacts, or photo upload.
- Text chat exists only inside structured game rooms and is moderated.
- Some user-generated text may include mild conflict or social deduction accusations.
- Public matching and user-generated messages require reporting, blocking, moderation, and operator review.

Escalate rating review if any of these are added:

- Voice chat, image upload, creator topics, open public chat, dating-style matching, real-money purchases, advertising SDKs, or external community links.

## Metadata Stop-Ship Checks

Do not submit if any metadata or screenshot contains:

1. “狼人杀” as the product name.
2. “找AI” as the product name.
3. Guest entry, local preview, debug fill, admin token, localhost, or placeholder production URL.
4. Claims that paid products improve win rate, reveal identity, boost matchmaking, guide voting, or alter settlement.
5. Privacy statements that conflict with `docs/PRIVACY_DATA_MAP.md`.
