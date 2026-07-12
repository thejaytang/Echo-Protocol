import crypto from "node:crypto";
import { modes, topics } from "./config.mjs";
import { moderateText } from "./moderation.mjs";
import { ScriptedAIGateway } from "./aiGateway.mjs";

const aiNames = ["阿言", "岚", "灰蓝"];
const scriptedHumanNames = ["小鹿", "小周", "林夏"];
const dailyMissions = [
  {
    id: "daily_quick_start",
    title: "完成 1 局快速开始",
    description: "打完任意公开局并看复盘。",
    reward: { clueStars: 20, xp: 10 },
  },
  {
    id: "daily_replay",
    title: "看 1 次复盘",
    description: "完成投票和揭晓，回看一局复盘。",
    reward: { clueStars: 30, xp: 15 },
  },
  {
    id: "daily_win",
    title: "赢下 1 局",
    description: "帮真人阵营拿下一局胜利。",
    reward: { clueStars: 40, xp: 20 },
  },
];
const progressionTitles = ["新手侦探", "见习预言家", "逻辑猎人", "高阶侦探", "AI 克星"];
const cosmeticItems = [
  {
    id: "classic-sleuth",
    name: "黑金侦探框",
    description: "默认头像框，适合刚上桌的新玩家。",
    cost: 0,
    rarity: "基础",
    accent: "#ffd46b",
  },
  {
    id: "signal-tracker",
    name: "信号追踪者",
    description: "蓝色电波头像框，适合喜欢抓细节的玩家。",
    cost: 50,
    rarity: "稀有",
    accent: "#49b7d6",
  },
  {
    id: "night-oracle",
    name: "夜局预言家",
    description: "紫金头像框，适合高胜率推理玩家。",
    cost: 120,
    rarity: "史诗",
    accent: "#a78bfa",
  },
];
const adminAuditEventTypes = new Set([
  "report.created",
  "report.updated",
  "report.batch.updated",
  "report.batch.targets_banned",
  "report.alert.sent",
  "report.alert.failed",
  "topic.updated",
  "user.banned",
  "user.blocked",
  "message.blocked",
]);

function nowIso(clock) {
  return new Date(clock.now()).toISOString();
}

function dayKey(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

function plusSeconds(clock, seconds) {
  return new Date(clock.now() + seconds * 1000).toISOString();
}

function publicUser(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarKey: user.avatarKey,
    kind: user.kind,
    deletedAt: user.deletedAt,
    bannedAt: user.bannedAt || null,
    banReason: user.banReason || null,
    ageConfirmed: Boolean(user.ageConfirmed),
    communityConfirmed: Boolean(user.communityConfirmed),
  };
}

function makeAiPlayer(index) {
  return {
    id: `ai-${crypto.randomUUID()}`,
    userId: null,
    nickname: aiNames[index % aiNames.length],
    kind: "ai",
    ready: true,
    role: "ai",
    persona: "表达自然、会回避过度具体细节的 AI 玩家",
    hiddenTask: "让至少一名真人相信自己是真人",
    strategyTags: [],
  };
}

function makeScriptedHuman(index) {
  return {
    id: `seed-human-${crypto.randomUUID()}`,
    userId: null,
    nickname: scriptedHumanNames[index % scriptedHumanNames.length],
    kind: "scripted_human",
    ready: true,
    role: "human",
    persona: "用于本地开发和 AI 对局的系统补位真人",
    hiddenTask: null,
    strategyTags: [],
  };
}

function makeHumanPlayer(user) {
  return {
    id: `player-${crypto.randomUUID()}`,
    userId: user.id,
    nickname: user.nickname,
    kind: "human",
    ready: false,
    role: "human",
    persona: null,
    hiddenTask: null,
    strategyTags: [],
  };
}

function m01OpponentKind(env = {}) {
  if (env.MIRAGE_M01_OPPONENT_KIND === "ai" || env.MIRAGE_M01_OPPONENT_KIND === "scripted_human") {
    return env.MIRAGE_M01_OPPONENT_KIND;
  }
  if (env.NODE_ENV === "test") return "ai";
  return crypto.randomInt(2) === 0 ? "ai" : "scripted_human";
}

function makeM01Opponent(env = {}) {
  return m01OpponentKind(env) === "scripted_human" ? makeScriptedHuman(0) : makeAiPlayer(0);
}

function cloneGamePlayer(player) {
  return {
    ...player,
    strategyTags: Array.isArray(player.strategyTags) ? [...player.strategyTags] : [],
  };
}

function roleSelectionScore(modeId, roleId, player) {
  return crypto
    .createHash("sha256")
    .update([modeId, roleId, player.id, player.userId || "", player.nickname || ""].join(":"))
    .digest("hex");
}

function selectSpecialHuman({ modeId, roleId, realHumans, humanTeam, soloUserId }) {
  // 单人快速开始：真人玩家保持侦探视角，卧底/诱饵交给脚本补位真人。
  if (soloUserId) {
    const scripted = humanTeam.filter((player) => player.kind === "scripted_human");
    if (scripted.length) {
      return scripted
        .slice()
        .sort((first, second) => roleSelectionScore(modeId, roleId, first).localeCompare(roleSelectionScore(modeId, roleId, second)))[0];
    }
  }
  const candidates = realHumans.filter((player) => player.userId).length
    ? realHumans.filter((player) => player.userId)
    : realHumans.length
    ? realHumans
    : humanTeam;
  return candidates
    .slice()
    .sort((first, second) => roleSelectionScore(modeId, roleId, first).localeCompare(roleSelectionScore(modeId, roleId, second)))[0];
}

function assignModeRoles(mode, sourcePlayers, soloUserId = null) {
  const players = sourcePlayers.map(cloneGamePlayer);
  const ai = players.find((player) => player.role === "ai");
  const ais = players.filter((player) => player.role === "ai");
  const realHumans = players.filter((player) => player.kind === "human");
  const humanTeam = players.filter((player) => player.kind === "human" || player.kind === "scripted_human");
  if (mode.id === "M04" && ais.length >= 2) {
    ais[0].hiddenTask = "保持中间立场，吸引侦探只集火另一名 AI。";
    ais[0].persona = "稳态伪装者";
    ais[1].hiddenTask = "制造轻微立场偏移，让真人把票分到错误目标。";
    ais[1].persona = "摇摆伪装者";
  }
  if (mode.id === "M06" && ai && humanTeam.length >= 4) {
    const undercover = selectSpecialHuman({ modeId: mode.id, roleId: "human_undercover", realHumans, humanTeam, soloUserId });
    undercover.role = "human_undercover";
    undercover.hiddenTask = `保护 AI 同盟 ${ai.nickname}，把怀疑转移到侦探身上。`;
    undercover.persona = "知道 AI 同盟的人类卧底";
    ai.hiddenTask = "配合人类卧底隐藏自己，避免成为唯一最高票。";
  }
  if (mode.id === "M08" && ai && humanTeam.length >= 4) {
    const fakeAi = selectSpecialHuman({ modeId: mode.id, roleId: "fake_ai", realHumans, humanTeam, soloUserId });
    fakeAi.role = "fake_ai";
    fakeAi.hiddenTask = "故意表现得像 AI，吸走侦探投票，保护真正 AI。";
    fakeAi.persona = "故意制造 AI 感的人类诱饵";
    ai.hiddenTask = "利用伪 AI 真人吸走怀疑，避免成为唯一最高票。";
  }
  return players;
}

function taskTitle(role) {
  if (role === "human") return "侦探任务";
  if (role === "human_undercover") return "阵营任务";
  if (role === "fake_ai") return "诱饵任务";
  if (role === "ai") return "伪装任务";
  return "本局任务";
}

function taskGoal(player, game) {
  if (player?.hiddenTask) return player.hiddenTask;
  const role = player?.role || "hidden";
  if (game?.modeId === "M01" && role === "human") return "听发言、抓细节，归票时判断对方是真人还是 AI。";
  if (role === "human") return "听发言、抓破绽，归票时找出伪装者。";
  if (role === "human_undercover") return "保护你的 AI 同盟，别让真正 AI 成为唯一最高票。";
  if (role === "fake_ai") return "故意露出 AI 感，吸走怀疑，保护真正 AI。";
  if (role === "ai") return "保持自然发言，尽量撑过投票。";
  return "先观察发言，别暴露判断。";
}

function roomCode() {
  return crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

function getMode(modeId) {
  const mode = modes[modeId];
  if (!mode) throw Object.assign(new Error("mode_not_found"), { status: 404 });
  return mode;
}

function finalStatementSeconds(mode) {
  return Math.max(15, Number(mode.finalStatementSeconds || 35));
}

function topicSettings(state) {
  return state?.topicSettings && typeof state.topicSettings === "object" ? state.topicSettings : {};
}

function configuredTopics(state) {
  const settings = topicSettings(state);
  return topics.map((topic) => ({ ...topic, ...(settings[topic.id] || {}) }));
}

function topicAvailableForMode(topic, modeId) {
  if (topic.enabled === false) return false;
  if (!modeId) return true;
  const modeIds = Array.isArray(topic.modeIds) ? topic.modeIds : [];
  return !modeIds.length || modeIds.includes(modeId);
}

function getTopic(topicId, modeId, state) {
  const availableTopics = configuredTopics(state).filter((topic) => topicAvailableForMode(topic, modeId));
  if (topicId) {
    const topic = availableTopics.find((item) => item.id === topicId);
    if (!topic) throw Object.assign(new Error("topic_not_available"), { status: 422 });
    return topic;
  }
  const fallbackTopic = availableTopics[0];
  if (!fallbackTopic) throw Object.assign(new Error("topic_not_available"), { status: 422 });
  return fallbackTopic;
}

function rematchTopicId(preferredTopicId, modeId, state) {
  if (preferredTopicId) {
    try {
      return getTopic(preferredTopicId, modeId, state).id;
    } catch (error) {
      if (error?.message !== "topic_not_available") throw error;
    }
  }
  return getTopic(null, modeId, state).id;
}

function assertEveryModeHasTopic(state) {
  for (const mode of Object.values(modes)) {
    const hasTopic = configuredTopics(state).some((topic) => topicAvailableForMode(topic, mode.id));
    if (!hasTopic) {
      throw Object.assign(new Error("topic_disable_would_empty_mode"), { status: 422 });
    }
  }
}

function isResolvedPhase(game) {
  return game.phase === "REVEAL" || game.phase === "COMPLETED";
}

function finalStatementState(game, viewerUserId) {
  const currentPlayer = game.players.find((player) => player.userId === viewerUserId);
  const submitted = Boolean(
    currentPlayer && game.messages.some((message) => message.phase === "FINAL_STATEMENT" && message.senderPlayerId === currentPlayer.id),
  );
  return {
    submitted,
    remaining: currentPlayer && game.phase === "FINAL_STATEMENT" && !submitted ? 1 : 0,
  };
}

function voteState(game, viewerUserId) {
  if (!game || game.phase !== "VOTING") return null;
  const humanPlayers = game.players.filter((player) => player.kind === "human" && player.userId);
  const submittedVotes = game.modeId === "M01" ? game.votes : game.votes.filter((vote) => vote.targetPlayerId !== "abstain");
  const votedUserIds = new Set(submittedVotes.map((vote) => vote.userId));
  const submittedCount = humanPlayers.filter((player) => votedUserIds.has(player.userId)).length;
  return {
    submitted: votedUserIds.has(viewerUserId),
    submittedCount,
    remaining: Math.max(0, humanPlayers.length - submittedCount),
    total: humanPlayers.length,
  };
}

function viewerReactionType(game, viewerUserId, messageId) {
  return (game.reactions || []).find((reaction) => reaction.userId === viewerUserId && reaction.messageId === messageId)?.type || null;
}

function assertUserCanPlay(user) {
  if (!user || user.deletedAt) {
    throw Object.assign(new Error("user_not_found"), { status: 404 });
  }
  if (user.bannedAt) {
    throw Object.assign(new Error("user_banned"), { status: 403 });
  }
}

function assertOnboardingConfirmed({ ageConfirmed, communityConfirmed }) {
  if (ageConfirmed !== true || communityConfirmed !== true) {
    throw Object.assign(new Error("onboarding_confirmation_required"), { status: 422 });
  }
}

function usersBlockedEachOther(state, firstUserId, secondUserId) {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) return false;
  return state.blocks.some(
    (block) =>
      (block.sourceUserId === firstUserId && block.targetUserId === secondUserId) ||
      (block.sourceUserId === secondUserId && block.targetUserId === firstUserId),
  );
}

function serializeGame(game, viewerUserId, state = null) {
  const sourceRoom = state && game.roomId ? state.rooms.find((room) => room.id === game.roomId) : null;
  const rematchRoom = sourceRoom?.rematchRoomId
    ? state.rooms.find((room) => room.id === sourceRoom.rematchRoomId && room.status !== "CLOSED")
    : null;
  const visibleRematchRoomId =
    game.phase === "COMPLETED" && rematchRoom?.players.some((player) => player.userId === viewerUserId)
      ? rematchRoom.id
      : null;
  const myVote = game.votes.find((vote) => vote.userId === viewerUserId) || null;
  const revealed = isResolvedPhase(game);
  const humanPlayers = game.players.filter((player) => player.kind === "human" && player.userId);
  const taskAckUserIds = new Set((game.taskAcks || []).map((item) => item.userId));
  return {
    id: game.id,
    roomId: game.roomId,
    rematchRoomId: visibleRematchRoomId,
    modeId: game.modeId,
    solo: Boolean(game.solo),
    topic: game.topic,
    phase: game.phase,
    phaseEndsAt: game.phaseEndsAt,
    winner: game.winner,
    players: game.players.map((player) => {
      const isSelf = player.userId === viewerUserId;
      return {
        id: player.id,
        userId: revealed || isSelf ? player.userId : null,
        nickname: player.nickname,
        kind: revealed || isSelf ? player.kind : "unknown",
        role: revealed || isSelf ? player.role : "hidden",
        hiddenTask: revealed || isSelf ? player.hiddenTask || null : null,
        ready: player.ready,
      };
    }),
    messages: game.messages.map((message) => {
      const revealed = isResolvedPhase(game);
      return {
        id: message.id,
        senderKind: message.senderKind,
        senderPlayerId: message.senderPlayerId,
        text: message.text,
        createdAt: message.createdAt,
        status: message.status,
        strategyTag: revealed ? message.strategyTag || null : null,
        aiSource: revealed ? message.aiSource || null : null,
        reactionType: viewerReactionType(game, viewerUserId, message.id),
      };
    }),
    votes: game.phase === "REVEAL" || game.phase === "COMPLETED" ? game.votes : [],
    myVote: game.phase === "VOTING" ? myVote : null,
    taskCard: {
      acknowledged: taskCardAcknowledged(game, viewerUserId),
      acknowledgedCount: humanPlayers.filter((player) => taskAckUserIds.has(player.userId)).length,
      total: humanPlayers.length,
    },
    voteState: voteState(game, viewerUserId),
    finalStatement: finalStatementState(game, viewerUserId),
    replay: game.phase === "COMPLETED" ? game.replay : null,
  };
}

