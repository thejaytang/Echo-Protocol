import { useMemo, useRef, useState } from "react";
import {
  ANALYST_HINTS,
  FACTION,
  ROLE,
  VOTING_SECONDS,
  checkWinCondition,
  initialEchoPlayers,
  mockCandidateVote,
  pickEchoVoteTarget,
  roundDiscussionSeconds,
} from "./echoData.js";

// Stage machine for one M06 "断连协议" match:
//
// mission -> discussion -> voting -> (resolveVotes) ->
//   [tie]        -> defense(tie)   -> revote        -> (resolveVotes, no more ties allowed to loop forever: a
//                                                        second consecutive tie forces "no disconnect" this round)
//   [plurality]  -> defense(single) -> revoteWindow  -> (resolveVotes final)
//   [no contest] -> broadcast (no one disconnected)
// -> broadcast -> winCheck -> (next round: discussion) | finished
//
// This hook only tracks state + pure transitions; screen components read
// `stage` and render the matching UI, calling back into the actions below.
export function useEchoProtocol() {
  const [players, setPlayers] = useState(() => initialEchoPlayers());
  const [round, setRound] = useState(1);
  const [stage, setStage] = useState("mission"); // mission | discussion | voting | defense | revote | broadcast | finished
  const [votes, setVotes] = useState({}); // voterId -> targetId | "abstain"
  const [defenseInfo, setDefenseInfo] = useState(null); // { kind: "tie"|"plurality", candidateIds: [] }
  const [broadcast, setBroadcast] = useState(null); // { disconnectedId, factionLabel, revealLabel } | { none: true }
  const [result, setResult] = useState(null); // { winner, reason }
  const [history, setHistory] = useState([]); // per-round recap entries for the final screen
  const [analystUsed, setAnalystUsed] = useState(false);
  const [analystResult, setAnalystResult] = useState(null); // { targets: [id,id], hasEcho: bool }

  // Guard against calling resolve twice for the same tally (defensive; the UI
  // should only invoke this once per stage transition).
  const resolvingRef = useRef(false);

  const alivePlayers = useMemo(() => players.filter((p) => p.alive), [players]);
  const discussionSeconds = useMemo(() => roundDiscussionSeconds(round), [round]);

  const you = players.find((p) => p.id === "you");

  function confirmMission() {
    setStage("discussion");
  }

  function useAnalystSkill() {
    if (analystUsed) return;
    const pool = players.filter((p) => p.alive && p.id !== "you");
    if (pool.length < 2) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 2);
    const hasEcho = targets.some((p) => p.faction === FACTION.ECHO);
    setAnalystResult({ targetIds: targets.map((p) => p.id), hasEcho });
    setAnalystUsed(true);
  }

  function goToVoting() {
    setVotes({});
    setStage("voting");
  }

  function castVote(voterId, targetIdOrAbstain) {
    setVotes((current) => {
      if (current[voterId] !== undefined) return current; // locked, no changes allowed
      return { ...current, [voterId]: targetIdOrAbstain };
    });
  }

  // Fill in mock votes for every alive NPC (echo + candidates) that hasn't
  // voted yet — used once "you" cast your vote, simulating the rest of the
  // room voting live so the tally fills in.
  function autoCastRemainingVotes() {
    setVotes((current) => {
      const next = { ...current };
      for (const p of alivePlayers) {
        if (next[p.id] !== undefined) continue;
        if (p.role === ROLE.ECHO) {
          next[p.id] = pickEchoVoteTarget(players, p.id) ?? "abstain";
        } else if (p.id !== "you") {
          next[p.id] = mockCandidateVote(p.id, players) ?? "abstain";
        }
      }
      return next;
    });
  }

  function tally(voteMap) {
    const counts = {};
    let abstainCount = 0;
    for (const targetId of Object.values(voteMap)) {
      if (targetId === "abstain") {
        abstainCount += 1;
        continue;
      }
      counts[targetId] = (counts[targetId] ?? 0) + 1;
    }
    return { counts, abstainCount };
  }

  function topCandidates(counts) {
    let max = 0;
    for (const c of Object.values(counts)) max = Math.max(max, c);
    if (max === 0) return { max, ids: [] };
    const ids = Object.entries(counts)
      .filter(([, c]) => c === max)
      .map(([id]) => id);
    return { max, ids };
  }

  // Called once every alive player has a vote entry (or abstained).
  function resolveVoting() {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const { counts, abstainCount } = tally(votes);
    const aliveCount = alivePlayers.length;

    // docs 4: 弃权超过存活人数一半 => 本轮直接无人断连
    if (abstainCount > aliveCount / 2) {
      finishRoundWithNoDisconnect("弃权人数超过存活人数一半，本轮判定无人断连。");
      resolvingRef.current = false;
      return;
    }

    const { max, ids } = topCandidates(counts);
    if (max === 0) {
      // Nobody voted for anyone (all abstained but under the majority threshold) — no contest.
      finishRoundWithNoDisconnect("本轮无人获得有效票数，无人断连。");
      resolvingRef.current = false;
      return;
    }

    if (ids.length === 1) {
      setDefenseInfo({ kind: "plurality", candidateIds: ids });
      setStage("defense");
    } else {
      setDefenseInfo({ kind: "tie", candidateIds: ids });
      setStage("defense");
    }
    resolvingRef.current = false;
  }

  function proceedFromDefenseToRevote() {
    setStage("revote");
    setVotes({}); // 复议后的改票/重新投票是独立一轮
  }

  // After the revote/change-vote window resolves, this decides the final
  // outcome for the round.
  function resolveRevote() {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const { counts, abstainCount } = tally(votes);
    const aliveCount = alivePlayers.length;

    if (abstainCount > aliveCount / 2) {
      finishRoundWithNoDisconnect("复议后弃权人数超过一半，本轮判定无人断连。");
      resolvingRef.current = false;
      return;
    }

    const { max, ids } = topCandidates(counts);

    if (max === 0) {
      finishRoundWithNoDisconnect("复议后无人获得有效票数，本轮无人断连。");
      resolvingRef.current = false;
      return;
    }

    if (ids.length > 1) {
      // Tie persisted through defense+revote (or plurality's revote produced a
      // new tie) -> per docs, no disconnect this round, move on.
      finishRoundWithNoDisconnect("复议后再次出现平票，本轮无人断连。");
      resolvingRef.current = false;
      return;
    }

    disconnectPlayer(ids[0]);
    resolvingRef.current = false;
  }

  function disconnectPlayer(targetId) {
    const target = players.find((p) => p.id === targetId);
    const factionLabel = target.faction === FACTION.ECHO ? "回声体" : "人类";
    // 引路人例外：本质人类，播报显示"人类"，即使阵营计数按回声体处理 (docs 2.2)
    const displayLabel = target.role === ROLE.GUIDE ? "人类" : factionLabel;

    setPlayers((current) => current.map((p) => (p.id === targetId ? { ...p, alive: false } : p)));
    setBroadcast({ disconnectedId: targetId, displayLabel, name: target.name, seat: target.seat });
    setHistory((current) => [
      ...current,
      {
        round,
        kind: "disconnect",
        name: target.name,
        seat: target.seat,
        displayLabel,
        actualRole: target.role,
      },
    ]);
    setStage("broadcast");
  }

  function finishRoundWithNoDisconnect(reasonText) {
    setBroadcast({ none: true, reasonText });
    setHistory((current) => [...current, { round, kind: "no-disconnect", reasonText }]);
    setStage("broadcast");
  }

  function acknowledgeBroadcast() {
    // Recompute win condition against the freshest players snapshot.
    setPlayers((currentPlayers) => {
      const outcome = checkWinCondition(currentPlayers);
      if (outcome) {
        setResult(outcome);
        setStage("finished");
      } else {
        setRound((r) => r + 1);
        setStage("discussion");
      }
      return currentPlayers;
    });
    setBroadcast(null);
    setDefenseInfo(null);
  }

  return {
    players,
    alivePlayers,
    round,
    stage,
    votes,
    discussionSeconds,
    votingSeconds: VOTING_SECONDS,
    defenseInfo,
    broadcast,
    result,
    history,
    you,
    analystUsed,
    analystResult,
    analystHints: ANALYST_HINTS,

    confirmMission,
    useAnalystSkill,
    goToVoting,
    castVote,
    autoCastRemainingVotes,
    resolveVoting,
    proceedFromDefenseToRevote,
    resolveRevote,
    acknowledgeBroadcast,
  };
}
