# 图灵迷局 API Contract

Base URL:

```text
https://api.mirage.example.com
```

本地开发:

```text
http://127.0.0.1:8787
```

## Operations

### GET `/health`

Returns lightweight process health and configured store name.

### GET `/ready`

Reads the active store and returns readiness data. Deployment platforms should use this endpoint to detect **PostgreSQL** or persistence failures and verify AI provider configuration without exposing secrets.

Example fields:

```json
{
  "ok": true,
  "name": "mirage-server",
  "store": "postgres",
  "ai": {
    "provider": "openai-compatible",
    "configured": true,
    "model": "gpt-4.1-mini",
    "timeoutMs": 4000,
    "fallbackEnabled": true
  },
  "reportAlerts": {
    "configured": true,
    "destination": "https://hooks.your-domain.com",
    "timeoutMs": 3000
  },
  "users": 12,
  "games": 4
}
```

## Rate Limits

Write-heavy endpoints may return `429` with errors such as `rate_limited:auth`, `rate_limited:messages`, or `rate_limited:reports`. Auth is limited per IP; authenticated game actions are limited per user or per user/game.

## Auth

### POST `/auth/guest`

Automated tests and review demo only. Player-facing Web and iOS onboarding must use Apple, WeChat, or Google account login and must not present guest or local preview entry.

Request:

```json
{
  "nickname": "玩家",
  "ageConfirmed": true,
  "communityConfirmed": true
}
```

Response:

```json
{
  "user": {
    "id": "user-id",
    "nickname": "玩家",
    "kind": "guest",
    "avatarKey": "default-1",
    "deletedAt": null,
    "bannedAt": null,
    "banReason": null,
    "ageConfirmed": true,
    "communityConfirmed": true
  },
  "token": "session-token"
}
```

`ageConfirmed` and `communityConfirmed` must both be `true`; otherwise the server returns `422 onboarding_confirmation_required`.

### POST `/auth/apple`

Request:

```json
{
  "identityToken": "apple-jwt",
  "authorizationCode": "apple-authorization-code",
  "nickname": "Apple 用户",
  "ageConfirmed": true,
  "communityConfirmed": true
}
```

生产环境必须设置 `APPLE_BUNDLE_ID` 并验证 Apple JWT。

### POST `/auth/google`

Request:

```json
{
  "identityToken": "google-id-token",
  "nickname": "Google 用户",
  "ageConfirmed": true,
  "communityConfirmed": true
}
```

生产环境必须设置 `GOOGLE_CLIENT_ID` 并验证 Google ID token。非生产环境允许 `mock.google.*` token 用于本地预览和自动化测试。

### POST `/auth/wechat`

Request:

```json
{
  "code": "wechat-sdk-login-code",
  "nickname": "微信用户",
  "ageConfirmed": true,
  "communityConfirmed": true
}
```

