# 后端影响评估：mirage-prototype 改版简报 v2（2.1 / 2.3 / 2.4）

对应文档：`mirage-prototype/REDESIGN_BRIEF_v2.md` 第 2.1、2.3、2.4 节。
评估人：后端工程师（D 角色）。
日期：2026-07-03。

结论摘要：三点里 1 点（2.1）做了低风险纯新增实现，1 点（2.3）做了低风险纯新增实现（新增只读方法 + 新增只读端点），1 点（2.4）确认无需任何后端改动。**未修改** `security.mjs`、`moderation.mjs`、`appleAuth.mjs`、`wechatAuth.mjs`、`googleAuth.mjs`、`commerce.mjs` 的鉴权/风控/支付核心逻辑。

---

## 2.1 好友房邀请强化（圆桌座位状态 + 邀请码大字）

### 现状判断

`docs/API_CONTRACT.md`「Friend Rooms」章节和 `server/src/gameEngine.mjs` 显示，好友房 API **已经**返回：

- `room.inviteCode`：邀请码（`POST /rooms` 创建时生成，`POST /rooms/:roomId/rematch` 再来一局时重新生成）。
- `room.players[]`：每个已占用座位的 `nickname`、`kind`（`human`/`ai`/`scripted_human`）、`ready`、`userId`。
- `room.hostUserId`、`room.status`（`LOBBY`/`IN_GAME`/`CLOSED`）。
- Mode 配置（`server/src/config.mjs` 的 `modes.*.playerCount` / `aiCount` / `minHumanCount`）足以推算总座位数、AI 座位数、最少真人数。

**但没有的**：一个直接可用的"每个座位当前状态"数组。前端要自己拿 `players.length` 和 `mode.playerCount - mode.aiCount` 去反推"哪些座位空着、哪些会被 AI 补位"，容易在等待页出现体验不一致（例如中途换房主、AI 补位时机计算错误）。

### 改动内容（已实施）

在 `server/src/gameEngine.mjs` 新增：

1. `roomSeatLayout(room)`：纯函数，根据房间当前 `players` 和对应 `mode` 配置计算出座位数组，不产生任何新的持久化状态。
2. `serializeRoom(room)`：对房间对象做 `{ ...room, seats, seatSummary }` 包装，**保留所有原有字段不变**，只新增两个字段：
   - `seats[]`：每个座位 `{ index, status, isHost, ready, nickname, userId }`，`status` 取值 `occupied` / `waiting`（真人座位空缺）/ `ai_fill_pending`（房间仍在 LOBBY，AI 位尚未真正生成）/ `ai_fill`（已开局，AI 已实际入座）。
   - `seatSummary`：`{ totalSeats, humanSeats, occupied, waiting, aiFill, minHumanCount }` 汇总计数，方便前端直接渲染文案（例如"2/4 已加入，1 位等待，1 位 AI 补位"）。
3. 在 `createRoom`、`setRoomTopic`、`joinRoom`、`setReady`、`startRoom`、`debugFillAndStartRoom`、`rematchRoom`、`leaveRoom`、`getRoom` 这 9 个引擎方法的返回路径上包一层 `serializeRoom(...)`，只在方法返回值上做包装，不改动 `state.rooms` 里持久化的房间对象本身（用的是展开运算符生成新对象，原始房间对象未被污染）。

`server/src/httpServer.mjs` **未改动**——因为所有房间相关路由本来就是把 engine 返回值原样通过 `send(req, res, ..., { room })` 透出，改动完全在 engine 层完成。

### 兼容性

- 所有既有字段名和语义不变（`inviteCode`、`players`、`hostUserId`、`status`、`modeId`、`topicId`、`gameId`、`rematchFromRoomId` 等），`server/test/api.test.mjs` 里对 `room.json.room.*` 的既有断言全部通过。
- `seats`/`seatSummary` 是新增字段，旧客户端（iOS 现有实现）会直接忽略，不受影响。
- `GET /admin/rooms`（`adminRooms()`）**未改**，仍返回原始房间对象——这是运营后台工具，不需要这个前端可视化字段，保持最小改动面。

---