// Read-only, additive seat-layout summary for friend-room lobby UI (waiting-room
// visualization: occupied / waiting-for-human / AI-fill seats + invite code).
// This does not change any existing room fields; it only adds `seats` and
// `seatSummary` alongside the room's existing raw fields.
function roomSeatLayout(room) {
  const mode = modes[room.modeId];
  if (!mode) return { seats: [], seatSummary: null };
  const humanSeatCount = Math.max(0, mode.playerCount - mode.aiCount);
  const humanPlayers = room.players.filter((player) => player.kind === "human");
  const seats = [];
  for (let index = 0; index < humanSeatCount; index += 1) {
    const player = humanPlayers[index];
    if (player) {
      seats.push({
        index,
        status: "occupied",
        isHost: player.userId === room.hostUserId,
        ready: Boolean(player.ready),
        nickname: player.nickname,
        userId: player.userId,
      });
    } else {
      seats.push({
        index,
        status: "waiting",
        isHost: false,
        ready: false,
        nickname: null,
        userId: null,
      });
    }
  }
  for (let index = 0; index < mode.aiCount; index += 1) {
    seats.push({
      index: humanSeatCount + index,
      status: room.status === "LOBBY" ? "ai_fill_pending" : "ai_fill",
      isHost: false,
      ready: true,
      nickname: null,
      userId: null,
    });
  }
  const occupiedCount = seats.filter((seat) => seat.status === "occupied").length;
  const waitingCount = seats.filter((seat) => seat.status === "waiting").length;
  const aiFillCount = seats.filter((seat) => seat.status.startsWith("ai_fill")).length;
  return {
    seats,
    seatSummary: {
      totalSeats: mode.playerCount,
      humanSeats: humanSeatCount,
      occupied: occupiedCount,
      waiting: waitingCount,
      aiFill: aiFillCount,
      minHumanCount: mode.minHumanCount,
    },
  };
}

function serializeRoom(room) {
  if (!room) return room;
  const { seats, seatSummary } = roomSeatLayout(room);
  return {
    ...room,
    seats,
    seatSummary,
  };
}

function appendEvent(state, type, payload, clock) {
  state.events.push({
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: nowIso(clock),
  });
}

function userWallet(user) {
  if (!user.wallet) user.wallet = { clueStars: 0, xp: 0 };
  user.wallet.clueStars = Number(user.wallet.clueStars || 0);
  user.wallet.xp = Number(user.wallet.xp || 0);
  return user.wallet;
}

function playerProgression(wallet) {
  const xp = Number(wallet?.xp || 0);
  const xpPerLevel = 50;
  const level = Math.max(1, Math.floor(xp / xpPerLevel) + 1);
  const currentLevelXp = (level - 1) * xpPerLevel;
  const nextLevelXp = level * xpPerLevel;
  const titleIndex = Math.min(progressionTitles.length - 1, Math.floor((level - 1) / 2));
  const title = progressionTitles[titleIndex];
  const nextTitle = progressionTitles[Math.min(progressionTitles.length - 1, titleIndex + 1)];
  return {
    level,
    title,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: Math.max(0, Math.min(1, (xp - currentLevelXp) / xpPerLevel)),
    nextTitle,
  };
}

function cosmeticById(itemId) {
  return cosmeticItems.find((item) => item.id === itemId) || null;
}

function cosmeticState(user) {
  const ownedIds = new Set(["classic-sleuth", ...(Array.isArray(user?.cosmetics?.ownedIds) ? user.cosmetics.ownedIds : [])]);
  const equippedId = ownedIds.has(user?.cosmetics?.equippedId) ? user.cosmetics.equippedId : "classic-sleuth";
  return { ownedIds, equippedId };
}

function ensureCosmetics(user) {
  const current = cosmeticState(user);
  user.cosmetics = {
    ownedIds: Array.from(current.ownedIds),
    equippedId: current.equippedId,
  };
  return user.cosmetics;
}

function cosmeticSummary(user, wallet) {
  const state = cosmeticState(user);
  const equipped = cosmeticById(state.equippedId) || cosmeticItems[0];
  return {
    equippedId: equipped.id,
    equipped,
    items: cosmeticItems.map((item) => {
      const owned = state.ownedIds.has(item.id);
      return {
        ...item,
        owned,
        equipped: item.id === equipped.id,
        affordable: owned || Number(wallet?.clueStars || 0) >= item.cost,
      };
    }),
  };
}

function missionDateKey(clock) {
  return new Date(clock.now()).toISOString().slice(0, 10);
}

function buildMissionItems({ completedQuickStart, replayReady, wonToday, state, userId, dateKey }) {
  const missionStatus = {
    daily_quick_start: completedQuickStart,
    daily_replay: replayReady,
    daily_win: wonToday,
  };
  return dailyMissions.map((mission) => {
    const completed = Boolean(missionStatus[mission.id]);
    const claimed = (state.missionClaims || []).some(
      (claim) => claim.userId === userId && claim.missionId === mission.id && claim.dateKey === dateKey,
    );
    return {
      ...mission,
      progress: completed ? 1 : 0,
      target: 1,
      completed,
      claimed,
      claimable: completed && !claimed,
    };
  });
}

function userGameSummary(state, userId, clock) {
  const user = state.users.find((item) => item.id === userId);
  const userGames = state.games.filter((game) => game.players.some((player) => player.userId === userId));
  const completedGames = userGames.filter((game) => game.phase === "COMPLETED");
  const wonGames = completedGames.filter((game) => game.winner === "human");
  const replayReadyGames = completedGames.filter((game) => game.replay);
  const dateKey = missionDateKey(clock);
  const todayCompletedGames = completedGames.filter((game) => String(game.updatedAt || game.createdAt).slice(0, 10) === dateKey);
  const latestCompleted = completedGames
    .slice()
    .sort((first, second) => Date.parse(second.updatedAt || second.createdAt) - Date.parse(first.updatedAt || first.createdAt))[0];
  const quickStartCompletedToday = todayCompletedGames.length > 0;
  const replayReadyToday = todayCompletedGames.some((game) => game.replay);
  const winCompletedToday = todayCompletedGames.some((game) => game.winner === "human");
  const wallet = {
    clueStars: Number(user?.wallet?.clueStars || 0),
    xp: Number(user?.wallet?.xp || 0),
  };

  return {
    wallet,
    progression: playerProgression(wallet),
    cosmetics: cosmeticSummary(user, wallet),
    stats: {
      completedGames: completedGames.length,
      activeGames: userGames.filter((game) => game.phase !== "COMPLETED").length,
      wins: wonGames.length,
      winRate: completedGames.length ? wonGames.length / completedGames.length : null,
      replayReady: replayReadyGames.length,
      replayReadyRate: completedGames.length ? replayReadyGames.length / completedGames.length : null,
    },
    recent: latestCompleted
      ? {
          gameId: latestCompleted.id,
          modeId: latestCompleted.modeId,
          topicTitle: latestCompleted.topic.title,
          winner: latestCompleted.winner,
          completedAt: latestCompleted.updatedAt || latestCompleted.createdAt,
          replayReady: Boolean(latestCompleted.replay),
        }
      : null,
    missions: {
      dateKey,
      quickStartCompletedToday,
      replayReadyToday,
      winCompletedToday,
      items: buildMissionItems({
        completedQuickStart: quickStartCompletedToday,
        replayReady: replayReadyToday,
        wonToday: winCompletedToday,
        state,
        userId,
        dateKey,
      }),
    },
    safety: {
      reportsSubmitted: state.reports.filter((report) => report.reporterUserId === userId).length,
      blocks: state.blocks.filter((block) => block.sourceUserId === userId).length,
      banned: Boolean(state.users.find((user) => user.id === userId)?.bannedAt),
    },
  };
}

function userGameHistory(state, userId, { limit = 20 } = {}) {
  return state.games
    .filter((game) => game.players.some((player) => player.userId === userId))
    .slice()
    .sort((first, second) => Date.parse(second.updatedAt || second.createdAt) - Date.parse(first.updatedAt || first.createdAt))
    .slice(0, limit)
    .map((game) => {
      const userPlayer = game.players.find((player) => player.userId === userId);
      return {
        gameId: game.id,
        roomId: game.roomId,
        modeId: game.modeId,
        topicTitle: game.topic.title,
        phase: game.phase,
        winner: game.winner,
        updatedAt: game.updatedAt || game.createdAt,
        replayReady: Boolean(game.replay),
        playerCount: game.players.length,
        humanCount: game.players.filter((player) => player.kind === "human").length,
        aiCount: game.players.filter((player) => player.role === "ai").length,
        myRole: userPlayer?.role || "unknown",
        voted: game.votes.some((vote) => vote.userId === userId),
      };
    });
}

function playerLeaderboard(state, viewerUserId, clock, { limit = 20 } = {}) {
  const completedGames = state.games.filter((game) => game.phase === "COMPLETED");
  const rows = state.users
    .filter((user) => !user.deletedAt)
    .map((user) => {
      const wallet = userWallet(user);
      const progression = playerProgression(wallet);
      const userCompletedGames = completedGames.filter((game) => game.players.some((player) => player.userId === user.id));
      const wins = userCompletedGames.filter((game) => game.winner === "human").length;
      const replayReady = userCompletedGames.filter((game) => game.replay).length;
      const score = progression.xp + wins * 20 + replayReady * 5;
      return {
        userId: user.id,
        nickname: user.nickname,
        level: progression.level,
        title: progression.title,
        xp: progression.xp,
        clueStars: wallet.clueStars,
        score,
        completedGames: userCompletedGames.length,
        wins,
        winRate: userCompletedGames.length ? wins / userCompletedGames.length : null,
        replayReady,
        isCurrentUser: user.id === viewerUserId,
      };
    })
    .filter((row) => row.completedGames > 0)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      if (second.xp !== first.xp) return second.xp - first.xp;
      if (second.wins !== first.wins) return second.wins - first.wins;
      if (second.completedGames !== first.completedGames) return second.completedGames - first.completedGames;
      return first.nickname.localeCompare(second.nickname, "zh-Hans-CN");
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 3), 50);
  const myRank = rows.find((row) => row.userId === viewerUserId) || null;
  const myIndex = myRank ? rows.findIndex((row) => row.userId === viewerUserId) : -1;
  const aroundMe = myIndex >= 0
    ? rows.slice(Math.max(0, myIndex - 2), Math.min(rows.length, myIndex + 3))
    : rows.slice(0, Math.min(rows.length, 5));

  return {
    season: {
      id: "S1",
      title: "S1 推理赛季",
      rule: "按经验、胜场、复盘局数综合排序",
    },
    top: rows.slice(0, safeLimit),
    aroundMe,
    myRank,
    totalPlayers: rows.length,
    updatedAt: nowIso(clock),
  };
}

const scriptedTopicLines = {
  "campus-ai-writing": {
    opening: "我觉得关键不是能不能用 AI，而是学生是否理解自己提交的内容。",
    replies: [
      "如果完全禁止，可能会让学生错过学习新工具的机会。",
      "但我同意需要标注，至少老师要知道哪些部分用了辅助。",
      "我更在意评价标准是否跟着变化，否则大家都会钻空子。",
    ],
  },
  "label-ai-content": {
    opening: "我觉得标注不是为了限制创作，而是让观众知道内容来源。",
    replies: [
      "如果标得太细，普通创作者可能会觉得流程太重。",
      "平台至少应该要求影响判断的信息被明确标注。",
      "我更担心大家只看标签，不再讨论内容本身是否可靠。",
    ],
  },
  "workplace-ai-decisions": {
    opening: "我觉得绩效评估可以参考 AI，但最终责任不能交给系统。",
    replies: [
      "AI 能发现一些数据趋势，但它很难理解团队协作里的具体背景。",
      "如果员工不知道哪些数据被使用，这个机制会很难被信任。",
      "我更倾向把 AI 当作辅助报告，而不是直接决定结果。",
    ],
  },
  "creator-ai-face": {
    opening: "我觉得 AI 换脸必须明显标注，因为观众很难靠肉眼分辨。",
    replies: [
      "有些创意内容本身没问题，但不标注会让人误以为是真实画面。",
      "平台可以把娱乐创作和误导性内容分开处理。",
      "我更在意传播场景，如果涉及公众人物或新闻，就应该更严格。",
    ],
  },
};

function scriptedLinesForTopic(topicId) {
  return scriptedTopicLines[topicId] || scriptedTopicLines["campus-ai-writing"];
}

function aiPlayers(game) {
  return game.players.filter((player) => player.role === "ai");
}

function scriptedHumanPlayers(game) {
  return game.players.filter((player) => player.kind === "scripted_human");
}

function taskCardAcknowledged(game, userId) {
  if (!userId) return false;
  if (game.phase !== "DISCUSSION") return true;
  return (game.taskAcks || []).some((item) => item.userId === userId);
}

function assertTaskCardAcknowledged(game, userId) {
  if (!taskCardAcknowledged(game, userId)) {
    throw Object.assign(new Error("task_card_not_acknowledged"), { status: 409 });
  }
}

function createGameFromPlayers(state, { roomId, modeId, topicId, players, clock, soloUserId = null }) {
  const mode = getMode(modeId);
  const topic = getTopic(topicId, mode.id, state);
  const assignedPlayers = assignModeRoles(mode, players, soloUserId);
  const game = {
    id: crypto.randomUUID(),
    roomId,
    modeId,
    topic,
    phase: "DISCUSSION",
    phaseEndsAt: plusSeconds(clock, mode.discussionSeconds),
    createdAt: nowIso(clock),
    updatedAt: nowIso(clock),
    winner: null,
    players: assignedPlayers,
    messages: [
      {
        id: crypto.randomUUID(),
        senderKind: "system",
        senderPlayerId: null,
        text: `本局主题：${topic.title}`,
        createdAt: nowIso(clock),
        status: "sent",
      },
    ],
    votes: [],
    reactions: [],
    taskAcks: [],
    replay: null,
  };
  addAiOpeningMessage(game, clock);
  addScriptedHumanOpeningMessage(game, clock);
  state.games.push(game);
  appendEvent(state, "game.created", { gameId: game.id, modeId, topicId: topic.id }, clock);
  return game;
}

