import { useMemo, useState } from "react";
import {
  Apple,
  Compass,
  FileText,
  LifeBuoy,
  MessageCircle,
  Package,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Trophy,
  Vote,
} from "lucide-react";
import "./styles.css";

import { AppHeader, GameTopBar, PlayerAvatar, StageRail, TabBar } from "./components/Shared.jsx";
import { MissionCardOverlay } from "./components/MissionCard.jsx";
import { RevealScreen } from "./components/RevealScreen.jsx";
import { ReplayScreen } from "./components/ReplayScreen.jsx";
import { FriendRoomScreen } from "./components/FriendRoomScreen.jsx";
import { SkinBadge } from "./components/SkinBadge.jsx";
import { EchoProtocolFlow } from "./components/echo-protocol/EchoProtocolFlow.jsx";
import { evidenceNotes, initialMessages, players, quickChatDrafts } from "./data.js";

function OnboardingScreen({ onComplete }) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  const canEnter = ageConfirmed && rulesConfirmed;

  return (
    <main className="screen onboarding-screen">
      <section className="onboarding-panel">
        <p className="eyebrow">欢迎进入图灵迷局</p>
        <h1>开局，揪出伪装者</h1>
        <p>伪装者已混进座位。听发言、抓破绽，最后把最可疑的人投出去。</p>

        <div className="confirm-list">
          <label>
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.target.checked)}
            />
            <span>我已完成年龄确认，并理解这是限时游戏房间。</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={rulesConfirmed}
              onChange={(event) => setRulesConfirmed(event.target.checked)}
            />
            <span>我同意社区规范，不分享真实姓名、地址、电话、学校或支付信息。</span>
          </label>
        </div>

        <div className="auth-provider-list" aria-label="固定账号登录">
          <button className="primary-button full" disabled={!canEnter} onClick={() => onComplete("apple")}>
            <Apple size={18} />
            Apple 登录
          </button>
          <button className="secondary-button full" disabled={!canEnter} onClick={() => onComplete("wechat")}>
            <MessageCircle size={18} />
            微信登录
          </button>
          <button className="secondary-button full" disabled={!canEnter} onClick={() => onComplete("google")}>
            G
            Google 登录
          </button>
        </div>
      </section>
    </main>
  );
}

function SettingsModal({ onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="report-modal" onClick={(event) => event.stopPropagation()}>
        <Settings size={24} />
        <h3>设置与安全</h3>
        <p>账号、安全和社区规则都放在这里。删除账号需要二次确认。</p>
        <div className="settings-list">
          <a href="/legal/privacy">
            <FileText size={15} /> 隐私政策
          </a>
          <a href="/legal/terms">
            <FileText size={15} /> 服务条款
          </a>
          <a href="/legal/community">
            <ScrollText size={15} /> 社区规范
          </a>
          <a href="/support">
            <LifeBuoy size={15} /> 联系客服
          </a>
          {confirmDelete ? (
            <button className="danger-text">
              <Trash2 size={15} /> 确认删除账号
            </button>
          ) : (
            <button className="danger-text" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> 删除账号
            </button>
          )}
        </div>
        <button className="primary-button full" onClick={onClose}>
          关闭
        </button>
      </section>
    </div>
  );
}