## 2.3 战报分享卡（模式名 / 话题 / 结果一句话 / 1-2 条关键线索 / 匿名化其他玩家）

### 现状判断

`GET /games/:gameId` 和 `POST /games/:gameId/replay` 揭晓后返回的 `game.replay` 里已有构成分享卡的原始素材（`server/src/gameEngine.mjs` 的 `buildReplay()`）：`identitySummary`（含真实 `nickname`）、`keyMessages`（原始发言文本）、`explanation`（一句话结果）、`taskResults`。

**关键问题**：这些字段里的 `nickname` 全部是真实昵称，且当前系统里*没有任何脱敏机制*——不止是复盘接口，`serializeGame()` 里 `players[].nickname` 在 REVEAL/COMPLETED 阶段也是直接输出真实昵称。也就是说，若前端直接拿现有字段拼分享卡，会不可避免地暴露其他玩家的真实昵称，违反简报第 2.3 节"匿名化为神秘玩家 B"的要求，也存在真实的隐私风险（这张卡如果被截图外传，暴露的是其他真人玩家的真实游戏昵称）。

### 改动内容（已实施）

新增（不改动任何现有字段/接口行为）：

1. `server/src/gameEngine.mjs` 新增纯函数 `buildShareCard(game, viewerUserId)`：
   - 只在 `game.phase === "COMPLETED"` 且 `game.replay` 已存在时可用（与 `/replay` 端点同样的前置条件）。
   - 返回字段：`modeId`、`modeName`（如"4 人经典混聊"）、`topicTitle`、`resultHeadline`（复用 `replay.explanation` 一句话结果文案，本身不含昵称）、`winner`、`keyClues`（最多 2 条，来自该玩家自己标记的怀疑原因 `reasonLabel` 和自己标记为"clue"的发言片段，均已做 60 字截断）、`brand: "图灵迷局"`。
   - **不返回**：`gameId`、`roomId`、任何真实 `userId`、任何真实昵称。除当前查看者本人显示为"我"外，其余每个玩家在这张卡内首次出现时分配一个稳定的匿名标签"神秘玩家 A/B/C..."（按首次出现顺序分配，仅在这一次响应内有效，不做跨局持久化，避免可关联性）。
2. `GameEngine.getShareCard({ userId, gameId })`：与 `viewReplay` 前置校验完全一致（用户必须是该局玩家、局必须已完成），只是返回 `buildShareCard(...)` 而不是完整 `serializeGame(...)`。
3. `server/src/httpServer.mjs` 新增只读端点 `GET /games/:gameId/share-card`，鉴权和限流方式与既有 `/replay`（`game_actions` 桶）保持一致，未加入 `playAction` 封禁名单（与 `/replay` 一致，因为这是查看历史，不是参与对局）。

### 为什么现在做（而不是只写文档）

虽然 `mirage-prototype` 本轮仍是纯前端 mock 验证阶段、还没有接真实 API，但"复盘接口默认暴露真实昵称、没有任何脱敏出口"是一个**已经存在于生产 API 的数据形状缺口**，不只是这次改版的前端专属问题——未来任何"分享/导出"类功能都会撞到同一个坑。补一个纯新增、只读、不改变现有语义的脱敏端点，风险很低（新函数、新方法、新路由，不touch 现有路由和字段），且一次性把这个缺口堵上，比每次都在评估文档里重复"需要补脱敏"更实际。

### 兼容性

- 完全新增：新函数、新引擎方法、新 HTTP 路由，不修改任何现有函数签名或返回字段。
- 未改动 `serializeGame`、`buildReplay`、`viewReplay` 本身——现有 `/games/:gameId`、`/games/:gameId/replay` 的行为和字段（含真实昵称的 `identitySummary` 等）保持不变，因为这些字段有其正当用途（例如"我的战绩"里查看真实对局细节、举报时定位具体发言者），不能也不应该做脱敏，脱敏只发生在新增的分享卡专用出口。

---

## 2.4 商业化预埋徽标（"即将上线"提示层）

### 现状判断

`server/src/commerce.mjs` 已经有一个完整可用的只读预告目录：`publicCommerceCatalog()`，通过既有端点 `GET /commerce/catalog` 暴露（`docs/API_CONTRACT.md` 第 401-410 行，`server/test/api.test.mjs` 619-721 行已覆盖测试）。其中已包含：

