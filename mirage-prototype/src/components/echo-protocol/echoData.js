// Mock data + pure helper functions for the "断连协议" (Echo Protocol) multi-round
// prototype. Scoped to the M06 scenario only (5 players: you=分析师, 2 普通候选人,
// 1 引路人, 1 回声体). Kept fully separate from src/data.js because this is an
// isolated experience path that must not disturb the existing single-round flow.
//
// Faction bookkeeping follows docs/GAMEPLAY_REDESIGN_ECHO_PROTOCOL_v1.md section 2.2:
// 引路人 is a human but counts as ECHO faction for win-condition math, while the
// reveal broadcast must still label them "人类" (intentional information asymmetry —
// do not "fix" this).

export const FACTION = {
  CANDIDATE: "candidate", // 候选人阵营（真实人类且站队人类）
  ECHO: "echo", // 回声体阵营（含真实回声体 + 引路人这种"计入回声体阵营的人类"）
};

export const ROLE = {
  YOU_ANALYST: "you_analyst", // 你，候选人 + 分析师技能
  CANDIDATE: "candidate", // 普通候选人，无技能
  GUIDE: "guide", // 引路人：人类，计入回声体阵营，揭晓时显示"人类"
  ECHO: "echo", // 回声体（AI）
};

export const BASE_DISCUSSION_SECONDS = 420; // M06 baseline per redesign doc 1.3
export const VOTING_SECONDS = 60; // reuse existing voting window
export const DEFENSE_SECONDS = 60; // 复议陈述 60s/人
export const REVOTE_WINDOW_SECONDS = 20; // 改票窗口 20s

export function initialEchoPlayers() {
  return [
    {
      id: "you",
      name: "你",
      seat: 1,
      avatar: "/assets/avatar-you.png",
      role: ROLE.YOU_ANALYST,
      faction: FACTION.CANDIDATE,
      isSelf: true,
      alive: true,
      revealLabel: "候选人", // 揭晓时显示的表面身份
    },
    {
      id: "lu",
      name: "小鹿",
      seat: 2,
      avatar: "/assets/avatar-lu.png",
      role: ROLE.CANDIDATE,
      faction: FACTION.CANDIDATE,
      isSelf: false,
      alive: true,
      revealLabel: "候选人",
    },
    {
      id: "wei",
      name: "阿维",
      seat: 3,
      avatar: "/assets/avatar-ai.png",
      role: ROLE.CANDIDATE,
      faction: FACTION.CANDIDATE,
      isSelf: false,
      alive: true,
      revealLabel: "候选人",
    },
    {
      id: "qiao",
      name: "乔姐",
      seat: 4,
      avatar: "/assets/avatar-lu.png",
      role: ROLE.GUIDE,
      faction: FACTION.ECHO, // 阵营计数按回声体计，尽管本质是人类
      isSelf: false,
      alive: true,
      revealLabel: "人类", // 断连结果播报只显示"人类"，制造信息不对称
    },
    {
      id: "echo",
      name: "阿言",
      seat: 5,
      avatar: "/assets/avatar-ai.png",
      role: ROLE.ECHO,
      faction: FACTION.ECHO,
      isSelf: false,
      alive: true,
      revealLabel: "回声体",
    },
  ];
}

export const echoMission = {
  campTitle: "候选人须知",
  role: "候选人（分析师）",
  goal: "本局信号室共 5 名接入者。你需要和其他候选人一起，在回声体接管信号室之前，通过多轮断连表决把回声体阵营逐一切断连接。",
  winCondition: "存活回声体阵营人数归零时，候选人阵营获胜；若回声体阵营人数达到或超过候选人人数，信号室将被回声体接管。",
  tools: [
    "分析师技能（限用 1 次）：任意一轮自由讨论中使用，系统从除你以外的存活候选人中随机抽取 2 人，如实告知你「这两人中至少一个属于回声体阵营」或「都不是」——结果只有你能看到",
    "断连表决：实时公开票数，投票后锁定不可改，可弃权",
    "复议陈述：出现平票或明确最高票时触发，本人限时自辩后可能迎来一次改票",
  ],
};

export const ANALYST_HINTS = {
  hasEcho: "系统提示（仅你可见）：这两人中，至少一个属于回声体阵营。",
  noEcho: "系统提示（仅你可见）：这两人都不属于回声体阵营。",
};

// docs section 1.3: roundDiscussionSeconds(n) = max(60, round(base * 0.6^(n-1) / 15) * 15)
export function roundDiscussionSeconds(roundNumber, base = BASE_DISCUSSION_SECONDS) {
  if (roundNumber <= 1) return base;
  const raw = base * Math.pow(0.6, roundNumber - 1);
  const roundedTo15 = Math.round(raw / 15) * 15;
  return Math.max(60, roundedTo15);
}

// docs section 2.1: 存活回声体阵营数 >= 存活候选人阵营数 时回声体获胜；
// 回声体阵营全灭则候选人阵营获胜。返回 null 表示尚未分出胜负。
export function checkWinCondition(playersList) {
  const alive = playersList.filter((p) => p.alive);
  const aliveEcho = alive.filter((p) => p.faction === FACTION.ECHO).length;
  const aliveCandidate = alive.filter((p) => p.faction === FACTION.CANDIDATE).length;

  if (aliveEcho === 0) {
    return { winner: FACTION.CANDIDATE, reason: "回声体阵营已全部断连，信号室清空成功。" };
  }
  if (aliveEcho >= aliveCandidate) {
    return { winner: FACTION.ECHO, reason: "回声体阵营人数已达到或超过候选人阵营，信号室被接管。" };
  }
  return null;
}

// Mock AI voting per docs section 5: exclude self, pick a random alive candidate.
// No real LLM wired up in this prototype — explicit fallback path only.
export function pickEchoVoteTarget(playersList, echoPlayerId, rng = Math.random) {
  const candidates = playersList.filter((p) => p.alive && p.id !== echoPlayerId);
  if (candidates.length === 0) return null;
  const index = Math.floor(rng() * candidates.length);
  return candidates[index].id;
}

// Simple mock voting for the other alive NPC candidates so the tally doesn't
// only consist of "you" — keeps the vote screen from feeling empty. Not meant
// to model real strategy, just enough variety to demo the flow.
export function mockCandidateVote(voterId, playersList, rng = Math.random) {
  const targets = playersList.filter((p) => p.alive && p.id !== voterId);
  if (targets.length === 0) return null;
  // Small bias: NPCs lean slightly toward suspecting the echo/guide faction to
  // keep demo playthroughs from wandering forever, but never a guaranteed hit.
  const weighted = targets.flatMap((p) => (p.faction === FACTION.ECHO ? [p, p] : [p]));
  const index = Math.floor(rng() * weighted.length);
  return weighted[index].id;
}
