import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { CountdownRing, PlayerAvatar } from "../Shared.jsx";
import { DEFENSE_SECONDS } from "./echoData.js";

// 复议陈述: triggered either by a tie (每位平票候选人各60秒，按座位号顺序) or by a
// clear plurality (最高票者本人60秒自辩). Once every defendant's 60s window has
// played out, hands control back so the parent can move into the revote stage
// (docs section 1.2 / 4).
export function EchoDefenseScreen({ round, players, defenseInfo, onProceedToRevote }) {
  const defendants = [...defenseInfo.candidateIds]
    .map((id) => players.find((p) => p.id === id))
    .sort((a, b) => a.seat - b.seat);

  const [activeIndex, setActiveIndex] = useState(0);
  const [remaining, setRemaining] = useState(DEFENSE_SECONDS);

  useEffect(() => {
    setRemaining(DEFENSE_SECONDS);
  }, [activeIndex]);

  useEffect(() => {
    if (remaining <= 0) {
      if (activeIndex < defendants.length - 1) {
        setActiveIndex((i) => i + 1);
      }
      return undefined;
    }
    const timer = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, activeIndex]);

  const allDone = activeIndex >= defendants.length - 1 && remaining <= 0;
  const current = defendants[activeIndex];

  return (
    <main className="screen echo-screen">
      <header className="echo-topbar">
        <div>
          <p className="eyebrow">断连协议 · 第 {round} 轮</p>
          <h2>复议陈述</h2>
        </div>
        <CountdownRing seconds={remaining} total={DEFENSE_SECONDS} label="陈述倒计时" />
      </header>

      <p className="echo-defense-context">
        {defenseInfo.kind === "tie"
          ? "本轮出现平票，以下候选人按座位号顺序依次陈述，随后全员重新投票。"
          : "本轮出现明确最高票，该候选人有 60 秒公开自辩机会，随后全员获得一次改票机会。"}
      </p>

      <section className="echo-defense-stage">
        <PlayerAvatar player={current} size="lg" />
        <strong>{current.name}</strong>
        <span className="echo-defense-seat">{current.seat} 号座位 · 正在陈述</span>
        <div className="echo-defense-bubble">
          <Megaphone size={15} />
          <p>（模拟自辩发言：{current.name} 正在向全员说明自己不是回声体阵营的理由。）</p>
        </div>
      </section>

      <div className="echo-defense-order">
        {defendants.map((d, index) => (
          <span key={d.id} className={`echo-defense-chip ${index === activeIndex ? "active" : ""} ${index < activeIndex ? "done" : ""}`}>
            {d.seat}号 {d.name}
          </span>
        ))}
      </div>

      {allDone ? (
        <button className="primary-button full" onClick={onProceedToRevote}>
          {defenseInfo.kind === "tie" ? "进入重新投票" : "进入改票窗口"}
        </button>
      ) : (
        <button className="ghost-button full" onClick={() => setRemaining(0)}>
          跳过等待
        </button>
      )}
    </main>
  );
}