```text
offers: [
  { id: "cosmetic_theme_pack", title: "装扮主题包", category: "cosmetic",
    phase: "Phase 2", status: "preview", priceLabel: "未开放",
    value: "头像框、桌面色、结算卡样式。", ... },
  ...
]
```

`status: "preview"`、`priceLabel: "未开放"`、`paymentsEnabled: false`、`purchaseProvider: "app_store_iap_required"` 这些字段已经精确匹配简报 2.4 节"只是预告、不接真实购买流程、不做付费墙"的要求，`cosmetic_theme_pack` 这一项本身就是"限定任务卡皮肤/装扮"类目。

### 结论

**确认无需任何后端改动。** 前端复盘页新增的"限定任务卡皮肤"预览徽标，直接读取（或本轮先用 mock 数据模拟）`GET /commerce/catalog` 里 `offers` 数组中 `category: "cosmetic"` 的条目即可；点击后展示的"即将上线"文案可直接取 `priceLabel`/`status`/`value` 字段拼装。不涉及 `commerce.mjs` 内任何支付逻辑（该文件目前也确实不含任何真实支付代码，只是一个静态目录生成函数）。

---

## 测试结果对比

跑法：`cd server && npm test`（Node 内置 test runner，`server/test/api.test.mjs`，74 个测试）。

| 阶段 | 结果 |
|---|---|
| 改动前（在独立临时目录还原出无 2.1/2.3 新增代码的版本后运行） | `tests 74, pass 74, fail 0` |
| 改动后（当前 `server/src` 实际状态） | `tests 74, pass 74, fail 0` |

两次结果一致，测试数量不变（本次未新增测试用例，凭已有测试的字段级断言间接验证未破坏既有行为），**无回归**。新增的 `seats`/`seatSummary`/`share-card` 相关代码目前只有静态审查验证，没有专属单测覆盖。

## 改了哪些文件

- `server/src/gameEngine.mjs`：新增 `roomSeatLayout`、`serializeRoom`、`buildShareCard` 三个纯函数；新增 `GameEngine.getShareCard` 方法；`createRoom`/`setRoomTopic`/`joinRoom`/`setReady`/`startRoom`/`debugFillAndStartRoom`/`rematchRoom`/`leaveRoom`/`getRoom` 九个方法的返回值改为经过 `serializeRoom` 包装（局部变量做了防冲突改名，行为不变）。
- `server/src/httpServer.mjs`：新增只读路由 `GET /games/:gameId/share-card`。

未改动：`security.mjs`、`moderation.mjs`、`appleAuth.mjs`、`wechatAuth.mjs`、`googleAuth.mjs`、`commerce.mjs`、`config.mjs`、`adminPage.mjs`、`store.mjs`。

## 给前端 / 未来联调的建议

1. **好友房等待页**：直接消费 `GET /rooms/:roomId`（或任意房间操作响应）里新增的 `room.seats[]` 渲染圆桌座位状态，不用再自己用 `mode.playerCount - mode.aiCount` 反推；`seatSummary` 可直接拼"X/Y 已加入"文案。邀请码大字沿用既有 `room.inviteCode`，无需改动。
2. **战报分享卡**：本轮 `mirage-prototype` 若仍停留在 mock 阶段，可先照抄 `buildShareCard` 的字段形状写死 mock 数据（`modeName`/`topicTitle`/`resultHeadline`/`winner`/`keyClues`/`brand`），字段名已经和后端对齐，未来切真实数据时改动量最小。真正联调时调用 `GET /games/:gameId/share-card`（局必须已 COMPLETED，否则 409 `replay_not_ready`）。
3. **商业化徽标**：可直接调用现有 `GET /commerce/catalog`，筛 `category === "cosmetic"` 的第一条渲染徽标；也可以本轮继续用 mock（因为数据形状已经完全对得上，不存在后续要改接口的风险）。
4. 首页信息架构简化（2.2 节）不在本次后端评估范围内（简报里也说明是纯前端信息架构调整），未涉及任何 API 变更。
