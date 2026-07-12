import { useEffect, useState } from "react";
import { Radar, ShieldAlert, Sparkles } from "lucide-react";
import { CountdownRing, PlayerAvatar } from "../Shared.jsx";

// Free-discussion stage for one round of the Echo Protocol. Countdown is
// display-only (mirrors the existing prototype's mocked timers — no real
// server-driven clock) and ticks down from `discussionSeconds`; hitting zero
// auto-advances to voting so the flow never stalls in the demo.
export function EchoDiscussionScreen({
  round,
  discussionSeconds,
  alivePlayers,
  you,
  analystUsed,
  analystResult,
  analystHints,
  onUseAnalyst,
  onGoToVoting,
}) {
  const [remaining, setRemaining] = useState(discussionSeconds);

  useEffect(() => {
    setRemaining(discussionSeconds);
  }, [discussionSeconds, round]);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const canUseAnalyst = you?.alive && !analystUsed;

  return (
    <main className="screen game-screen echo-screen">
      <header className="echo-topbar">
        <div>
          <p className="eyebrow">断连协议 · 第 {round} 轮</p>
          <h2>自由讨论</h2>
        </div>
        <CountdownRing seconds={remaining} total={discussionSeconds} label="讨论倒计时" />
      </header>

      <section className="player-strip round-strip" aria-label="存活候选人">
        {alivePlayers.map((player) => (
          <div className="player-tile echo-player-tile" key={player.id}>
            <div className="avatar-stack">
              <PlayerAvatar player={player} />
              <span>{player.seat}</span>
            </div>
            <div className="player-copy">
              <strong>{player.name}</strong>
              <span>{player.isSelf ? "分析师" : "候选人"}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="echo-skill-panel">
        <div className="echo-skill-head">
          <Sparkles size={18} />
          <div>
            <strong>分析师技能</strong>
            <span>限用 1 次，效果仅你可见，其他人完全不知情</span>
          </div>
        </div>
        {analystUsed ? (
          <div className="echo-skill-result">
            <ShieldAlert size={15} />
            <p>{analystResult?.hasEcho ? analystHints.hasEcho : analystHints.noEcho}</p>
          </div>
        ) : (
          <button className="secondary-button full" disabled={!canUseAnalyst} onClick={onUseAnalyst}>
            <Radar size={16} />
            使用分析师技能（随机抽取 2 名存活候选人）
          </button>
        )}
      </section>

      <section className="echo-discussion-note">
        <p>本环节为模拟自由讨论（原型不接入实时聊天）。讨论结束或倒计时归零后进入断连表决。</p>
      </section>

      <button className="primary-button full" onClick={onGoToVoting}>
        进入断连表决
      </button>
    </main>
  );
}
