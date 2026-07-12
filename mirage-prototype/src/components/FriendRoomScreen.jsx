import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { AppHeader, PlayerAvatar } from "./Shared.jsx";
import { players } from "../data.js";

const ROOM_CAPACITY = 4;
const INVITE_CODE = "A7K29Q";

// Brief 2.1: waiting screen becomes a round-table seat visualization with
// three states — occupied / waiting / AI fill — plus a stronger invite code
// card with one-tap copy and share.
export function FriendRoomScreen({ onStart, onHome, onSettings }) {
  const [copied, setCopied] = useState(false);

  const seats = Array.from({ length: ROOM_CAPACITY }).map((_, index) => {
    const player = players[index];
    if (player) return { kind: "occupied", player, ready: index < 2 };
    if (index === ROOM_CAPACITY - 1) return { kind: "ai-fill" };
    return { kind: "waiting" };
  });

  function handleCopy() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="screen">
      <AppHeader onHome={onHome} onSettings={onSettings} />
      <section className="room-lobby">
        <p className="eyebrow">好友房</p>
        <h2>4 人经典混聊</h2>
        <p>3 名真人和 1 名 AI。全员准备后由房主开始，局后进入揭晓和复盘。</p>

        <div className="invite-box invite-box-strong">
          <div>
            <span className="label">邀请码</span>
            <strong className="invite-code-big">{INVITE_CODE}</strong>
          </div>
          <button className="icon-button" aria-label="复制邀请码" onClick={handleCopy}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <button className="secondary-button invite-share-button">
            <Share2 size={16} />
            分享邀请
          </button>
        </div>

        <div className="round-table" aria-label="圆桌座位状态">
          <div className="round-table-center">
            <span>{players.length + 1}/{ROOM_CAPACITY}</span>
            <span className="round-table-center-label">已入座</span>
          </div>
          {seats.map((seat, index) => {
            const angle = (360 / ROOM_CAPACITY) * index - 90;
            const style = { "--seat-angle": `${angle}deg` };
            return (
              <div className={`round-seat round-seat-${seat.kind}`} style={style} key={index}>
                {seat.kind === "occupied" ? (
                  <>
                    <PlayerAvatar player={seat.player} size="sm" />
                    <span className="round-seat-name">{seat.player.name}</span>
                    <span className={`round-seat-status ${seat.ready ? "ready" : "pending"}`}>
                      {seat.ready ? "已准备" : "等待准备"}
                    </span>
                  </>
                ) : seat.kind === "ai-fill" ? (
                  <>
                    <span className="round-seat-placeholder ai">AI</span>
                    <span className="round-seat-name">AI 补位</span>
                    <span className="round-seat-status pending">未满自动补位</span>
                  </>
                ) : (
                  <>
                    <span className="round-seat-placeholder empty" />
                    <span className="round-seat-name">空位</span>
                    <span className="round-seat-status pending">等待好友加入</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button className="primary-button full" onClick={onStart}>
          房主开始
        </button>
        <button className="ghost-button full" onClick={onHome}>
          返回首页
        </button>
      </section>
    </main>
  );
}