function HomeScreen({ onStart, onFriendRoom, onSettings, onEchoProtocol }) {
  return (
    <main className="screen home-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">图灵迷局</p>
          <h1>图灵迷局</h1>
          <p className="home-copy">进入限时聊天局，通过发言、怀疑和投票揪出伪装者。</p>
        </div>
        <button className="icon-button" aria-label="设置" onClick={onSettings}>
          <Settings size={22} />
        </button>
      </header>

      <section className="score-strip">
        <div>
          <span className="label">识别率</span>
          <strong>86%</strong>
        </div>
        <div>
          <span className="label">完赛</span>
          <strong>3 局</strong>
        </div>
        <div>
          <span className="label">可复盘局</span>
          <strong>3</strong>
        </div>
      </section>

      <section className="primary-panel">
        <div>
          <p className="panel-kicker">公开局</p>
          <h2>3 人抓伪装者</h2>
          <p>2 名侦探和 1 名伪装者围绕话题聊天，讨论结束后归票锁定目标。</p>
        </div>
        <button className="primary-button" onClick={onStart}>
          快速开始
        </button>
      </section>

      <section className="primary-panel echo-entry-panel">
        <div>
          <p className="panel-kicker">新玩法体验</p>
          <h2>体验断连协议（多轮甄别）</h2>
          <p>5 人信号室，多轮自由讨论 + 断连表决 + 分析师技能，直到分出信号室归属。</p>
        </div>
        <button className="primary-button" onClick={onEchoProtocol}>
          进入信号室
        </button>
      </section>

      <section className="mode-list" aria-label="模式列表">
        <button className="mode-row" onClick={onStart}>
          <div>
            <strong>2 人真假局</strong>
            <span>2 分钟聊天，抓对方破绽</span>
          </div>
          <span className="mode-meta">2 人</span>
        </button>
        <button className="mode-row selected" onClick={onStart}>
          <div>
            <strong>3 人抓伪装者</strong>
            <span>公开匹配</span>
          </div>
          <span className="mode-meta">3 人</span>
        </button>
        <button className="mode-row" onClick={onFriendRoom}>
          <div>
            <strong>创建好友房</strong>
            <span>邀请朋友进入 4 人或 6 人局</span>
          </div>
          <span className="mode-meta">邀请码</span>
        </button>
      </section>

      <section className="recent-replay">
        <div>
          <span className="label">最近复盘</span>
          <strong>你把 AI 判断成了人类</strong>
        </div>
        <button className="ghost-button" onClick={onStart}>
          再试一局
        </button>
      </section>
    </main>
  );
}

const recentGames = [
  { title: "3 人抓伪装者 · 判断正确", meta: "今天 19:32", hit: true },
  { title: "2 人真假局 · 未命中", meta: "昨天 21:05", hit: false },
  { title: "好友房 4 人局 · 判断正确", meta: "3 天前", hit: true },
];

