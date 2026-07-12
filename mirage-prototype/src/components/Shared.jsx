import { Copy, Home, ScrollText, Settings, User } from "lucide-react";
import { phases, revealRoles } from "../data.js";

export function PlayerAvatar({ player, size = "md", revealed = false }) {
  const isAi = revealed && revealRoles[player.id]?.includes("AI");
  return (
    <img
      className={`avatar avatar-${size} ${revealed ? (isAi ? "avatar-ai" : "avatar-human") : ""}`}
      src={player.avatar}
      alt={`${player.name} 头像`}
    />
  );
}

export function AppHeader({ onHome, onSettings, roomCode = "884271" }) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={onHome} aria-label="返回首页">
        <span className="brand-title">图灵迷局</span>
        <span className="brand-subtitle">揪出伪装者</span>
      </button>
      <div className="room-actions">
        <div className="room-code">
          房间号 {roomCode}
          <Copy size={16} strokeWidth={2} />
        </div>
        <button className="icon-button" aria-label="设置" onClick={onSettings}>
          <Settings size={21} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

export function CountdownRing({ seconds, total = 120, label = "讨论阶段" }) {
  const pct = Math.max(0, Math.min(1, seconds / total));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const isUrgent = seconds <= 10;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <section className={`timer-panel ${isUrgent ? "urgent" : ""}`} aria-label="当前阶段倒计时">
      <span>{label}</span>
      <div className="timer-ring-wrap">
        <svg className="timer-ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle className="timer-ring-track" cx="32" cy="32" r={radius} />
          <circle
            className="timer-ring-progress"
            cx="32"
            cy="32"
            r={radius}
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <strong>
          {mm}:{ss}
        </strong>
      </div>
    </section>
  );
}

export function GameTopBar({ onHome, onSettings, seconds = 102, roomCode = "884271" }) {
  return (
    <header className="game-topbar">
      <button className="brand-button" onClick={onHome} aria-label="返回首页">
        <span className="brand-title">图灵迷局</span>
        <span className="brand-subtitle">揪出伪装者</span>
      </button>
      <CountdownRing seconds={seconds} />
      <div className="room-actions">
        <div className="room-code">
          房间号 {roomCode}
          <Copy size={15} strokeWidth={2} />
        </div>
        <button className="icon-button" aria-label="设置" onClick={onSettings}>
          <Settings size={20} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

export function StageRail({ active }) {
  return (
    <section className="stage-rail" aria-label="游戏阶段">
      {phases.map((phase, index) => {
        const step = index + 1;
        const isActive = step === active;
        const isDone = step < active;
        return (
          <div className="stage-item" key={phase}>
            <div className={`stage-dot ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
              {isDone ? <span className="stage-dot-check" aria-hidden="true" /> : step}
            </div>
            <div className={`stage-label ${isActive ? "active" : ""}`}>{phase}</div>
          </div>
        );
      })}
    </section>
  );
}

export function TabBar({ active, onNavigate }) {
  const tabs = [
    { id: "home", label: "开局", icon: Home },
    { id: "records", label: "战绩", icon: ScrollText },
    { id: "profile", label: "我的", icon: User },
  ];
  return (
    <nav className="tab-bar" aria-label="主导航">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            className={`tab-bar-item ${isActive ? "active" : ""}`}
            onClick={() => onNavigate(tab.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
