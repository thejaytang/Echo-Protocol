import { RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { FACTION, ROLE } from "./echoData.js";

const ROLE_LABEL = {
  [ROLE.YOU_ANALYST]: "候选人 · 分析师",
  [ROLE.CANDIDATE]: "候选人",
  [ROLE.GUIDE]: "人类 · 引路人",
  [ROLE.ECHO]: "回声体",
};

// Multi-round recap, distinct from the existing single-round ReplayScreen's
// linear timeline: here each "frame" is a full round (discussion -> vote
// outcome), so players can see the whole arc of the match, not just one vote.
export function EchoFinalScreen({ players, round, result, history, onRestart, onHome, restartLabel = "再玩一局断连协议" }) {
  const candidateWon = result.winner === FACTION.CANDIDATE;

  return (
    <main className="screen echo-screen echo-final-screen">
      <header className="echo-topbar">
        <div>
          <p className="eyebrow">断连协议 · 信号室归属判定</p>
          <h2>{candidateWon ? "候选人阵营获胜" : "回声体阵营获胜"}</h2>
        </div>
      </header>

      <section className={`echo-final-banner ${candidateWon ? "is-human" : "is-echo"}`}>
        <Trophy size={26} />
        <p>{result.reason}</p>
      </section>

      <section className="echo-final-roster">
        <p className="label">最终身份揭晓</p>
        {players.map((p) => (
          <div className="echo-final-roster-row" key={p.id}>
            <span className="echo-roster-seat">{p.seat}</span>
            <strong>{p.name}</strong>
            <span className={`role-badge ${p.faction === FACTION.ECHO ? "role-badge-ai" : "role-badge-human"}`}>
              {ROLE_LABEL[p.role]}
            </span>
            <span className="echo-roster-status">{p.alive ? "存活至终局" : "已断连"}</span>
          </div>
        ))}
      </section>

      <section className="echo-final-timeline" aria-label="多轮回顾">
        <p className="label">多轮回顾</p>
        {history.map((entry, index) => (
          <div className="echo-round-recap" key={index}>
            <div className="echo-round-recap-head">
              <span className="echo-round-badge">第 {entry.round} 轮</span>
              <span>{entry.kind === "disconnect" ? "发生断连" : "无人断连"}</span>
            </div>
            {entry.kind === "disconnect" ? (
              <p>
                {entry.seat} 号座位 · {entry.name} 被断连，播报阵营为「{entry.displayLabel}」。
              </p>
            ) : (
              <p>{entry.reasonText}</p>
            )}
          </div>
        ))}
        <div className="echo-round-recap echo-round-recap-final">
          <div className="echo-round-recap-head">
            <span className="echo-round-badge">终局</span>
            <span>共进行 {round} 轮</span>
          </div>
          <p>
            <ShieldCheck size={13} /> {result.reason}
          </p>
        </div>
      </section>

      <div className="modal-actions">
        <button className="primary-button" onClick={onRestart}>
          <RotateCcw size={18} />
          {restartLabel}
        </button>
        <button className="ghost-button" onClick={onHome}>
          返回首页
        </button>
      </div>
    </main>
  );
}
