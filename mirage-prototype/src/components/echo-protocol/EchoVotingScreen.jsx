import { useEffect, useRef, useState } from "react";
import { Ban, Vote } from "lucide-react";
import { PlayerAvatar } from "../Shared.jsx";

// Live public "断连表决": votes lock in immediately (no changing your mind),
// abstain is a first-class option, and the tally is visible to everyone in
// real time — this mirrors docs section 4's intentional social-pressure
// design. Once "you" lock in a choice, the remaining NPC/echo votes are
// auto-filled after a short delay to simulate the room voting live, then the
// round is resolved automatically.
export function EchoVotingScreen({
  round,
  alivePlayers,
  votes,
  you,
  onCastVote,
  onAutoCastRemaining,
  onResolve,
  title = "断连表决",
  subtitle,
}) {
  const [settling, setSettling] = useState(false);
  const resolvedRef = useRef(false);

  const youVoted = you ? votes[you.id] !== undefined : false;
  const allVoted = alivePlayers.every((p) => votes[p.id] !== undefined);

  useEffect(() => {
    if (!youVoted || settling) return;
    setSettling(true);
    const timer = window.setTimeout(() => {
      onAutoCastRemaining();
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youVoted]);

  useEffect(() => {
    if (allVoted && !resolvedRef.current) {
      resolvedRef.current = true;
      const timer = window.setTimeout(() => onResolve(), 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVoted]);

  const counts = {};
  let abstainCount = 0;
  for (const targetId of Object.values(votes)) {
    if (targetId === "abstain") abstainCount += 1;
    else counts[targetId] = (counts[targetId] ?? 0) + 1;
  }

  return (
    <main className="screen echo-screen">
      <header className="echo-topbar">
        <div>
          <p className="eyebrow">断连协议 · 第 {round} 轮</p>
          <h2>{title}</h2>
        </div>
      </header>

      {subtitle ? <p className="echo-voting-subtitle">{subtitle}</p> : null}

      <section className="echo-vote-list" aria-label="投票目标">
        {alivePlayers
          .filter((p) => !p.isSelf)
          .map((player) => {
            const voteCount = counts[player.id] ?? 0;
            return (
              <button
                key={player.id}
                className={`vote-option ${you && votes[you.id] === player.id ? "selected" : ""}`}
                disabled={youVoted}
                onClick={() => onCastVote(you.id, player.id)}
              >
                <PlayerAvatar player={player} size="sm" />
                <div>
                  <strong>{player.name}</strong>
                  <span>{votes[player.id] !== undefined ? "已投票" : "等待表态"}</span>
                </div>
                <span className="echo-vote-count">{voteCount}</span>
              </button>
            );
          })}
      </section>

      <button className="ghost-button full" disabled={youVoted} onClick={() => onCastVote(you.id, "abstain")}>
        <Ban size={16} />
        弃权
      </button>

      <section className="echo-vote-status">
        <Vote size={16} />
        <p>
          {youVoted
            ? allVoted
              ? "全员表态完毕，正在结算本轮票数..."
              : "你已锁定投票，其他人正在表态（票数实时公开，不可撤回）"
            : "选择一名候选人投出断连票，或选择弃权。投出后立即锁定，不可更改。"}
        </p>
      </section>

      {abstainCount > 0 ? <p className="echo-abstain-note">当前弃权人数：{abstainCount}</p> : null}
    </main>
  );
}