function addAiOpeningMessage(game, clock) {
  const ais = aiPlayers(game);
  if (!ais.length) return;
  const lines = scriptedLinesForTopic(game.topic?.id);
  ais.forEach((ai, index) => {
    const text = index === 0 ? lines.opening : lines.replies[index - 1] || lines.opening;
    const tag = index === 0 ? "balanced_opinion" : "soft_deflection";
    game.messages.push({
      id: crypto.randomUUID(),
      senderKind: "player",
      senderPlayerId: ai.id,
      text,
      createdAt: nowIso(clock),
      status: "sent",
      strategyTag: tag,
    });
    ai.strategyTags.push(tag);
  });
}

function addScriptedHumanOpeningMessage(game, clock) {
  const humans = scriptedHumanPlayers(game);
  if (!humans.length) return;
  const lines = scriptedLinesForTopic(game.topic?.id);
  humans.forEach((player, index) => {
    const text = lines.replies[index] || lines.opening;
    game.messages.push({
      id: crypto.randomUUID(),
      senderKind: "player",
      senderPlayerId: player.id,
      text,
      createdAt: nowIso(clock),
      status: "sent",
      strategyTag: "human_seed_opening",
    });
    player.strategyTags.push("human_seed_opening");
  });
}

function addAiReply(game, clock) {
  const ai = aiPlayers(game)
    .filter((player) => game.messages.filter((message) => message.senderPlayerId === player.id).length < 3)
    .sort((left, right) =>
      game.messages.filter((message) => message.senderPlayerId === left.id).length -
      game.messages.filter((message) => message.senderPlayerId === right.id).length
    )[0];
  if (!ai) return;
  const aiMessageCount = game.messages.filter((message) => message.senderPlayerId === ai.id).length;
  if (aiMessageCount >= 3) return;
  const textByCount = scriptedLinesForTopic(game.topic?.id).replies;
  const tagByCount = ["soft_deflection", "partial_agreement", "goal_shift"];
  const index = Math.min(aiMessageCount - 1, textByCount.length - 1);
  game.messages.push({
    id: crypto.randomUUID(),
    senderKind: "player",
    senderPlayerId: ai.id,
    text: textByCount[index],
    createdAt: nowIso(clock),
    status: "sent",
    strategyTag: tagByCount[index],
  });
  ai.strategyTags.push(tagByCount[index]);
}

function generateScriptedHumanReply(game, clock) {
  const player = scriptedHumanPlayers(game)
    .filter((item) => game.messages.filter((message) => message.senderPlayerId === item.id).length < 3)
    .sort((left, right) =>
      game.messages.filter((message) => message.senderPlayerId === left.id).length -
      game.messages.filter((message) => message.senderPlayerId === right.id).length
    )[0];
  if (!player) return null;
  const messageCount = game.messages.filter((message) => message.senderPlayerId === player.id).length;
  if (messageCount >= 3) return null;
  const lines = scriptedLinesForTopic(game.topic?.id);
  const index = Math.min(messageCount, lines.replies.length - 1);
  const tagByCount = ["human_clarification", "human_consistency", "human_final_detail"];
  return {
    playerId: player.id,
    text: lines.replies[index] || lines.opening,
    strategyTag: tagByCount[Math.max(0, messageCount - 1)] || "human_clarification",
    createdAt: nowIso(clock),
  };
}

function addAiFinalStatement(game, clock) {
  const finalStatements = [
    "我最后补一句：我不想把判断做得太绝对，但我前面的立场是一致的。",
    "我最后只强调一点：我不是回避问题，我是在看规则边界能不能真正落地。",
  ];
  aiPlayers(game).forEach((ai, index) => {
    if (game.messages.some((message) => message.phase === "FINAL_STATEMENT" && message.senderPlayerId === ai.id)) return;
    game.messages.push({
      id: crypto.randomUUID(),
      senderKind: "player",
      senderPlayerId: ai.id,
      text: finalStatements[index] || finalStatements[0],
      createdAt: nowIso(clock),
      status: "sent",
      phase: "FINAL_STATEMENT",
      strategyTag: "final_statement",
    });
    ai.strategyTags.push("final_statement");
  });
}

function addScriptedHumanFinalStatement(game, clock) {
  const finalStatements = [
    "我最后判断还是看细节完整度，我前面给的是自己的真实取向，不是为了躲票。",
    "我的最后一句是：别只看我表达整齐，要看我有没有回应具体问题。",
  ];
  scriptedHumanPlayers(game).forEach((player, index) => {
    if (game.messages.some((message) => message.phase === "FINAL_STATEMENT" && message.senderPlayerId === player.id)) return;
    game.messages.push({
      id: crypto.randomUUID(),
      senderKind: "player",
      senderPlayerId: player.id,
      text: finalStatements[index] || finalStatements[0],
      createdAt: nowIso(clock),
      status: "sent",
      phase: "FINAL_STATEMENT",
      strategyTag: "human_final_statement",
    });
    player.strategyTags.push("human_final_statement");
  });
}

function enterFinalStatement(game, clock) {
  const mode = getMode(game.modeId);
  game.phase = "FINAL_STATEMENT";
  game.phaseEndsAt = plusSeconds(clock, finalStatementSeconds(mode));
  game.updatedAt = nowIso(clock);
  game.messages.push({
    id: crypto.randomUUID(),
    senderKind: "system",
    senderPlayerId: null,
    text: "进入最终陈述：每名真人只能补充一句，随后开始归票。",
    createdAt: nowIso(clock),
    status: "sent",
    phase: "FINAL_STATEMENT",
  });
  addAiFinalStatement(game, clock);
  addScriptedHumanFinalStatement(game, clock);
}

function finalStatementSubmittedUserIds(game) {
  const playerById = new Map(game.players.map((player) => [player.id, player]));
  return new Set(
    game.messages
      .filter((message) => message.phase === "FINAL_STATEMENT")
      .map((message) => playerById.get(message.senderPlayerId))
      .filter((player) => player?.userId)
      .map((player) => player.userId),
  );
}

function enterVoting(game, clock) {
  const mode = getMode(game.modeId);
  game.phase = "VOTING";
  game.phaseEndsAt = plusSeconds(clock, mode.votingSeconds);
  game.updatedAt = nowIso(clock);
}

function estimateOutputTokens(text) {
  const length = String(text || "").trim().length;
  return length ? Math.max(1, Math.ceil(length / 2)) : 0;
}

function aiFallbackReply({ ai, clock, source, strategyTag, latencyMs = 0 }) {
  return {
    text: "我觉得可以有限度使用，但必须让老师知道哪些部分用了辅助。",
    strategyTag,
    source,
    latencyMs,
    createdAt: nowIso(clock),
    aiPlayerId: ai.id,
  };
}

async function generateAiReply(game, aiGateway, clock) {
  const ai = aiPlayers(game)
    .filter((player) => game.messages.filter((message) => message.senderPlayerId === player.id).length < 3)
    .sort((left, right) =>
      game.messages.filter((message) => message.senderPlayerId === left.id).length -
      game.messages.filter((message) => message.senderPlayerId === right.id).length
    )[0];
  if (!ai) return null;
  const aiMessageCount = game.messages.filter((message) => message.senderPlayerId === ai.id).length;
  if (aiMessageCount >= 3) return null;
  let result;
  try {
    result = await aiGateway.generateReply({ game: structuredClone(game), aiPlayer: structuredClone(ai) });
  } catch (error) {
    const blocked = String(error?.message || "").startsWith("ai_message_blocked:");
    return aiFallbackReply({
      ai,
      clock,
      source: blocked ? "fallback_after_moderation" : "fallback_after_llm_failure",
      strategyTag: blocked ? "moderation_fallback" : "soft_deflection",
    });
  }
  const moderation = moderateText(result.text);
  if (!moderation.allowed) {
    return aiFallbackReply({
      ai,
      clock,
      source: "fallback_after_moderation",
      strategyTag: "moderation_fallback",
      latencyMs: result.latencyMs || 0,
    });
  }
  return {
    text: moderation.text,
    strategyTag: result.strategyTag || "ai_reply",
    source: result.source || "unknown",
    latencyMs: result.latencyMs || 0,
    createdAt: nowIso(clock),
    aiPlayerId: ai.id,
  };
}

function maybeAdvanceGame(game, clock) {
  if (!game || game.phase === "COMPLETED") return;
  const now = clock.now();
  const phaseEnd = Date.parse(game.phaseEndsAt);
  // 兼容旧存档：中段表态阶段已下线，历史对局直接进入最终陈述。
  if (game.phase === "MID_CHECK") {
    enterFinalStatement(game, clock);
  }
  if (game.phase === "DISCUSSION" && now >= phaseEnd) {
    enterFinalStatement(game, clock);
  }
  if (game.phase === "FINAL_STATEMENT") {
    const humanPlayers = game.players.filter((player) => player.kind === "human");
    const submittedUserIds = finalStatementSubmittedUserIds(game);
    const allSubmitted = humanPlayers.every((player) => submittedUserIds.has(player.userId));
    if (allSubmitted || now >= Date.parse(game.phaseEndsAt)) {
      enterVoting(game, clock);
    }
  }
  if (game.phase === "VOTING") {
    const humanPlayers = game.players.filter((player) => player.kind === "human");
    const submittedVotes = game.modeId === "M01" ? game.votes : game.votes.filter((vote) => vote.targetPlayerId !== "abstain");
    const votedUserIds = new Set(submittedVotes.map((vote) => vote.userId));
    const allVoted = humanPlayers.every((player) => votedUserIds.has(player.userId));
    if (allVoted || now >= Date.parse(game.phaseEndsAt)) {
      game.phase = "REVEAL";
      game.phaseEndsAt = plusSeconds(clock, 2);
      settleGame(game);
      game.updatedAt = nowIso(clock);
    }
  }
  if (game.phase === "REVEAL" && now >= Date.parse(game.phaseEndsAt)) {
    completeRevealedGame(game, clock);
  }
}

function m01Judgement(game) {
  const detective = game.players.find((player) => player.kind === "human" && player.userId);
  const opponent = game.players.find((player) => player.id !== detective?.id) || null;
  const vote = detective ? game.votes.find((item) => item.userId === detective.userId) || null : null;
  const guessedAi = Boolean(opponent && vote?.targetPlayerId === opponent.id);
  const guessedHuman = vote?.targetPlayerId === "abstain";
  const opponentIsAi = opponent?.role === "ai";
  return {
    detective,
    opponent,
    vote,
    guessedAi,
    guessedHuman,
    opponentIsAi,
    correct: Boolean(vote && ((guessedAi && opponentIsAi) || (guessedHuman && !opponentIsAi))),
  };
}

function completeRevealedGame(game, clock) {
  game.phase = "COMPLETED";
  game.phaseEndsAt = null;
  if (!game.replay) game.replay = buildReplay(game);
  game.updatedAt = nowIso(clock);
}

function voteOutcome(game) {
  const counts = new Map();
  for (const vote of game.votes) {
    if (vote.targetPlayerId === "abstain") continue;
    counts.set(vote.targetPlayerId, (counts.get(vote.targetPlayerId) || 0) + 1);
  }
  const maxVotes = Math.max(0, ...counts.values());
  const topIds = [...counts.entries()].filter(([, value]) => value === maxVotes).map(([playerId]) => playerId);
  const uniqueHighest = topIds.length === 1 && maxVotes > 0;
  const topPlayerId = uniqueHighest ? topIds[0] : null;
  const topPlayer = topPlayerId ? game.players.find((player) => player.id === topPlayerId) || null : null;
  const aiIds = new Set(aiPlayers(game).map((player) => player.id));
  const aiVoteCounts = [...aiIds].map((playerId) => counts.get(playerId) || 0);
  const humanTargetCounts = [...counts.entries()]
    .filter(([playerId]) => !aiIds.has(playerId))
    .map(([, value]) => value);
  const minAiVotes = aiVoteCounts.length ? Math.min(...aiVoteCounts) : 0;
  const maxHumanVotes = humanTargetCounts.length ? Math.max(...humanTargetCounts) : 0;
  return {
    counts,
    maxVotes,
    topPlayer,
    topPlayerId,
    uniqueHighest,
    aiWasUniqueHighest: Boolean(topPlayerId && aiIds.has(topPlayerId)),
    // 双 AI 局：每名 AI 都要吃到票，且票数都压过任何真人。
    aiPairIdentified: aiIds.size > 0 && minAiVotes > 0 && minAiVotes > maxHumanVotes,
  };
}

function settleGame(game) {
  if (game.modeId === "M01") {
    game.winner = m01Judgement(game).correct ? "human" : "ai";
    return;
  }
  const aiPlayers = game.players.filter((player) => player.role === "ai");
  if (!aiPlayers.length) {
    game.winner = "human";
    return;
  }
  const outcome = voteOutcome(game);
  if (game.modeId === "M04") {
    // 单人局只有一票，分票条件在数学上无法达成：投中任意一名 AI 即算识破。
    game.winner = (game.solo ? outcome.aiWasUniqueHighest : outcome.aiPairIdentified) ? "human" : "ai";
    return;
  }
  game.winner = outcome.aiWasUniqueHighest ? "human" : "ai";
}

function taskResultSummary(player, game, outcome) {
  const humanWon = game.winner === "human";
  const aiWon = game.winner === "ai";
  if (player.role === "ai") {
    return {
      completed: aiWon,
      summary: aiWon ? "伪装撑过归票，伪装任务完成。" : "被真人锁定，伪装任务失败。",
    };
  }
  if (player.role === "human_undercover") {
    return {
      completed: aiWon,
      summary: aiWon ? "成功保护 AI 同盟，阵营任务完成。" : "AI 同盟被锁定，阵营任务失败。",
    };
  }
  if (player.role === "fake_ai") {
    return {
      completed: aiWon,
      summary: aiWon ? "成功吸走怀疑，诱饵任务完成。" : "侦探仍锁定真正 AI，诱饵任务失败。",
    };
  }
  if (game.modeId === "M01") {
    return {
      completed: humanWon,
      summary: humanWon ? "真假判断成立，侦探任务完成。" : "真假判断失手，侦探任务失败。",
    };
  }
  if (game.modeId === "M04") {
    if (game.solo) {
      return {
        completed: humanWon,
        summary: humanWon ? "投中伪装者，侦探任务完成。" : "两名伪装者都躲过指认，侦探任务失败。",
      };
    }
    return {
      completed: humanWon,
      summary: humanWon ? "真人分票锁定两名 AI，侦探任务完成。" : "归票没有完整锁定双 AI，侦探任务失败。",
    };
  }
  return {
    completed: humanWon,
    summary: humanWon ? "真正 AI 被投成唯一最高票，侦探任务完成。" : "真正 AI 躲过归票，侦探任务失败。",
  };
}

