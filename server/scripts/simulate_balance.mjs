import { GameEngine } from "../src/gameEngine.mjs";
import { MemoryStore } from "../src/store.mjs";
import { modes } from "../src/config.mjs";

const SKILLED = "skilled";
const MONOTONE = "monotone";
const MISLED = "misled";

const runConfig = {
  policies: [SKILLED, MONOTONE, MISLED],
  modes: ["M01", "M02", "M03", "M04", "M06", "M08"],
  deterministic: true,
  harness: "GameEngine + MemoryStore",
};

function humanLabel(index) {
  return ["玩家甲", "玩家乙", "玩家丙", "玩家丁", "玩家戊", "玩家己"][index] || `玩家${index + 1}`;
}

function createHarness(env = {}) {
  const store = new MemoryStore();
  const engine = new GameEngine(store, {
    env: {
      NODE_ENV: "test",
      AUTH_ALLOW_MOCK_APPLE: "true",
      ...env,
    },
  });
  return { engine, store };
}

async function createUsers(engine, count, prefix) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    users.push(await engine.createGuest({
      nickname: `${prefix}${humanLabel(index)}`,
      ageConfirmed: true,
      communityConfirmed: true,
    }));
  }
  return users;
}

async function startPublicMode(engine, modeId, users) {
  if (modeId === "M01") {
    const match = await engine.startMatchmaking({ userId: users[0].id, modeId });
    return match.game.id;
  }
  await engine.startMatchmaking({ userId: users[0].id, modeId });
  const match = await engine.startMatchmaking({ userId: users[1].id, modeId });
  return match.game.id;
}

async function startFriendMode(engine, modeId, users) {
  const room = await engine.createRoom({ userId: users[0].id, modeId });
  for (const user of users.slice(1)) {
    await engine.joinRoom({ userId: user.id, inviteCode: room.inviteCode });
    await engine.setReady({ userId: user.id, roomId: room.id, ready: true });
  }
  const started = await engine.startRoom({ userId: users[0].id, roomId: room.id });
  return started.game.id;
}

function rawGame(store, gameId) {
  const game = store.snapshot().games.find((item) => item.id === gameId);
  if (!game) throw new Error(`game_not_found:${gameId}`);
  return game;
}

