**Source Visual Truth**

- Public reference patterns reviewed:
  - Xiaomi Game Center werewolf room screenshot: https://game.xiaomi.com/viewpoint/1270322523_1687141560069_149
  - Xiaomi Game Center 12-player werewolf interface screenshot: https://game.xiaomi.com/viewpoint/1127866428_1608346597714_16
  - Official Werewolf voting/promo screenshot: https://langrensha.com/news/official/20201217/26904_922335.html
- Scope: original adaptation, not a pixel clone. Matched structural patterns only: seat-based room, room number, phase/timer, central phase prompt, bottom action controls, vote, reveal, replay.

**Implementation Evidence**

- URL: http://127.0.0.1:8794/
- Viewport: 430 x 932 mobile
- State screenshots:
  - /Users/tang/Desktop/各种AI玩具/Mirage /qa-artifacts/wolf-onboarding.png
  - /Users/tang/Desktop/各种AI玩具/Mirage /qa-artifacts/wolf-home.png
  - /Users/tang/Desktop/各种AI玩具/Mirage /qa-artifacts/wolf-lobby-tabs.png
  - /Users/tang/Desktop/各种AI玩具/Mirage /qa-artifacts/wolf-game.png
  - /Users/tang/Desktop/各种AI玩具/Mirage /qa-artifacts/wolf-vote.png
  - /Users/tang/Desktop/各种AI玩具/Mirage /qa-artifacts/wolf-replay.png

**Findings**

- No actionable P0/P1/P2 findings remain.
- Fonts and typography: mobile hierarchy is readable; title, room metadata, phase prompt, and small labels have clear optical separation.
- Spacing and layout rhythm: lobby cards, stage rail, seat board, feed, and bottom controls fit the mobile viewport without incoherent overlap.
- Colors and visual tokens: dark room palette with amber/teal action states avoids the previous pale prototype look and keeps contrast usable.
- Image quality and asset fidelity: existing avatar assets render correctly; no third-party proprietary assets were copied.
- Copy and content: visible product name is "图灵迷局"; lobby, room, and post-game copy now uses game-facing language such as 玩法速览、今日悬赏、开聊、归票、揭晓、线索、分享战报 and 局后处理.

**Patches Made During QA**

- Fixed onboarding contrast after first browser screenshot showed pale text on a light panel.
- Added countdown DOM structure and automatic phase refresh when timer reaches 00:00.
- Updated readiness and smoke checks from the old visible names to "图灵迷局".
- Reworked the home lobby into four mobile-game tabs: 大厅, 战绩, 任务, 我的.
- Removed duplicated mode rows from the primary lobby and moved records, tasks, legal/support, and account deletion into clearer functional groups.
- Added in-game 玩法入口 on the topic card so players can open and close the current mode rules from the active room.
- Replaced explanatory safety/status copy in player UI with shorter game-facing prompts and added anonymous post-game text share fallback.
- Fixed the task wallet / reward panel contrast in the Web home tabs by overriding the old light `primary-panel` style inside the dark game shell.
- Tightened the Web task tab for mobile: wallet card now has a dedicated game-style layout, mission rows use fixed action width, and the home shell reserves extra bottom safe-area space above the fixed nav.
- Reworked records empty states on Web and iOS into action cards with 快速上桌 instead of static explanatory copy and removed the duplicate 最近牌局 info panel.
- Reworked the profile tab actions: Web now uses game-style profile action cards, and iOS routes legal/support/delete actions through a single 账号与规则 entry instead of listing system links on the profile home.
- Reinforced the task wallet panel with an explicit dark game-card background so it cannot fall back to the old pale `primary-panel` styling.
- Reworked the Web waiting-match screen into a seat-based room state with occupied, waiting, and AI fill seats plus quick fallback actions.
- Added empty seat cards to Web and iOS friend rooms so players can see the full room capacity and missing seats before starting.
- Reworked the friend-room join entry on Web and iOS around a 6-character room code: automatic uppercase filtering, paste from clipboard, and disabled/guarded join until the room code is complete.
- Added discussion-phase quick chat chips on Web and iOS so players can send short game-facing lines without staring at an empty text input.
- Reworked post-game reporting on Web and iOS so players choose a report reason before submitting or blocking, while the existing report API still carries full game context.
- Reworked mission reward claiming feedback on Web and iOS to show the concrete 推理星 and 经验 gained instead of a generic claimed state.
- Reworked the 战绩 tab around a real season/rank card on Web and iOS: S1 推理赛季, Lv/title progress, win/replay stats, rank path, and a contextual action to claim rewards, start, or play again.
- Added one-tap mission reward claiming on Web and iOS, backed by the server `/me/missions/claim-all` endpoint so the task tab behaves more like a mobile-game reward center.
- Added reward-to-rank feedback on Web and iOS: mission rewards still show concrete currency gains, but level/title changes now surface as 称号升级.

**Functional Checks**

- Guest onboarding completed.
- Home lobby showed quick start, 3-player mode, friend room, safety/account links, and bottom navigation.
- Bottom navigation switches across 大厅, 战绩, 任务, 我的.
- 1v1 game completed through discussion, sample message, voting, reveal, and replay.
- In-game message report action is absent.
- Post-game reporting is grouped under 局后处理 and appears only when there is a reportable human opponent.
- `npm test` passed 42/42.
- `node scripts/release_gate.mjs` passed.

**Open Questions**

- The app uses original visuals with existing local avatars. A future art pass should generate or commission a proper room background and role portraits if the product needs a stronger commercial game feel.

final result: passed
