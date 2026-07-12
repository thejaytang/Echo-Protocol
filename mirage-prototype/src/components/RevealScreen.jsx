import { useEffect, useMemo, useState } from "react";
import { FastForward } from "lucide-react";
import { AppHeader, PlayerAvatar, StageRail } from "./Shared.jsx";
import { players, revealOrder, revealRoles } from "../data.js";
import { ShareCardPreview } from "./ShareCard.jsx";

const FLIP_INTERVAL_MS = 500;

// Ritual moment B (Brief 1.3.B): seat-by-seat flip instead of a static list.
// Order follows each player's own suspicion marks (mock data), never a
// system-generated suspicion/strategy score.
export function RevealScreen({ onReplay, onHome, onSettings }) {
  const [flippedCount, setFlippedCount] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const allFlipped = flippedCount >= revealOrder.length || skipped;

  useEffect(() => {
    if (skipped) return undefined;
    if (flippedCount >= revealOrder.length) return undefined;
    const timer = window.setTimeout(() => {
      setFlippedCount((count) => count + 1);
    }, FLIP_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [flippedCount, skipped]);

  useEffect(() => {
    if (!allFlipped) return undefined;
    const timer = window.setTimeout(() => setShowResult(true), 260);
    return () => window.clearTimeout(timer);
  }, [allFlipped]);

  const orderedSeats = useMemo(() => {
    return revealOrder.map((id, index) => ({
      player: players.find((p) => p.id === id),
      index,
    }));
  }, []);

  function handleSkip() {
    setSkipped(true);
  }

  return (
    <main className="screen reveal-screen">
      <AppHeader onHome={onHome} onSettings={onSettings} />
      <StageRail active={4} />

      <section className="reveal-panel">
        <p className="eyebrow">揭晓</p>
        <h2>逐位揭晓身份</h2>

        {!allFlipped ? (
          <button className="ghost-button reveal-skip" onClick={handleSkip}>
            <FastForward size={15} />
            跳过动画
          </button>
        ) : null}

        <div className="flip-board" aria-label="身份揭晓">
          {orderedSeats.map(({ player, index }) => {
            const isFlipped = allFlipped || index < flippedCount;
            const role = revealRoles[player.id];
            const isAi = role.includes("AI");
            return (
              <div className={`flip-card ${isFlipped ? "flipped" : ""}`} key={player.id}>
                <div className="flip-card-inner">
                  <div className="flip-face flip-face-back">
                    <span className="flip-seat-number">{player.seat}</span>
                  </div>
                  <div className={`flip-face flip-face-front ${isAi ? "is-ai" : "is-human"}`}>
                    <PlayerAvatar player={player} size="sm" revealed />
                    <strong>{player.name}</strong>
                    <span className={`role-badge ${isAi ? "role-badge-ai" : "role-badge-human"}`}>
                      {role}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`reveal-result ${showResult ? "shown" : ""}`}>
          <h3>你找出了隐藏 AI</h3>
          <p>你的投票：阿言。真实身份：AI 混入者。</p>

          <button className="share-card-trigger" onClick={() => setShowShareCard(true)}>
            <span>战报卡预览</span>
            <span className="share-card-trigger-hint">点击预览分享战报</span>
          </button>

          <button className="primary-button full" onClick={onReplay}>
            查看复盘
          </button>
        </div>
      </section>

      {showShareCard ? <ShareCardPreview onClose={() => setShowShareCard(false)} /> : null}
    </main>
  );
}