function realHumanPlayers(game) {
  return game.players.filter((player) => player.kind === "human" && player.userId);
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function modeAiCount(modeId, opponentKind) {
  if (modeId === "M01" && opponentKind === "scripted_human") return 0;
  return modes[modeId].aiCount;
}

async function acknowledgeTaskCards(engine, store, gameId) {
  const game = rawGame(store, gameId);
  for (const player of realHumanPlayers(game)) {
    await engine.acknowledgeTaskCard({ userId: player.userId, gameId });
  }
}

function scenarioInvariants({ game, modeId, opponentKind }) {
  const mode = modes[modeId];
  const humans = realHumanPlayers(game);
  const ais = aiPlayers(game);
  const roleCounts = countBy(game.players, (player) => player.role);
  const taskAckUserIds = new Set((game.taskAcks || []).map((item) => item.userId));
  const acknowledgedHumans = humans.filter((player) => taskAckUserIds.has(player.userId));
  return {
    fixedPlayerCount: game.players.length === mode.playerCount,
    expectedPlayerCount: mode.playerCount,
    actualPlayerCount: game.players.length,
    fixedAiCount: ais.length === modeAiCount(modeId, opponentKind),
    expectedAiCount: modeAiCount(modeId, opponentKind),
    actualAiCount: ais.length,
    minimumHumanCountMet: humans.length >= mode.minHumanCount,
    minHumanCount: mode.minHumanCount,
    actualHumanCount: humans.length,
    specialRoleAssignedToRealUser:
      modeId === "M06"
        ? game.players.some((player) => player.role === "human_undercover" && player.kind === "human" && player.userId)
        : modeId === "M08"
          ? game.players.some((player) => player.role === "fake_ai" && player.kind === "human" && player.userId)
          : true,
    taskCardAcknowledgedForAllHumans: acknowledgedHumans.length === humans.length,
    acknowledgedHumanCount: acknowledgedHumans.length,
    roleCounts,
  };
}

function assertScenarioInvariants(invariants, modeId) {
  for (const [key, value] of Object.entries(invariants)) {
    if (typeof value === "boolean" && !value) {
      throw new Error(`balance_invariant_failed:${modeId}:${key}`);
    }
  }
}

function aiPlayers(game) {
  return game.players.filter((player) => player.role === "ai");
}

function firstOtherPlayer(game, voter) {
  return game.players.find((player) => player.id !== voter.id);
}

async function advanceToVoting(engine, gameId, userId) {
  for (let step = 0; step < 6; step += 1) {
    const current = await engine.getGame({ userId, gameId });
    if (current.phase === "VOTING") return current;
    if (current.phase === "REVEAL" || current.phase === "COMPLETED") return current;
    await engine.forceAdvance({ gameId, userId, seconds: 999 });
  }
  const game = await engine.getGame({ userId, gameId });
  if (game.phase !== "VOTING") {
    throw new Error(`failed_to_reach_voting:${game.modeId}:${game.phase}`);
  }
  return game;
}

function targetForPolicy({ game, voter, policy, modeId, opponentKind }) {
  const ais = aiPlayers(game);
  if (modeId === "M01") {
    if (policy === SKILLED) {
      return opponentKind === "scripted_human" ? "abstain" : ais[0]?.id;
    }
    return firstOtherPlayer(game, voter)?.id;
  }

  if (policy === MONOTONE) {
    return firstOtherPlayer(game, voter)?.id;
  }

  if (modeId === "M04") {
    if (policy === SKILLED) {
      const voters = realHumanPlayers(game);
      const voterIndex = voters.findIndex((player) => player.id === voter.id);
      return ais[voterIndex % ais.length]?.id;
    }
    return ais[0]?.id;
  }

  if (modeId === "M06" && policy === MISLED) {
    const undercover = game.players.find((player) => player.role === "human_undercover");
    return voter.role === "human_undercover" ? ais[0]?.id : undercover?.id;
  }

  if (modeId === "M08" && policy === MISLED) {
    const fakeAi = game.players.find((player) => player.role === "fake_ai");
    return voter.role === "fake_ai" ? ais[0]?.id : fakeAi?.id;
  }

  return ais[0]?.id;
}

function voteTelemetry({ game, replay, modeId, policy }) {
  const aiIds = new Set((replay.aiPlayerIds || (replay.aiPlayerId ? [replay.aiPlayerId] : [])).filter(Boolean));
  const votes = replay.voteSummary || [];
  const targets = votes.map((vote) => vote.targetPlayerId);
  const aiTargetCount = targets.filter((target) => aiIds.has(target)).length;
  const uniqueAiTargets = new Set(targets.filter((target) => aiIds.has(target)));
  const humanTargetCount = targets.filter((target) => target !== "abstain" && !aiIds.has(target)).length;
  return {
    voteCount: votes.length,
    humanVoterCount: realHumanPlayers(game).length,
    targets,
    aiTargetCount,
    humanTargetCount,
    uniqueAiTargetCount: uniqueAiTargets.size,
    skilledVotesOnlyAi: policy === SKILLED && modeId !== "M01" ? humanTargetCount === 0 && aiTargetCount === votes.length : null,
    skilledM04SplitsAcrossBothAi: policy === SKILLED && modeId === "M04" ? uniqueAiTargets.size === aiIds.size : null,
  };
}

function assertVoteTelemetry(telemetry, modeId, policy) {
  if (telemetry.voteCount !== telemetry.humanVoterCount) {
    throw new Error(`balance_vote_count_failed:${modeId}:${policy}`);
  }
  if (telemetry.skilledVotesOnlyAi === false) {
    throw new Error(`balance_skilled_policy_voted_human:${modeId}`);
  }
  if (telemetry.skilledM04SplitsAcrossBothAi === false) {
    throw new Error("balance_m04_skilled_policy_did_not_split_ai_votes");
  }
}

async function runScenario(definition) {
  const { modeId, label, policy, userCount, publicMode = false, env = {}, expectedWinner, opponentKind } = definition;
  const { engine, store } = createHarness(env);
  const users = await createUsers(engine, userCount, `${modeId}-`);
  const gameId = publicMode
    ? await startPublicMode(engine, modeId, users)
    : await startFriendMode(engine, modeId, users);

  await acknowledgeTaskCards(engine, store, gameId);
  const openedGame = rawGame(store, gameId);
  const invariants = scenarioInvariants({ game: openedGame, modeId, opponentKind });
  assertScenarioInvariants(invariants, modeId);
  await advanceToVoting(engine, gameId, users[0].id);
  const votingGame = rawGame(store, gameId);
  invariants.noMidCheckPhase = !votingGame.messages.some((message) => message.phase === "MID_CHECK");
  if (!invariants.noMidCheckPhase) {
    throw new Error(`balance_unexpected_mid_check_phase:${modeId}:${policy}`);
  }
  for (const voter of realHumanPlayers(votingGame)) {
    const targetPlayerId = targetForPolicy({ game: votingGame, voter, policy, modeId, opponentKind });
    if (!targetPlayerId) throw new Error(`missing_vote_target:${modeId}:${policy}:${voter.role}`);
    await engine.vote({ userId: voter.userId, gameId, targetPlayerId });
  }

  const completed = await engine.viewReplay({ userId: users[0].id, gameId });
  const replay = completed.replay;
  const telemetry = {
    votes: voteTelemetry({ game: votingGame, replay, modeId, policy }),
    replay: {
      identityCount: replay.identitySummary.length,
      taskResultCount: replay.taskResults.length,
      explanation: replay.explanation,
    },
  };
  assertVoteTelemetry(telemetry.votes, modeId, policy);
  const result = {
    modeId,
    label,
    policy,
    expectedWinner,
    winner: replay.winner,
    passed: replay.winner === expectedWinner,
    invariants,
    telemetry,
    voteTargets: replay.voteSummary.map((vote) => vote.targetPlayerId),
    aiPlayerIds: replay.aiPlayerIds || (replay.aiPlayerId ? [replay.aiPlayerId] : []),
    identityRoles: replay.identitySummary.map((item) => item.role),
    explanation: replay.explanation,
  };
  if (!result.passed) {
    throw new Error(`balance_scenario_failed:${modeId}:${policy}:expected_${expectedWinner}_got_${replay.winner}`);
  }
  return result;
}

const scenarios = [
  { modeId: "M01", label: "真假局抓到 AI", policy: SKILLED, userCount: 1, publicMode: true, env: { MIRAGE_M01_OPPONENT_KIND: "ai" }, opponentKind: "ai", expectedWinner: "human" },
  { modeId: "M01", label: "真假局识别真人", policy: SKILLED, userCount: 1, publicMode: true, env: { MIRAGE_M01_OPPONENT_KIND: "scripted_human" }, opponentKind: "scripted_human", expectedWinner: "human" },
  { modeId: "M01", label: "真假局无脑判 AI 会误伤真人", policy: MONOTONE, userCount: 1, publicMode: true, env: { MIRAGE_M01_OPPONENT_KIND: "scripted_human" }, opponentKind: "scripted_human", expectedWinner: "ai" },
  { modeId: "M02", label: "三人猎 AI 协同命中", policy: SKILLED, userCount: 2, publicMode: true, expectedWinner: "human" },
  { modeId: "M02", label: "三人猎 AI 无脑互投失败", policy: MONOTONE, userCount: 2, publicMode: true, expectedWinner: "ai" },
  { modeId: "M03", label: "四人经典混聊命中", policy: SKILLED, userCount: 2, expectedWinner: "human" },
  { modeId: "M04", label: "六人双 AI 分票命中", policy: SKILLED, userCount: 3, expectedWinner: "human" },
  { modeId: "M04", label: "六人双 AI 集火单 AI 失败", policy: MONOTONE, userCount: 3, expectedWinner: "ai" },
  { modeId: "M06", label: "卧底护 AI 局识别真 AI", policy: SKILLED, userCount: 4, expectedWinner: "human" },
  { modeId: "M06", label: "卧底护 AI 局被卧底误导", policy: MISLED, userCount: 4, expectedWinner: "ai" },
  { modeId: "M08", label: "伪 AI 诱饵局识别真 AI", policy: SKILLED, userCount: 4, expectedWinner: "human" },
  { modeId: "M08", label: "伪 AI 诱饵局误投诱饵", policy: MISLED, userCount: 4, expectedWinner: "ai" },
];

const results = [];
for (const scenario of scenarios) {
  results.push(await runScenario(scenario));
}

const implementedModes = [...new Set(results.map((result) => result.modeId))];
const skilledWins = results.filter((result) => result.policy === SKILLED && result.winner === "human").length;
const badPolicyWins = results.filter((result) => result.policy !== SKILLED && result.winner === "human").length;
const misledScenarios = results.filter((result) => ["M06", "M08"].includes(result.modeId) && result.policy === MISLED);

if (implementedModes.length < 6) {
  throw new Error(`balance_mode_coverage_too_low:${implementedModes.length}`);
}
if (skilledWins < 6) {
  throw new Error(`skilled_policy_not_rewarded:${skilledWins}`);
}
if (badPolicyWins > 0) {
  throw new Error(`bad_policy_unexpected_human_wins:${badPolicyWins}`);
}
if (misledScenarios.length < 2 || !misledScenarios.every((result) => result.winner === "ai")) {
  throw new Error("advanced_misled_scenarios_missing");
}

const report = {
  ok: true,
  runConfig,
  modeCoverage: implementedModes,
  scenarioCount: results.length,
  skilledHumanWins: skilledWins,
  badPolicyHumanWins: badPolicyWins,
  misledScenarioCount: misledScenarios.length,
  invariantCoverage: {
    fixedPlayerCounts: results.every((result) => result.invariants.fixedPlayerCount),
    fixedAiCounts: results.every((result) => result.invariants.fixedAiCount),
    minimumHumanCounts: results.every((result) => result.invariants.minimumHumanCountMet),
    taskCardAcknowledgements: results.every((result) => result.invariants.taskCardAcknowledgedForAllHumans),
    specialRolesRealUsers: results.every((result) => result.invariants.specialRoleAssignedToRealUser),
    voteCounts: results.every((result) => result.telemetry.votes.voteCount === result.telemetry.votes.humanVoterCount),
    noMidCheckPhase: results.every((result) => result.invariants.noMidCheckPhase === true),
  },
  scenarios: results,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Gameplay balance simulation passed");
  console.log(`Modes: ${implementedModes.join(", ")}`);
  console.log(`Scenarios: ${results.length}`);
  console.log(`Skilled human wins: ${skilledWins}`);
  console.log(`Bad-policy human wins: ${badPolicyWins}`);
  console.log(`Invariants: ${JSON.stringify(report.invariantCoverage)}`);
  for (const result of results) {
    console.log(`- ${result.modeId} ${result.policy}: ${result.winner} (${result.label})`);
  }
}