function RecordsScreen() {
  const completed = recentGames.length;
  const hitCount = recentGames.filter((item) => item.hit).length;
  const seasonUnlocked = completed >= 3;

  return (
    <main className="screen placeholder-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">图灵迷局</p>
          <h1>战绩</h1>
          <p className="home-copy">你的识别表现和对局记录都在这里。</p>
        </div>
      </header>

      <section className="score-strip">
        <div>
          <span className="label">识别率</span>
          <strong>{Math.round((hitCount / completed) * 100)}%</strong>
        </div>
        <div>
          <span className="label">完赛</span>
          <strong>{completed} 局</strong>
        </div>
        <div>
          <span className="label">可复盘局</span>
          <strong>{completed}</strong>
        </div>
      </section>

      <section className="season-card">
        <div className="season-card-head">
          <Trophy size={18} />
          <div>
            <strong>识别赛季 S1</strong>
            <span>{seasonUnlocked ? "已解锁排行榜" : `再完成 ${3 - completed} 局解锁排行榜`}</span>
          </div>
        </div>
        <div className="season-progress-track">
          <div
            className="season-progress-fill"
            style={{ width: `${Math.min(100, (completed / 3) * 100)}%` }}
          />
        </div>
        {seasonUnlocked ? <button className="ghost-button full">查看排行榜</button> : null}
      </section>

      <p className="placeholder-list-label">复盘库</p>
      <section className="placeholder-list">
        {recentGames.map((item) => (
          <div className="placeholder-card" key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function ProfileScreen({ onSettings }) {
  return (
    <main className="screen placeholder-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">图灵迷局</p>
          <h1>我的</h1>
          <p className="home-copy">账号、安全与偏好设置。</p>
        </div>
        <button className="icon-button" aria-label="设置" onClick={onSettings}>
          <Settings size={22} />
        </button>
      </header>
      <section className="placeholder-list">
        <div className="placeholder-card">
          <strong>识别称号</strong>
          <span>敏锐观察者 · Lv.3</span>
        </div>
        <div className="placeholder-card placeholder-card-row">
          <div>
            <strong>账号状态</strong>
            <span>
              <ShieldCheck size={13} /> Apple 已绑定 · 战绩已保护
            </span>
          </div>
        </div>
        <div className="placeholder-card placeholder-card-row">
          <div>
            <strong>背包与装扮</strong>
            <span>
              <Package size={13} /> 任务卡皮肤、头像框将在这里预览
            </span>
          </div>
          <SkinBadge />
        </div>
        <div className="placeholder-card">
          <strong>账号与规则</strong>
          <span>隐私政策、服务条款、社区规范、客服与账号管理见右上角设置</span>
        </div>
      </section>
    </main>
  );
}

function PlayerStrip({ selectedSuspect, onMark }) {
  return (
    <section className="player-strip round-strip" aria-label="玩家列表">
      {players.map((player, index) => (
        <button
          className={`player-tile ${selectedSuspect === player.id ? "marked" : ""}`}
          key={player.id}
          onClick={() => onMark(player.id)}
        >
          <div className="avatar-stack">
            <PlayerAvatar player={player} />
            <span>{index + 1}</span>
          </div>
          <div className="player-copy">
            <strong>{player.name}</strong>
            <span>{player.publicRole}</span>
          </div>
        </button>
      ))}
    </section>
  );
}

function SystemNotice() {
  return (
    <section className="system-notice">
      <ShieldCheck size={24} />
      <p>本局 1 名 AI 已混入。听发言、抓破绽，投出最像 AI 的玩家。</p>
      <button>查看规则</button>
    </section>
  );
}

function ChatMessage({ message, reaction, onReact, selectedSuspect }) {
  const player = players.find((item) => item.id === message.playerId);
  const marked = !player.self && selectedSuspect === player.id;
  return (
    <article className={`chat-row ${player.self ? "self-row" : ""}`}>
      <div className="message-main">
        <PlayerAvatar player={player} size="sm" />
        <div className="message-body">
          <div className="message-meta">
            <strong>{player.name}</strong>
            <span>{message.time}</span>
          </div>
          <div className="bubble">{message.text}</div>
          <div className="message-actions">
            <button
              className={`tiny-action ${reaction === message.id ? "active" : ""}`}
              onClick={() => onReact(message.id)}
            >
              <ThumbsUp size={14} />
              标为线索
            </button>
          </div>
        </div>
      </div>
      {marked ? (
        <aside className="suspicion-card">
          <span>我的标记</span>
          <strong>{player.suspicion}%</strong>
          <div className="mini-bars">
            {Array.from({ length: 8 }).map((_, index) => (
              <i key={index} className={index < Math.round(player.suspicion / 12.5) ? "filled" : ""} />
            ))}
          </div>
        </aside>
      ) : null}
    </article>
  );
}

function GameScreen({ onVote, onHome, onSettings }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [selectedSuspect, setSelectedSuspect] = useState("");
  const [reaction, setReaction] = useState(null);
  const currentTime = useMemo(() => {
    const minute = 33 + Math.max(0, messages.length - initialMessages.length);
    return `19:${String(minute).padStart(2, "0")}`;
  }, [messages.length]);

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((items) => [
      ...items,
      {
        id: Date.now(),
        playerId: "you",
        time: currentTime,
        text,
        status: "sent",
      },
    ]);
    setDraft("");
  }

  return (
    <main className="screen game-screen">
      <GameTopBar onHome={onHome} onSettings={onSettings} seconds={102} />
      <StageRail active={2} />
      <PlayerStrip selectedSuspect={selectedSuspect} onMark={setSelectedSuspect} />
      <SystemNotice />

      <section className="chat-list" aria-label="聊天消息">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            reaction={reaction}
            onReact={setReaction}
            selectedSuspect={selectedSuspect}
          />
        ))}
      </section>

      <section className="composer">
        <div className="quick-chat-row" aria-label="起手句">
          {quickChatDrafts.map((text) => (
            <button className="quick-chat-chip" key={text} onClick={() => setDraft(text)}>
              {text}
            </button>
          ))}
        </div>
        <div className="input-row">
          <MessageCircle size={23} />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入消息..."
            maxLength={280}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }}
          />
          <button className="send-button" onClick={sendMessage} aria-label="发送消息">
            <Send size={18} />
          </button>
          <button className="vote-button" onClick={onVote}>
            投票
          </button>
        </div>
        <p className="safety-note">
          <ShieldCheck size={14} />
          保持理性讨论，AI 可能会伪装成人类
        </p>
      </section>
    </main>
  );
}

