// Mock data shared across screens. No backend — front-end only prototype.

export const players = [
  {
    id: "you",
    name: "你",
    seat: 1,
    publicRole: "侦探",
    avatar: "/assets/avatar-you.png",
    suspicion: 20,
    self: true,
  },
  {
    id: "lu",
    name: "小鹿",
    seat: 2,
    publicRole: "待判断",
    avatar: "/assets/avatar-lu.png",
    suspicion: 25,
  },
  {
    id: "yan",
    name: "阿言",
    seat: 3,
    publicRole: "待判断",
    avatar: "/assets/avatar-ai.png",
    suspicion: 70,
  },
];

// Real roles + reveal order are only referenced by the Reveal screen.
// Never surface this data (or any derived suspicion score) before the reveal phase.
export const revealRoles = {
  you: "侦探",
  lu: "侦探",
  yan: "AI 混入者",
};

// Order in which seats flip during the reveal ceremony — driven by each
// player's own suspicion marks (mock: highest marked-suspicion flips last
// for maximum tension).
export const revealOrder = ["lu", "you", "yan"];

export const evidenceNotes = {
  lu: "暂无强证据",
  yan: "我标记了 2 条模糊回答",
};

export const initialMessages = [
  {
    id: 1,
    playerId: "you",
    time: "19:30",
    text: "大家好，我是学生，昨天去图书馆复习到很晚。",
    status: "sent",
  },
  {
    id: 2,
    playerId: "lu",
    time: "19:31",
    text: "我在健身房跑步，回来路上下雨还打不到车，有点狼狈。",
    status: "sent",
  },
  {
    id: 3,
    playerId: "yan",
    time: "19:31",
    text: "我在家看了一部评分很高的悬疑电影，名字有点长，不太记得了。",
    status: "sent",
    clue: "回答较笼统，缺少具体细节",
  },
  {
    id: 4,
    playerId: "you",
    time: "19:32",
    text: "阿言，你能说一下电影的主角或关键情节吗？",
    status: "sent",
  },
  {
    id: 5,
    playerId: "yan",
    time: "19:32",
    text: "嗯，就是讲一个人发现真相的故事，结局反转挺意外的。",
    status: "sent",
    clue: "细节回避，倾向模糊概括",
  },
];

export const phases = ["任务", "讨论", "投票", "揭晓", "复盘"];

// Mission card content — the mandatory first screen of a round.
// Title varies by camp per the compliance brief: never "身份卡".
export const missionCards = {
  you: {
    campTitle: "侦探任务",
    role: "侦探",
    goal: "听发言、抓破绽，找出混入座位的伪装者。",
    winCondition: "投票阶段把票投给真正的 AI 混入者，即算完成任务。",
    tools: ["证据笔记：随手标记可疑发言", "起手句：三条备用开场，仅填入草稿"],
  },
};

export const quickChatDrafts = ["我先听一轮", "这句太空了", "请给细节"];

// Replay timeline — information order must stay identical to the previous
// build; only the visual treatment (film-strip, cyan/red markers) changes.
export const replayTimeline = [
  { id: "judge", time: "判断", text: "我的最终投票给阿言，信心值为高。", tone: "cyan" },
  { id: "identity", time: "身份", text: "阿言是 AI 混入者；你和小鹿是侦探。", tone: "cyan" },
  {
    id: "t1931",
    time: "19:31",
    text: "阿言提到“评分很高的悬疑电影”，但没有给出片名或具体场景。",
    tone: "cyan",
  },
  {
    id: "t1932",
    time: "19:32",
    text: "被追问关键情节后，回答转为“发现真相”“结局反转”。",
    tone: "cyan",
  },
  { id: "vote", time: "投票", text: "你和小鹿均投给阿言，AI 成为唯一最高票。", tone: "gold" },
];

// A separate mock scenario item marked as a misread, to demonstrate the red
// "误判" marker style described in the brief. Kept out of the default
// timeline above so information order matches the brief exactly; shown when
// replay is toggled to the "misread" mock variant used for QA screenshots.
export const replayMisreadExample = {
  id: "misread-example",
  time: "19:30",
  text: "你曾一度怀疑小鹿的雨天描述过于具体像是编造，但复盘显示这是真实细节。",
  tone: "red",
};

// Full alternate timeline for the "误判" replay scenario, reusing
// replayMisreadExample so the red film-frame style actually renders somewhere
// instead of sitting unused in the data file. Information order mirrors the
// hit scenario: judge -> identity -> key beats -> vote.
export const replayMisreadTimeline = [
  { id: "judge-miss", time: "判断", text: "我的最终投票给小鹿，信心值为高。", tone: "cyan" },
  {
    id: "identity-miss",
    time: "身份",
    text: "阿言才是 AI 混入者；小鹿是侦探。你投错了目标。",
    tone: "red",
  },
  {
    id: "t1931-miss",
    time: "19:31",
    text: "阿言提到“评分很高的悬疑电影”，但没有给出片名或具体场景——这本是关键线索。",
    tone: "cyan",
  },
  replayMisreadExample,
  {
    id: "vote-miss",
    time: "投票",
    text: "你和小鹿的票分散在不同目标，阿言没有成为唯一最高票。",
    tone: "red",
  },
];

// Summary blocks for the two replay demo scenarios (hit / miss). Keeping both
// in one place makes the ReplayScreen toggle a simple lookup instead of
// duplicated JSX for each outcome.
export const replaySummaries = {
  hit: {
    resultTitle: "判断正确",
    resultDetail: "阿言在生活细节追问中连续回避，且使用概括式表达。",
    taskResult: "任务完成",
    calibration: "高信心命中",
    reward: "+20",
    timeline: replayTimeline,
  },
  miss: {
    resultTitle: "判断失准",
    resultDetail: "小鹿的雨天描述其实是真实细节，你把这条误当成了破绽。",
    taskResult: "任务未完成",
    calibration: "高信心误判",
    reward: "+5",
    timeline: replayMisreadTimeline,
  },
};