function buildTaskResults(game, outcome) {
  return game.players.map((player) => {
    const result = taskResultSummary(player, game, outcome);
    return {
      playerId: player.id,
      userId: player.userId || null,
      role: player.role,
      title: taskTitle(player.role),
      goal: taskGoal(player, game),
      completed: result.completed,
      status: result.completed ? "completed" : "failed",
      summary: result.summary,
    };
  });
}

function buildReplay(game) {
  const ais = aiPlayers(game);
  const ai = ais[0] || null;
  const keyMessages = game.messages
    .filter((message) => message.strategyTag || message.senderKind === "player")
    .slice(-4)
    .map((message) => ({
      messageId: message.id,
      senderPlayerId: message.senderPlayerId,
      text: message.text,
      strategyTag: message.strategyTag || null,
    }));
  const outcome = voteOutcome(game);
  return {
    id: crypto.randomUUID(),
    gameId: game.id,
    status: "ready",
    winner: game.winner,
    aiPlayerId: ai?.id || null,
    aiGoal: ai?.hiddenTask || null,
    aiPlayerIds: ais.map((player) => player.id),
    aiGoals: ais.map((player) => ({ playerId: player.id, goal: player.hiddenTask || null })),
    identitySummary: game.players.map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      role: player.role,
      hiddenTask: player.hiddenTask || null,
    })),
    voteSummary: game.votes,
    taskResults: buildTaskResults(game, outcome),
    keyMessages,
    explanation: replayExplanation(game, outcome),
  };
}

function replayExplanation(game, outcome) {
  if (game.modeId === "M01") {
    const judgement = m01Judgement(game);
    if (judgement.correct && judgement.opponentIsAi) {
      return "你判断对方是 AI，真正伪装者被锁定，判断正确。";
    }
    if (judgement.correct) {
      return "你判断对方是真人补位，没有误投，判断正确。";
    }
    if (!judgement.vote) {
      return "你没有完成真假判断，对局直接失手。";
    }
    if (judgement.opponentIsAi) {
      return "对方其实是 AI，但你判断成真人，伪装者逃脱。";
    }
    return "对方其实是真人补位，但你判断成 AI，判断失败。";
  }
  if (game.modeId === "M04") {
    if (game.winner === "human") {
      return game.solo ? "你投中了其中一名伪装者，单人局识破成功。" : "真人把票分到两名 AI 身上，双伪装者都被锁定，识别成功。";
    }
    if (game.solo) {
      return "两名伪装者都躲过了你的指认，双 AI 阵营获胜。";
    }
    return "两名 AI 没有同时被票数压制，双 AI 阵营撑过归票，伪装目标达成。";
  }
  if (game.winner === "human") {
    return "侦探阵营把真正 AI 投成唯一最高票，识别成功。";
  }
  if (game.modeId === "M06" && outcome.topPlayer?.role === "human_undercover") {
    return "人类卧底吸走了最高票，真正 AI 没有被投成唯一最高票，AI 同盟获胜。";
  }
  if (game.modeId === "M08" && outcome.topPlayer?.role === "fake_ai") {
    return "伪 AI 真人成功吸走投票，真正 AI 躲过归票，AI 同盟获胜。";
  }
  if (!outcome.uniqueHighest) {
    return "归票没有形成唯一最高票，真正 AI 躲过识别，伪装目标达成。";
  }
  return "真正 AI 没有成为唯一最高票，伪装目标达成。";
}

const shareAnonymSuffixes = "ABCDEFGHIJ".split("");

// Read-only, additive helper for the post-game "share card" preview (section 2.3
// of the redesign brief). Derived entirely from existing completed-game data
// (game.replay, clue reactions, mode/topic config); it does not add new
// persisted state. Deliberately excludes userId, roomId and gameId, and
// anonymizes every player except the viewer as "神秘玩家 A/B/C...".
function buildShareCard(game, viewerUserId) {
  if (game.phase !== "COMPLETED" || !game.replay) {
    throw Object.assign(new Error("replay_not_ready"), { status: 409 });
  }
  const mode = modes[game.modeId] || null;
  const viewerPlayer = game.players.find((player) => player.userId === viewerUserId) || null;

  let anonymIndex = 0;
  const anonymizedNames = new Map();
  function anonymizedLabelFor(playerId) {
    if (viewerPlayer && playerId === viewerPlayer.id) return "我";
    if (!anonymizedNames.has(playerId)) {
      const suffix = shareAnonymSuffixes[anonymIndex % shareAnonymSuffixes.length];
      anonymizedNames.set(playerId, `神秘玩家 ${suffix}`);
      anonymIndex += 1;
    }
    return anonymizedNames.get(playerId);
  }

  const clueMessageIds = new Set(
    (game.messages || [])
      .filter((message) => viewerReactionType(game, viewerUserId, message.id) === "clue")
      .map((message) => message.id),
  );
  const myClueMessages = (game.messages || [])
    .filter((message) => clueMessageIds.has(message.id))
    .slice(-2)
    .map((message) => ({
      aboutPlayer: anonymizedLabelFor(message.senderPlayerId),
      text: String(message.text || "").slice(0, 60),
    }));

  const keyClues = myClueMessages.map((item) => `${item.aboutPlayer} 的关键发言：${item.text}`).slice(0, 2);

  return {
    modeId: game.modeId,
    modeName: mode?.name || game.modeId,
    topicTitle: game.topic?.title || null,
    resultHeadline: game.replay.explanation,
    winner: game.winner,
    keyClues,
    brand: "图灵迷局",
  };
}

export class GameEngine {
  constructor(store, { clock = Date, aiGateway = new ScriptedAIGateway(), env = {} } = {}) {
    this.store = store;
    this.clock = clock;
    this.aiGateway = aiGateway;
    this.env = env;
  }

  async createGuest({ nickname, ageConfirmed, communityConfirmed }) {
    assertOnboardingConfirmed({ ageConfirmed, communityConfirmed });
    return await this.store.mutate((state) => {
      const user = {
        id: crypto.randomUUID(),
        kind: "guest",
        nickname: nickname?.trim() || `玩家${state.users.length + 1}`,
        avatarKey: "default-1",
        wallet: { clueStars: 0, xp: 0 },
        appleSub: null,
        googleSub: null,
        wechatSub: null,
        wechatUnionId: null,
        bannedAt: null,
        banReason: null,
        ageConfirmed,
        communityConfirmed,
        createdAt: nowIso(this.clock),
        deletedAt: null,
      };
      state.users.push(user);
      appendEvent(state, "user.created", { userId: user.id, kind: "guest" }, this.clock);
      return user;
    });
  }

