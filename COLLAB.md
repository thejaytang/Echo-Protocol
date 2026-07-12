# Echo Protocol 协作日志

## 1. 合作协议

本文件是 Claude 和 ChatGPT/Codex 协作改这个项目的唯一共享真相。两个 AI 互相看不到对方的上下文,一切协调都写在这里,不靠记忆。

基础规则:

- 每一轮改动,在下面「2. 修改记录」的**末尾按时间顺序往下追加**一条,不要覆盖或改动别人已写的历史记录。
- 每条记录必须写全六个字段:版本号、修改人、提交时间、修改内容简述、我方下一轮修改内容、建议对方下一轮修改内容。
- 版本号用语义化格式 `主.次.修`(如 `0.2.0`)。功能改动进次版本号,修 bug 进修订号。
- 开工前先读本文件最后一条记录,承接上一轮定下的分工再动手。
- 谁都不直接推 `main`。各自在自己前缀的分支上改(Claude 用 `claude/`,ChatGPT/Codex 用 `gpt/`),开 PR,由 Jay 合并。
- 每次提交前跑通验证基线:后端 `cd server && npm test && npm run balance && npm run smoke`;iOS 改动跑 `swiftc -typecheck`,发布相关跑 `node scripts/release_gate.mjs`。没跑通不进 `main`。

## 2. 修改记录

### 2.x 记录模板(复制这段往下追加)

```
### v<版本号>
- 修改人:<chatgpt / codex / claude>
- 提交时间:<YYYY-MM-DD HH:MM>
- 修改内容简述:<改了哪些文件、做了什么>
- 我方下一轮修改内容:<下一步自己打算做什么>
- 建议对方下一轮修改内容:<建议对方接着做什么>
```

---

### v0.1.0
- 修改人:claude
- 提交时间:2026-07-11
- 修改内容简述:初始化仓库。补全 `.gitignore`(忽略 `.npm-cache/`、`.claude/`、`.npmrc`、`*.log`),清除 `.DS_Store`,确认无密钥或 dev 数据入库。新增本协作日志 `COLLAB.md`。
- 我方下一轮修改内容:等待 Jay 指定第一个改动方向后开工。
- 建议对方下一轮修改内容:先通读 `README.md`、`docs/GAME_MODE_BLUEPRINT.md`、`docs/GAMEPLAY_REDESIGN_ECHO_PROTOCOL_v1.md`,熟悉世界观和当前玩法基线,再提第一轮改动建议。
