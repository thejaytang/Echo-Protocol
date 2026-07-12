import { useState } from "react";
import { BarChart3, FlaskConical, RotateCcw, Share2 } from "lucide-react";
import { AppHeader, StageRail } from "./Shared.jsx";
import { replaySummaries } from "../data.js";
import { ShareCardPreview } from "./ShareCard.jsx";
import { SkinBadge } from "./SkinBadge.jsx";

// Ritual moment C (Brief 1.3.C): same information order as before, restyled
// as a scrollable "film strip" timeline. Cyan markers = key judgment beats,
// red markers = misread/misled beats. A demo-only scenario toggle switches
// between the "hit" and "miss" mock outcomes so the red film-frame style
// actually renders somewhere, instead of the misread mock sitting unused.
export function ReplayScreen({ onRestart, onHome, onSettings }) {
  const [reportStage, setReportStage] = useState("idle"); // idle | reasons | done
  const [showShareCard, setShowShareCard] = useState(false);
  const [scenario, setScenario] = useState("hit"); // hit | miss — demo toggle only
  const summary = replaySummaries[scenario];

  return (
    <main className="screen replay-screen">
      <AppHeader onHome={onHome} onSettings={onSettings} />
      <StageRail active={5} />

      <section className="replay-panel">
        <div className="section-heading">
          <BarChart3 size={22} />
          <div>
            <p className="eyebrow">复盘</p>
            <h2>本局结算</h2>
          </div>
          <SkinBadge />
        </div>

        <button
          className="scenario-demo-toggle"
          onClick={() => setScenario((current) => (current === "hit" ? "miss" : "hit"))}
        >
          <FlaskConical size={13} />
          {scenario === "hit" ? "查看误判示例" : "查看命中示例"}
        </button>

        <div className={`replay-summary ${scenario === "miss" ? "replay-summary-miss" : ""}`}>
          <strong>{summary.resultTitle}</strong>
          <span>{summary.resultDetail}</span>
        </div>

        <section className="score-strip compact">
          <div>
            <span className="label">我的任务结果</span>
            <strong>{summary.taskResult}</strong>
          </div>
          <div>
            <span className="label">复盘校准</span>
            <strong>{summary.calibration}</strong>
          </div>
        </section>

        <div className="film-strip" aria-label="复盘时间线">
          <div className="film-strip-rail" aria-hidden="true" />
          {summary.timeline.map((item) => (
            <div className={`film-frame film-frame-${item.tone}`} key={item.id}>
              <div className="film-frame-marker" />
              <div className="film-frame-body">
                <span className="film-frame-time">{item.time}</span>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="safety-actions post-game-actions">
          {reportStage === "idle" ? (
            <>
              <button onClick={() => setReportStage("reasons")}>举报</button>
              <button onClick={() => setReportStage("done")}>拉黑</button>
              <button onClick={() => setReportStage("reasons")}>举报并拉黑</button>
            </>
          ) : reportStage === "reasons" ? (
            <div className="report-reason-list">
              <p className="label">选择举报原因</p>
              {["骚扰或攻击性言论", "分享真实身份信息", "其他违规内容"].map((reason) => (
                <button key={reason} className="report-reason-row" onClick={() => setReportStage("done")}>
                  {reason}
                </button>
              ))}
            </div>
          ) : (
            <p className="report-done-note">已收到你的局后处理，感谢反馈。</p>
          )}
        </section>

        <section className="score-strip compact">
          <div>
            <span className="label">本局奖励</span>
            <strong>{summary.reward}</strong>
          </div>
          <div>
            <span className="label">匿名战报</span>
            <strong>可分享</strong>
          </div>
        </section>

        <div className="modal-actions">
          <button className="primary-button" onClick={onRestart}>
            <RotateCcw size={18} />
            再来一局
          </button>
          <button className="ghost-button" onClick={() => setShowShareCard(true)}>
            <Share2 size={16} />
            分享战报
          </button>
          <button className="ghost-button" onClick={onHome}>
            返回首页
          </button>
        </div>
      </section>

      {showShareCard ? <ShareCardPreview onClose={() => setShowShareCard(false)} /> : null}
    </main>
  );
}
