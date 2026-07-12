import { Eye } from "lucide-react";

// Simplified spectator state (docs section 6): a disconnected candidate can no
// longer speak in the main channel or vote. Per the task scope, we don't build
// a full spectator chat channel — just a clear status screen, plus a way to
// keep watching the remaining rounds play out (auto-follows the match state).
export function EchoSpectatorScreen({ round, onContinueWatching }) {
  return (
    <main className="screen echo-screen echo-spectator-screen">
      <div className="echo-spectator-panel">
        <Eye size={30} />
        <h2>你已断连</h2>
        <p>你与信号室的连接已断开，无法再发言或参与断连表决。</p>
        <p className="echo-spectator-sub">你可以继续观看剩余候选人的进展，直到本局分出信号室归属。</p>
        <button className="primary-button full" onClick={onContinueWatching}>
          继续观看第 {round} 轮进展
        </button>
      </div>
    </main>
  );
}
