import { useEffect, useState } from "react";
import { useEchoProtocol } from "./useEchoProtocol.js";
import { EchoMissionScreen } from "./EchoMissionScreen.jsx";
import { EchoDiscussionScreen } from "./EchoDiscussionScreen.jsx";
import { EchoVotingScreen } from "./EchoVotingScreen.jsx";
import { EchoDefenseScreen } from "./EchoDefenseScreen.jsx";
import { EchoBroadcastScreen } from "./EchoBroadcastScreen.jsx";
import { EchoSpectatorScreen } from "./EchoSpectatorScreen.jsx";
import { EchoFinalScreen } from "./EchoFinalScreen.jsx";

// Top-level orchestrator for the M06 "断连协议" multi-round experience.
// Deliberately isolated from App.jsx's single-round flow: this component owns
// its own stage machine end-to-end (mission -> discussion -> voting ->
// defense -> revote -> broadcast -> repeat -> finished) via useEchoProtocol.
// `onExit` returns to the host (home). `onRestart` starts a fresh match —
// App.jsx implements this by remounting EchoProtocolFlow with a new `key` so
// useEchoProtocol's state resets cleanly instead of trying to hand-reset every
// field here.
export function EchoProtocolFlow({ onExit, onRestart }) {
  const engine = useEchoProtocol();
  const [acknowledgedDisconnect, setAcknowledgedDisconnect] = useState(false);

  const {
    players,
    alivePlayers,
    round,
    stage,
    votes,
    discussionSeconds,
    defenseInfo,
    broadcast,
    result,
    history,
    you,
    analystUsed,
    analystResult,
    analystHints,
    confirmMission,
    useAnalystSkill,
    goToVoting,
    castVote,
    autoCastRemainingVotes,
    resolveVoting,
    proceedFromDefenseToRevote,
    resolveRevote,
    acknowledgeBroadcast,
  } = engine;

  // If "you" have been disconnected but the match is still running, show the
  // spectator status screen instead of the normal stage UI, once per
  // disconnect event (re-armed whenever a new round starts).
  const youDisconnected = you && !you.alive;

  // Re-arm the spectator gate at the start of every new discussion round so
  // the "已断连" status screen reappears once per round instead of only once
  // for the rest of the match.
  useEffect(() => {
    if (stage === "discussion") {
      setAcknowledgedDisconnect(false);
    }
  }, [stage, round]);

  if (youDisconnected && stage !== "finished" && !acknowledgedDisconnect) {
    return (
      <EchoSpectatorScreen
        round={round}
        onContinueWatching={() => setAcknowledgedDisconnect(true)}
      />
    );
  }

  if (stage === "mission") {
    return <EchoMissionScreen onConfirm={confirmMission} />;
  }

  if (stage === "discussion") {
    return (
      <EchoDiscussionScreen
        round={round}
        discussionSeconds={discussionSeconds}
        alivePlayers={alivePlayers}
        you={you}
        analystUsed={analystUsed}
        analystResult={analystResult}
        analystHints={analystHints}
        onUseAnalyst={useAnalystSkill}
        onGoToVoting={goToVoting}
      />
    );
  }

  if (stage === "voting") {
    return (
      <EchoVotingScreen
        round={round}
        alivePlayers={alivePlayers}
        votes={votes}
        you={you}
        onCastVote={castVote}
        onAutoCastRemaining={autoCastRemainingVotes}
        onResolve={resolveVoting}
      />
    );
  }

  if (stage === "defense") {
    return (
      <EchoDefenseScreen
        round={round}
        players={players}
        defenseInfo={defenseInfo}
        onProceedToRevote={proceedFromDefenseToRevote}
      />
    );
  }

  if (stage === "revote") {
    return (
      <EchoVotingScreen
        round={round}
        alivePlayers={alivePlayers}
        votes={votes}
        you={you}
        onCastVote={castVote}
        onAutoCastRemaining={autoCastRemainingVotes}
        onResolve={resolveRevote}
        title={defenseInfo?.kind === "tie" ? "重新投票" : "改票窗口"}
        subtitle={
          defenseInfo?.kind === "tie"
            ? "平票候选人已完成陈述，现在全员重新投票；若再次平票，本轮无人断连。"
            : "自辩已结束，全员有一次改票机会，按最终票数结算。"
        }
      />
    );
  }

  if (stage === "broadcast") {
    return <EchoBroadcastScreen round={round} broadcast={broadcast} onAcknowledge={acknowledgeBroadcast} />;
  }

  if (stage === "finished") {
    return (
      <EchoFinalScreen
        players={players}
        round={round}
        result={result}
        history={history}
        onRestart={onRestart}
        onHome={onExit}
      />
    );
  }

  return null;
}