function VoteScreen({ onReveal, onBack, onSettings }) {
  const [target, setTarget] = useState("");
  const [confidence, setConfidence] = useState("medium");

  return (
    <main className="screen">
      <AppHeader onHome={onBack} onSettings={onSettings} />
      <StageRail active={3} />
      <section className="vote-panel">
        <div className="section-heading">
          <Vote size={22} />
          <div>
            <p className="eyebrow">投票阶段</p>
            <h2>你认为谁是 AI？</h2>
          </div>
        </div>
        <div className="vote-options">
          {players
            .filter((player) => !player.self)
            .map((player) => (
              <button
                key={player.id}
                className={`vote-option ${target === player.id ? "selected" : ""}`}
                onClick={() => setTarget(player.id)}
              >
                <PlayerAvatar player={player} size="sm" />
                <div>
                  <strong>{player.name}</strong>
                  <span>{evidenceNotes[player.id]}</span>
                </div>
              </button>
            ))}
        </div>

        <div className="confidence-group">
          <span className="label">信心值</span>
          {[
            ["low", "低"],
            ["medium", "中"],
            ["high", "高"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={confidence === value ? "selected" : ""}
              onClick={() => setConfidence(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <button className="primary-button full" disabled={!target} onClick={onReveal}>
          确认归票
        </button>
        <button className="ghost-button full" onClick={onBack}>
          返回讨论
        </button>
      </section>
    </main>
  );
}

export function App() {
  const [screen, setScreen] = useState("onboarding");
  const [activeTab, setActiveTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [missionSeen, setMissionSeen] = useState(false);
  const [echoRunId, setEchoRunId] = useState(0);
  const settingsModal = settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null;

  const tabScreens = new Set(["home", "records", "profile"]);

  function goHome() {
    setScreen("home");
    setActiveTab("home");
  }

  function startGame() {
    setMissionSeen(false);
    setScreen("mission");
  }

  function startEchoProtocol() {
    setEchoRunId((id) => id + 1);
    setScreen("echo-protocol");
  }

  function handleNavigate(tabId) {
    setActiveTab(tabId);
    setScreen(tabId);
  }

  if (screen === "onboarding") {
    return (
      <>
        <OnboardingScreen onComplete={goHome} />
        {settingsModal}
      </>
    );
  }

  if (tabScreens.has(screen)) {
    let body;
    if (screen === "records") {
      body = <RecordsScreen />;
    } else if (screen === "profile") {
      body = <ProfileScreen onSettings={() => setSettingsOpen(true)} />;
    } else {
      body = (
        <HomeScreen
          onStart={startGame}
          onFriendRoom={() => setScreen("friend")}
          onEchoProtocol={startEchoProtocol}
          onSettings={() => setSettingsOpen(true)}
        />
      );
    }
    return (
      <>
        {body}
        <TabBar active={activeTab} onNavigate={handleNavigate} />
        {settingsModal}
      </>
    );
  }

  if (screen === "echo-protocol") {
    // key={echoRunId} forces a clean remount (fresh useEchoProtocol state)
    // every time the player starts or restarts a match, instead of manually
    // resetting every field in the hook.
    return (
      <EchoProtocolFlow
        key={echoRunId}
        onExit={goHome}
        onRestart={startEchoProtocol}
      />
    );
  }

  if (screen === "friend") {
    return (
      <>
        <FriendRoomScreen
          onStart={startGame}
          onHome={goHome}
          onSettings={() => setSettingsOpen(true)}
        />
        {settingsModal}
      </>
    );
  }

  if (screen === "mission") {
    return (
      <>
        <main className="screen game-screen mission-host-screen">
          <GameTopBar onHome={goHome} onSettings={() => setSettingsOpen(true)} seconds={120} label="任务阶段" />
          <StageRail active={1} />
          <section className="mission-host-placeholder">
            <Compass size={26} />
            <p>任务卡确认后即可进入讨论。</p>
          </section>
        </main>
        {!missionSeen ? (
          <MissionCardOverlay
            onConfirm={() => {
              setMissionSeen(true);
              setScreen("game");
            }}
          />
        ) : null}
        {settingsModal}
      </>
    );
  }

  if (screen === "vote") {
    return (
      <>
        <VoteScreen
          onReveal={() => setScreen("reveal")}
          onBack={() => setScreen("game")}
          onSettings={() => setSettingsOpen(true)}
        />
        {settingsModal}
      </>
    );
  }

  if (screen === "reveal") {
    return (
      <>
        <RevealScreen
          onReplay={() => setScreen("replay")}
          onHome={goHome}
          onSettings={() => setSettingsOpen(true)}
        />
        {settingsModal}
      </>
    );
  }

  if (screen === "replay") {
    return (
      <>
        <ReplayScreen
          onRestart={startGame}
          onHome={goHome}
          onSettings={() => setSettingsOpen(true)}
        />
        {settingsModal}
      </>
    );
  }

  return (
    <>
      <GameScreen
        onVote={() => setScreen("vote")}
        onHome={goHome}
        onSettings={() => setSettingsOpen(true)}
      />
      {settingsModal}
    </>
  );
}
