import { RadioTower, Users } from "lucide-react";

// 断连结果播报: only ever shows the FACTION label ("人类" / "回声体"), never the
// specific role name — and per docs 2.2, a disconnected 引路人 is deliberately
// shown as "人类" even though their disconnect just reduced the echo faction's
// headcount. This asymmetry is intentional design, not a bug.
export function EchoBroadcastScreen({ round, broadcast, onAcknowledge }) {
  const isNoDisconnect = Boolean(broadcast?.none);

  return (
    <main className="screen echo-screen echo-broadcast-screen">
      <header className="echo-topbar">
        <div>
          <p className="eyebrow">断连协议 · 第 {round} 轮</p>
          <h2>断连结果播报</h2>
        </div>
      </header>

      <section className={`echo-broadcast-panel ${isNoDisconnect ? "neutral" : broadcast.displayLabel === "回声体" ? "is-echo" : "is-human"}`}>
        <RadioTower size={32} />
        {isNoDisconnect ? (
          <>
            <h3>本轮无人断连</h3>
            <p>{broadcast.reasonText}</p>
          </>
        ) : (
          <>
            <h3>
              {broadcast.seat} 号座位 · {broadcast.name} 已断连
            </h3>
            <p className="echo-broadcast-faction">
              阵营播报：<strong>{broadcast.displayLabel}</strong>
            </p>
            <p className="echo-broadcast-hint">
              <Users size={14} />
              系统只播报阵营，不会公开具体身份或技能角色。
            </p>
          </>
        )}
      </section>

      <button className="primary-button full" onClick={onAcknowledge}>
        确认，检查信号室归属判定
      </button>
    </main>
  );
}
