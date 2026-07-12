import { useState } from "react";
import { Compass, Sparkles, Target, Wrench } from "lucide-react";
import { missionCards } from "../data.js";

// Opening ritual moment (Brief 1.3.A). Shown before the player ever sees the
// chat room. Title copy is camp-specific and must never say "身份卡".
export function MissionCardOverlay({ onConfirm }) {
  const [closing, setClosing] = useState(false);
  const mission = missionCards.you;

  function handleConfirm() {
    setClosing(true);
    // Let the collapse animation play before handing off to the discussion
    // phase so the stage rail visibly advances from 任务 -> 讨论.
    window.setTimeout(onConfirm, 420);
  }

  return (
    <div className="mission-backdrop">
      <section className={`mission-card ${closing ? "collapsing" : ""}`}>
        <div className="mission-card-glow" aria-hidden="true" />
        <p className="mission-eyebrow">
          <Sparkles size={14} /> 开局任务
        </p>
        <h2>{mission.campTitle}</h2>

        <div className="mission-row">
          <span className="mission-row-icon"><Compass size={16} /></span>
          <div>
            <p className="mission-row-label">阵营 / 身份</p>
            <p className="mission-row-text">你是{mission.role}，本局与队友一同推理。</p>
          </div>
        </div>

        <div className="mission-row">
          <span className="mission-row-icon"><Target size={16} /></span>
          <div>
            <p className="mission-row-label">目标</p>
            <p className="mission-row-text">{mission.goal}</p>
          </div>
        </div>

        <div className="mission-row">
          <span className="mission-row-icon cyan"><Sparkles size={16} /></span>
          <div>
            <p className="mission-row-label">赢法</p>
            <p className="mission-row-text">{mission.winCondition}</p>
          </div>
        </div>

        <div className="mission-row">
          <span className="mission-row-icon"><Wrench size={16} /></span>
          <div>
            <p className="mission-row-label">工具</p>
            <ul className="mission-tool-list">
              {mission.tools.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </div>
        </div>

        <button className="primary-button full mission-confirm" onClick={handleConfirm}>
          确认任务
        </button>
      </section>
    </div>
  );
}
