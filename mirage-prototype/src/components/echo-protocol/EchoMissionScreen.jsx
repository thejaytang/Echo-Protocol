import { useState } from "react";
import { Compass, Sparkles, Target, Wrench } from "lucide-react";
import { echoMission } from "./echoData.js";

// Opening ritual for the Echo Protocol path — shown once at the start of the
// match only (per redesign doc 1.2: "任务卡只在开局出现一次"). Mirrors the
// visual language of MissionCardOverlay but with 断连协议 copy and an explicit
// explanation of how the Analyst skill works, since this run always assigns
// "you" the Analyst role.
export function EchoMissionScreen({ onConfirm }) {
  const [closing, setClosing] = useState(false);

  function handleConfirm() {
    setClosing(true);
    window.setTimeout(onConfirm, 380);
  }

  return (
    <div className="mission-backdrop">
      <section className={`mission-card ${closing ? "collapsing" : ""}`}>
        <div className="mission-card-glow" aria-hidden="true" />
        <p className="mission-eyebrow">
          <Sparkles size={14} /> 断连协议 · {echoMission.campTitle}
        </p>
        <h2>信号室已接入，甄别开始</h2>

        <div className="mission-row">
          <span className="mission-row-icon">
            <Compass size={16} />
          </span>
          <div>
            <p className="mission-row-label">身份</p>
            <p className="mission-row-text">你是{echoMission.role}。</p>
          </div>
        </div>

        <div className="mission-row">
          <span className="mission-row-icon">
            <Target size={16} />
          </span>
          <div>
            <p className="mission-row-label">目标</p>
            <p className="mission-row-text">{echoMission.goal}</p>
          </div>
        </div>

        <div className="mission-row">
          <span className="mission-row-icon cyan">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="mission-row-label">赢法</p>
            <p className="mission-row-text">{echoMission.winCondition}</p>
          </div>
        </div>

        <div className="mission-row">
          <span className="mission-row-icon">
            <Wrench size={16} />
          </span>
          <div>
            <p className="mission-row-label">工具</p>
            <ul className="mission-tool-list">
              {echoMission.tools.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </div>
        </div>

        <button className="primary-button full mission-confirm" onClick={handleConfirm}>
          确认须知，进入信号室
        </button>
      </section>
    </div>
  );
}