  async upsertAppleUser({ appleSub, email, nickname, appleRefreshToken, ageConfirmed, communityConfirmed }) {
    assertOnboardingConfirmed({ ageConfirmed, communityConfirmed });
    return await this.store.mutate((state) => {
      let user = state.users.find((item) => item.appleSub === appleSub);
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          kind: "apple",
          nickname: nickname?.trim() || "Apple 用户",
          avatarKey: "default-1",
          wallet: { clueStars: 0, xp: 0 },
          appleSub,
          googleSub: null,
          wechatSub: null,
          wechatUnionId: null,
          email,
          appleRefreshToken: appleRefreshToken || null,
          bannedAt: null,
          banReason: null,
          ageConfirmed,
          communityConfirmed,
          createdAt: nowIso(this.clock),
          deletedAt: null,
        };
        state.users.push(user);
      } else if (appleRefreshToken) {
        user.appleRefreshToken = appleRefreshToken;
      }
      user.ageConfirmed = true;
      user.communityConfirmed = true;
      appendEvent(state, "user.apple_login", { userId: user.id }, this.clock);
      return user;
    });
  }

  async upsertGoogleUser({ googleSub, email, nickname, ageConfirmed, communityConfirmed }) {
    assertOnboardingConfirmed({ ageConfirmed, communityConfirmed });
    return await this.store.mutate((state) => {
      let user = state.users.find((item) => item.googleSub === googleSub);
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          kind: "google",
          nickname: nickname?.trim() || "Google 用户",
          avatarKey: "default-1",
          wallet: { clueStars: 0, xp: 0 },
          appleSub: null,
          googleSub,
          wechatSub: null,
          wechatUnionId: null,
          email,
          appleRefreshToken: null,
          bannedAt: null,
          banReason: null,
          ageConfirmed,
          communityConfirmed,
          createdAt: nowIso(this.clock),
          deletedAt: null,
        };
        state.users.push(user);
      }
      user.ageConfirmed = true;
      user.communityConfirmed = true;
      appendEvent(state, "user.google_login", { userId: user.id }, this.clock);
      return user;
    });
  }

  async upsertWeChatUser({ wechatSub, unionId, nickname, ageConfirmed, communityConfirmed }) {
    assertOnboardingConfirmed({ ageConfirmed, communityConfirmed });
    if (!wechatSub) throw Object.assign(new Error("invalid_wechat_subject"), { status: 400 });
    return await this.store.mutate((state) => {
      let user = state.users.find((item) => item.wechatSub === wechatSub);
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          kind: "wechat",
          nickname: nickname?.trim() || "微信用户",
          avatarKey: "default-1",
          wallet: { clueStars: 0, xp: 0 },
          appleSub: null,
          googleSub: null,
          wechatSub,
          wechatUnionId: unionId || null,
          email: null,
          appleRefreshToken: null,
          bannedAt: null,
          banReason: null,
          ageConfirmed,
          communityConfirmed,
          createdAt: nowIso(this.clock),
          deletedAt: null,
        };
        state.users.push(user);
      } else if (unionId && !user.wechatUnionId) {
        user.wechatUnionId = unionId;
      }
      user.ageConfirmed = true;
      user.communityConfirmed = true;
      appendEvent(state, "user.wechat_login", { userId: user.id }, this.clock);
      return user;
    });
  }

  async getUser(userId) {
    const state = await this.store.snapshot();
    return state.users.find((user) => user.id === userId && !user.deletedAt);
  }

  async userSummary(userId) {
    const state = await this.store.snapshot();
    if (!state.users.some((user) => user.id === userId && !user.deletedAt)) {
      throw Object.assign(new Error("user_not_found"), { status: 404 });
    }
    return userGameSummary(state, userId, this.clock);
  }

  async userGames(userId, { limit = 20 } = {}) {
    return await this.store.mutate((state) => {
      if (!state.users.some((user) => user.id === userId && !user.deletedAt)) {
        throw Object.assign(new Error("user_not_found"), { status: 404 });
      }
      for (const game of state.games) {
        if (game.players.some((player) => player.userId === userId)) {
          maybeAdvanceGame(game, this.clock);
        }
      }
      return userGameHistory(state, userId, { limit });
    });
  }

  async leaderboard(userId, { limit = 20 } = {}) {
    const state = await this.store.snapshot();
    if (!state.users.some((user) => user.id === userId && !user.deletedAt)) {
      throw Object.assign(new Error("user_not_found"), { status: 404 });
    }
    return playerLeaderboard(state, userId, this.clock, { limit });
  }

  async claimMissionReward({ userId, missionId }) {
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      assertUserCanPlay(user);
      const dateKey = missionDateKey(this.clock);
      const summary = userGameSummary(state, userId, this.clock);
      const mission = summary.missions.items.find((item) => item.id === missionId);
      if (!mission) throw Object.assign(new Error("mission_not_found"), { status: 404 });
      if (!mission.completed) throw Object.assign(new Error("mission_not_completed"), { status: 409 });
      if (mission.claimed) throw Object.assign(new Error("mission_already_claimed"), { status: 409 });
      const wallet = userWallet(user);
      wallet.clueStars += mission.reward.clueStars;
      wallet.xp += mission.reward.xp;
      state.missionClaims = state.missionClaims || [];
      state.missionClaims.push({
        id: crypto.randomUUID(),
        userId,
        missionId,
        dateKey,
        reward: mission.reward,
        createdAt: nowIso(this.clock),
      });
      appendEvent(state, "mission.claimed", { userId, missionId, dateKey, reward: mission.reward }, this.clock);
      return userGameSummary(state, userId, this.clock);
    });
  }

  async claimAllMissionRewards({ userId }) {
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      assertUserCanPlay(user);
      const dateKey = missionDateKey(this.clock);
      const summary = userGameSummary(state, userId, this.clock);
      const claimableMissions = summary.missions.items.filter((item) => item.claimable && !item.claimed);
      if (!claimableMissions.length) {
        throw Object.assign(new Error("no_claimable_missions"), { status: 409 });
      }
      const wallet = userWallet(user);
      const totalReward = { clueStars: 0, xp: 0 };
      state.missionClaims = state.missionClaims || [];
      for (const mission of claimableMissions) {
        wallet.clueStars += mission.reward.clueStars;
        wallet.xp += mission.reward.xp;
        totalReward.clueStars += mission.reward.clueStars;
        totalReward.xp += mission.reward.xp;
        state.missionClaims.push({
          id: crypto.randomUUID(),
          userId,
          missionId: mission.id,
          dateKey,
          reward: mission.reward,
          createdAt: nowIso(this.clock),
        });
        appendEvent(state, "mission.claimed", { userId, missionId: mission.id, dateKey, reward: mission.reward }, this.clock);
      }
      appendEvent(
        state,
        "mission.claimed_all",
        { userId, missionIds: claimableMissions.map((mission) => mission.id), dateKey, reward: totalReward },
        this.clock,
      );
      return userGameSummary(state, userId, this.clock);
    });
  }

  async unlockCosmetic({ userId, itemId }) {
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      if (!user) throw Object.assign(new Error("user_not_found"), { status: 404 });
      const item = cosmeticById(itemId);
      if (!item) throw Object.assign(new Error("cosmetic_not_found"), { status: 404 });
      const cosmetics = ensureCosmetics(user);
      if (cosmetics.ownedIds.includes(item.id)) {
        return userGameSummary(state, userId, this.clock);
      }
      const wallet = userWallet(user);
      if (wallet.clueStars < item.cost) {
        throw Object.assign(new Error("cosmetic_not_enough_stars"), { status: 409 });
      }
      wallet.clueStars -= item.cost;
      cosmetics.ownedIds.push(item.id);
      cosmetics.equippedId = item.id;
      appendEvent(state, "cosmetic.unlocked", { userId, itemId: item.id, cost: item.cost }, this.clock);
      return userGameSummary(state, userId, this.clock);
    });
  }

  async equipCosmetic({ userId, itemId }) {
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      if (!user) throw Object.assign(new Error("user_not_found"), { status: 404 });
      const item = cosmeticById(itemId);
      if (!item) throw Object.assign(new Error("cosmetic_not_found"), { status: 404 });
      const cosmetics = ensureCosmetics(user);
      if (!cosmetics.ownedIds.includes(item.id)) {
        throw Object.assign(new Error("cosmetic_not_owned"), { status: 409 });
      }
      cosmetics.equippedId = item.id;
      appendEvent(state, "cosmetic.equipped", { userId, itemId: item.id }, this.clock);
      return userGameSummary(state, userId, this.clock);
    });
  }

  async getPlayableUser(userId) {
    const user = await this.getUser(userId);
    assertUserCanPlay(user);
    return user;
  }

  async deleteAccount(userId) {
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) return null;
      const deletedAt = nowIso(this.clock);
      const anonymizedNickname = "已删除用户";
      const deletedUser = {
        ...user,
        nickname: anonymizedNickname,
        avatarKey: null,
        appleSub: null,
        googleSub: null,
        wechatSub: null,
        wechatUnionId: null,
        appleRefreshToken: null,
        email: null,
        deletedAt,
      };
      Object.assign(user, deletedUser);
      state.blocks = state.blocks.filter((block) => block.sourceUserId !== userId && block.targetUserId !== userId);
      state.matchmaking = state.matchmaking.filter((item) => item.userId !== userId);
      for (const room of state.rooms) {
        if (room.status === "LOBBY") {
          room.players = room.players.filter((player) => player.userId !== userId);
          if (room.hostUserId === userId) {
            const nextHost = room.players.find((player) => player.kind === "human" && player.userId);
            room.hostUserId = nextHost?.userId || null;
            if (!room.hostUserId) room.status = "CLOSED";
          }
        } else {
          for (const player of room.players) {
            if (player.userId === userId) player.nickname = anonymizedNickname;
          }
        }
      }
      for (const game of state.games) {
        for (const player of game.players) {
          if (player.userId === userId) player.nickname = anonymizedNickname;
        }
        if (game.replay) {
          for (const item of game.replay.identitySummary || []) {
            const player = game.players.find((gamePlayer) => gamePlayer.id === item.playerId);
            if (player?.userId === userId) item.nickname = anonymizedNickname;
          }
        }
      }
      appendEvent(state, "user.deleted", { userId }, this.clock);
      return publicUser(user);
    });
  }

  listModes() {
    return Object.values(modes);
  }

  async listTopics({ modeId } = {}) {
    if (modeId) getMode(modeId);
    const state = await this.store.snapshot();
    return configuredTopics(state).filter((topic) => topicAvailableForMode(topic, modeId));
  }

  async adminTopics() {
    const state = await this.store.snapshot();
    return configuredTopics(state);
  }

  async updateTopicSetting({ topicId, enabled, actor = "admin" }) {
    return await this.store.mutate((state) => {
      const baseTopic = topics.find((topic) => topic.id === topicId);
      if (!baseTopic) throw Object.assign(new Error("topic_not_found"), { status: 404 });
      const currentSettings = topicSettings(state);
      const nextSetting = {
        ...(currentSettings[topicId] || {}),
        enabled: enabled !== false,
        updatedAt: nowIso(this.clock),
        updatedBy: actor,
      };
      const nextState = {
        ...state,
        topicSettings: {
          ...currentSettings,
          [topicId]: nextSetting,
        },
      };
      assertEveryModeHasTopic(nextState);
      state.topicSettings = nextState.topicSettings;
      appendEvent(state, "topic.updated", { topicId, enabled: nextSetting.enabled, actor }, this.clock);
      return configuredTopics(state).find((topic) => topic.id === topicId);
    });
  }

  async startMatchmaking({ userId, modeId, topicId }) {
    const mode = getMode(modeId);
    if (mode.id !== "M01" && mode.id !== "M02") {
      throw Object.assign(new Error("mode_requires_friend_room"), { status: 422 });
    }
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      assertUserCanPlay(user);
      const topic = getTopic(topicId, mode.id, state);
      if (mode.id === "M01") {
        const players = [makeHumanPlayer(user), makeM01Opponent(this.env)];
        const game = createGameFromPlayers(state, { roomId: null, modeId, topicId: topic.id, players, clock: this.clock });
        return { status: "matched", game: serializeGame(game, userId, state) };
      }

      const existing = state.matchmaking.find(
        (item) =>
          item.modeId === modeId &&
          (item.topicId || getTopic(null, item.modeId, state).id) === topic.id &&
          (item.status || "waiting") === "waiting" &&
          item.userId !== userId &&
          !usersBlockedEachOther(state, item.userId, userId),
      );
      if (!existing) {
        state.matchmaking = state.matchmaking.filter((item) => item.userId !== userId);
        const ticket = { id: crypto.randomUUID(), userId, modeId, topicId: topic.id, status: "waiting", gameId: null, createdAt: nowIso(this.clock) };
        state.matchmaking.push(ticket);
        appendEvent(state, "match.waiting", { userId, modeId, topicId: topic.id, ticketId: ticket.id }, this.clock);
        return { status: "waiting", modeId, topicId: topic.id, ticketId: ticket.id, createdAt: ticket.createdAt };
      }

      state.matchmaking = state.matchmaking.filter((item) => item.userId !== userId);
      const otherUser = state.users.find((item) => item.id === existing.userId);
      const humans = [makeHumanPlayer(otherUser), makeHumanPlayer(user)];
      const aiPlayers = Array.from({ length: mode.aiCount }, (_, index) => makeAiPlayer(index));
      const remaining = mode.playerCount - humans.length - aiPlayers.length;
      const players = [...humans, ...aiPlayers, ...Array.from({ length: remaining }, (_, index) => makeScriptedHuman(index))];
      const game = createGameFromPlayers(state, { roomId: null, modeId, topicId: topic.id, players, clock: this.clock });
      existing.status = "matched";
      existing.gameId = game.id;
      existing.matchedAt = nowIso(this.clock);
      appendEvent(state, "match.matched", { gameId: game.id, modeId, topicId: topic.id, ticketId: existing.id }, this.clock);
      return { status: "matched", game: serializeGame(game, userId, state) };
    });
  }

  // 快速开始：任何模式都能单人开局，缺的真人席位由脚本补位真人填充、AI 席位由 AI 填充，
  // 立即进入对局。用于大厅"点开即玩"，不需要好友房建房或公开匹配凑真人。
  async quickStart({ userId, modeId, topicId }) {
    const mode = getMode(modeId);
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      assertUserCanPlay(user);
      const topic = getTopic(topicId, mode.id, state);
      let players;
      if (mode.id === "M01") {
        players = [makeHumanPlayer(user), makeM01Opponent(this.env)];
      } else {
        const missingHumans = Math.max(0, mode.minHumanCount - 1);
        const scriptedHumans = Array.from({ length: missingHumans }, (_, index) => makeScriptedHuman(index));
        const aiSeats = Array.from({ length: mode.aiCount }, (_, index) => makeAiPlayer(index));
        const basePlayers = [makeHumanPlayer(user), ...scriptedHumans];
        const remaining = Math.max(0, mode.playerCount - basePlayers.length - aiSeats.length);
        const extraHumans = Array.from({ length: remaining }, (_, index) => makeScriptedHuman(index + missingHumans));
        players = [...basePlayers, ...aiSeats, ...extraHumans];
      }
      const game = createGameFromPlayers(state, { roomId: null, modeId, topicId: topic.id, players, clock: this.clock, soloUserId: userId });
      // 单人局标记：讨论可提前结束，M04 使用单人判定。
      game.solo = true;
      appendEvent(state, "game.quick_start", { gameId: game.id, modeId, topicId: topic.id }, this.clock);
      return { status: "matched", game: serializeGame(game, userId, state) };
    });
  }

  // 单人局专用：唯一的真人玩家聊够了可以提前结束讨论，直接进入最终陈述，
  // 避免 AI/脚本补位停止回复后玩家干等讨论倒计时。
  async finishDiscussion({ userId, gameId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      maybeAdvanceGame(game, this.clock);
      const player = game.players.find((item) => item.userId === userId);
      if (!player) throw Object.assign(new Error("player_not_in_game"), { status: 403 });
      if (!game.solo) throw Object.assign(new Error("discussion_finish_not_available"), { status: 409 });
      if (game.phase !== "DISCUSSION") throw Object.assign(new Error("discussion_finish_not_allowed_in_phase"), { status: 409 });
      assertTaskCardAcknowledged(game, userId);
      enterFinalStatement(game, this.clock);
      appendEvent(state, "game.discussion.finished", { gameId, userId }, this.clock);
      return serializeGame(game, userId, state);
    });
  }

  async getMatchmakingStatus({ userId, ticketId }) {
    return await this.store.mutate((state) => {
      const ticket = state.matchmaking.find((item) => item.id === ticketId && item.userId === userId);
      if (!ticket) throw Object.assign(new Error("matchmaking_ticket_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (ticket.status === "matched" && ticket.gameId) {
        const game = state.games.find((item) => item.id === ticket.gameId);
        if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
        maybeAdvanceGame(game, this.clock);
        return { status: "matched", modeId: ticket.modeId, topicId: ticket.topicId || null, ticketId: ticket.id, createdAt: ticket.createdAt, game: serializeGame(game, userId, state) };
      }
      return { status: "waiting", modeId: ticket.modeId, topicId: ticket.topicId || null, ticketId: ticket.id, createdAt: ticket.createdAt };
    });
  }

  async cancelMatchmaking({ userId, ticketId }) {
    return await this.store.mutate((state) => {
      const ticket = state.matchmaking.find((item) => item.id === ticketId && item.userId === userId);
      if (!ticket) throw Object.assign(new Error("matchmaking_ticket_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (ticket.status === "matched" && ticket.gameId) {
        const game = state.games.find((item) => item.id === ticket.gameId);
        if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
        maybeAdvanceGame(game, this.clock);
        return { status: "matched", modeId: ticket.modeId, topicId: ticket.topicId || null, ticketId: ticket.id, createdAt: ticket.createdAt, game: serializeGame(game, userId, state) };
      }
      state.matchmaking = state.matchmaking.filter((item) => item.id !== ticket.id);
      appendEvent(state, "match.cancelled", { userId, modeId: ticket.modeId, topicId: ticket.topicId || null, ticketId: ticket.id }, this.clock);
      return { status: "cancelled", modeId: ticket.modeId, topicId: ticket.topicId || null, ticketId: ticket.id, createdAt: ticket.createdAt };
    });
  }

  async createRoom({ userId, modeId, topicId, allowAiFill = true }) {
    const mode = getMode(modeId);
    const room = await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      assertUserCanPlay(user);
      const topic = getTopic(topicId, mode.id, state);
      const hostPlayer = makeHumanPlayer(user);
      hostPlayer.ready = true;
      const newRoom = {
        id: crypto.randomUUID(),
        inviteCode: roomCode(),
        modeId: mode.id,
        topicId: topic.id,
        hostUserId: userId,
        allowAiFill,
        status: "LOBBY",
        players: [hostPlayer],
        createdAt: nowIso(this.clock),
        gameId: null,
      };
      state.rooms.push(newRoom);
      appendEvent(state, "room.created", { roomId: newRoom.id, modeId, topicId: topic.id }, this.clock);
      return newRoom;
    });
    return serializeRoom(room);
  }

  async setRoomTopic({ userId, roomId, topicId }) {
    const room = await this.store.mutate((state) => {
      const targetRoom = state.rooms.find((item) => item.id === roomId);
      if (!targetRoom) throw Object.assign(new Error("room_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (targetRoom.status !== "LOBBY") {
        throw Object.assign(new Error("room_topic_locked"), { status: 409 });
      }
      if (targetRoom.hostUserId !== userId) {
        throw Object.assign(new Error("only_host_can_update_topic"), { status: 403 });
      }
      const topic = getTopic(topicId, targetRoom.modeId, state);
      if (targetRoom.topicId === topic.id) return targetRoom;
      targetRoom.topicId = topic.id;
      for (const player of targetRoom.players) {
        if (player.kind === "human") player.ready = player.userId === targetRoom.hostUserId;
      }
      appendEvent(state, "room.topic.updated", { roomId, userId, topicId: topic.id }, this.clock);
      return targetRoom;
    });
    return serializeRoom(room);
  }

  async joinRoom({ userId, inviteCode }) {
    const room = await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === userId && !item.deletedAt);
      const targetRoom = state.rooms.find((item) => item.inviteCode === inviteCode && item.status === "LOBBY");
      assertUserCanPlay(user);
      if (!targetRoom) throw Object.assign(new Error("room_not_found"), { status: 404 });
      if (targetRoom.players.some((player) => usersBlockedEachOther(state, player.userId, userId))) {
        throw Object.assign(new Error("room_blocked_user"), { status: 403 });
      }
      if (!targetRoom.players.some((player) => player.userId === userId)) {
        const mode = getMode(targetRoom.modeId);
        const maxHumanSeats = Math.max(0, mode.playerCount - mode.aiCount);
        const humanCount = targetRoom.players.filter((player) => player.kind === "human").length;
        if (humanCount >= maxHumanSeats) {
          throw Object.assign(new Error("room_full"), { status: 409 });
        }
        targetRoom.players.push(makeHumanPlayer(user));
      }
      appendEvent(state, "room.joined", { roomId: targetRoom.id, userId }, this.clock);
      return targetRoom;
    });
    return serializeRoom(room);
  }

  async setReady({ userId, roomId, ready }) {
    const room = await this.store.mutate((state) => {
      const targetRoom = state.rooms.find((item) => item.id === roomId);
      const player = targetRoom?.players.find((item) => item.userId === userId);
      if (!targetRoom || !player) throw Object.assign(new Error("room_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      player.ready = Boolean(ready);
      appendEvent(state, "room.ready", { roomId, userId, ready: player.ready }, this.clock);
      return targetRoom;
    });
    return serializeRoom(room);
  }

  async startRoom({ userId, roomId }) {
    const result = await this.store.mutate((state) => {
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) throw Object.assign(new Error("room_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (room.hostUserId !== userId) throw Object.assign(new Error("only_host_can_start"), { status: 403 });
      const mode = getMode(room.modeId);
      const humanCount = room.players.filter((player) => player.kind === "human").length;
      const maxHumanSeats = Math.max(0, mode.playerCount - mode.aiCount);
      if (humanCount > maxHumanSeats) {
        throw Object.assign(new Error("room_full"), { status: 409 });
      }
      if (humanCount < mode.minHumanCount) {
        throw Object.assign(new Error("not_enough_humans"), { status: 409 });
      }
      const readyHumans = room.players.filter((player) => player.kind === "human").every((player) => player.ready);
      if (!readyHumans) throw Object.assign(new Error("not_all_ready"), { status: 409 });
      const aiPlayers = Array.from({ length: mode.aiCount }, (_, index) => makeAiPlayer(index));
      const remaining = Math.max(0, mode.playerCount - room.players.length - aiPlayers.length);
      const players = [...room.players, ...aiPlayers, ...Array.from({ length: remaining }, (_, index) => makeScriptedHuman(index))];
      const game = createGameFromPlayers(state, { roomId: room.id, modeId: room.modeId, topicId: room.topicId, players, clock: this.clock });
      room.status = "IN_GAME";
      room.gameId = game.id;
      appendEvent(state, "room.started", { roomId, gameId: game.id }, this.clock);
      return { room, game: serializeGame(game, userId, state) };
    });
    return { room: serializeRoom(result.room), game: result.game };
  }

  async debugFillAndStartRoom({ userId, roomId }) {
    const result = await this.store.mutate((state) => {
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) throw Object.assign(new Error("room_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (room.hostUserId !== userId) throw Object.assign(new Error("only_host_can_start"), { status: 403 });
      if (room.status !== "LOBBY") throw Object.assign(new Error("room_already_started"), { status: 409 });
      const mode = getMode(room.modeId);
      const humanCount = room.players.filter((player) => player.kind === "human").length;
      const maxHumanSeats = Math.max(0, mode.playerCount - mode.aiCount);
      if (humanCount > maxHumanSeats) {
        throw Object.assign(new Error("room_full"), { status: 409 });
      }
      const missingHumans = Math.max(0, mode.minHumanCount - humanCount);
      const debugHumans = Array.from({ length: missingHumans }, (_, index) => makeScriptedHuman(index));
      const aiSeats = Array.from({ length: mode.aiCount }, (_, index) => makeAiPlayer(index));
      const basePlayers = [...room.players, ...debugHumans];
      const remaining = Math.max(0, mode.playerCount - basePlayers.length - aiSeats.length);
      const extraHumans = Array.from({ length: remaining }, (_, index) => makeScriptedHuman(index + missingHumans));
      const players = [...basePlayers, ...aiSeats, ...extraHumans];
      const game = createGameFromPlayers(state, { roomId: room.id, modeId: room.modeId, topicId: room.topicId, players, clock: this.clock });
      room.status = "IN_GAME";
      room.gameId = game.id;
      appendEvent(state, "debug.room.fill_and_start", { roomId, gameId: game.id, missingHumans }, this.clock);
      return { room, game: serializeGame(game, userId, state) };
    });
    return { room: serializeRoom(result.room), game: result.game };
  }

  async rematchRoom({ userId, roomId }) {
    const result = await this.store.mutate((state) => {
      const sourceRoom = state.rooms.find((item) => item.id === roomId);
      if (!sourceRoom) throw Object.assign(new Error("room_not_found"), { status: 404 });
      const requester = state.users.find((item) => item.id === userId && !item.deletedAt);
      assertUserCanPlay(requester);
      if (!sourceRoom.players.some((player) => player.userId === userId)) {
        throw Object.assign(new Error("room_forbidden"), { status: 403 });
      }
      const sourceGame = sourceRoom.gameId ? state.games.find((item) => item.id === sourceRoom.gameId) : null;
      if (!sourceGame) throw Object.assign(new Error("room_rematch_not_available"), { status: 409 });
      maybeAdvanceGame(sourceGame, this.clock);
      if (sourceRoom.status !== "IN_GAME" || sourceGame.phase !== "COMPLETED") {
        throw Object.assign(new Error("room_rematch_not_available"), { status: 409 });
      }

      if (sourceRoom.rematchRoomId) {
        const existingRoom = state.rooms.find((item) => item.id === sourceRoom.rematchRoomId && item.status !== "CLOSED");
        if (existingRoom) {
          if (!existingRoom.players.some((player) => player.userId === userId)) {
            throw Object.assign(new Error("room_forbidden"), { status: 403 });
          }
          return { room: existingRoom, created: false };
        }
      }

      const retainedUsers = [];
      const sourceUserIds = [
        userId,
        ...sourceRoom.players
          .filter((player) => player.kind === "human" && player.userId && player.userId !== userId)
          .map((player) => player.userId),
      ];
      for (const sourceUserId of new Set(sourceUserIds)) {
        const user = state.users.find((item) => item.id === sourceUserId && !item.deletedAt && !item.bannedAt);
        if (!user) continue;
        if (retainedUsers.some((retainedUser) => usersBlockedEachOther(state, retainedUser.id, user.id))) continue;
        retainedUsers.push(user);
      }

      const players = retainedUsers.map((user) => {
        const player = makeHumanPlayer(user);
        player.ready = user.id === userId;
        return player;
      });
      const room = {
        id: crypto.randomUUID(),
        inviteCode: roomCode(),
        modeId: sourceRoom.modeId,
        topicId: rematchTopicId(sourceRoom.topicId || sourceGame.topic?.id, sourceRoom.modeId, state),
        hostUserId: userId,
        allowAiFill: sourceRoom.allowAiFill !== false,
        status: "LOBBY",
        players,
        createdAt: nowIso(this.clock),
        gameId: null,
        rematchFromRoomId: sourceRoom.id,
        rematchFromGameId: sourceGame.id,
      };
      sourceRoom.rematchRoomId = room.id;
      state.rooms.push(room);
      appendEvent(state, "room.rematch.created", { roomId: room.id, sourceRoomId: sourceRoom.id, sourceGameId: sourceGame.id, modeId: room.modeId, topicId: room.topicId }, this.clock);
      return { room, created: true };
    });
    return { room: serializeRoom(result.room), created: result.created };
  }

  async leaveRoom({ userId, roomId }) {
    const room = await this.store.mutate((state) => {
      const targetRoom = state.rooms.find((item) => item.id === roomId);
      if (!targetRoom) throw Object.assign(new Error("room_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (targetRoom.status !== "LOBBY") {
        throw Object.assign(new Error("room_leave_not_allowed"), { status: 409 });
      }
      if (!targetRoom.players.some((player) => player.userId === userId)) {
        throw Object.assign(new Error("room_not_found"), { status: 404 });
      }
      targetRoom.players = targetRoom.players.filter((player) => player.userId !== userId);
      if (targetRoom.hostUserId === userId) {
        const nextHost = targetRoom.players.find((player) => player.kind === "human" && player.userId);
        targetRoom.hostUserId = nextHost?.userId || null;
        if (!targetRoom.hostUserId) {
          targetRoom.status = "CLOSED";
        }
      }
      appendEvent(state, "room.left", { roomId, userId, status: targetRoom.status, hostUserId: targetRoom.hostUserId }, this.clock);
      return targetRoom;
    });
    return serializeRoom(room);
  }

  async getRoom({ roomId, userId }) {
    const state = await this.store.snapshot();
    const room = state.rooms.find((item) => item.id === roomId);
    if (!room) return null;
    if (userId && room.hostUserId !== userId && !room.players.some((player) => player.userId === userId)) {
      throw Object.assign(new Error("room_forbidden"), { status: 403 });
    }
    return serializeRoom(room);
  }

  async getGame({ userId, gameId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (!game.players.some((player) => player.userId === userId)) {
        throw Object.assign(new Error("game_forbidden"), { status: 403 });
      }
      maybeAdvanceGame(game, this.clock);
      return serializeGame(game, userId, state);
    });
  }

  async acknowledgeTaskCard({ userId, gameId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      maybeAdvanceGame(game, this.clock);
      const player = game.players.find((item) => item.userId === userId);
      if (!player) throw Object.assign(new Error("player_not_in_game"), { status: 403 });
      game.taskAcks = Array.isArray(game.taskAcks) ? game.taskAcks : [];
      if (!game.taskAcks.some((item) => item.userId === userId)) {
        game.taskAcks.push({ id: crypto.randomUUID(), userId, playerId: player.id, createdAt: nowIso(this.clock) });
        appendEvent(state, "game.task_card.acknowledged", { gameId, userId, playerId: player.id }, this.clock);
      }
      game.updatedAt = nowIso(this.clock);
      return serializeGame(game, userId, state);
    });
  }

  async sendMessage({ userId, gameId, text }) {
    const result = await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      maybeAdvanceGame(game, this.clock);
      if (game.phase !== "DISCUSSION" && game.phase !== "FINAL_STATEMENT") {
        throw Object.assign(new Error("message_not_allowed_in_phase"), { status: 409 });
      }
      const player = game.players.find((item) => item.userId === userId);
      if (!player) throw Object.assign(new Error("player_not_in_game"), { status: 403 });
      if (game.phase === "DISCUSSION") assertTaskCardAcknowledged(game, userId);
      if (game.phase === "FINAL_STATEMENT" && game.messages.some((message) => message.phase === "FINAL_STATEMENT" && message.senderPlayerId === player.id)) {
        throw Object.assign(new Error("final_statement_already_sent"), { status: 409 });
      }
      const moderation = moderateText(text);
      if (!moderation.allowed) {
        appendEvent(state, "message.blocked", { gameId, userId, reason: moderation.reason }, this.clock);
        throw Object.assign(new Error(`message_blocked:${moderation.reason}`), { status: 422 });
      }
      const message = {
        id: crypto.randomUUID(),
        senderKind: "player",
        senderPlayerId: player.id,
        text: moderation.text,
        createdAt: nowIso(this.clock),
        status: "sent",
        phase: game.phase,
        strategyTag: game.phase === "FINAL_STATEMENT" ? "final_statement" : null,
      };
      game.messages.push(message);
      if (game.phase === "FINAL_STATEMENT") {
        const humanPlayers = game.players.filter((item) => item.kind === "human");
        const submittedUserIds = finalStatementSubmittedUserIds(game);
        if (humanPlayers.every((item) => submittedUserIds.has(item.userId))) {
          enterVoting(game, this.clock);
        }
      }
      appendEvent(state, "message.sent", { gameId, userId, messageId: message.id }, this.clock);
      return { game: structuredClone(game), serialized: serializeGame(game, userId, state) };
    });
    if (result.game.phase === "FINAL_STATEMENT") return result.serialized;
    const aiReply = await generateAiReply(result.game, this.aiGateway, this.clock);
    const scriptedReply = aiReply ? null : generateScriptedHumanReply(result.game, this.clock);
    const reply = aiReply || scriptedReply;
    if (!reply) return result.serialized;
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game || game.phase !== "DISCUSSION") return result.serialized;
      const replyPlayerId = reply.aiPlayerId || reply.playerId;
      const replyPlayer = game.players.find((player) => player.id === replyPlayerId);
      if (!replyPlayer) return result.serialized;
      game.messages.push({
        id: crypto.randomUUID(),
        senderKind: "player",
        senderPlayerId: replyPlayer.id,
        text: reply.text,
        createdAt: reply.createdAt,
        status: "sent",
        strategyTag: reply.strategyTag,
        aiSource: reply.source,
        aiLatencyMs: reply.latencyMs,
      });
      replyPlayer.strategyTags.push(reply.strategyTag);
      appendEvent(
        state,
        aiReply ? "ai.message.sent" : "scripted_human.message.sent",
        {
          gameId,
          source: reply.source || "scripted_human",
          strategyTag: reply.strategyTag,
          latencyMs: Number(reply.latencyMs || 0),
          estimatedOutputTokens: aiReply ? estimateOutputTokens(reply.text) : 0,
        },
        this.clock,
      );
      return serializeGame(game, userId, state);
    });
  }

  async react({ userId, gameId, messageId, type }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      maybeAdvanceGame(game, this.clock);
      if (game.phase !== "DISCUSSION") throw Object.assign(new Error("reaction_not_allowed_in_phase"), { status: 409 });
      if (!game.players.some((player) => player.userId === userId)) {
        throw Object.assign(new Error("game_forbidden"), { status: 403 });
      }
      assertTaskCardAcknowledged(game, userId);
      if (type !== "clue") throw Object.assign(new Error("invalid_reaction_type"), { status: 422 });
      const message = game.messages.find((item) => item.id === messageId);
      if (!message || message.senderKind !== "player") throw Object.assign(new Error("invalid_message"), { status: 422 });
      const sender = game.players.find((player) => player.id === message.senderPlayerId);
      if (!sender || sender.userId === userId) throw Object.assign(new Error("invalid_message"), { status: 422 });
      const existing = (game.reactions || []).find((item) => item.userId === userId && item.messageId === messageId && item.type === type);
      game.reactions = (game.reactions || []).filter((item) => !(item.userId === userId && item.messageId === messageId));
      if (!existing) {
        game.reactions.push({ id: crypto.randomUUID(), userId, messageId, type, createdAt: nowIso(this.clock) });
      }
      game.updatedAt = nowIso(this.clock);
      return serializeGame(game, userId, state);
    });
  }

  async vote({ userId, gameId, targetPlayerId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      maybeAdvanceGame(game, this.clock);
      if (game.phase !== "VOTING") throw Object.assign(new Error("vote_not_allowed_in_phase"), { status: 409 });
      const voter = game.players.find((item) => item.userId === userId);
      if (!voter) throw Object.assign(new Error("player_not_in_game"), { status: 403 });
      if (targetPlayerId === "abstain" && game.modeId !== "M01") {
        throw Object.assign(new Error("invalid_vote_target"), { status: 422 });
      }
      if (targetPlayerId !== "abstain" && !game.players.some((player) => player.id === targetPlayerId && player.id !== voter.id)) {
        throw Object.assign(new Error("invalid_vote_target"), { status: 422 });
      }
      game.votes = game.votes.filter((item) => item.userId !== userId);
      game.votes.push({
        id: crypto.randomUUID(),
        userId,
        voterPlayerId: voter.id,
        targetPlayerId,
        createdAt: nowIso(this.clock),
      });
      maybeAdvanceGame(game, this.clock);
      appendEvent(state, "vote.submitted", { gameId, userId, targetPlayerId }, this.clock);
      return serializeGame(game, userId, state);
    });
  }

  async viewReplay({ userId, gameId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (!game.players.some((player) => player.userId === userId)) {
        throw Object.assign(new Error("game_forbidden"), { status: 403 });
      }
      maybeAdvanceGame(game, this.clock);
      if (game.phase === "REVEAL") {
        completeRevealedGame(game, this.clock);
        appendEvent(state, "game.replay.viewed", { gameId, userId }, this.clock);
      }
      if (game.phase !== "COMPLETED") {
        throw Object.assign(new Error("replay_not_ready"), { status: 409 });
      }
      return serializeGame(game, userId, state);
    });
  }

  // Read-only "share card" preview for the post-game replay screen (section 2.3
  // of the redesign brief). Requires the game to already be COMPLETED (same
  // precondition as /replay) and only returns anonymized, non-identifying data;
  // see buildShareCard for exactly what fields are included/excluded.
  async getShareCard({ userId, gameId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (!game.players.some((player) => player.userId === userId)) {
        throw Object.assign(new Error("game_forbidden"), { status: 403 });
      }
      maybeAdvanceGame(game, this.clock);
      if (game.phase !== "COMPLETED") {
        throw Object.assign(new Error("replay_not_ready"), { status: 409 });
      }
      return buildShareCard(game, userId);
    });
  }

  async forceAdvance({ gameId, seconds, userId }) {
    return await this.store.mutate((state) => {
      const game = state.games.find((item) => item.id === gameId);
      if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
      game.phaseEndsAt = new Date(this.clock.now() - Number(seconds || 1) * 1000).toISOString();
      maybeAdvanceGame(game, this.clock);
      return userId ? serializeGame(game, userId, state) : game;
    });
  }

  async createReport({ userId, gameId, roomId, messageId, targetUserId, reason }) {
    return await this.store.mutate((state) => {
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (gameId) {
        const game = state.games.find((item) => item.id === gameId);
        if (!game) throw Object.assign(new Error("game_not_found"), { status: 404 });
        if (!game.players.some((player) => player.userId === userId)) {
          throw Object.assign(new Error("game_forbidden"), { status: 403 });
        }
      }
      const report = {
        id: crypto.randomUUID(),
        reporterUserId: userId,
        targetUserId: targetUserId || null,
        roomId: roomId || null,
        gameId: gameId || null,
        messageId: messageId || null,
        reason: String(reason || "unspecified").slice(0, 120),
        status: "open",
        action: null,
        createdAt: nowIso(this.clock),
        updatedAt: nowIso(this.clock),
      };
      state.reports.push(report);
      appendEvent(state, "report.created", { reportId: report.id, gameId, roomId }, this.clock);
      return report;
    });
  }

  async blockUser({ userId, targetUserId }) {
    return await this.store.mutate((state) => {
      assertUserCanPlay(state.users.find((item) => item.id === userId));
      if (userId === targetUserId) throw Object.assign(new Error("cannot_block_self"), { status: 422 });
      const target = state.users.find((item) => item.id === targetUserId && !item.deletedAt);
      if (!target) throw Object.assign(new Error("target_user_not_found"), { status: 404 });
      const existing = state.blocks.find((item) => item.sourceUserId === userId && item.targetUserId === targetUserId);
      if (existing) return existing;
      const block = { id: crypto.randomUUID(), sourceUserId: userId, targetUserId, createdAt: nowIso(this.clock) };
      state.blocks.push(block);
      appendEvent(state, "user.blocked", { userId, targetUserId }, this.clock);
      return block;
    });
  }

  async banUser({ targetUserId, reason = "policy_violation", reportId = null, actor = "admin" }) {
    return await this.store.mutate((state) => {
      const user = state.users.find((item) => item.id === targetUserId);
      if (!user) throw Object.assign(new Error("user_not_found"), { status: 404 });
      user.bannedAt = nowIso(this.clock);
      user.banReason = String(reason || "policy_violation").slice(0, 160);
      state.matchmaking = state.matchmaking.filter((item) => item.userId !== targetUserId);
      for (const room of state.rooms) {
        if (room.status !== "LOBBY") continue;
        room.players = room.players.filter((player) => player.userId !== targetUserId);
        if (room.hostUserId === targetUserId) {
          const nextHost = room.players.find((player) => player.kind === "human" && player.userId);
          room.hostUserId = nextHost?.userId || null;
          if (!room.hostUserId) room.status = "CLOSED";
        }
      }
      if (reportId) {
        const report = state.reports.find((item) => item.id === reportId);
        if (report) {
          const previous = { status: report.status, action: report.action };
          report.status = "resolved";
          report.action = "banned_user";
          report.updatedAt = nowIso(this.clock);
          appendEvent(
            state,
            "report.updated",
            { reportId, actor, previous, next: { status: report.status, action: report.action } },
            this.clock,
          );
        }
      }
      appendEvent(state, "user.banned", { targetUserId, reportId, reason: user.banReason, actor }, this.clock);
      return publicUser(user);
    });
  }

  async banReportTargetsBatch({ reportIds, reason = "batch_report_confirmed", actor = "admin" }) {
    const ids = Array.isArray(reportIds) ? reportIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) throw Object.assign(new Error("report_batch_empty"), { status: 422 });
    if (uniqueIds.length > 50) throw Object.assign(new Error("report_batch_too_large"), { status: 422 });
    const banReason = String(reason || "batch_report_confirmed").trim().slice(0, 160) || "batch_report_confirmed";
    return await this.store.mutate((state) => {
      const reports = uniqueIds.map((id) => state.reports.find((item) => item.id === id));
      if (reports.some((report) => !report)) throw Object.assign(new Error("report_not_found"), { status: 404 });
      if (reports.some((report) => !report.targetUserId)) {
        throw Object.assign(new Error("report_target_missing"), { status: 422 });
      }
      const targetUserIds = [...new Set(reports.map((report) => report.targetUserId))];
      const users = targetUserIds.map((targetUserId) => state.users.find((item) => item.id === targetUserId));
      if (users.some((user) => !user)) throw Object.assign(new Error("user_not_found"), { status: 404 });
      const bannedAt = nowIso(this.clock);
      for (const user of users) {
        user.bannedAt = bannedAt;
        user.banReason = banReason;
      }
      state.matchmaking = state.matchmaking.filter((item) => !targetUserIds.includes(item.userId));
      for (const room of state.rooms) {
        if (room.status !== "LOBBY") continue;
        room.players = room.players.filter((player) => !targetUserIds.includes(player.userId));
        if (room.hostUserId && targetUserIds.includes(room.hostUserId)) {
          const nextHost = room.players.find((player) => player.kind === "human" && player.userId);
          room.hostUserId = nextHost?.userId || null;
          if (!room.hostUserId) room.status = "CLOSED";
        }
      }
      for (const report of reports) {
        const previous = { status: report.status, action: report.action };
        report.status = "resolved";
        report.action = "banned_user";
        report.updatedAt = bannedAt;
        appendEvent(
          state,
          "report.updated",
          { reportId: report.id, actor, previous, next: { status: report.status, action: report.action } },
          this.clock,
        );
      }
      for (const targetUserId of targetUserIds) {
        appendEvent(state, "user.banned", { targetUserId, reportIds: uniqueIds, reason: banReason, actor }, this.clock);
      }
      appendEvent(
        state,
        "report.batch.targets_banned",
        { reportIds: uniqueIds, targetUserIds, count: targetUserIds.length, reason: banReason, actor },
        this.clock,
      );
      return {
        reports,
        users: users.map(publicUser),
      };
    });
  }

  async listReports({ status = null, reason = null, gameId = null, targetUserId = null, limit = null } = {}) {
    const state = await this.store.snapshot();
    const normalizedStatus = String(status || "").trim();
    const normalizedReason = String(reason || "").trim().toLowerCase();
    const normalizedGameId = String(gameId || "").trim();
    const normalizedTargetUserId = String(targetUserId || "").trim();
    const max = Math.max(1, Math.min(500, Number.parseInt(limit, 10) || state.reports.length || 1));
    return state.reports
      .filter((report) => {
        if (normalizedStatus && report.status !== normalizedStatus) return false;
        if (normalizedReason && !String(report.reason || "").toLowerCase().includes(normalizedReason)) return false;
        if (normalizedGameId && report.gameId !== normalizedGameId) return false;
        if (normalizedTargetUserId && report.targetUserId !== normalizedTargetUserId) return false;
        return true;
      })
      .slice(0, max);
  }

  async metricsSummary({ reportSlaSeconds = 24 * 60 * 60 } = {}) {
    const state = await this.store.snapshot();
    const completedGames = state.games.filter((game) => game.phase === "COMPLETED");
    const aiGames = completedGames.filter((game) => game.players.some((player) => player.role === "ai"));
    const aiWins = aiGames.filter((game) => game.winner === "ai").length;
    const humanWins = aiGames.filter((game) => game.winner === "human").length;
    const openReports = state.reports.filter((report) => report.status === "open");
    const now = this.clock.now();
    const openReportAges = openReports.map((report) => Math.max(0, Math.floor((now - Date.parse(report.createdAt)) / 1000)));
    const oldestOpenAgeSeconds = openReportAges.length ? Math.max(...openReportAges) : 0;
    const slaSeconds = Number(reportSlaSeconds || 24 * 60 * 60);
    const gameById = new Map(state.games.map((game) => [game.id, game]));
    const reportAge = (report) => Math.max(0, Math.floor((now - Date.parse(report.createdAt)) / 1000));
    const rate = (value, total) => (total ? value / total : null);
    const distinct = (values) => new Set(values.filter(Boolean));
    const eventType = (type) => state.events.filter((event) => event.type === type);
    const activeUsers = state.users.filter((user) => !user.deletedAt && !user.bannedAt);
    const humanUserIdsByGame = (games) =>
      distinct(games.flatMap((game) => game.players.filter((player) => player.kind === "human" && player.userId).map((player) => player.userId)));
    const reportReasons = Object.entries(
      state.reports.reduce((acc, report) => {
        acc[report.reason] = (acc[report.reason] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
    const modeStats = Object.values(modes).map((mode) => {
      const gamesForMode = state.games.filter((game) => game.modeId === mode.id);
      const completedForMode = gamesForMode.filter((game) => game.phase === "COMPLETED");
      const aiGamesForMode = completedForMode.filter((game) => game.players.some((player) => player.role === "ai"));
      const aiWinsForMode = aiGamesForMode.filter((game) => game.winner === "ai").length;
      const humanWinsForMode = aiGamesForMode.filter((game) => game.winner === "human").length;
      const reportCount = state.reports.filter((report) => gameById.get(report.gameId)?.modeId === mode.id).length;
      return {
        modeId: mode.id,
        name: mode.name,
        matchType: mode.matchType,
        total: gamesForMode.length,
        completed: completedForMode.length,
        active: gamesForMode.filter((game) => game.phase !== "COMPLETED").length,
        aiWins: aiWinsForMode,
        humanWins: humanWinsForMode,
        aiWinRate: rate(aiWinsForMode, aiGamesForMode.length),
        reports: reportCount,
      };
    });
    const topicStats = configuredTopics(state).map((topic) => {
      const gamesForTopic = state.games.filter((game) => game.topic?.id === topic.id);
      const completedForTopic = gamesForTopic.filter((game) => game.phase === "COMPLETED");
      const aiGamesForTopic = completedForTopic.filter((game) => game.players.some((player) => player.role === "ai"));
      const aiWinsForTopic = aiGamesForTopic.filter((game) => game.winner === "ai").length;
      const reportCount = state.reports.filter((report) => gameById.get(report.gameId)?.topic?.id === topic.id).length;
      return {
        topicId: topic.id,
        title: topic.title,
        enabled: topic.enabled !== false,
        total: gamesForTopic.length,
        completed: completedForTopic.length,
        aiWinRate: rate(aiWinsForTopic, aiGamesForTopic.length),
        reports: reportCount,
      };
    }).sort((a, b) => b.total - a.total || b.reports - a.reports || a.title.localeCompare(b.title));
    const activeUserIds = distinct(activeUsers.map((user) => user.id));
    const gameStarterUserIds = humanUserIdsByGame(state.games);
    const completedGameUserIds = humanUserIdsByGame(completedGames);
    const replayViewedUserIds = distinct(eventType("game.replay.viewed").map((event) => event.payload?.userId));
    const friendRoomCreatorUserIds = distinct(state.rooms.map((room) => room.hostUserId));
    const missionClaimEvents = eventType("mission.claimed");
    const cosmeticUnlockEvents = eventType("cosmetic.unlocked");
    const cosmeticEquipEvents = eventType("cosmetic.equipped");
    const missionClaimUserIds = distinct(missionClaimEvents.map((event) => event.payload?.userId));
    const cosmeticUnlockUserIds = distinct(cosmeticUnlockEvents.map((event) => event.payload?.userId));
    const completedCountsByUser = new Map();
    for (const game of completedGames) {
      for (const player of game.players) {
        if (player.kind !== "human" || !player.userId) continue;
        completedCountsByUser.set(player.userId, (completedCountsByUser.get(player.userId) || 0) + 1);
      }
    }
    const repeatCompletedUsers = Array.from(completedCountsByUser.values()).filter((count) => count >= 2).length;
    const missionRewardTotals = missionClaimEvents.reduce(
      (total, event) => {
        const reward = event.payload?.reward || {};
        total.clueStars += Number(reward.clueStars || 0);
        total.xp += Number(reward.xp || 0);
        return total;
      },
      { clueStars: 0, xp: 0 },
    );
    const cosmeticSpend = cosmeticUnlockEvents.reduce((total, event) => total + Number(event.payload?.cost || 0), 0);
    const cosmeticUnlocksByItem = Object.entries(
      cosmeticUnlockEvents.reduce((acc, event) => {
        const itemId = event.payload?.itemId || "unknown";
        acc[itemId] = (acc[itemId] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([itemId, unlocks]) => ({ itemId, unlocks }))
      .sort((a, b) => b.unlocks - a.unlocks || a.itemId.localeCompare(b.itemId));
    const walletTotals = activeUsers.reduce(
      (total, user) => {
        total.clueStars += Number(user.wallet?.clueStars || 0);
        total.xp += Number(user.wallet?.xp || 0);
        return total;
      },
      { clueStars: 0, xp: 0 },
    );
    const aiMessageEvents = eventType("ai.message.sent");
    const aiSourceCounts = Object.entries(
      aiMessageEvents.reduce((acc, event) => {
        const source = event.payload?.source || "unknown";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
    const aiFallbackMessages = aiMessageEvents.filter((event) => String(event.payload?.source || "").startsWith("fallback"));
    const aiLlmMessages = aiMessageEvents.filter((event) => ["llm", "llm_mock"].includes(event.payload?.source));
    const aiLatencies = aiMessageEvents.map((event) => Number(event.payload?.latencyMs || 0)).filter((value) => value > 0);
    const aiEstimatedTokenEvents = aiMessageEvents.filter((event) => Number(event.payload?.estimatedOutputTokens || 0) > 0);
    const aiEstimatedOutputTokens = aiMessageEvents.reduce(
      (total, event) => total + Number(event.payload?.estimatedOutputTokens || 0),
      0,
    );
    return {
      users: {
        total: state.users.length,
        active: activeUsers.length,
        banned: state.users.filter((user) => user.bannedAt).length,
        deleted: state.users.filter((user) => user.deletedAt).length,
      },
      games: {
        total: state.games.length,
        completed: completedGames.length,
        active: state.games.filter((game) => game.phase !== "COMPLETED").length,
        aiWinRate: aiGames.length ? aiWins / aiGames.length : null,
        aiWins,
        humanWins,
      },
      reports: {
        total: state.reports.length,
        open: openReports.length,
        resolved: state.reports.filter((report) => report.status === "resolved").length,
        slaSeconds,
        oldestOpenAgeSeconds,
        overdueOpen: openReportAges.filter((age) => age > slaSeconds).length,
        byReason: reportReasons,
        oldestOpen: openReports
          .map((report) => ({
            id: report.id,
            reason: report.reason,
            gameId: report.gameId,
            targetUserId: report.targetUserId,
            ageSeconds: reportAge(report),
          }))
          .sort((a, b) => b.ageSeconds - a.ageSeconds)
          .slice(0, 5),
      },
      safety: {
        blocks: state.blocks.length,
        bannedUsers: state.users.filter((user) => user.bannedAt).length,
        messageBlocks: state.events.filter((event) => event.type === "message.blocked").length,
        alertFailures: state.events.filter((event) => event.type === "report.alert.failed").length,
      },
      funnel: {
        activeUsers: activeUserIds.size,
        gameStarters: gameStarterUserIds.size,
        completedPlayers: completedGameUserIds.size,
        replayViewers: replayViewedUserIds.size,
        friendRoomCreators: friendRoomCreatorUserIds.size,
        missionClaimers: missionClaimUserIds.size,
        cosmeticUnlockers: cosmeticUnlockUserIds.size,
        gameStartRate: rate(gameStarterUserIds.size, activeUserIds.size),
        completionActivationRate: rate(completedGameUserIds.size, activeUserIds.size),
        replayViewRate: rate(replayViewedUserIds.size, completedGameUserIds.size),
        repeatCompletedRate: rate(repeatCompletedUsers, completedGameUserIds.size),
        friendRoomCreatorRate: rate(friendRoomCreatorUserIds.size, activeUserIds.size),
      },
      retention: {
        repeatCompletedUsers,
        repeatCompletedRate: rate(repeatCompletedUsers, completedGameUserIds.size),
        completedPlayers: completedGameUserIds.size,
        replayViewers: replayViewedUserIds.size,
        replayViewRate: rate(replayViewedUserIds.size, completedGameUserIds.size),
      },
      economy: {
        wallet: walletTotals,
        missionClaims: {
          total: missionClaimEvents.length,
          users: missionClaimUserIds.size,
          clueStarsGranted: missionRewardTotals.clueStars,
          xpGranted: missionRewardTotals.xp,
        },
        cosmetics: {
          unlocks: cosmeticUnlockEvents.length,
          equips: cosmeticEquipEvents.length,
          unlockers: cosmeticUnlockUserIds.size,
          clueStarsSpent: cosmeticSpend,
          topItems: cosmeticUnlocksByItem.slice(0, 5),
        },
      },
      aiOperations: {
        messages: {
          total: aiMessageEvents.length,
          llm: aiLlmMessages.length,
          fallback: aiFallbackMessages.length,
          fallbackRate: rate(aiFallbackMessages.length, aiMessageEvents.length),
          bySource: aiSourceCounts,
        },
        latency: {
          measured: aiLatencies.length,
          averageMs: aiLatencies.length
            ? Math.round(aiLatencies.reduce((total, value) => total + value, 0) / aiLatencies.length)
            : null,
        },
        costProxy: {
          measuredMessages: aiEstimatedTokenEvents.length,
          estimatedOutputTokens: aiEstimatedOutputTokens,
          estimatedOutputTokensPerCompletedGame: aiEstimatedTokenEvents.length ? rate(aiEstimatedOutputTokens, completedGames.length) : null,
          completedGames: completedGames.length,
        },
      },
      modes: modeStats,
      topics: topicStats,
    };
  }

  async adminTrends({ days = 14 } = {}) {
    const state = await this.store.snapshot();
    const windowDays = Math.max(1, Math.min(90, Number.parseInt(days, 10) || 14));
    const end = new Date(this.clock.now());
    end.setUTCHours(0, 0, 0, 0);
    const startMs = end.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000;
    const buckets = new Map();
    for (let index = 0; index < windowDays; index += 1) {
      const date = new Date(startMs + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      buckets.set(date, {
        date,
        usersCreated: 0,
        activeUsers: new Set(),
        gameStarters: new Set(),
        completedPlayers: new Set(),
        replayViewers: new Set(),
        startedGames: 0,
        completedGames: 0,
        aiWins: 0,
        humanWins: 0,
        reports: 0,
        bans: 0,
        messageBlocks: 0,
        aiMessages: 0,
        aiFallbackMessages: 0,
        estimatedOutputTokens: 0,
      });
    }
    const bucketFor = (value) => {
      const key = dayKey(value);
      return key ? buckets.get(key) || null : null;
    };
    const addUser = (set, userId) => {
      if (userId) set.add(userId);
    };
    for (const user of state.users) {
      const bucket = bucketFor(user.createdAt);
      if (!bucket) continue;
      bucket.usersCreated += 1;
      addUser(bucket.activeUsers, user.id);
    }
    for (const game of state.games) {
      const startBucket = bucketFor(game.createdAt);
      const humanUserIds = game.players.filter((player) => player.kind === "human" && player.userId).map((player) => player.userId);
      if (startBucket) {
        startBucket.startedGames += 1;
        for (const userId of humanUserIds) {
          addUser(startBucket.activeUsers, userId);
          addUser(startBucket.gameStarters, userId);
        }
      }
      if (game.phase === "COMPLETED") {
        const completedBucket = bucketFor(game.updatedAt || game.createdAt);
        if (completedBucket) {
          completedBucket.completedGames += 1;
          for (const userId of humanUserIds) {
            addUser(completedBucket.activeUsers, userId);
            addUser(completedBucket.completedPlayers, userId);
          }
          if (game.players.some((player) => player.role === "ai")) {
            if (game.winner === "ai") completedBucket.aiWins += 1;
            if (game.winner === "human") completedBucket.humanWins += 1;
          }
        }
      }
    }
    for (const report of state.reports) {
      const bucket = bucketFor(report.createdAt);
      if (!bucket) continue;
      bucket.reports += 1;
      addUser(bucket.activeUsers, report.reporterUserId);
    }
    for (const event of state.events) {
      const bucket = bucketFor(event.createdAt);
      if (!bucket) continue;
      const payload = event.payload || {};
      if (payload.userId) addUser(bucket.activeUsers, payload.userId);
      if (event.type === "game.replay.viewed") {
        addUser(bucket.replayViewers, payload.userId);
      } else if (event.type === "user.banned") {
        bucket.bans += 1;
      } else if (event.type === "message.blocked") {
        bucket.messageBlocks += 1;
      } else if (event.type === "ai.message.sent") {
        bucket.aiMessages += 1;
        if (String(payload.source || "").startsWith("fallback")) bucket.aiFallbackMessages += 1;
        bucket.estimatedOutputTokens += Number(payload.estimatedOutputTokens || 0);
      }
    }
    const rate = (value, total) => (total ? value / total : null);
    const rows = Array.from(buckets.values()).map((bucket) => {
      const aiDecisionGames = bucket.aiWins + bucket.humanWins;
      return {
        date: bucket.date,
        usersCreated: bucket.usersCreated,
        activeUsers: bucket.activeUsers.size,
        gameStarters: bucket.gameStarters.size,
        completedPlayers: bucket.completedPlayers.size,
        replayViewers: bucket.replayViewers.size,
        startedGames: bucket.startedGames,
        completedGames: bucket.completedGames,
        gameStartRate: rate(bucket.gameStarters.size, bucket.activeUsers.size),
        completionRate: rate(bucket.completedPlayers.size, bucket.gameStarters.size),
        replayViewRate: rate(bucket.replayViewers.size, bucket.completedPlayers.size),
        aiWinRate: rate(bucket.aiWins, aiDecisionGames),
        reports: bucket.reports,
        bans: bucket.bans,
        messageBlocks: bucket.messageBlocks,
        aiMessages: bucket.aiMessages,
        aiFallbackRate: rate(bucket.aiFallbackMessages, bucket.aiMessages),
        estimatedOutputTokens: bucket.estimatedOutputTokens,
      };
    });
    const totals = rows.reduce(
      (acc, row) => {
        for (const key of [
          "usersCreated",
          "activeUsers",
          "gameStarters",
          "completedPlayers",
          "replayViewers",
          "startedGames",
          "completedGames",
          "reports",
          "bans",
          "messageBlocks",
          "aiMessages",
          "estimatedOutputTokens",
        ]) {
          acc[key] += Number(row[key] || 0);
        }
        return acc;
      },
      {
        usersCreated: 0,
        activeUsers: 0,
        gameStarters: 0,
        completedPlayers: 0,
        replayViewers: 0,
        startedGames: 0,
        completedGames: 0,
        reports: 0,
        bans: 0,
        messageBlocks: 0,
        aiMessages: 0,
        estimatedOutputTokens: 0,
      },
    );
    return {
      window: {
        days: windowDays,
        startDate: rows[0]?.date || null,
        endDate: rows.at(-1)?.date || null,
      },
      totals,
      days: rows,
    };
  }

  async getReportContext(reportId) {
    const state = await this.store.snapshot();
    const report = state.reports.find((item) => item.id === reportId);
    if (!report) throw Object.assign(new Error("report_not_found"), { status: 404 });
    const game = report.gameId ? state.games.find((item) => item.id === report.gameId) : null;
    const room = report.roomId ? state.rooms.find((item) => item.id === report.roomId) : null;
    const messageIndex = game?.messages.findIndex((message) => message.id === report.messageId) ?? -1;
    const contextMessages =
      game && messageIndex >= 0
        ? game.messages.slice(Math.max(0, messageIndex - 3), messageIndex + 4)
        : game?.messages.slice(-8) || [];
    return {
      report,
      room,
      game: game
        ? {
            id: game.id,
            roomId: game.roomId,
            modeId: game.modeId,
            phase: game.phase,
            topic: game.topic,
            players: game.players.map((player) => ({
              id: player.id,
              userId: player.userId,
              nickname: player.nickname,
              kind: player.kind,
              role: player.role,
            })),
          }
        : null,
      messages: contextMessages,
      reporter: state.users.find((user) => user.id === report.reporterUserId)
        ? publicUser(state.users.find((user) => user.id === report.reporterUserId))
        : null,
      target:
        report.targetUserId && state.users.find((user) => user.id === report.targetUserId)
          ? publicUser(state.users.find((user) => user.id === report.targetUserId))
          : null,
    };
  }

  async updateReport({ reportId, status, action, actor = "admin" }) {
    return await this.store.mutate((state) => {
      const report = state.reports.find((item) => item.id === reportId);
      if (!report) throw Object.assign(new Error("report_not_found"), { status: 404 });
      const previous = { status: report.status, action: report.action };
      report.status = status || report.status;
      report.action = action || report.action;
      report.updatedAt = nowIso(this.clock);
      appendEvent(
        state,
        "report.updated",
        { reportId, actor, previous, next: { status: report.status, action: report.action } },
        this.clock,
      );
      return report;
    });
  }

  async updateReportsBatch({ reportIds, status = "resolved", action = "reviewed", actor = "admin" }) {
    const ids = Array.isArray(reportIds) ? reportIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) throw Object.assign(new Error("report_batch_empty"), { status: 422 });
    if (uniqueIds.length > 50) throw Object.assign(new Error("report_batch_too_large"), { status: 422 });
    const nextStatus = String(status || "resolved").trim();
    if (!["open", "resolved"].includes(nextStatus)) {
      throw Object.assign(new Error("report_status_invalid"), { status: 422 });
    }
    const nextAction = String(action || "reviewed").trim().slice(0, 120) || "reviewed";
    return await this.store.mutate((state) => {
      const reports = uniqueIds.map((id) => state.reports.find((item) => item.id === id));
      if (reports.some((report) => !report)) throw Object.assign(new Error("report_not_found"), { status: 404 });
      const updated = [];
      for (const report of reports) {
        const previous = { status: report.status, action: report.action };
        report.status = nextStatus;
        report.action = nextAction;
        report.updatedAt = nowIso(this.clock);
        appendEvent(
          state,
          "report.updated",
          { reportId: report.id, actor, previous, next: { status: report.status, action: report.action } },
          this.clock,
        );
        updated.push(report);
      }
      appendEvent(
        state,
        "report.batch.updated",
        { reportIds: uniqueIds, count: updated.length, status: nextStatus, action: nextAction, actor },
        this.clock,
      );
      return updated;
    });
  }

  async recordReportAlert({ reportId, alert }) {
    if (!alert || alert.status === "disabled") return null;
    return await this.store.mutate((state) => {
      const report = state.reports.find((item) => item.id === reportId);
      if (!report) throw Object.assign(new Error("report_not_found"), { status: 404 });
      const type = alert.status === "sent" ? "report.alert.sent" : "report.alert.failed";
      appendEvent(
        state,
        type,
        {
          reportId,
          destination: alert.destination || null,
          statusCode: alert.statusCode || null,
          error: alert.error || null,
        },
        this.clock,
      );
      return alert;
    });
  }

  async adminAuditEvents({ limit = 50 } = {}) {
    const state = await this.store.snapshot();
    const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return state.events
      .filter((event) => adminAuditEventTypes.has(event.type))
      .slice(-size)
      .reverse();
  }

  async adminRooms() {
    const state = await this.store.snapshot();
    return state.rooms;
  }

  async adminGame(gameId) {
    const state = await this.store.snapshot();
    return state.games.find((game) => game.id === gameId);
  }
}

export { publicUser };