生产环境必须设置 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`，服务端使用微信开放平台登录 code 换取 `openid` / `unionid`。非生产环境允许 `mock.wechat.*` code 用于本地预览和自动化测试。

### DELETE `/account`

Requires bearer token. Deletes guest, Apple-linked, WeChat-linked, or Google-linked account data from 图灵迷局 records.

Deletion anonymizes the user profile, clears Apple/WeChat/Google-linked identifiers, removes pending matchmaking and lobby presence, clears block relationships, and replaces historical player nicknames with `已删除用户` while retaining minimal safety and compliance records.

For Apple-linked users, the server attempts to revoke the Apple refresh token and returns an `appleRevoke` status. A revoke failure does not block local account deletion:

```json
{
  "user": {
    "id": "user-id",
    "nickname": "已删除用户",
    "deletedAt": "2026-06-09T00:00:00.000Z"
  },
  "appleRevoke": {
    "revoked": false,
    "reason": "apple_revoke_failed"
  }
}
```

### GET `/me`

Requires bearer token. Returns the current user and is used by the iOS app to validate Keychain session tokens on cold start.

Response:

```json
{
  "user": {
    "id": "user-id",
    "nickname": "玩家",
    "kind": "guest",
    "avatarKey": "default-1",
    "deletedAt": null,
    "bannedAt": null,
    "banReason": null
  }
}
```

### GET `/me/summary`

Requires bearer token. Returns user-facing home summary data for 战绩、任务 and 我的 sections. This endpoint is read-only and computed from existing games, rooms, reports and blocks.

Response:

```json
{
  "summary": {
    "wallet": {
      "clueStars": 50,
      "xp": 25
    },
    "progression": {
      "level": 1,
      "title": "新手侦探",
      "xp": 25,
      "currentLevelXp": 0,
      "nextLevelXp": 50,
      "progress": 0.5,
      "nextTitle": "见习预言家"
    },
    "cosmetics": {
      "equippedId": "classic-sleuth",
      "equipped": {
        "id": "classic-sleuth",
        "name": "黑金侦探框",
        "description": "默认头像框，适合刚上桌的新玩家。",
        "cost": 0,
        "rarity": "基础",
        "accent": "#ffd46b",
        "owned": true,
        "equipped": true,
        "affordable": true
      },
      "items": []
    },
    "stats": {
      "completedGames": 3,
      "activeGames": 0,
      "wins": 2,
      "winRate": 0.66,
      "replayReady": 3,
      "replayReadyRate": 1
    },
    "recent": {
      "gameId": "game-id",
      "modeId": "M01",
      "topicTitle": "是否允许用 AI 完成作业？",
      "winner": "human",
      "completedAt": "2026-06-09T00:00:00.000Z",
      "replayReady": true
    },
    "missions": {
      "dateKey": "2026-06-11",
      "quickStartCompletedToday": true,
      "replayReadyToday": true,
      "winCompletedToday": false,
      "items": [
        {
          "id": "daily_quick_start",
          "title": "完成 1 局快速开始",
          "description": "完成任意公开局并进入复盘。",
          "reward": {
            "clueStars": 20,
            "xp": 10
          },
          "progress": 1,
          "target": 1,
          "completed": true,
          "claimed": false,
          "claimable": true
        }
      ]
    },
    "safety": {
      "reportsSubmitted": 0,
      "blocks": 0,
      "banned": false
    }
  }
}
```

### POST `/me/cosmetics/:itemId/unlock`

Requires bearer token. Unlocks a cosmetic item with free in-game `clueStars`, equips it immediately, and returns the refreshed home summary. This is not a paid currency or in-app purchase endpoint.

Errors:

- `cosmetic_not_found`
- `cosmetic_not_enough_stars`

Response:

```json
{
  "summary": {
    "wallet": {
      "clueStars": 0,
      "xp": 25
    },
    "cosmetics": {
      "equippedId": "signal-tracker"
    }
  }
}
```

### POST `/me/cosmetics/:itemId/equip`

Requires bearer token. Equips an already owned cosmetic item and returns the refreshed home summary.

Errors:

- `cosmetic_not_found`
- `cosmetic_not_owned`

Response:

```json
{
  "summary": {
    "cosmetics": {
      "equippedId": "classic-sleuth"
    }
  }
}
```

### POST `/me/missions/:missionId/claim`

Requires bearer token. Claims one completed daily mission reward. The server stores one claim per user, mission and day, then returns the refreshed summary. Rewards are free in-game progress only and are not paid currency.

Errors:

- `mission_not_found`
- `mission_not_completed`
- `mission_already_claimed`
- `user_banned`

Response:

```json
{
  "summary": {
    "wallet": {
      "clueStars": 70,
      "xp": 35
    }
  }
}
```

### GET `/me/games`

Requires bearer token. Returns recent game-history summaries for the 战绩 page. This endpoint does not return messages or replay details; clients open a specific game through `GET /games/:gameId`, which keeps the existing member authorization check.

Response:

```json
{
  "games": [
    {
      "gameId": "game-id",
      "roomId": null,
      "modeId": "M01",
      "topicTitle": "是否允许用 AI 完成作业？",
      "phase": "COMPLETED",
      "winner": "human",
      "updatedAt": "2026-06-09T00:00:00.000Z",
      "replayReady": true,
      "playerCount": 2,
      "humanCount": 1,
      "aiCount": 1,
      "myRole": "human",
      "voted": true
    }
  ]
}
```

### GET `/leaderboard`

Requires bearer token. Returns the current season leaderboard for the 榜单 page. The server computes rows from existing user wallet, completed games, wins and replay-ready games; no extra leaderboard table is required for v1.

Response:

```json
{
  "leaderboard": {
    "season": {
      "id": "S1",
      "title": "S1 推理赛季",
      "rule": "按经验、胜场、复盘局数综合排序"
    },
    "top": [
      {
        "userId": "user-id",
        "nickname": "榜一玩家",
        "level": 1,
        "title": "新手侦探",
        "xp": 25,
        "clueStars": 50,
        "score": 50,
        "completedGames": 1,
        "wins": 1,
        "winRate": 1,
        "replayReady": 1,
        "isCurrentUser": true,
        "rank": 1
      }
    ],
    "aroundMe": [],
    "myRank": null,
    "totalPlayers": 1,
    "updatedAt": "2026-06-09T00:00:00.000Z"
  }
}
```

### GET `/commerce/catalog`

Requires bearer token. Returns a read-only Phase 2 commerce preview catalog for the 我的 page. This endpoint does not create purchases and must not be used to sell gameplay advantage. Real payments must use Apple **IAP** or another platform-approved purchase provider before any paid entitlement is enabled.

Response:

```json
{
  "catalog": {
    "version": "phase2-preview-v1",
    "paymentsEnabled": false,
    "purchaseProvider": "app_store_iap_required",
    "headline": "权益预告",
    "summary": "只规划外观、复盘和好友房便利，不出售胜率、身份信息或投票优势。",
    "fairnessGuards": [
      "不出售身份、阵营、AI 位置或投票提示。"
    ],
    "offers": [
      {
        "id": "cosmetic_theme_pack",
        "title": "装扮主题包",
        "category": "cosmetic",
        "phase": "Phase 2",
        "status": "preview",
        "priceLabel": "未开放",
        "value": "头像框、桌面色、结算卡样式。",
        "fairness": "只改变展示，不影响身份、投票、匹配或结算。"
      }
    ]
  }
}
```

## Modes

### GET `/modes`

Returns the shared world setting plus M01, M02, M03, M04, M06 and M08 mode configs. All modes share one unified background (`worldSetting`); they differ only in table size, AI count and hidden roles. Clients use this response for both start-room logic and player-facing mode rules.

The response includes `worldSetting`:

- `title`, `tagline`, `background`: the unified narrative shared by every mode; home screens render this once instead of per-mode lore.

Each mode includes:

- `id`, `name`, `playerCount`, `aiCount`, `minHumanCount`
- `discussionSeconds`, `finalStatementSeconds`, `votingSeconds`, `voteType`
- `voteType: "identify_ai_pair"` is used by M04. Each human still casts one vote; the human side wins only if every AI receives at least one vote and each AI's vote total is higher than any human's.
- `matchType`: `public` or `friend_room`
- `difficulty`: 1 (入门), 2 (进阶) or 3 (高阶), for home-screen presentation
- `tagline`: one-line selling point for mode cards
- `intro`, `goal`
- `flow`: short player-facing phase names (identical structure across modes; friend-room modes prepend room setup steps)
- `rules`: player-facing rule bullets
- `safety`: post-game report and block handling copy

Example:

```json
{
  "worldSetting": {
    "title": "图灵迷局",
    "tagline": "一张圆桌，一个话题，找出伪装成真人的 AI。",
    "background": "每一局都发生在同一张圆桌上：所有玩家围绕同一个话题发言，其中混着伪装成真人的 AI。听发言、抓破绽，在投票前找出它。"
  },
  "modes": [
    {
      "id": "M01",
      "name": "单线接触",
      "playerCount": 2,
      "aiCount": 1,
      "minHumanCount": 1,
      "discussionSeconds": 120,
      "finalStatementSeconds": 25,
      "votingSeconds": 20,
      "voteType": "identify_ai",
      "matchType": "public",
      "difficulty": 1,
      "tagline": "一对一快速判断，2 分钟一局。",
      "intro": "圆桌只坐两个人：对面可能是 AI，也可能是真人补位。",
      "goal": "听完对方发言，判断对方是真人还是 AI。",
      "flow": ["任务卡", "讨论发言", "最终陈述", "投票归票", "身份揭晓", "复盘"],
      "rules": [
        "围绕话题自由对话，观察对方是否回避细节。",
        "投票时判断对方是 AI 还是真人，提交后立即揭晓。"
      ],
      "safety": "收局后可处理扰局玩家。"
    }
  ]
}
```

### GET `/topics`

Returns the enabled official topic library. Use `?modeId=M01` to return only enabled topics available for a mode. Admin topic settings take effect immediately for new matchmaking, new rooms and lobby topic changes.

Each topic includes:

- `id`, `title`, `category`, `risk`
- `modeIds`: modes where the topic can be selected
- `enabled`: disabled topics are hidden from clients

Example:

```json
{
  "topics": [
    {
      "id": "label-ai-content",
      "title": "AI 生成内容是否必须标注？",
      "category": "AI 生活",
      "risk": "medium",
      "modeIds": ["M01", "M02", "M03", "M04"],
      "enabled": true
    }
  ]
}
```

## Matchmaking

### POST `/quick-start`

Requires bearer token. Starts any mode as a solo game immediately: the requester takes the single real-human seat, remaining human seats are filled with scripted-human fill-ins and AI seats with AI players, and the game enters `DISCUSSION` right away — no waiting or friend-room setup. This is what the lobby "开始对局" button uses so every mode is "点开即玩".

Request:

```json
{
  "modeId": "M06",
  "topicId": "label-ai-content"
}
```

`topicId` is optional (same resolution as `/matchmaking/start`). The response always has `status: "matched"` with the created `game` (HTTP `201`). The real-human player is always seated as a detective (`role: "human"`); for M06/M08 the hidden 人类卧底 / 伪 AI 真人 role is assigned to a scripted-human fill-in so the player keeps the detective viewpoint in solo play.

### POST `/matchmaking/start`

Request:

```json
{
  "modeId": "M01",
  "topicId": "label-ai-content"
}
```

`topicId` is optional. If omitted, the server uses the first available official topic for the selected mode. Invalid or unavailable topics return `422 topic_not_available`.

M01 immediately returns a matched 2-player truth-test game. The opponent is hidden as `kind: "unknown"` / `role: "hidden"` before reveal and may be either AI or a scripted human fill-in. In M01, `targetPlayerId: "abstain"` means "judge the opponent as human"; it is not treated as a skipped vote. M02 waits until two human users join with the same `modeId` and `topicId`, then creates 2 human + 1 AI.

Waiting response:

```json
{
  "status": "waiting",
  "modeId": "M02",
  "topicId": "label-ai-content",
  "ticketId": "matchmaking-ticket-id",
  "createdAt": "2026-06-15T12:00:00.000Z"
}
```

### GET `/matchmaking/:ticketId`

Requires bearer token. Returns `202` while the ticket is still waiting and `200` with `game` after another compatible player completes the match. Waiting and matched responses include `createdAt`, the original ticket creation time, so Web and iOS can show elapsed waiting time and switch suggestions consistently. The iOS waiting screen polls this endpoint to enter the game automatically.

### DELETE `/matchmaking/:ticketId`

Requires bearer token. Cancels a waiting ticket when the user leaves the waiting screen:

```json
{
  "status": "cancelled",
  "modeId": "M02",
  "topicId": "label-ai-content",
  "ticketId": "matchmaking-ticket-id"
}
```

If the ticket was matched just before cancellation, the server returns `status: "matched"` and the created `game` instead of dropping the user from the game.

## Friend Rooms

### POST `/rooms`

Creates a friend room with invite code. `topicId` is optional and follows the same validation rules as matchmaking.

Request:

```json
{
  "modeId": "M03",
  "topicId": "workplace-ai-decisions",
  "allowAiFill": true
}
```

The returned room includes `topicId`.

### POST `/rooms/join`

Joins a room by invite code.

Friend-room human seats are capped before AI seats are filled. A room can contain at most `mode.playerCount - mode.aiCount` human players in `LOBBY`; if the room is full, the server returns `409 room_full`. This preserves fixed mode sizes such as M03 = 3 human seats + 1 AI seat, M04 = 4 human seats + 2 AI seats, and M06/M08 = 4 human seats + 1 AI seat.

### GET `/rooms/:roomId`

Requires bearer token. Returns the latest lobby or started-room state for room members. The iOS friend-room screen polls this endpoint so host and guests can observe joins, ready state changes, and `gameId` after the room starts. `hostUserId` is nullable because a room becomes `CLOSED` with no host after the final human member leaves.

### DELETE `/rooms/:roomId`

Requires bearer token. Lets a lobby member leave before the room starts. If the host leaves, the next human member becomes host. If no human members remain, the room is marked `CLOSED` and returns `hostUserId: null`. Started rooms return `409 room_leave_not_allowed`.

### POST `/rooms/:roomId/ready`

Sets ready state.

### POST `/rooms/:roomId/topic`

Requires bearer token. Host-only, lobby-only endpoint for changing the room's official topic before start.

Request:

```json
{
  "topicId": "workplace-ai-decisions"
}
```

The selected topic must be available for the room mode. Changing the topic resets non-host human members to `ready: false`; the host remains ready. Non-host requests return `403 only_host_can_update_topic`, started rooms return `409 room_topic_locked`, and invalid topics return `422 topic_not_available`.

### POST `/rooms/:roomId/start`

Host starts the room with the room's current `topicId`. All human members must be ready, and the room must meet the mode's minimum human-player requirement before AI/scripted seats are filled. The server also rejects overfilled rooms with `409 room_full` before creating the game. For the current friend-room modes, M03 requires at least 2 human players and allows at most 3, M04 requires at least 3 and allows at most 4, and M06/M08 require exactly 4 human players. Otherwise the server returns `409 not_enough_humans`, `409 not_all_ready`, or `409 room_full`.

### POST `/debug/rooms/:roomId/fill-and-start`

Non-production only. Host can start a local preview room by filling missing human seats with scripted human players before normal AI seats are added. This exists only for local demo coverage of M04/M06/M08; production `/rooms/:roomId/start` still enforces the minimum real-human requirement.

### POST `/rooms/:roomId/rematch`

Requires bearer token. After the room's current game reaches `COMPLETED`, any original human room member can create or reopen the next lobby for the same room group. The new lobby preserves the previous room's `modeId`, `topicId`, AI fill setting and eligible human members; the user who requests the rematch becomes the new host and is marked ready, while other retained members must ready again before start.

The endpoint returns `201` when it creates the rematch lobby and `200` when a rematch lobby already exists for that source room. If the source game is not complete, it returns `409 room_rematch_not_available`.

## Games

### GET `/games/:gameId`

Returns server-authoritative state. Completed friend-room games include `rematchRoomId` when a new rematch lobby already exists and the viewer is a member of that lobby, so clients can show “进入再来一局房间” instead of creating another rematch.

Game state includes `taskCard`, a viewer-scoped server-authoritative acknowledgement state for the opening task card. During `DISCUSSION`, player discussion actions are rejected until the current viewer has acknowledged the task card through `POST /games/:gameId/task-card`; clients must not rely on local-only “seen” state for this gate. Detail questions are ordinary chat: if a player wants details, they send a message directly; the only private evidence tool is the per-message clue mark (`reactionType: "clue"`). During `FINAL_STATEMENT`, `finalStatement` tells the current viewer whether they can still submit their one final statement. During `VOTING`, `votes` remains hidden, while `myVote` exposes only the current viewer's latest vote and `voteState` exposes `submitted`, `submittedCount`, `remaining`, and `total` so clients can show “已投，可修改” and “还差几名真人交票” without leaking other players' choices. Replay keeps `aiPlayerId` / `aiGoal` for single-AI compatibility and also returns `aiPlayerIds` / `aiGoals` so modes such as M04 can reveal multiple AI goals. Replay also returns `taskResults` for each player so clients can show “我的任务结果” by matching `taskResults[].playerId` to the current user's player. The legacy `MID_CHECK` phase, viewer-scoped `suspicions` evidence notes, and role skill actions have been removed from gameplay; their endpoints and fields no longer exist:

Each `messages[]` item may include viewer-scoped `reactionType: "clue"` when the current user marked that line as a clue. This is private evidence memory for voting and replay UI. It must not be treated as a public reaction count and must not expose `strategyTag` before reveal.

Before `REVEAL`, the current viewer can see only their own `userId`, real `kind`, `role`, and `hiddenTask`. Other seats return `userId: null`, `kind: "unknown"`, `role: "hidden"`, and `hiddenTask: null`, so clients cannot infer who is a real human, AI, scripted fill-in, human undercover, or fake AI before reveal. This is required for M02/M03/M04 identity fairness and for M06 人类卧底 / M08 伪 AI 诱饵局.

For M06 and M08, the server chooses `human_undercover` / `fake_ai` from real human users at game start. Clients must not assume the last joined user, host, or any fixed seat owns the special role; use the viewer-scoped `role` and `hiddenTask` fields from `GET /games/:gameId`.

```json
{
  "game": {
    "id": "game-id",
    "phase": "DISCUSSION",
    "players": [
      {
        "id": "player-id",
        "userId": "current-viewer-user-id",
        "kind": "human",
        "role": "human",
        "hiddenTask": null
      },
      {
        "id": "other-player-id",
        "userId": null,
        "kind": "unknown",
        "role": "hidden",
        "hiddenTask": null
      }
    ],
    "votes": [],
    "myVote": null,
    "voteState": null,
    "taskCard": {
      "acknowledged": false,
      "acknowledgedCount": 0,
      "total": 1
    },
    "finalStatement": {
      "submitted": false,
      "remaining": 0
    }
  }
}
```

### POST `/games/:gameId/task-card`

Acknowledges the opening task card for the current viewer. This endpoint is idempotent and returns the updated `game`.

Important errors:

- `409 task_card_not_acknowledged` may be returned by discussion actions when this acknowledgement is missing.

### POST `/games/:gameId/messages`

Moderates and sends a message during `DISCUSSION` or `FINAL_STATEMENT`. During `DISCUSSION`, when an AI player is present, the server may call the configured **LLM** gateway to append one AI reply. During `FINAL_STATEMENT`, each human player can submit exactly one final statement; the server does not append extra AI replies, because the AI final statement is added when the phase starts. The response hides AI strategy metadata until `REVEAL` or `COMPLETED`.

Moderation blocks empty/overlong messages and baseline policy categories:

- `privacy_or_contact_info`
- `harassment`
- `adult_content`
- `scam_or_spam`

Important errors:

- `409 message_not_allowed_in_phase`
- `409 final_statement_already_sent`

### POST `/games/:gameId/reactions`

Toggles the current viewer's clue mark on one non-self player message during `DISCUSSION`.

Request:

```json
{
  "messageId": "message-id",
  "type": "clue"
}
```

Response:

```json
{
  "game": {}
}
```

Rules:

- Only `type: "clue"` is accepted.
- The target message must belong to the same game, must be a player message, and must not be the current viewer's own message.
- Repeating the same request removes the clue mark.
- The response returns updated `game.messages[].reactionType` only for the current viewer.

Important errors:

- `409 reaction_not_allowed_in_phase`
- `422 invalid_message`
- `422 invalid_reaction_type`

### POST `/games/:gameId/votes`

Submits or updates vote during `VOTING`. Last valid vote wins. Before reveal, the response still hides `votes` and returns the submitter's `myVote` plus `voteState`; after all required human players vote or the timer ends, the game enters `REVEAL` and the public vote summary becomes visible.

Request:

```json
{
  "targetPlayerId": "player-id"
}
```

`targetPlayerId: "abstain"` is allowed only in M01, where it means “判断对方是真人”. Other modes must target another player.

Important errors:

- `409 vote_not_allowed_in_phase`
- `422 invalid_vote_target`

## Safety

### POST `/reports`

Creates a report linked to room, game, message and target user when available.

Player-facing post-game report reasons should include `post_game_disruptive_play`, `post_game_harassment`, `post_game_threat_or_self_harm`, `post_game_spam_or_scam`, and `post_game_player_report`. Server-side message moderation blocks high-risk text before it enters the room with reasons such as `privacy_or_contact_info`, `harassment`, `violent_threat`, `adult_content`, `scam_or_spam`, and `self_harm_risk`.

Request:

```json
{
  "gameId": "game-id",
  "roomId": "room-id",
  "messageId": "message-id",
  "targetUserId": "target-user-id",
  "reason": "unsafe_advice",
  "block": true
}
```

When `REPORT_ALERT_WEBHOOK_URL` is configured, report creation sends a non-blocking `report.created` webhook for moderation alerting. Webhook success or failure is written to admin audit events. Webhook failures do not prevent the user report from being accepted.

### POST `/blocks`

Blocks another user without creating a report. Use this from post-game safety actions when a player only wants to avoid future matches with the same person.

Request:

```json
{
  "targetUserId": "target-user-id"
}
```

Returns `201 { "block": { ... } }`. The operation is idempotent for the same source and target user. A blocked pair cannot be matched together through public matchmaking or join the same friend room. Blocking yourself returns `422 cannot_block_self`.

## Admin

All admin endpoints require `X-Admin-Token`. `ADMIN_TOKEN` grants write access. Optional `ADMIN_READONLY_TOKEN` grants read-only access to `GET /admin/*` operations, including reports, report context, CSV export, metrics, trends, audit events, topics, rooms, and game lookup. Read-only tokens cannot call mutating admin endpoints; those return `403 admin_write_forbidden`.

- `GET /admin` returns the minimal operations page.
- `GET /admin/reports?status=open&reason=spam&gameId=...&targetUserId=...`
- `GET /admin/session`
- `GET /admin/reports.csv`
- `GET /admin/reports/:reportId/context`
- `PATCH /admin/reports/:reportId`
- `POST /admin/reports/batch`
- `POST /admin/reports/batch-ban-targets`
- `POST /admin/reports/:reportId/ban-target`
- `GET /admin/audit?limit=50`
- `GET /admin/rooms`
- `GET /admin/games/:gameId`
- `GET /admin/metrics`
- `GET /admin/trends?days=14`
- GET `/admin/topics`
- PATCH `/admin/topics/:topicId`

`GET /admin/reports` returns report queue rows. Optional filters are `status`, `reason` substring, `gameId`, `targetUserId`, and `limit` up to 500. The same filters are accepted by `GET /admin/reports.csv`, so operators can export only the current review slice.

`GET /admin/reports/:reportId/context` returns report metadata, room/game metadata, nearby messages, reporter and target user summaries.

`GET /admin/session` returns `{ "access": "write" }` for `ADMIN_TOKEN` and `{ "access": "read" }` for `ADMIN_READONLY_TOKEN`. The admin page uses this endpoint to show 写入权限 or 只读模式 and to disable mutating controls before an operator clicks them.

`GET /admin/reports.csv` downloads the current report table as `text/csv` with report IDs, workflow status/action, reason, timestamps, reporter/target user IDs, and linked game/room/message IDs. It does not include message bodies; operators should use the context endpoint for single-report message review.

`POST /admin/reports/batch` accepts up to 50 report IDs and updates their status/action in one audited operation, for example `{ "reportIds": ["..."], "status": "resolved", "action": "reviewed" }`. Use it for reviewed reports that do not require account action.

`POST /admin/reports/batch-ban-targets` accepts up to 50 report IDs, requires every report to have a `targetUserId`, bans the unique target users, resolves those reports with `action=banned_user`, removes banned users from matchmaking and open lobbies, and writes `report.batch.targets_banned` plus per-user `user.banned` audit events. Operators should use this only after reviewing contexts for the selected reports.

`POST /admin/reports/:reportId/ban-target` marks the target user as banned, resolves the report, removes the target from matchmaking and open lobbies, and blocks future play actions.

`GET /admin/metrics` returns the operations dashboard data: totals for users, active/completed games, AI win rate, reports, report SLA state, product funnel, retention proxy, virtual economy, AI operations, blocks, moderation blocks, mode performance, topic performance, top report reasons, and the oldest open report queue. Report metrics include `slaSeconds`, `oldestOpenAgeSeconds`, `overdueOpen`, `byReason`, and `oldestOpen`. Product, economy and AI metrics are computed from server-authoritative state and audit events: `funnel` includes active users, game starters, completed players, replay viewers, friend-room creators, mission claimers, cosmetic unlockers and conversion rates; `retention` includes repeat completed users and replay view rate; `economy` includes wallet totals, mission rewards granted, cosmetic unlock/equip counts, clue stars spent, and top unlocked cosmetic items; `aiOperations` includes AI message counts by source, **fallback rate**, average measured latency, and an estimated output-token cost proxy per completed game. The token proxy is for local cost trend monitoring only; production should prefer provider usage or billing data when available.

`GET /admin/trends?days=14` returns daily aggregate trends for a 1-90 day window. It includes account creation, active users, game starts, completed games, replay viewers, funnel rates, AI win rate, reports, bans, moderation blocks, AI messages, **fallback rate**, and output-token proxy. It returns aggregate counts only and does not expose user IDs or message bodies.

`GET /admin/audit` returns recent safety and moderation audit events, including report creation, report alert success/failure, report status/action updates, report batch updates, message moderation blocks, user blocks, and user bans. Report update events include previous and next status/action values and an `actor` field.

GET `/admin/topics` returns the complete official topic library, including disabled topics. PATCH `/admin/topics/:topicId` accepts `{ "enabled": false }` or `{ "enabled": true }`, persists the setting in the runtime store, writes a `topic.updated` audit event, and rejects changes that would leave any current mode with no enabled topic by returning `422 topic_disable_would_empty_mode`. Players cannot select disabled topics, and explicit attempts to start matchmaking or change a room to a disabled topic return `422 topic_not_available`.

When a report is submitted with `block: true`, the target user is blocked by the reporter. Blocked pairs are not matched together in public matchmaking and cannot join the same friend-room lobby.

## Legal and Support

These pages are intended for App Store metadata and in-app settings links:

- `GET /legal/privacy`
- `GET /legal/terms`
- `GET /legal/community`
- `GET /support`
