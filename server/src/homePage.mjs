export function homePage() {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>图灵迷局</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #25282d;
      background: #f6f2ea;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      min-height: 100vh;
      background:
        radial-gradient(circle at 50% -120px, rgba(255, 255, 255, 0.96), rgba(246, 242, 234, 0) 360px),
        linear-gradient(180deg, #f9f5ec 0%, #eee7db 100%);
      -webkit-font-smoothing: antialiased;
    }
    button, input, select { font: inherit; }
    button { border: 0; cursor: pointer; }
    a { color: inherit; text-decoration: none; }
    #app { min-height: 100vh; }
    .screen {
      width: min(100vw, 430px);
      min-height: 100vh;
      margin: 0 auto;
      padding: 22px 16px 24px;
      background:
        radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0) 35%),
        linear-gradient(180deg, #fffdf7 0%, #f8f3eb 100%);
      color: #292d33;
      box-shadow: 0 28px 80px rgba(48, 42, 31, 0.14);
    }
    .game-screen { padding-top: 18px; padding-bottom: 218px; }
    .app-header, .home-header, .game-topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .brand-button {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 0;
      color: inherit;
      background: transparent;
      text-align: left;
    }
    .brand-title, .home-header h1 {
      font-size: 27px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0;
    }
    .brand-subtitle, .home-copy {
      margin: 0;
      color: #7a7f86;
      font-size: 14px;
      line-height: 1.42;
    }
    .icon-button {
      display: inline-flex;
      min-width: 42px;
      height: 36px;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      border: 1px solid rgba(43, 47, 54, 0.08);
      border-radius: 8px;
      color: #3b4047;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 8px 18px rgba(69, 58, 36, 0.05);
      font-weight: 800;
      white-space: nowrap;
    }
    .room-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 7px;
      color: #5d626a;
      font-size: 13px;
    }
    .room-code {
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      padding: 7px 10px;
      border: 1px solid rgba(43, 47, 54, 0.08);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.72);
    }
    .timer-panel {
      width: 118px;
      padding: 8px 10px;
      text-align: center;
      border: 1px solid rgba(43, 47, 54, 0.08);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 11px 24px rgba(87, 77, 52, 0.06);
    }
    .timer-panel span {
      display: block;
      color: #656b73;
      font-size: 12px;
      font-weight: 650;
    }
    .timer-panel strong {
      display: block;
      margin-top: 2px;
      color: #ed9700;
      font-size: 25px;
      line-height: 1;
      font-weight: 840;
    }
    .stage-rail {
      display: grid;
      grid-template-columns: repeat(var(--stage-count, 6), 1fr);
      margin: 16px 0 12px;
      position: relative;
    }
    .stage-rail::before {
      position: absolute;
      top: 15px;
      right: 28px;
      left: 28px;
      height: 2px;
      content: "";
      background: #dedbd4;
    }
    .stage-item {
      position: relative;
      z-index: 1;
      display: flex;
      min-width: 0;
      align-items: center;
      flex-direction: column;
      gap: 7px;
    }
    .stage-dot {
      display: grid;
      width: 30px;
      height: 30px;
      place-items: center;
      border-radius: 999px;
      color: #fff;
      background: #c8c8c6;
      font-size: 14px;
      font-weight: 800;
    }
    .stage-dot.active, .stage-dot.done { background: #f2a000; }
    .stage-label {
      color: #555b64;
      font-size: 13px;
      font-weight: 700;
    }
    .stage-label.active { color: #e99300; }
    .eyebrow {
      margin: 0 0 8px;
      color: #767b83;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 9px; font-size: 31px; line-height: 1.08; font-weight: 850; letter-spacing: 0; }
    h2 { margin-bottom: 9px; font-size: 23px; line-height: 1.18; font-weight: 820; letter-spacing: 0; }
    h3 { margin-bottom: 7px; font-size: 16px; line-height: 1.25; font-weight: 820; letter-spacing: 0; }
    p { color: #646a72; line-height: 1.55; }
    input, select {
      width: 100%;
      min-height: 45px;
      border: 1px solid #dad3c7;
      border-radius: 8px;
      padding: 10px 12px;
      color: #292d33;
      background: #fff;
    }
    label {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      color: #515861;
      font-size: 14px;
      line-height: 1.45;
    }
    label input { width: auto; min-height: auto; margin-top: 3px; }
    .primary-button, .secondary-button, .quiet-button, .danger-button {
      display: inline-flex;
      min-height: 46px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 8px;
      padding: 12px 16px;
      font-weight: 820;
      line-height: 1;
    }
    .primary-button { color: #fff; background: #f2a000; }
    .secondary-button { color: #fff; background: #25282d; }
    .quiet-button { color: #30343a; background: #fff; border: 1px solid #ded6ca; }
    .danger-button { color: #fff; background: #c9412b; }
    .primary-button.full, .secondary-button.full, .quiet-button.full { width: 100%; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .stack { display: grid; gap: 12px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .panel {
      border: 1px solid rgba(43, 47, 54, 0.08);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 18px 48px rgba(69, 58, 36, 0.07);
    }
    .home-header { margin-bottom: 20px; }
    .score-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      overflow: hidden;
      margin: 16px 0;
      border: 1px solid #ded6c9;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.82);
    }
    .score-strip div {
      padding: 14px 12px;
      border-right: 1px solid #ded6c9;
    }
    .score-strip div:last-child { border-right: 0; }
    .label { display: block; color: #80848b; font-size: 12px; font-weight: 800; }
    .score-strip strong { display: block; margin-top: 4px; font-size: 20px; line-height: 1; }
    .primary-panel {
      display: grid;
      gap: 16px;
      margin: 16px 0;
      padding: 18px;
      border: 1px solid #e5ddcf;
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(255, 252, 244, 0.96), rgba(255, 245, 222, 0.96)),
        #fff;
      box-shadow: 0 18px 44px rgba(82, 66, 32, 0.07);
    }
    .panel-kicker {
      margin: 0 0 8px;
      color: #737983;
      font-size: 13px;
      font-weight: 850;
    }
    .mode-list {
      overflow: hidden;
      margin-top: 16px;
      border: 1px solid #e0d8cb;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
    }
    .mode-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      width: 100%;
      padding: 15px 16px;
      border-bottom: 1px solid #ede5d8;
      color: #2c3036;
      background: transparent;
      text-align: left;
    }
    .mode-row:last-child { border-bottom: 0; }
    .mode-row.active { background: #fff5df; }
    .mode-row span { display: block; margin-top: 3px; color: #777d85; font-size: 13px; font-weight: 560; }
    .mode-pill {
      align-self: center;
      border-radius: 999px;
      padding: 6px 9px;
      color: #6f5d34;
      background: #f4ead7;
      font-size: 13px;
      font-weight: 850;
      white-space: nowrap;
    }
    .friend-room {
      display: grid;
      gap: 10px;
      margin-top: 16px;
      padding: 16px;
      border: 1px solid #e3dacd;
      border-radius: 8px;
      background: #fff;
    }
    .friend-room .join-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 66px 76px;
      gap: 8px;
    }
    .last-replay {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding: 14px 16px;
      border: 1px solid #e3dacd;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
    }
    .onboarding-screen {
      display: grid;
      align-content: center;
      min-height: 100vh;
    }
    .onboarding-panel {
      display: grid;
      gap: 18px;
      padding: 20px;
      border: 1px solid #e1d7c8;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 22px 70px rgba(52, 45, 34, 0.1);
    }
    .identity-card {
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border-radius: 8px;
      background: #fff5df;
    }
    .identity-card img {
      display: block;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      outline: 3px solid #20c5db;
    }
    .confirm-list { display: grid; gap: 11px; }
    .auth-provider-list { display: grid; gap: 10px; }
    .legal-links {
      display: flex;
      gap: 13px;
      flex-wrap: wrap;
      color: #6e737b;
      font-size: 13px;
      font-weight: 760;
    }
    .player-strip {
      display: grid;
      grid-template-columns: repeat(var(--player-count, 2), minmax(0, 1fr));
      margin: 8px 0 12px;
      padding: 8px;
      border: 1px solid rgba(43, 47, 54, 0.08);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 8px 18px rgba(50, 43, 27, 0.04);
    }
    .player-tile {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 8px;
      padding: 5px;
      border-right: 1px solid #ede8dc;
      color: inherit;
      background: transparent;
      text-align: left;
    }
    .player-tile:last-child { border-right: 0; }
    .player-tile.marked .avatar { outline: 3px solid #24c5dc; }
    .avatar-stack { position: relative; flex: 0 0 auto; }
    .avatar {
      display: block;
      width: 44px;
      height: 44px;
      object-fit: cover;
      border-radius: 50%;
      background: #e8e2d7;
    }
    .truth-avatar {
      display: grid;
      place-items: center;
      color: #241c10;
      font-weight: 900;
      background: linear-gradient(135deg, #ffe38a, #43c7dc);
    }
    .avatar-sm { width: 38px; height: 38px; }
    .avatar-ai { outline: 2px solid #24c5dc; }
    .badge-number {
      position: absolute;
      right: -6px;
      bottom: -4px;
      display: grid;
      width: 21px;
      height: 21px;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: #424950;
      font-size: 12px;
      font-weight: 850;
    }
    .player-meta { min-width: 0; }
    .player-name {
      overflow: hidden;
      color: #2f3339;
      font-size: 14px;
      font-weight: 850;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .player-role {
      margin-top: 3px;
      color: #747a82;
      font-size: 12px;
      font-weight: 700;
    }
    .player-role.ai { color: #00aeca; }
    .topic-card {
      display: grid;
      grid-template-columns: 42px 1fr auto;
      gap: 12px;
      align-items: center;
      margin: 12px 0;
      padding: 13px;
      border: 1px solid #f2b84a;
      border-radius: 8px;
      background: #fff7e7;
    }
    .topic-icon {
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border-radius: 50%;
      color: #f2a000;
      border: 2px solid #f2a000;
      font-weight: 850;
    }
    .topic-card strong { display: block; margin-bottom: 4px; }
    .topic-card p { margin: 0; font-size: 13px; }
    .topic-card button {
      color: #9a6800;
      background: transparent;
      font-weight: 850;
      white-space: nowrap;
    }
    .message-list {
      display: grid;
      gap: 14px;
      margin-top: 14px;
    }
    .message-row {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 10px;
      align-items: start;
    }
    .message-head {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 20px;
      color: #777d85;
      font-size: 13px;
    }
    .message-head strong { color: #2c3036; }
    .bubble {
      display: inline-block;
      max-width: 100%;
      margin: 4px 0 7px;
      padding: 11px 13px;
      border: 1px solid #e1d9cd;
      border-radius: 8px;
      background: #fff;
      color: #32363c;
      line-height: 1.5;
    }
    .message-row.own .bubble { background: #fff7e4; }
    .message-row.system { grid-template-columns: 1fr; }
    .message-row.system .bubble {
      display: block;
      border-color: #f2b84a;
      background: #fff7e7;
    }
    .message-tools {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .mini-button {
      min-height: 29px;
      border: 1px solid #ded6ca;
      border-radius: 8px;
      padding: 6px 10px;
      color: #555c65;
      background: #fff;
      font-size: 12px;
      font-weight: 760;
    }
    .clue {
      color: #00aeca;
      font-size: 13px;
      font-weight: 850;
    }
    .composer {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 5;
      width: min(100vw, 430px);
      margin: 0 auto;
      padding: 12px 16px 14px;
      border-top: 1px solid #e4dbce;
      background: rgba(255, 253, 247, 0.97);
      backdrop-filter: blur(16px);
    }
    .composer-row {
      display: grid;
      grid-template-columns: 1fr 46px 70px;
      gap: 8px;
    }
    .composer-row.compact {
      grid-template-columns: 1fr 46px;
    }
    .send-button {
      border-radius: 8px;
      color: #4c5560;
      background: #ede7dc;
      font-weight: 900;
    }
    .vote-button {
      border-radius: 8px;
      color: #fff;
      background: #f2a000;
      font-weight: 900;
    }
    .composer-note {
      margin: 8px 0 0;
      color: #7f858c;
      font-size: 12px;
      text-align: center;
    }
    .discussion-target {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 9px;
      padding: 9px 10px;
      border: 1px solid #ded6ca;
      border-radius: 8px;
      background: #fff;
    }
    .discussion-target strong {
      display: block;
      color: #25282d;
      font-size: 13px;
    }
    .discussion-target span {
      color: #747a82;
      font-size: 12px;
    }
    .vote-panel, .replay-panel, .room-panel {
      display: grid;
      gap: 12px;
      margin-top: 14px;
      padding: 16px;
      border: 1px solid #e1d8ca;
      border-radius: 8px;
      background: #fff;
    }
    .candidate {
      display: grid;
      grid-template-columns: 46px 1fr auto;
      gap: 10px;
      align-items: center;
      min-height: 64px;
      padding: 10px;
      border: 1px solid #e4dcd0;
      border-radius: 8px;
      background: #fff;
      color: #25282d;
      text-align: left;
    }
    .candidate.selected {
      border-color: #25c6db;
      box-shadow: 0 0 0 3px rgba(37, 198, 219, 0.16);
    }
    .vote-status {
      display: grid;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid #eadfcf;
      border-radius: 8px;
      background: #fbf4e8;
      color: #2d3137;
    }
    .vote-status span {
      color: #70757d;
      font-size: 12px;
      line-height: 1.45;
    }
    .vote-status small {
      color: #8a7455;
      font-size: 12px;
      line-height: 1.45;
    }
    .vote-evidence {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }
    .vote-evidence span {
      padding: 3px 7px;
      border-radius: 999px;
      color: #6c4d10;
      background: #fff1cb;
      font-size: 10px;
      font-weight: 820;
    }
    .vote-confirm-card {
      display: grid;
      gap: 12px;
      padding: 13px;
      border: 1px solid #f2b84a;
      border-radius: 8px;
      background: #fff7e7;
    }
    .vote-confirm-card h3,
    .vote-confirm-card p {
      margin: 0;
    }
    .vote-confirm-target {
      display: grid;
      grid-template-columns: 46px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 1px solid #e4dcd0;
      border-radius: 8px;
      background: #fff;
    }
    .vote-warning {
      color: #9a6800;
      font-size: 13px;
      font-weight: 760;
    }
    .vote-confirm-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .identity-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .identity-item {
      padding: 12px;
      border: 1px solid #e4dcd0;
      border-radius: 8px;
      background: #fffaf0;
    }
    .timeline {
      display: grid;
      gap: 0;
      margin-top: 8px;
    }
    .timeline-row {
      display: grid;
      grid-template-columns: 52px 1fr;
      gap: 10px;
      padding: 14px 0;
      border-bottom: 1px solid #ece2d6;
    }
    .timeline-row:last-child { border-bottom: 0; }
    .timeline-time {
      color: #ed9700;
      font-weight: 850;
    }
    .result-hero {
      display: grid;
      gap: 10px;
      padding: 16px;
      border: 1px solid #e1d8ca;
      border-radius: 8px;
      background: #fff7e7;
    }
    .result-hero h2 {
      margin: 0;
      font-size: 27px;
    }
    .result-hero p { margin: 0; }
    .result-hero.win { border-color: #f0b33c; }
    .result-hero.loss { border-color: #3bc2d6; background: #eefbff; }
    .settlement-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .settlement-stat {
      padding: 11px 10px;
      border: 1px solid #e4dcd0;
      border-radius: 8px;
      background: #fff;
    }
    .settlement-stat strong {
      display: block;
      margin-top: 3px;
      font-size: 18px;
      line-height: 1.1;
    }
    .reward-card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
      border: 1px solid #e4dcd0;
      border-radius: 8px;
      background: #fff;
    }
    .reward-card h3,
    .reward-card p {
      margin: 0;
    }
    .postgame-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .postgame-actions .primary-button { grid-column: 1 / -1; }
    .task-card-overlay {
      position: fixed;
      inset: 0;
      z-index: 9;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(5, 8, 14, 0.72);
      backdrop-filter: blur(14px);
    }
    .task-card-sheet {
      display: grid;
      width: min(392px, 100%);
      gap: 14px;
      padding: 18px;
      border: 1px solid #e1d8ca;
      border-radius: 8px;
      background: #fffaf0;
      color: #25282d;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.28);
    }
    .task-card-sheet h2,
    .task-card-sheet p { margin: 0; }
    .task-token {
      display: grid;
      grid-template-columns: 58px 1fr;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 1px solid #e4dcd0;
      border-radius: 8px;
      background: #fff;
    }
    .task-token .avatar {
      width: 58px;
      height: 58px;
    }
    .task-token strong {
      display: block;
      font-size: 20px;
    }
    .task-tip-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .task-tip-list li {
      padding: 9px 10px;
      border-radius: 8px;
      background: rgba(37, 40, 45, 0.06);
      font-size: 13px;
      line-height: 1.45;
    }
    .task-detail-grid {
      display: grid;
      gap: 8px;
    }
    .task-detail-row {
      display: grid;
      grid-template-columns: 68px 1fr;
      gap: 10px;
      align-items: start;
      padding: 10px;
      border-radius: 8px;
      background: rgba(37, 40, 45, 0.06);
      font-size: 13px;
      line-height: 1.45;
    }
    .task-detail-row strong {
      color: #9a6800;
      font-size: 12px;
      white-space: nowrap;
    }
    .notice {
      position: fixed;
      z-index: 10;
      right: 16px;
      bottom: 16px;
      left: 16px;
      width: min(398px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 12px 14px;
      border-radius: 999px;
      color: #fff;
      background: #25282d;
      box-shadow: 0 14px 36px rgba(37, 40, 45, 0.24);
      font-weight: 820;
      text-align: center;
    }
    .notice.error { background: #c9412b; }
    .hidden { display: none; }
    .muted { color: #757b83; }
    .dev-dock {
      position: fixed;
      top: 68px;
      right: max(10px, calc((100vw - 430px) / 2 + 10px));
      z-index: 11;
      width: 146px;
      overflow: hidden;
      border: 1px solid rgba(43, 47, 54, 0.12);
      border-radius: 8px;
      color: #25282d;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.16);
    }
    .dev-dock summary {
      min-height: 34px;
      padding: 9px 11px;
      color: #9a6800;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      list-style: none;
    }
    .dev-dock summary::-webkit-details-marker { display: none; }
    .dev-actions {
      display: grid;
      gap: 6px;
      padding: 0 8px 8px;
    }
    .dev-actions button {
      min-height: 31px;
      border: 1px solid rgba(43, 47, 54, 0.12);
      border-radius: 8px;
      color: #3b4047;
      background: rgba(255, 255, 255, 0.84);
      font-size: 12px;
      font-weight: 800;
    }
    /* 游戏式房间体验：保留现有 API，重做用户可见结构。 */
    body {
      background:
        radial-gradient(circle at 50% -140px, rgba(249, 180, 75, 0.2), transparent 330px),
        linear-gradient(180deg, #0e1422 0%, #17121d 52%, #25151a 100%);
    }
    .screen {
      width: min(100vw, 430px);
      padding: 16px 14px 26px;
      color: #f8efe2;
      background:
        linear-gradient(180deg, rgba(22, 31, 49, 0.96), rgba(24, 18, 29, 0.98)),
        #151923;
      box-shadow: 0 32px 90px rgba(0, 0, 0, 0.38);
    }
    .screen p,
    .screen .muted,
    .home-copy,
    .brand-subtitle {
      color: rgba(248, 239, 226, 0.68);
    }
    .screen h1,
    .screen h2,
    .screen h3,
    .brand-title,
    .home-header h1,
    .player-name,
    .message-head strong {
      color: #fff7e8;
    }
    .eyebrow,
    .panel-kicker,
    .label {
      color: #f1b95a;
      letter-spacing: 0;
    }
    .primary-button {
      color: #26140e;
      background: linear-gradient(180deg, #ffd56b, #e99422);
      box-shadow: 0 10px 24px rgba(227, 137, 27, 0.28);
    }
    .secondary-button {
      color: #eaf8ff;
      background: #1a8eaa;
      box-shadow: 0 10px 24px rgba(26, 142, 170, 0.2);
    }
    .quiet-button,
    .icon-button {
      color: #f8efe2;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.14);
      box-shadow: none;
    }
    .danger-button { background: #c9473c; }
    input,
    select {
      color: #fff8ec;
      background: rgba(5, 9, 16, 0.48);
      border-color: rgba(255, 255, 255, 0.14);
    }
    input::placeholder { color: rgba(248, 239, 226, 0.48); }
    .wolf-home {
      display: grid;
      align-content: start;
      gap: 14px;
      padding-bottom: calc(128px + env(safe-area-inset-bottom));
    }
    .onboarding-panel {
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
    }
    .onboarding-panel h1,
    .onboarding-panel h2,
    .onboarding-panel h3,
    .onboarding-panel strong {
      color: #fff7e8;
    }
    .onboarding-panel p,
    .onboarding-panel label {
      color: rgba(248, 239, 226, 0.76);
    }
    .identity-card {
      color: #fff7e8;
      background: rgba(255, 212, 107, 0.12);
    }
    .identity-card p {
      color: rgba(248, 239, 226, 0.7);
    }
    .legal-links {
      color: rgba(248, 239, 226, 0.7);
    }
    .wolf-hero {
      display: grid;
      gap: 16px;
      margin: -16px -14px 0;
      padding: 18px 14px 16px;
      background:
        linear-gradient(180deg, rgba(255, 210, 119, 0.1), rgba(255, 255, 255, 0)),
        rgba(4, 8, 16, 0.24);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .wolf-profile {
      display: grid;
      grid-template-columns: 52px 1fr auto;
      gap: 12px;
      align-items: center;
    }
    .wolf-profile .avatar {
      width: 52px;
      height: 52px;
      outline: 2px solid rgba(255, 214, 123, 0.86);
    }
    .wolf-profile strong {
      display: block;
      font-size: 21px;
      line-height: 1.08;
    }
    .wolf-mode-card,
    .wolf-room-card,
    .wolf-panel,
    .wolf-room-panel,
    .wolf-replay-card {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.075);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
    }
    .wolf-mode-card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      width: 100%;
      min-height: 118px;
      padding: 16px;
      color: #fff8ec;
      text-align: left;
      overflow: hidden;
    }
    .wolf-mode-card.primary {
      background:
        linear-gradient(135deg, rgba(239, 170, 55, 0.95), rgba(126, 43, 40, 0.92)),
        #7e2b28;
    }
    .wolf-mode-card.ai {
      background:
        linear-gradient(135deg, rgba(36, 145, 177, 0.86), rgba(30, 43, 82, 0.92)),
        #1e2b52;
    }
    .wolf-mode-card strong {
      display: block;
      margin-bottom: 8px;
      font-size: 22px;
      line-height: 1.08;
    }
    .wolf-mode-card span {
      display: block;
      color: rgba(255, 248, 236, 0.76);
      font-size: 13px;
      line-height: 1.45;
    }
    .wolf-mode-card .mode-meta {
      margin-top: 7px;
      color: rgba(255, 248, 236, 0.62);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .mode-token {
      align-self: start;
      min-width: 54px;
      padding: 8px 9px;
      border-radius: 8px;
      color: #2a160d;
      background: rgba(255, 218, 126, 0.92);
      font-weight: 900;
      text-align: center;
      white-space: nowrap;
    }
    .wolf-section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0 0;
    }
    .wolf-section-title h2 {
      margin: 0;
      font-size: 18px;
    }
    .wolf-room-card {
      display: grid;
      gap: 12px;
      padding: 14px;
    }
    .rule-title-row,
    .rules-sheet-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .mode-rule-card p {
      margin: 5px 0 0;
      color: rgba(248, 239, 226, 0.68);
      font-size: 13px;
      line-height: 1.45;
    }
    .rule-flow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
    }
    .rule-flow span {
      padding: 7px 9px;
      border: 1px solid rgba(255, 212, 107, 0.22);
      border-radius: 999px;
      color: #ffd46b;
      background: rgba(255, 212, 107, 0.1);
      font-size: 12px;
      font-weight: 900;
    }
    .rule-flow b {
      color: rgba(248, 239, 226, 0.46);
      font-size: 11px;
    }
    .rules-overlay {
      position: fixed;
      inset: 0;
      z-index: 8;
      display: grid;
      place-items: end center;
      padding: 14px;
      background: rgba(7, 9, 16, 0.72);
    }
    .rules-modal {
      display: grid;
      gap: 13px;
      width: min(100%, 430px);
      max-height: min(82vh, 720px);
      overflow: auto;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px 12px 8px 8px;
      background: #151827;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.36);
    }
    .rules-modal h2,
    .mode-rule-card h3 {
      margin: 0;
      color: #fff8ec;
    }
    .rules-modal > p {
      margin: 0;
      color: rgba(248, 239, 226, 0.7);
      font-size: 13px;
      line-height: 1.5;
    }
    .mode-rule-card {
      display: grid;
      gap: 10px;
      padding: 13px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .mode-rule-card ul {
      display: grid;
      gap: 7px;
      margin: 0;
      padding-left: 18px;
      color: rgba(248, 239, 226, 0.82);
      font-size: 13px;
      line-height: 1.45;
    }
    .mode-rule-card small {
      display: block;
      padding: 9px;
      border-radius: 8px;
      color: rgba(248, 239, 226, 0.7);
      background: rgba(0, 0, 0, 0.18);
      line-height: 1.4;
    }
    .mode-start-modal ul {
      display: grid;
      gap: 7px;
      margin: 0;
      padding-left: 18px;
      color: rgba(248, 239, 226, 0.84);
      font-size: 13px;
      line-height: 1.45;
    }
    .mode-brief-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .mode-brief-grid div {
      padding: 10px 9px;
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .mode-brief-grid strong {
      display: block;
      margin-top: 4px;
      color: #fff8ec;
      font-size: 18px;
      line-height: 1;
    }
    .mode-brief-grid small,
    .mode-safety-note {
      display: block;
      margin-top: 5px;
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
      line-height: 1.35;
    }
    .mode-safety-note {
      margin-top: 0;
      padding: 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.18);
    }
    .topic-choice-list {
      display: grid;
      gap: 8px;
    }
    .topic-choice {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 9px;
      align-items: start;
      min-height: 62px;
      padding: 11px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #fff8ec;
      background: rgba(255, 255, 255, 0.07);
      text-align: left;
    }
    .topic-choice.active {
      border-color: rgba(255, 212, 107, 0.72);
      background: rgba(255, 212, 107, 0.14);
    }
    .topic-choice strong {
      display: block;
      color: #fff8ec;
      font-size: 13px;
      line-height: 1.25;
    }
    .topic-choice span {
      display: block;
      margin-top: 4px;
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
      line-height: 1.35;
    }
    .mode-start-actions {
      display: grid;
      gap: 9px;
    }
    .wolf-bottom-nav {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 4;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      width: min(100vw, 430px);
      margin: 0 auto;
      padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(13, 17, 28, 0.94);
      backdrop-filter: blur(16px);
    }
    .wolf-bottom-nav button,
    .wolf-bottom-nav a {
      min-height: 44px;
      color: rgba(248, 239, 226, 0.72);
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      font-size: 12px;
      font-weight: 800;
    }
    .wolf-bottom-nav .active { color: #ffd46b; }
    .nav-icon {
      position: relative;
      display: block;
      width: 22px;
      height: 22px;
      color: currentColor;
    }
    .nav-icon-wrap {
      position: relative;
      display: grid;
      place-items: center;
      width: 28px;
      height: 24px;
    }
    .nav-badge {
      position: absolute;
      top: -4px;
      right: -5px;
      min-width: 15px;
      height: 15px;
      padding: 0 4px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(13, 17, 28, 0.92);
      border-radius: 999px;
      color: #1e1108;
      background: #ff6b61;
      font-size: 10px;
      line-height: 1;
      font-weight: 900;
    }
    .nav-icon::before,
    .nav-icon::after {
      position: absolute;
      content: "";
      box-sizing: border-box;
    }
    .nav-lobby::before {
      left: 5px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-top: 2px solid currentColor;
      border-left: 2px solid currentColor;
      transform: rotate(45deg);
    }
    .nav-lobby::after {
      left: 6px;
      top: 10px;
      width: 11px;
      height: 9px;
      border: 2px solid currentColor;
      border-top: 0;
      border-radius: 2px;
    }
    .nav-records::before {
      left: 4px;
      bottom: 4px;
      width: 4px;
      height: 8px;
      border-radius: 2px;
      background: currentColor;
      box-shadow: 7px -4px 0 currentColor, 14px -8px 0 currentColor;
    }
    .nav-records::after {
      left: 3px;
      right: 2px;
      bottom: 2px;
      height: 2px;
      border-radius: 2px;
      background: currentColor;
      opacity: 0.55;
    }
    .nav-profile::before {
      left: 8px;
      top: 4px;
      width: 7px;
      height: 7px;
      border: 2px solid currentColor;
      border-radius: 999px;
    }
    .nav-profile::after {
      left: 4px;
      top: 13px;
      width: 14px;
      height: 7px;
      border: 2px solid currentColor;
      border-radius: 999px 999px 4px 4px;
      border-bottom: 0;
    }
    .home-body {
      display: grid;
      gap: 14px;
    }
    .tab-page {
      display: grid;
      gap: 14px;
    }
    .mode-stack {
      display: grid;
      gap: 12px;
    }
    .quick-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .small-mode-card {
      display: grid;
      gap: 8px;
      min-height: 104px;
      padding: 13px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #fff8ec;
      background: rgba(255, 255, 255, 0.07);
      text-align: left;
    }
    .small-mode-card strong {
      display: block;
      font-size: 16px;
      line-height: 1.18;
    }
    .small-mode-card span {
      color: rgba(248, 239, 226, 0.66);
      font-size: 12px;
      line-height: 1.35;
    }
    .wolf-home .primary-panel {
      margin: 0;
      color: #fff8ec;
      border-color: rgba(255, 212, 107, 0.2);
      background-color: #161c2b;
      background:
        radial-gradient(circle at 88% 4%, rgba(255, 212, 107, 0.2), transparent 154px),
        linear-gradient(135deg, rgba(44, 50, 66, 0.92), rgba(22, 25, 38, 0.96));
      box-shadow: none;
    }
    .wolf-home .primary-panel h2 {
      margin: 0;
      color: #fff8ec;
      font-size: 26px;
      line-height: 1.12;
    }
    .wolf-home .primary-panel p {
      margin: 0;
      color: rgba(248, 239, 226, 0.66);
      line-height: 1.45;
    }
    .wolf-home .primary-panel .panel-kicker {
      margin-bottom: 8px;
      color: #ffd46b;
    }
    .wolf-home .primary-panel .mode-pill {
      align-self: end;
      justify-self: start;
    }
    .mission-wallet-panel {
      grid-template-columns: 1fr auto;
      align-items: end;
      min-height: 132px;
      background-color: #161c2b;
      background:
        radial-gradient(circle at 86% 10%, rgba(255, 212, 107, 0.18), transparent 146px),
        linear-gradient(135deg, rgba(45, 51, 66, 0.96), rgba(17, 21, 34, 0.98));
    }
    .mission-wallet-panel h2 {
      margin-bottom: 6px;
    }
    .wallet-claim-button {
      border: 0;
      cursor: pointer;
    }
    .mission-list {
      gap: 0;
      padding: 10px 14px;
    }
    .mission-list .progress-row {
      grid-template-columns: minmax(0, 1fr) 86px;
      align-items: start;
      gap: 12px;
      padding: 15px 0;
    }
    .mission-list .progress-row strong {
      font-size: 16px;
      line-height: 1.28;
    }
    .mission-list .progress-row span {
      display: block;
      line-height: 1.45;
    }
    .mission-list .quiet-button {
      width: 76px;
      min-height: 44px;
      padding: 0 10px;
      font-size: 13px;
      font-weight: 900;
    }
    .mission-list .progress-meter {
      width: 86px;
    }
    .cosmetic-panel {
      display: grid;
      gap: 10px;
    }
    .cosmetic-item {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 13px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .cosmetic-frame {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border: 2px solid var(--cosmetic-accent, #ffd46b);
      border-radius: 999px;
      color: var(--cosmetic-accent, #ffd46b);
      background: rgba(255, 255, 255, 0.08);
      font-size: 14px;
      font-weight: 950;
    }
    .cosmetic-item strong {
      display: block;
      color: #fff8ec;
    }
    .cosmetic-item span {
      display: block;
      margin-top: 3px;
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
      line-height: 1.4;
    }
    .cosmetic-action {
      display: grid;
      justify-items: end;
      gap: 5px;
      min-width: 82px;
    }
    .cosmetic-action small {
      color: rgba(248, 239, 226, 0.62);
      font-size: 11px;
      font-weight: 850;
    }
    .history-list {
      gap: 0;
      padding: 10px 14px;
    }
    .history-list .stack {
      gap: 10px;
    }
    .season-panel {
      display: grid;
      gap: 14px;
      padding: 16px;
      border: 1px solid rgba(255, 212, 107, 0.2);
      border-radius: 8px;
      color: #fff8ec;
      background:
        radial-gradient(circle at 88% 0%, rgba(255, 212, 107, 0.2), transparent 160px),
        radial-gradient(circle at 14% 100%, rgba(36, 145, 177, 0.22), transparent 170px),
        linear-gradient(135deg, rgba(45, 51, 66, 0.98), rgba(18, 21, 34, 0.98));
    }
    .season-rank-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .season-rank-head p {
      margin: 0 0 7px;
      color: #ffd46b;
      font-size: 12px;
      font-weight: 900;
    }
    .season-rank-head h3 {
      margin: 0;
      font-size: 28px;
      line-height: 1.08;
    }
    .season-rank-head span {
      display: block;
      margin-top: 7px;
      color: rgba(248, 239, 226, 0.68);
      font-size: 13px;
      line-height: 1.4;
    }
    .season-rank-badge {
      flex: 0 0 auto;
      padding: 9px 11px;
      border-radius: 999px;
      color: #2a160d;
      background: #ffd46b;
      font-size: 12px;
      font-weight: 950;
      white-space: nowrap;
    }
    .season-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .season-stats span {
      min-width: 0;
      padding: 10px 9px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
      color: rgba(248, 239, 226, 0.64);
      font-size: 11px;
      font-weight: 850;
    }
    .season-stats strong {
      display: block;
      margin-top: 5px;
      color: #fff8ec;
      font-size: 18px;
      line-height: 1.05;
    }
    .season-track {
      display: grid;
      grid-template-columns: 1fr 18px 1fr 18px 1fr;
      align-items: center;
      gap: 6px;
    }
    .season-track span {
      min-width: 0;
      padding: 9px 7px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: rgba(248, 239, 226, 0.7);
      background: rgba(255, 255, 255, 0.06);
      font-size: 11px;
      font-weight: 900;
      text-align: center;
    }
    .season-track span.active {
      color: #2a160d;
      border-color: transparent;
      background: #ffd46b;
    }
    .season-track b {
      color: rgba(248, 239, 226, 0.44);
      font-size: 13px;
      text-align: center;
    }
    .season-objective {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .season-objective strong {
      display: block;
      color: #fff8ec;
      line-height: 1.2;
    }
    .season-objective span {
      display: block;
      margin-top: 4px;
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
      line-height: 1.4;
    }
    .season-objective .quiet-button {
      min-height: 42px;
      padding: 0 13px;
      white-space: nowrap;
    }
    .empty-record-card {
      display: grid;
      gap: 10px;
      padding: 14px;
      border: 1px solid rgba(255, 212, 107, 0.2);
      border-radius: 8px;
      background:
        radial-gradient(circle at 90% 0%, rgba(255, 212, 107, 0.16), transparent 140px),
        rgba(255, 255, 255, 0.07);
    }
    .empty-record-card strong {
      color: #fff8ec;
      font-size: 17px;
      line-height: 1.25;
    }
    .empty-record-card span {
      color: rgba(248, 239, 226, 0.64);
      font-size: 13px;
      line-height: 1.45;
    }
    .empty-record-card .quiet-button {
      justify-self: start;
      min-height: 42px;
      padding: 0 14px;
    }
    .progress-card {
      display: grid;
      gap: 10px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .progress-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    }
    .progress-row:last-child { border-bottom: 0; }
    .progress-row strong {
      display: block;
      margin-bottom: 3px;
      color: #fff8ec;
    }
    .progress-row span {
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
    }
    .progress-meter {
      width: 84px;
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
    }
    .progress-meter.wide {
      width: 100%;
      margin-top: 10px;
    }
    .progress-meter i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #ffd46b;
    }
    .mission-action {
      display: grid;
      justify-items: end;
      gap: 6px;
      min-width: 92px;
    }
    .mission-action small {
      color: rgba(248, 239, 226, 0.7);
      font-size: 11px;
      font-weight: 800;
    }
    .record-card {
      display: grid;
      grid-template-columns: 52px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .record-card .avatar {
      width: 52px;
      height: 52px;
    }
    .record-card strong {
      display: block;
      color: #fff8ec;
    }
    .record-card span {
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
    }
    .leaderboard-row {
      grid-template-columns: 44px 1fr auto;
    }
    .leaderboard-row.rank-top {
      border-color: rgba(255, 212, 107, 0.28);
      background: rgba(255, 212, 107, 0.1);
    }
    .leaderboard-rank {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #2a160d !important;
      background: #ffd46b;
      font-size: 13px !important;
      font-weight: 950;
    }
    .profile-action-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .profile-action-card {
      display: grid;
      align-content: space-between;
      gap: 9px;
      min-height: 96px;
      padding: 13px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #fff8ec;
      background: rgba(255, 255, 255, 0.07);
      font-weight: 820;
      text-align: left;
    }
    .profile-action-card strong {
      display: block;
      font-size: 15px;
      line-height: 1.2;
    }
    .profile-action-card small {
      color: rgba(248, 239, 226, 0.56);
      font-size: 12px;
      line-height: 1.35;
    }
    .profile-action-card.danger {
      grid-column: 1 / -1;
      min-height: 64px;
      border-color: rgba(233, 92, 78, 0.34);
      background: rgba(201, 71, 60, 0.16);
    }
    .profile-action-card.danger small {
      color: rgba(255, 202, 196, 0.72);
    }
    .wolf-screen {
      min-height: 100vh;
      padding: 12px 10px 170px;
      background:
        radial-gradient(circle at 50% 190px, rgba(42, 137, 161, 0.28), transparent 210px),
        linear-gradient(180deg, #111a2b 0%, #1b1724 58%, #27171b 100%);
    }
    .wolf-topbar {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
    }
    .wolf-room-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .wolf-room-meta strong {
      overflow: hidden;
      color: #fff8ec;
      font-size: 20px;
      line-height: 1.05;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .wolf-room-meta span {
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
      font-weight: 760;
    }
    .wolf-timer {
      min-width: 72px;
      padding: 8px 9px;
      border: 1px solid rgba(255, 212, 107, 0.42);
      border-radius: 8px;
      color: #ffd46b;
      background: rgba(0, 0, 0, 0.22);
      font-weight: 900;
      text-align: center;
    }
    .wolf-timer span {
      display: block;
      margin-bottom: 2px;
      color: rgba(248, 239, 226, 0.58);
      font-size: 11px;
    }
    .wolf-timer strong {
      display: block;
      color: #ffd46b;
      font-size: 15px;
      line-height: 1.1;
    }
    .stage-rail {
      margin: 10px 0 12px;
      padding: 10px 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.055);
    }
    .stage-rail::before { background: rgba(255, 255, 255, 0.18); }
    .stage-dot {
      background: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.74);
    }
    .stage-dot.active,
    .stage-dot.done {
      color: #29160d;
      background: #ffd46b;
    }
    .stage-label { color: rgba(248, 239, 226, 0.58); }
    .stage-label.active { color: #ffd46b; }
    .wolf-arena {
      position: relative;
      display: grid;
      gap: 12px;
      min-height: 392px;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.12)),
        rgba(9, 16, 28, 0.72);
      overflow: hidden;
    }
    .seat-board {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      z-index: 1;
    }
    .seat-card {
      display: grid;
      grid-template-columns: 46px 1fr;
      gap: 8px;
      align-items: center;
      min-height: 74px;
      padding: 8px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #fff8ec;
      background: rgba(255, 255, 255, 0.075);
      text-align: left;
    }
    .seat-card.locked {
      cursor: default;
    }
    .seat-card.marked {
      border-color: #36d2e5;
      box-shadow: 0 0 0 2px rgba(54, 210, 229, 0.22);
    }
    .seat-card.current {
      border-color: rgba(255, 212, 107, 0.56);
    }
    .seat-card.empty {
      border-style: dashed;
      color: rgba(248, 239, 226, 0.72);
      background: rgba(255, 255, 255, 0.035);
    }
    .seat-card.empty .avatar {
      opacity: 0.48;
      filter: grayscale(0.4);
    }
    .seat-card.empty .seat-role {
      color: rgba(248, 239, 226, 0.48);
    }
    .waiting-screen .wolf-arena {
      min-height: 420px;
    }
    .waiting-screen .seat-board {
      align-content: start;
    }
    .waiting-hero {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
      padding: 16px;
      border: 1px solid rgba(255, 212, 107, 0.26);
      border-radius: 8px;
      background:
        radial-gradient(circle at 90% 0%, rgba(255, 212, 107, 0.18), transparent 160px),
        rgba(255, 255, 255, 0.075);
    }
    .waiting-hero h1,
    .waiting-hero p {
      margin: 0;
    }
    .waiting-ticket-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .waiting-stat-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .waiting-stat-grid div {
      min-width: 0;
      padding: 10px 9px;
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .waiting-stat-grid strong {
      display: block;
      margin-top: 4px;
      color: #fff8ec;
      font-size: 18px;
      line-height: 1;
    }
    .queue-progress {
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
    }
    .queue-progress i {
      display: block;
      width: 64%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #ffd46b, #36d2e5);
    }
    .waiting-meta-list {
      display: grid;
      gap: 8px;
    }
    .waiting-meta-list span {
      padding: 9px 10px;
      border-radius: 8px;
      color: rgba(248, 239, 226, 0.76);
      background: rgba(255, 255, 255, 0.07);
      font-size: 12px;
      font-weight: 760;
      line-height: 1.35;
    }
    .waiting-switch-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
    }
    .waiting-switch-grid .quiet-button,
    .waiting-switch-grid .secondary-button {
      width: 100%;
      min-height: 44px;
      padding: 0 10px;
      font-size: 13px;
    }
    .seat-card .avatar {
      width: 46px;
      height: 46px;
      outline: 2px solid rgba(255, 255, 255, 0.18);
    }
    .seat-card .badge-number {
      right: -4px;
      bottom: -5px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.26);
    }
    .seat-name {
      overflow: hidden;
      font-size: 14px;
      font-weight: 900;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .seat-role {
      margin-top: 3px;
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
      font-weight: 760;
    }
    .seat-role.ai { color: #36d2e5; }
    .phase-panel {
      align-self: end;
      z-index: 1;
      display: grid;
      gap: 10px;
      padding: 14px;
      border: 1px solid rgba(255, 212, 107, 0.34);
      border-radius: 8px;
      background: rgba(15, 19, 29, 0.88);
    }
    .phase-panel h1 {
      margin: 0;
      font-size: 25px;
      line-height: 1.1;
    }
    .phase-panel p {
      margin: 0;
      font-size: 13px;
    }
    .phase-callout {
      display: inline-flex;
      width: fit-content;
      max-width: 100%;
      padding: 7px 10px;
      border-radius: 8px;
      color: #25150c;
      background: #ffd46b;
      font-size: 12px;
      font-weight: 900;
    }
    .room-feed {
      display: grid;
      gap: 10px;
      margin-top: 12px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.18);
    }
    .feed-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: rgba(248, 239, 226, 0.58);
      font-size: 12px;
      font-weight: 850;
    }
    .message-list {
      max-height: 282px;
      overflow: auto;
      margin-top: 0;
      padding-right: 3px;
    }
    .message-row { grid-template-columns: 38px 1fr; }
    .message-head { color: rgba(248, 239, 226, 0.55); }
    .bubble {
      border-color: rgba(255, 255, 255, 0.12);
      color: #fff8ec;
      background: rgba(255, 255, 255, 0.08);
    }
    .message-row.own .bubble {
      color: #26140d;
      background: #ffd46b;
      border-color: transparent;
    }
    .clue { color: #36d2e5; }
    .composer,
    .action-dock {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 5;
      width: min(100vw, 430px);
      margin: 0 auto;
      padding: 12px 14px 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(13, 17, 28, 0.95);
      backdrop-filter: blur(16px);
    }
    .composer-row {
      grid-template-columns: 1fr 48px 70px;
    }
    .send-button,
    .vote-button {
      border-radius: 8px;
      font-weight: 900;
    }
    .send-button {
      color: #f8efe2;
      background: rgba(255, 255, 255, 0.12);
    }
    .vote-button {
      color: #26140e;
      background: #ffd46b;
    }
    .composer-note { color: rgba(248, 239, 226, 0.52); }
    .discussion-target {
      color: #fff8ec;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.08);
    }
    .discussion-target strong { color: #fff8ec; }
    .discussion-target span { color: rgba(248, 239, 226, 0.58); }
    .vote-panel,
    .replay-panel,
    .room-panel {
      color: #fff8ec;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.075);
    }
    .candidate {
      color: #fff8ec;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.07);
    }
    .candidate.selected {
      border-color: #36d2e5;
      box-shadow: 0 0 0 3px rgba(54, 210, 229, 0.16);
    }
    .vote-status {
      color: #fff8ec;
      border-color: rgba(255, 212, 107, 0.26);
      background: rgba(255, 212, 107, 0.1);
    }
    .vote-status span {
      color: rgba(255, 248, 236, 0.72);
    }
    .vote-status small {
      color: rgba(255, 248, 236, 0.6);
    }
    .vote-evidence span {
      color: #ffd46b;
      background: rgba(255, 212, 107, 0.14);
    }
    .vote-confirm-card {
      color: #fff8ec;
      border-color: rgba(255, 212, 107, 0.34);
      background: rgba(255, 212, 107, 0.1);
    }
    .vote-confirm-target {
      color: #fff8ec;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.07);
    }
    .vote-warning { color: #ffd46b; }
    .mode-pill {
      color: #2b170d;
      background: #ffd46b;
    }
    .identity-item {
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.07);
    }
    .result-hero {
      border-color: rgba(255, 212, 107, 0.28);
      background:
        radial-gradient(circle at 90% 0%, rgba(255, 212, 107, 0.18), transparent 160px),
        rgba(255, 255, 255, 0.08);
    }
    .result-hero.loss {
      border-color: rgba(54, 210, 229, 0.28);
      background:
        radial-gradient(circle at 90% 0%, rgba(54, 210, 229, 0.16), transparent 160px),
        rgba(255, 255, 255, 0.08);
    }
    .settlement-stat,
    .reward-card {
      color: #fff8ec;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.07);
    }
    .task-card-sheet {
      color: #fff8ec;
      border-color: rgba(255, 212, 107, 0.28);
      background:
        radial-gradient(circle at 90% 0%, rgba(255, 212, 107, 0.18), transparent 160px),
        #171c2a;
    }
    .task-token,
    .task-detail-row,
    .task-tip-list li {
      color: #fff8ec;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.08);
    }
    .task-detail-row strong { color: #ffd46b; }
    .timeline-row { border-bottom-color: rgba(255, 255, 255, 0.1); }
    .timeline-time { color: #ffd46b; }
    .notice {
      background: rgba(7, 10, 16, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.14);
    }
    .dev-dock {
      color: #f8efe2;
      border-color: rgba(255, 255, 255, 0.14);
      background: rgba(7, 10, 16, 0.9);
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.28);
    }
    .dev-dock summary { color: #ffd46b; }
    .dev-actions button {
      color: rgba(248, 239, 226, 0.86);
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.08);
    }
    .report-reason-list {
      display: grid;
      gap: 10px;
    }
    .report-reason-card {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #fff8ec;
      background: rgba(255, 255, 255, 0.08);
      text-align: left;
    }
    .report-reason-card strong {
      font-size: 15px;
    }
    .report-reason-card span {
      color: rgba(248, 239, 226, 0.62);
      font-size: 12px;
    }
    @media (max-width: 380px) {
      .screen { padding-right: 12px; padding-left: 12px; }
      .brand-title, .home-header h1 { font-size: 25px; }
      .score-strip strong { font-size: 18px; }
      .composer-row { grid-template-columns: 1fr 44px 62px; }
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="notice" class="notice hidden"></div>
  <script>
    const tokenKey = "mirage-session-token";
    const app = document.querySelector("#app");
    const notice = document.querySelector("#notice");
    const localDebug = new URLSearchParams(location.search).has("debug");
      const stageNames = ["任务卡", "开聊", "陈述", "归票", "揭晓", "复盘"];
    const state = {
      route: "boot",
      token: sessionStorage.getItem(tokenKey) || "",
      user: null,
      summary: null,
      gameHistory: [],
      leaderboard: null,
      commerceCatalog: null,
      modes: [],
      worldSetting: null,
      topics: [],
      homeTab: "lobby",
      game: null,
      room: null,
      copiedInviteCode: "",
      copyInviteNeedsManual: false,
      showGameRules: false,
      selectedModeId: "",
      selectedTopicId: "",
      ticketId: null,
      waitingModeId: "",
      waitingTopicId: "",
      waitingStartedAt: "",
      seenTaskCards: {},
      reviewingTaskGameId: "",
      selectedDiscussionTargetId: "",
      selectedVoteTargetId: "",
      lastDiscussionTargetId: "",
      confirmingVote: false,
      pendingReportTarget: "",
      pendingReportBlock: false,
      clockRefreshing: false,
      rematchRefreshing: false,
      lastRematchRefreshAt: 0,
      pollTimer: null
    };

    function h(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }

    function percentText(value) {
      return typeof value === "number" ? Math.round(value * 100) + "%" : "0%";
    }

    function progressWidth(value) {
      return Math.max(0, Math.min(100, Math.round(Number(value || 0) * 100)));
    }

    function durationText(seconds) {
      const total = Number(seconds || 0);
      if (total >= 60) return Math.round(total / 60) + " 分";
      return total + " 秒";
    }

    function elapsedSecondsSince(value) {
      const startedAt = value ? Date.parse(value) : NaN;
      if (!Number.isFinite(startedAt)) return 0;
      return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    }

    function elapsedText(seconds) {
      const total = Math.max(0, Number(seconds || 0));
      if (total >= 60) return Math.floor(total / 60) + " 分 " + String(total % 60).padStart(2, "0") + " 秒";
      return total + " 秒";
    }

    function showNotice(message, type) {
      notice.textContent = message;
      notice.className = "notice" + (type === "error" ? " error" : "");
      window.clearTimeout(showNotice.timer);
      showNotice.timer = window.setTimeout(() => {
        notice.className = "notice hidden";
      }, 3200);
    }

    function playerErrorMessage(message) {
      if (message === "message_blocked:privacy_or_contact_info") return "这条内容不能发送。不要分享联系方式、地址、学校或支付信息。";
      if (message === "message_blocked:harassment") return "这条内容不能发送。请围绕推理发言，不要攻击其他玩家。";
      if (message === "message_blocked:violent_threat") return "这条内容不能发送。暴力威胁会被拦截并记录。";
      if (message === "message_blocked:self_harm_risk") return "这条内容不能发送。如果你或他人正处于危险，请立即联系当地紧急服务或可信赖的人。";
      if (message === "message_blocked:adult_content") return "这条内容不能发送。游戏房间不允许成人或性骚扰内容。";
      if (message === "message_blocked:scam_or_spam") return "这条内容不能发送。不要发布广告、引流、交易或诈骗信息。";
      return message || "操作失败";
    }

    async function api(path, options = {}) {
      const headers = { "Content-Type": "application/json" };
      if (options.auth !== false && state.token) headers.Authorization = "Bearer " + state.token;
      const response = await fetch(path, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || response.statusText || "request_failed");
      return json;
    }

    async function bootstrap() {
      try {
        const [modes, topics] = await Promise.all([
          api("/modes", { auth: false }),
          api("/topics", { auth: false })
        ]);
        state.modes = modes.modes || [];
        state.worldSetting = modes.worldSetting || null;
        state.topics = topics.topics || [];
        if (state.token) {
          try {
            const me = await api("/me");
            state.user = me.user;
            await loadHomeData();
            state.route = "home";
            applyShareLandingIntent();
          } catch {
            state.token = "";
            state.summary = null;
            state.gameHistory = [];
            state.leaderboard = null;
            state.commerceCatalog = null;
            sessionStorage.removeItem(tokenKey);
            state.route = "onboarding";
          }
        } else {
          state.route = "onboarding";
        }
      } catch (error) {
        state.route = "error";
        showNotice(error.message, "error");
      }
      render();
    }

    async function loadSummary() {
      if (!state.token) return;
      try {
        const data = await api("/me/summary");
        state.summary = data.summary || null;
      } catch {
        state.summary = null;
      }
    }

    async function loadHistory() {
      if (!state.token) return;
      try {
        const data = await api("/me/games");
        state.gameHistory = data.games || [];
      } catch {
        state.gameHistory = [];
      }
    }

    async function loadLeaderboard() {
      if (!state.token) return;
      try {
        const data = await api("/leaderboard");
        state.leaderboard = data.leaderboard || null;
      } catch {
        state.leaderboard = null;
      }
    }

    async function loadCommerceCatalog() {
      if (!state.token) return;
      try {
        const data = await api("/commerce/catalog");
        state.commerceCatalog = data.catalog || null;
      } catch {
        state.commerceCatalog = null;
      }
    }

    async function loadHomeData() {
      await Promise.all([loadSummary(), loadHistory(), loadLeaderboard(), loadCommerceCatalog()]);
    }

    async function claimMission(missionId) {
      const mission = state.summary?.missions?.items?.find((item) => item.id === missionId);
      const previousProgression = state.summary?.progression;
      const data = await api("/me/missions/" + encodeURIComponent(missionId) + "/claim", { method: "POST" });
      state.summary = data.summary || state.summary;
      await loadLeaderboard();
      showNotice(rewardResultText(previousProgression, state.summary?.progression, rewardClaimText(mission)));
      render();
    }

    async function claimAllMissions() {
      const missions = Array.isArray(state.summary?.missions?.items) ? state.summary.missions.items : [];
      const claimableMissions = missions.filter((item) => item.claimable && !item.claimed);
      if (!claimableMissions.length) {
        showNotice("暂无可领取奖励");
        return;
      }
      const totalReward = missionRewardTotals(claimableMissions);
      const previousProgression = state.summary?.progression;
      const data = await api("/me/missions/claim-all", { method: "POST" });
      state.summary = data.summary || state.summary;
      await loadLeaderboard();
      showNotice(rewardResultText(previousProgression, state.summary?.progression, rewardClaimText(totalReward)));
      render();
    }

    async function unlockCosmetic(itemId) {
      const data = await api("/me/cosmetics/" + encodeURIComponent(itemId) + "/unlock", { method: "POST" });
      state.summary = data.summary || state.summary;
      await loadLeaderboard();
      const item = state.summary?.cosmetics?.items?.find((entry) => entry.id === itemId);
      showNotice(item ? "已解锁并装备：" + item.name : "装扮已解锁");
      render();
    }

    async function equipCosmetic(itemId) {
      const data = await api("/me/cosmetics/" + encodeURIComponent(itemId) + "/equip", { method: "POST" });
      state.summary = data.summary || state.summary;
      const item = state.summary?.cosmetics?.items?.find((entry) => entry.id === itemId);
      showNotice(item ? "已装备：" + item.name : "装扮已装备");
      render();
    }

    function rewardClaimText(mission) {
      const reward = mission?.reward || mission || {};
      const clueStars = Number(reward.clueStars || 0);
      const xp = Number(reward.xp || 0);
      if (!clueStars && !xp) return "任务奖励已领取";
      return "领取成功：推理星 +" + clueStars + " · 经验 +" + xp;
    }

    function rewardResultText(previousProgression, nextProgression, fallbackText) {
      if (!nextProgression) return fallbackText;
      const previousLevel = Number(previousProgression?.level || nextProgression.level || 1);
      const nextLevel = Number(nextProgression.level || 1);
      const previousTitle = previousProgression?.title || nextProgression.title || "";
      const nextTitle = nextProgression.title || "新手侦探";
      if (nextLevel > previousLevel || nextTitle !== previousTitle) {
        return "称号升级：Lv." + nextLevel + " " + nextTitle;
      }
      return fallbackText;
    }

    function missionRewardTotals(missions) {
      return (missions || []).reduce((total, mission) => {
        const reward = mission?.reward || {};
        total.clueStars += Number(reward.clueStars || 0);
        total.xp += Number(reward.xp || 0);
        return total;
      }, { clueStars: 0, xp: 0 });
    }

    function currentScreenClass() {
      return state.route === "game" ? "screen game-screen wolf-screen" : "screen";
    }

    function render() {
      if (state.route === "boot") {
        app.innerHTML = '<main class="screen"><p class="muted">正在入场...</p></main>';
        return;
      }
      if (state.route === "error") {
        app.innerHTML = '<main class="screen stack"><h1>连接失败</h1><p>暂时进不了房间，请稍后再试。</p><button class="primary-button full" data-action="retry">重试</button></main>';
        return;
      }
      if (state.route === "onboarding") return renderOnboarding();
      if (state.route === "home") return renderHome();
      if (state.route === "waiting") return renderWaiting();
      if (state.route === "room") return renderRoom();
      if (state.route === "game") return renderGame();
    }

    function renderOnboarding() {
      app.innerHTML = '<main class="screen onboarding-screen">' +
        '<section class="onboarding-panel">' +
          '<div><p class="eyebrow">图灵迷局</p><h1>开局，揪出伪装者</h1><p>每局都有伪装者混在席位里。听发言、抓破绽，最后把最可疑的人投出去。</p></div>' +
          '<div class="identity-card"><img src="/preview-assets/avatar-ai.png" alt="AI 玩家头像" /><div><strong>伪装者</strong><p>它会跟着话题发言，尽量撑到投票后不被抓出。</p></div></div>' +
          '<input id="nickname" placeholder="昵称" value="玩家" autocomplete="nickname" />' +
          '<div class="confirm-list">' +
            '<label><input id="ageConfirmed" type="checkbox" /> <span>我已确认年龄要求。</span></label>' +
            '<label><input id="communityConfirmed" type="checkbox" /> <span>不爆真实信息，不扰局。</span></label>' +
          '</div>' +
          '<div class="auth-provider-list" aria-label="固定账号登录">' +
            '<button id="appleLoginButton" class="primary-button full" data-action="mock-apple-login" disabled>Apple 登录</button>' +
            '<button id="wechatLoginButton" class="secondary-button full" data-action="mock-wechat-login" disabled>微信登录</button>' +
            '<button id="googleLoginButton" class="secondary-button full" data-action="mock-google-login" disabled>Google 登录</button>' +
          '</div>' +
          '<div class="legal-links"><a href="/legal/privacy">隐私政策</a><a href="/legal/terms">服务条款</a><a href="/legal/community">社区规范</a></div>' +
        '</section>' +
      '</main>';
      updateOnboardingEntryState();
    }

    function renderHome() {
      const tab = normalizedHomeTab(state.homeTab || "lobby");
      const summary = state.summary;
      const progression = summary?.progression;
      const profileSubtitle = state.user?.nickname
        ? state.user.nickname + (progression ? " · Lv." + progression.level + " " + progression.title : "，今晚上桌")
        : (progression ? "Lv." + progression.level + " " + progression.title : "今晚上桌");
      app.innerHTML = '<main class="screen wolf-home">' +
        '<section class="wolf-hero">' +
          '<header class="wolf-profile"><img class="avatar" src="/preview-assets/avatar-you.png" alt="玩家头像" /><div><strong>图灵迷局</strong><span>' + h(profileSubtitle) + '</span></div><button class="icon-button" data-action="logout" aria-label="退出">退出</button></header>' +
        '</section>' +
        renderSafetyBanner() +
        '<section class="home-body">' + renderActiveGameBanner() + renderHomeContent(tab) + '</section>' +
        renderHomeNav(tab) +
        renderModeStartModal() +
      '</main>';
    }

    function renderHomeContent(tab) {
      if (tab === "records") return renderRecordsHome();
      if (tab === "profile") return renderProfileHome();
      return renderLobbyHome();
    }

    function normalizedHomeTab(tab) {
      if (tab === "leaderboard") return "records";
      if (tab === "missions") return "profile";
      return ["lobby", "records", "profile"].includes(tab) ? tab : "lobby";
    }

    function renderActiveGameBanner() {
      if (state.user?.bannedAt) return "";
      const activeGame = (state.gameHistory || []).find((item) => item.phase !== "COMPLETED");
      if (!activeGame) return "";
      return '<button class="wolf-mode-card primary" data-action="open-history-game" data-game="' + h(activeGame.gameId) + '">' +
        '<span><strong>继续上一局</strong><span>' + h(phaseTitle(activeGame.phase)) + ' · ' + h(activeGame.topicTitle) + '</span></span><b class="mode-token">继续</b>' +
      '</button>';
    }

    // 大厅显示全部模式，都走"快速开始"：单人点开即玩，缺的席位由 AI/脚本补位。
    // 好友房联机（建房、邀请码、凑真人）暂不开发。
    function renderLobbyHome() {
      const modeCards = (state.modes || []).map((mode, index) =>
        '<button class="wolf-mode-card ' + (index % 2 === 0 ? "primary" : "ai") + '" data-action="show-mode" data-mode="' + h(mode.id) + '">' +
          '<span><strong>' + h(mode.name) + '</strong><span>' + h(lobbyModeSubtitle(mode)) + '</span><span class="mode-meta">' + h(modeMetaLine(mode)) + '</span></span>' +
          '<b class="mode-token">' + h(mode.playerCount) + ' 人</b>' +
        '</button>'
      ).join("");
      return '<section class="tab-page">' +
        '<section class="wolf-section-title"><h2>选择模式</h2><span class="mode-pill">点开即玩</span></section>' +
        modeCards +
      '</section>';
    }

    function modeDifficultyTitle(mode) {
      const value = Number(mode?.difficulty || 1);
      if (value >= 3) return "高阶";
      if (value === 2) return "进阶";
      return "入门";
    }

    function modeMetaLine(mode) {
      return modeDifficultyTitle(mode) + " · 约 " + durationText(Number(mode.discussionSeconds || 0) + Number(mode.votingSeconds || 0)) + " · 混入 " + Number(mode.aiCount || 1) + " 名 AI";
    }

    function lobbyModeSubtitle(mode) {
      return mode.tagline || mode.intro || "同一张圆桌，找出伪装成真人的 AI。";
    }


    function renderRuleFlow(flow) {
      const steps = Array.isArray(flow) && flow.length ? flow : stageNames;
      return '<div class="rule-flow">' + steps.map((step, index) =>
        '<span>' + h(flowStepTitle(step)) + '</span>' + (index < steps.length - 1 ? '<b>›</b>' : "")
      ).join("") + '</div>';
    }

    function flowStepTitle(step) {
      if (step === "讨论发言") return "开聊";
      if (step === "投票归票") return "归票";
      if (step === "身份揭晓") return "揭晓";
      if (step === "成员准备") return "准备";
      if (step === "创建房间") return "开房";
      return step;
    }

    function renderGameRulesModal(game) {
      if (!state.showGameRules || !game) return "";
      const mode = modeById(game.modeId) || { id: game.modeId, name: game.modeId, intro: "本局玩法加载中。", flow: stageNames, rules: [], matchType: game.roomId ? "friend_room" : "public" };
      return '<section class="rules-overlay" role="dialog" aria-modal="true" aria-label="本局玩法">' +
        '<section class="rules-modal">' +
          '<header class="rules-sheet-head"><div><h2>本局玩法</h2><p>' + h(game.topic?.title || "围绕话题聊天，抓出伪装者。") + '</p></div><button class="icon-button" data-action="close-game-rules" aria-label="关闭">关闭</button></header>' +
          renderModeRuleCard(mode) +
        '</section>' +
      '</section>';
    }

    function renderModeRuleCard(mode) {
      const rules = Array.isArray(mode.rules) && mode.rules.length ? mode.rules : [mode.intro].filter(Boolean);
      const matchType = mode.matchType === "friend_room" ? "好友房" : "公开匹配";
      return '<section class="mode-rule-card">' +
        '<div class="rule-title-row"><div><h3>' + h(mode.name) + '</h3><p>' + h(mode.goal || mode.intro) + '</p></div><span class="mode-pill">' + h(matchType) + '</span></div>' +
        renderRuleFlow(mode.flow) +
        '<ul>' + rules.map((rule) => '<li>' + h(rule) + '</li>').join("") + '</ul>' +
        '<small>' + h(mode.safety || "收局后可处理扰局玩家。") + '</small>' +
      '</section>';
    }

    function modeById(modeId) {
      return (state.modes || []).find((mode) => mode.id === modeId) || null;
    }

    function topicsForMode(modeId) {
      return (state.topics || []).filter((topic) => {
        const modeIds = Array.isArray(topic.modeIds) ? topic.modeIds : [];
        return topic.enabled !== false && (!modeIds.length || modeIds.includes(modeId));
      });
    }

    function topicById(topicId) {
      return (state.topics || []).find((topic) => topic.id === topicId) || null;
    }

    function selectedTopicForMode(modeId) {
      const available = topicsForMode(modeId);
      return available.find((topic) => topic.id === state.selectedTopicId) || available[0] || null;
    }

    function ensureSelectedTopic(modeId) {
      const topic = selectedTopicForMode(modeId);
      state.selectedTopicId = topic?.id || "";
      return topic;
    }

    function renderTopicPicker(mode, selectedTopicId, actionName) {
      const available = topicsForMode(mode.id);
      if (!available.length) {
        return '<section class="mode-rule-card"><h3>本局话题</h3><p>这局暂时没有可选话题。</p></section>';
      }
      return '<section class="mode-rule-card"><h3>本局话题</h3><p>选一题，上桌就开聊。</p><div class="topic-choice-list">' +
        available.map((topic) => '<button class="topic-choice' + (topic.id === selectedTopicId ? " active" : "") + '" data-action="' + h(actionName) + '" data-topic="' + h(topic.id) + '" data-mode="' + h(mode.id) + '"><span><strong>' + h(topic.title) + '</strong><span>' + h(topic.category) + ' · ' + h(topicRiskTitle(topic.risk)) + '</span></span><b class="mode-pill">' + h(topic.id === selectedTopicId ? "已选" : "选择") + '</b></button>').join("") +
      '</div></section>';
    }

    function renderModeStartModal() {
      if (!state.selectedModeId) return "";
      const mode = modeById(state.selectedModeId);
      if (!mode) return "";
      const selectedTopic = ensureSelectedTopic(mode.id);
      const rules = Array.isArray(mode.rules) && mode.rules.length ? mode.rules : [mode.intro].filter(Boolean);
      const aiCaption = mode.id === "M01" ? "真假未知" : "AI " + mode.aiCount;
      const voteCaption = mode.id === "M01" ? "判真假" : "抓伪装者";
      const soloFillNote = Number(mode.minHumanCount || 1) > 1 ? "缺的席位由 AI 和脚本玩家补齐，可单人开局。" : "";
      return '<section class="rules-overlay" role="dialog" aria-modal="true" aria-label="模式详情">' +
        '<section class="rules-modal mode-start-modal">' +
          '<header class="rules-sheet-head"><div><p class="eyebrow">' + h(modeDifficultyTitle(mode)) + '局</p><h2>' + h(mode.name) + '</h2><p>' + h(mode.goal || mode.intro) + '</p></div><button class="icon-button" data-action="close-mode" aria-label="关闭">关闭</button></header>' +
          '<section class="mode-brief-grid"><div><span class="label">人数</span><strong>' + h(mode.playerCount) + '</strong><small>' + h(aiCaption) + '</small></div><div><span class="label">讨论</span><strong>' + h(durationText(mode.discussionSeconds)) + '</strong><small>限时发言</small></div><div><span class="label">投票</span><strong>' + h(durationText(mode.votingSeconds)) + '</strong><small>' + h(voteCaption) + '</small></div></section>' +
          renderRuleFlow(mode.flow) +
          renderTopicPicker(mode, selectedTopic?.id || "", "select-topic") +
          '<ul>' + rules.map((rule) => '<li>' + h(rule) + '</li>').join("") + '</ul>' +
          (soloFillNote ? '<small class="mode-safety-note">' + h(soloFillNote) + '</small>' : "") +
          '<small class="mode-safety-note">' + h(mode.safety || "收局后可处理扰局玩家。") + '</small>' +
          '<div class="mode-start-actions"><button class="primary-button full" data-action="confirm-mode" data-mode="' + h(mode.id) + '">开始对局</button><button class="quiet-button full" data-action="close-mode">再看看</button></div>' +
        '</section>' +
      '</section>';
    }

    function renderRecordsHome() {
      const summary = state.summary;
      const recent = summary?.recent;
      const recentTitle = recent ? (recent.winner === "human" ? "最近一局：判断正确" : "最近一局：AI 获胜") : "暂无战绩";
      const recentSubtitle = recent ? recent.topicTitle + " · " + (recent.replayReady ? "复盘已整理" : "复盘整理中") : "还没有最近战况。";
      const recentAction = recent
        ? 'data-action="replay-again" data-mode="' + h(recent.modeId || "M01") + '"'
        : 'data-action="show-mode" data-mode="M01"';
      const recentActionTitle = recent ? "同模式再试" : "开一局";
      return '<section class="tab-page">' +
        '<section class="wolf-section-title"><h2>战绩</h2><span class="mode-pill">赛季</span></section>' +
        renderSeasonPanel() +
        '<section class="record-card"><img class="avatar" src="/preview-assets/avatar-ai.png" alt="AI 对手头像" /><div><strong>' + h(recentTitle) + '</strong><span>' + h(recentSubtitle) + '</span></div><button class="quiet-button" ' + recentAction + '>' + h(recentActionTitle) + '</button></section>' +
        '<section class="progress-card"><div class="progress-row"><div><strong>识别胜率</strong><span>已完成 ' + h(summary?.stats?.completedGames || 0) + ' 局，胜利 ' + h(summary?.stats?.wins || 0) + ' 局</span></div><div class="progress-meter"><i style="width: ' + progressWidth(summary?.stats?.winRate) + '%"></i></div></div><div class="progress-row"><div><strong>复盘局数</strong><span>' + h(summary?.stats?.replayReady || 0) + ' 局可回看复盘</span></div><div class="progress-meter"><i style="width: ' + progressWidth(summary?.stats?.replayReadyRate) + '%"></i></div></div></section>' +
        renderHistoryList() +
        renderLeaderboardPanel() +
      '</section>';
    }

    function renderSeasonPanel() {
      const summary = state.summary || {};
      const progression = summary.progression || {};
      const stats = summary.stats || {};
      const xp = Number(progression.xp || 0);
      const nextLevelXp = Number(progression.nextLevelXp || 50);
      const remainingXp = Math.max(0, nextLevelXp - xp);
      const rankTitle = "Lv." + h(progression.level || 1) + " " + h(progression.title || "新手侦探");
      const nextTitle = progression.nextTitle || "见习预言家";
      const rankSubtitle = remainingXp > 0
        ? "距离 " + h(nextTitle) + " 还差 " + h(remainingXp) + " XP"
        : "当前段位进度已拉满";
      return '<section class="season-panel">' +
        '<div class="season-rank-head"><div><p>S1 推理赛季</p><h3>' + rankTitle + '</h3><span>' + rankSubtitle + '</span></div><b class="season-rank-badge">XP ' + h(xp) + '</b></div>' +
        '<div class="progress-meter wide"><i style="width: ' + progressWidth(progression.progress) + '%"></i></div>' +
        '<div class="season-stats"><span>胜率<strong>' + h(percentText(stats.winRate)) + '</strong></span><span>完赛<strong>' + h(stats.completedGames || 0) + '</strong></span><span>复盘<strong>' + h(percentText(stats.replayReadyRate)) + '</strong></span></div>' +
        renderSeasonTrack(progression) +
        renderSeasonObjective(summary) +
      '</section>';
    }

    function renderSeasonTrack(progression) {
      const currentTitle = progression?.title || "新手侦探";
      const nextTitle = progression?.nextTitle || "见习预言家";
      const finalTitle = "AI 克星";
      const middleTitle = nextTitle === currentTitle ? "高阶侦探" : nextTitle;
      return '<div class="season-track"><span class="active">' + h(currentTitle) + '</span><b>›</b><span>' + h(middleTitle) + '</span><b>›</b><span>' + h(finalTitle) + '</span></div>';
    }

    function renderSeasonObjective(summary) {
      const missions = Array.isArray(summary?.missions?.items) ? summary.missions.items : [];
      const hasClaimableMission = missions.some((item) => item.claimable && !item.claimed);
      if (hasClaimableMission) {
        return '<div class="season-objective"><div><strong>今日段位奖励待领取</strong><span>先把悬赏奖励拿到手，经验会推进等级称号。</span></div><button class="quiet-button" data-action="go-missions">去领取</button></div>';
      }
      if (summary?.recent) {
        return '<div class="season-objective"><div><strong>继续冲榜</strong><span>复用上一局模式，保持判断手感。</span></div><button class="quiet-button" data-action="replay-again" data-mode="' + h(summary.recent.modeId || "M01") + '">再来一局</button></div>';
      }
      return '<div class="season-objective"><div><strong>今晚首局</strong><span>完成一局后解锁战绩、复盘和今日悬赏。</span></div><button class="quiet-button" data-action="show-mode" data-mode="M01">快速上桌</button></div>';
    }

    function renderHistoryList() {
      const games = state.gameHistory || [];
      const content = games.length
        ? games.map((item) => {
            const title = item.phase === "COMPLETED"
              ? (item.winner === "human" ? "判断正确 · " + modeDisplayTitle(item.modeId) : "AI 获胜 · " + modeDisplayTitle(item.modeId))
              : "进行中 · " + phaseTitle(item.phase);
            const action = item.phase === "COMPLETED" ? (item.replayReady ? "看复盘" : "查看") : "继续";
            return '<button class="record-card" data-action="open-history-game" data-game="' + h(item.gameId) + '"><img class="avatar" src="' + h(item.winner === "human" ? "/preview-assets/avatar-you.png" : "/preview-assets/avatar-ai.png") + '" alt="对局头像" /><div><strong>' + h(title) + '</strong><span>' + h(item.topicTitle) + ' · ' + h(item.playerCount) + ' 人局 · ' + h(timeLabel(item.updatedAt)) + '</span></div><span class="mode-pill">' + h(action) + '</span></button>';
          }).join("")
        : '<section class="empty-record-card"><strong>今晚还没上桌</strong><span>打一局后，这里会保存结果和关键线索。</span><button class="quiet-button" data-action="show-mode" data-mode="M01">快速上桌</button></section>';
      return '<section class="progress-card history-list"><div class="progress-row"><div><strong>最近对局</strong><span>' + h(games.length) + ' 局可查看</span></div><span class="mode-pill">历史</span></div><div class="stack">' + content + '</div></section>';
    }

    function renderLeaderboardHome() {
      return renderRecordsHome();
    }

    function leaderboardUnlocked(summary = state.summary) {
      return Number(summary?.stats?.completedGames || 0) >= 3;
    }

    function renderLeaderboardLockedCard(summary = state.summary) {
      const completed = Number(summary?.stats?.completedGames || 0);
      const remaining = Math.max(0, 3 - completed);
      return '<section class="progress-card leaderboard-locked">' +
        '<div class="progress-row"><div><strong>排行榜 3 局后解锁</strong><span>先完成 3 局，熟悉任务卡、发言和归票后再看排名。</span></div><span class="mode-pill">还差 ' + h(remaining) + ' 局</span></div>' +
        '<button class="quiet-button full" data-action="show-mode" data-mode="M01">继续开局</button>' +
      '</section>';
    }

    function renderLeaderboardPanel() {
      if (!leaderboardUnlocked()) return renderLeaderboardLockedCard();
      const leaderboard = state.leaderboard || {};
      const myRank = leaderboard.myRank;
      const topRows = Array.isArray(leaderboard.top) ? leaderboard.top.slice(0, 3) : [];
      const aroundRows = Array.isArray(leaderboard.aroundMe) ? leaderboard.aroundMe : [];
      const topContent = topRows.length
        ? topRows.map(renderLeaderboardRow).join("")
        : '<section class="empty-record-card"><strong>还没有榜单</strong><span>完成一局后，S1 推理赛季会开始计分。</span><button class="quiet-button" data-action="show-mode" data-mode="M01">快速上桌</button></section>';
      const aroundContent = aroundRows.length
        ? aroundRows.map(renderLeaderboardRow).join("")
        : '<div class="progress-row"><div><strong>附近名次待解锁</strong><span>打一局，拿经验和复盘分。</span></div><button class="quiet-button" data-action="show-mode" data-mode="M01">开局</button></div>';
      return '<section class="leaderboard-embed">' +
        '<section class="wolf-section-title"><h2>排行榜</h2><span class="mode-pill">战绩内</span></section>' +
        '<section class="season-panel leaderboard-hero"><div class="season-rank-head"><div><p>' + h(leaderboard.season?.title || "S1 推理赛季") + '</p><h3>' + h(myRank ? "第 " + myRank.rank + " 名" : "未入榜") + '</h3><span>' + h(myRank ? myRank.title + " · " + myRank.score + " 分" : "完成一局后进入赛季榜") + '</span></div><b class="season-rank-badge">' + h(myRank ? "XP " + myRank.xp : "开局") + '</b></div><p class="muted">' + h(leaderboard.season?.rule || "按经验、胜场、复盘局数综合排序") + '</p><div class="season-stats"><span>在榜<strong>' + h(leaderboard.totalPlayers || 0) + '</strong></span><span>我的胜率<strong>' + h(percentText(myRank?.winRate)) + '</strong></span><span>复盘<strong>' + h(myRank?.replayReady || 0) + '</strong></span></div></section>' +
        '<section class="progress-card leaderboard-list"><div class="progress-row"><div><strong>榜首席位</strong><span>本赛季前三玩家</span></div><span class="mode-pill">Top 3</span></div><div class="stack">' + topContent + '</div></section>' +
        '<section class="progress-card leaderboard-list"><div class="progress-row"><div><strong>我的附近</strong><span>看清下一个要追上的位置</span></div><span class="mode-pill">附近</span></div><div class="stack">' + aroundContent + '</div></section>' +
      '</section>';
    }

    function renderLeaderboardRow(row) {
      const rankClass = row.rank <= 3 ? " rank-top" : "";
      return '<div class="record-card leaderboard-row' + rankClass + '">' +
        '<span class="leaderboard-rank">#' + h(row.rank) + '</span>' +
        '<div><strong>' + h(row.nickname || "玩家") + (row.isCurrentUser ? " · 我" : "") + '</strong><span>Lv.' + h(row.level || 1) + ' ' + h(row.title || "新手侦探") + ' · 胜率 ' + h(percentText(row.winRate)) + ' · 完赛 ' + h(row.completedGames || 0) + '</span></div>' +
        '<span class="mode-pill">' + h(row.score || 0) + ' 分</span>' +
      '</div>';
    }

    function renderMissionsHome() {
      return renderProfileHome();
    }

    function renderMissionRewardsPanel() {
      const missions = state.summary?.missions || {};
      const wallet = state.summary?.wallet || {};
      const missionItems = Array.isArray(missions.items) ? missions.items : [];
      const quickDone = missions.quickStartCompletedToday === true;
      const replayDone = missions.replayReadyToday === true;
      const winDone = missions.winCompletedToday === true;
      const claimableMissions = missionItems.filter((item) => item.claimable && !item.claimed);
      const rewardAction = claimableMissions.length
        ? '<button class="mode-pill wallet-claim-button" data-action="claim-all-missions">一键领取</button>'
        : '<span class="mode-pill">今日奖励</span>';
      const missionContent = missionItems.length
        ? missionItems.map(renderMissionItem).join("")
        : '<div class="progress-row"><div><strong>完成 1 局快速开始</strong><span>奖励：推理星 +20</span></div><button class="quiet-button" data-action="start-mode" data-mode="M01"' + (quickDone ? " disabled" : "") + '>' + h(quickDone ? "已完成" : "开始") + '</button></div><div class="progress-row"><div><strong>看 1 次复盘</strong><span>奖励：推理星 +30</span></div><div class="progress-meter"><i style="width: ' + (replayDone ? 100 : 0) + '%"></i></div></div><div class="progress-row"><div><strong>赢下 1 局</strong><span>奖励：推理星 +40</span></div><div class="progress-meter"><i style="width: ' + (winDone ? 100 : 0) + '%"></i></div></div>';
      return '<section class="mission-lobby-block">' +
        '<section class="wolf-section-title"><h2>今日悬赏</h2><span class="mode-pill">奖励</span></section>' +
        '<section class="primary-panel mission-wallet-panel"><div><p class="panel-kicker">背包</p><h2>' + h(wallet.clueStars || 0) + ' 推理星</h2><p>经验 ' + h(wallet.xp || 0) + '，完成悬赏后升级称号。</p></div>' + rewardAction + '</section>' +
        '<section class="progress-card mission-list">' + missionContent + '</section>' +
        '<section class="wolf-room-card"><h3>今日悬赏</h3><p>打一局、看复盘、赢一局，拿推理星。</p></section>' +
      '</section>';
    }

    function renderCosmeticsPanel() {
      const cosmetics = state.summary?.cosmetics;
      const items = Array.isArray(cosmetics?.items) ? cosmetics.items : [];
      if (!items.length) return "";
      return '<section class="cosmetic-panel"><section class="wolf-section-title"><h2>背包装扮</h2><span class="mode-pill">' + h(cosmetics.equipped?.name || "默认") + '</span></section>' +
        items.map(renderCosmeticItem).join("") +
      '</section>';
    }

    function renderCosmeticItem(item) {
      const action = item.equipped
        ? 'data-action="cosmetic-equipped" disabled'
        : item.owned
        ? 'data-action="equip-cosmetic" data-cosmetic="' + h(item.id) + '"'
        : 'data-action="unlock-cosmetic" data-cosmetic="' + h(item.id) + '"' + (item.affordable ? "" : " disabled");
      const buttonTitle = item.equipped ? "使用中" : item.owned ? "装备" : "解锁";
      const meta = item.owned ? item.rarity : h(item.cost || 0) + " 推理星";
      return '<article class="cosmetic-item" style="--cosmetic-accent:' + h(item.accent || "#ffd46b") + '">' +
        '<div class="cosmetic-frame">' + h((item.name || "装扮").slice(0, 1)) + '</div>' +
        '<div><strong>' + h(item.name) + '</strong><span>' + h(item.description) + '</span></div>' +
        '<div class="cosmetic-action"><button class="quiet-button" ' + action + '>' + h(buttonTitle) + '</button><small>' + h(meta) + '</small></div>' +
      '</article>';
    }

    function renderMissionItem(item) {
      const progress = Math.min(1, Number(item.progress || 0) / Math.max(1, Number(item.target || 1)));
      const reward = item.reward || {};
      const action = item.claimed
        ? 'data-action="mission-claimed"'
        : item.claimable
          ? 'data-action="claim-mission" data-mission="' + h(item.id) + '"'
          : 'data-action="start-mode" data-mode="M01"';
      const buttonTitle = item.claimed ? "已领取" : item.claimable ? "领取" : "开局";
      return '<div class="progress-row"><div><strong>' + h(item.title) + '</strong><span>' + h(item.description) + '</span><span class="muted">奖励：推理星 +' + h(reward.clueStars || 0) + ' · 经验 +' + h(reward.xp || 0) + '</span></div><div class="mission-action"><button class="quiet-button" ' + action + (item.claimed ? " disabled" : "") + '>' + h(buttonTitle) + '</button><div class="progress-meter"><i style="width: ' + progressWidth(progress) + '%"></i></div><small>' + h(item.claimed ? "已领取" : item.claimable ? "可领取" : String(item.progress || 0) + "/" + String(item.target || 1)) + '</small></div></div>';
    }

    function renderProfileHome() {
      const safety = state.summary?.safety || {};
      const equippedCosmetic = state.summary?.cosmetics?.equipped;
      return '<section class="tab-page">' +
        '<section class="wolf-section-title"><h2>我的</h2><span class="mode-pill">安全</span></section>' +
        '<section class="primary-panel"><div><p class="panel-kicker">账号与安全</p><h2>' + h(state.user?.nickname || "玩家") + '</h2><p>固定账号保存战绩和装扮。房间规则、客服申诉、隐私和删档都在这里。</p></div><span class="mode-pill">' + h(state.user?.bannedAt ? "受限" : "在线") + '</span></section>' +
        renderMissionRewardsPanel() +
        renderCosmeticsPanel() +
        renderCommercePreviewPanel() +
        '<section class="progress-card"><div class="progress-row"><div><strong>当前装扮</strong><span>' + h(equippedCosmetic?.name || "黑金侦探框") + ' · ' + h(equippedCosmetic?.rarity || "基础") + '</span></div><span class="mode-pill">背包</span></div><div class="progress-row"><div><strong>安全中心</strong><span>已处理 ' + h(safety.reportsSubmitted || 0) + ' 次举报 · 拉黑 ' + h(safety.blocks || 0) + ' 人</span></div><span class="mode-pill">账号</span></div></section>' +
        '<section class="profile-action-grid"><a class="profile-action-card" href="/legal/community"><strong>房间规则</strong><small>发言、举报和封禁边界</small></a><a class="profile-action-card" href="/support"><strong>联系客服</strong><small>反馈问题或账号申诉</small></a><a class="profile-action-card" href="/legal/privacy"><strong>隐私政策</strong><small>数据与账号说明</small></a><a class="profile-action-card" href="/legal/terms"><strong>服务条款</strong><small>游戏服务规则</small></a><button class="profile-action-card danger" data-action="delete-account"><strong>删除账号和个人数据</strong><small>删档后不可恢复</small></button></section>' +
      '</section>';
    }

    function renderCommercePreviewPanel() {
      const catalog = state.commerceCatalog;
      const offers = Array.isArray(catalog?.offers) ? catalog.offers.slice(0, 3) : [];
      if (!offers.length) return "";
      const offerRows = offers.map((offer) =>
        '<div class="progress-row"><div><strong>' + h(offer.title) + '</strong><span>' + h(offer.value) + '</span><span class="muted">' + h(offer.fairness) + '</span></div><span class="mode-pill">' + h(offer.priceLabel || offer.status || "未开放") + '</span></div>'
      ).join("");
      const guard = Array.isArray(catalog.fairnessGuards) ? catalog.fairnessGuards[0] : "不出售胜率、身份信息或投票优势。";
      return '<section class="progress-card commerce-preview"><div class="progress-row"><div><strong>' + h(catalog.headline || "权益预告") + '</strong><span>' + h(catalog.summary || "只规划不影响公平的长期权益。") + '</span></div><span class="mode-pill">未开放</span></div>' + offerRows + '<p class="muted">' + h(guard) + '</p></section>';
    }

    function renderHomeNav(activeTab) {
      const items = [["lobby", "大厅", "nav-lobby"], ["records", "战绩", "nav-records"], ["profile", "我的", "nav-profile"]];
      return '<nav class="wolf-bottom-nav" aria-label="底部导航">' + items.map(([tab, label, icon]) =>
        '<button class="' + (activeTab === tab ? "active" : "") + '" data-action="home-tab" data-tab="' + h(tab) + '"><span class="nav-icon-wrap"><span class="nav-icon ' + h(icon) + '" aria-hidden="true"></span>' + renderHomeNavBadge(tab) + '</span><span>' + h(label) + '</span></button>'
      ).join("") + '</nav>';
    }

    function renderHomeNavBadge(tab) {
      const badge = homeNavBadge(tab);
      return badge ? '<span class="nav-badge">' + h(badge) + '</span>' : "";
    }

    function homeNavBadge(tab) {
      if (tab === "profile") {
        const items = Array.isArray(state.summary?.missions?.items) ? state.summary.missions.items : [];
        const count = items.filter((item) => item.claimable && !item.claimed).length;
        return count > 0 ? String(Math.min(count, 9)) : "";
      }
      if (tab === "records") {
        const activeGames = (state.gameHistory || []).filter((game) => game.phase !== "COMPLETED").length;
        return activeGames > 0 ? "续" : "";
      }
      return "";
    }

    function renderSafetyBanner() {
      if (!state.user || !state.user.bannedAt) return "";
      return '<section class="friend-room"><h3>账号已被限制</h3><p>' + h(state.user.banReason || "该账号暂时不能参与匹配、好友房、发言、投票或举报。") + '</p></section>';
    }

    function inviteCopyLabel(inviteCode) {
      if (state.copiedInviteCode !== inviteCode) return "复制邀请码";
      return state.copyInviteNeedsManual ? "手动复制 " + inviteCode : "邀请码已复制";
    }

    function renderWaitingSeat(label, nickname, status, avatar, tone = "") {
      const cardClass = "seat-card locked" + (tone === "current" ? " current" : "") + (tone === "empty" ? " empty" : "");
      const roleClass = tone === "ai" ? " ai" : "";
      const pill = tone === "empty" ? "等待入座" : tone === "ai" ? "系统补位" : "已占座";
      return '<article class="' + cardClass + '"><div class="avatar-stack"><img class="avatar' + roleClass + '" src="' + h(avatar) + '" alt="' + h(nickname) + ' 头像" /><span class="badge-number">' + h(label) + '</span></div><div><div class="seat-name">' + h(nickname) + '</div><div class="seat-role' + roleClass + '">' + h(status) + '</div><span class="mode-pill">' + h(pill) + '</span></div></article>';
    }

    function renderWaiting() {
      const mode = modeById(state.waitingModeId) || modeById("M02") || { id: "M02", name: "三角定位", playerCount: 3, aiCount: 1, minHumanCount: 2, discussionSeconds: 300, votingSeconds: 30, flow: stageNames, rules: [] };
      const topic = topicById(state.waitingTopicId) || selectedTopicForMode(mode.id);
      const nickname = state.user?.nickname || "你";
      const seats = renderWaitingSeats(mode, nickname);
      const missingHumans = Math.max(0, Number(mode.minHumanCount || 2) - 1);
      const ticketLabel = state.ticketId ? "候场码 " + state.ticketId.slice(0, 6).toUpperCase() : "排队中";
      const topicMeta = [topic?.category, topicRiskTitle(topic?.risk)].filter(Boolean).join(" · ") || "标准话题";
      const flowText = (Array.isArray(mode.flow) && mode.flow.length ? mode.flow : stageNames).map(flowStepTitle).join(" → ");
      const elapsedSeconds = elapsedSecondsSince(state.waitingStartedAt);
      const fallbackReady = elapsedSeconds >= 45;
      const fallbackCopy = fallbackReady ? "已经等了一会儿，可以先改玩单线接触。" : "超过 45 秒还没凑齐时，可以切到单线接触。";
      app.innerHTML = '<main class="screen wolf-screen waiting-screen">' +
        '<header class="wolf-topbar"><div class="wolf-room-meta"><strong>公开匹配</strong><span>' + h(mode.name) + ' · ' + h(ticketLabel) + '</span></div><button class="icon-button" data-action="cancel-ticket" aria-label="返回大厅">大厅</button></header>' +
        '<section class="waiting-hero"><div class="waiting-ticket-row"><span class="phase-callout">匹配中</span><span class="mode-pill">' + h(ticketLabel) + '</span></div><h1>' + h(mode.name) + '</h1><p>' + h(topic?.title || "围绕话题聊天，抓出伪装者。") + '</p><div class="waiting-stat-grid"><div><span class="label">席位</span><strong>' + h(mode.playerCount) + ' 人</strong></div><div><span class="label">已等待</span><strong data-waiting-elapsed>' + h(elapsedText(elapsedSeconds)) + '</strong></div><div><span class="label">投票</span><strong>' + h(durationText(mode.votingSeconds)) + '</strong></div></div><div class="queue-progress" aria-label="匹配进度"><i></i></div><p class="muted">已保留你的座位，凑齐后自动开局。</p></section>' +
        '<section class="wolf-arena"><div class="seat-board">' + seats + '</div><section class="phase-panel"><span class="phase-callout">等人上桌</span><h1>' + h(missingHumans > 0 ? "还差 " + missingHumans + " 名真人" : "正在确认席位") + '</h1><p>系统会补齐伪装者席位，真人到位后直接查看任务卡。</p><div class="waiting-meta-list"><span>话题：' + h(topicMeta) + '</span><span>流程：' + h(flowText) + '</span></div><button class="primary-button full" data-action="refresh-ticket">刷新匹配</button></section></section>' +
        '<section class="room-panel"><h3>换个开法</h3><p data-waiting-fallback-copy>' + h(fallbackCopy) + '</p><div class="waiting-switch-grid"><button class="secondary-button" data-action="waiting-quick-start">单线接触</button></div><button class="quiet-button full" data-action="cancel-ticket">返回大厅</button></section>' +
      '</main>';
    }

    function renderWaitingSeats(mode, nickname) {
      const playerCount = Math.max(2, Number(mode.playerCount || 3));
      const aiCount = Math.max(0, Number(mode.aiCount || 1));
      const humanSeats = Math.max(1, playerCount - aiCount);
      const seats = [renderWaitingSeat("1", nickname, "你已入座", "/preview-assets/avatar-you.png", "current")];
      for (let index = 1; index < humanSeats; index += 1) {
        seats.push(renderWaitingSeat(String(seats.length + 1), "真人玩家", index === 1 ? "匹配中" : "等待加入", "/preview-assets/avatar-lu.png", "empty"));
      }
      for (let index = 0; index < aiCount; index += 1) {
        seats.push(renderWaitingSeat(String(seats.length + 1), aiCount > 1 ? "伪装者 " + (index + 1) : "伪装者", "开局补位", "/preview-assets/avatar-ai.png", "ai"));
      }
      return seats.join("");
    }

    function renderRoom() {
      const room = state.room;
      if (!room) return renderHome();
      const mode = state.modes.find((item) => item.id === room.modeId);
      const requiredHumans = mode?.minHumanCount || (room.modeId === "M04" ? 3 : room.modeId === "M01" ? 1 : 2);
      const seatCount = Math.max(Number(mode?.playerCount || 0), room.players.length, requiredHumans + 1);
      const players = Array.from({ length: seatCount }, (_, index) => {
        const player = room.players[index];
        if (!player) return renderEmptySeat(index);
        return '<button class="seat-card" type="button"><div class="avatar-stack"><img class="avatar" src="' + h(avatarFor(player, index)) + '" alt="' + h(player.nickname) + ' 头像" /><span class="badge-number">' + (index + 1) + '</span></div><div><div class="seat-name">' + h(player.nickname) + '</div><div class="seat-role">' + h(playerKindTitle(player.kind)) + '</div><span class="mode-pill">' + (player.ready ? "已准备" : "未准备") + '</span></div></button>';
      }).join("");
      const isHost = state.user && room.hostUserId === state.user.id;
      const humanPlayers = room.players.filter((player) => player.kind === "human");
      const humanCount = humanPlayers.length;
      const readyCount = humanPlayers.filter((player) => player.ready).length;
      const readyTarget = Math.max(requiredHumans, humanCount);
      const allReady = humanPlayers.every((player) => player.ready);
      const currentPlayer = humanPlayers.find((player) => player.userId === state.user?.id);
      const isCurrentReady = currentPlayer?.ready === true;
      const canReady = room.status === "LOBBY" && !isCurrentReady;
      const canStart = isHost && room.status === "LOBBY" && humanCount >= requiredHumans && allReady;
      const roomHint = humanCount < requiredHumans ? "还需要 " + (requiredHumans - humanCount) + " 名真人玩家加入后才能开局。" : allReady ? "所有真人已准备，可以开始。" : "等待所有真人成员准备。";
      const roomElapsedSeconds = elapsedSecondsSince(room.createdAt);
      const roomFallbackCopy = friendRoomFallbackCopy(roomElapsedSeconds, humanCount, requiredHumans);
      const readyButtonTitle = isCurrentReady ? "已准备" : "我已准备";
      const startButtonTitle = canStart ? "房主开始" : humanCount < requiredHumans ? "还差 " + (requiredHumans - humanCount) + " 人" : !allReady ? "等待准备" : "房主开始";
      const debugFillAction = localDebug && isHost && room.status === "LOBBY"
        ? '<button class="quiet-button full" data-action="debug-fill-room">补齐试玩</button><p class="muted">本地预览专用：用脚本真人补齐席位并立即开局。</p>'
        : "";
      const roomTopic = topicById(room.topicId) || selectedTopicForMode(room.modeId);
      const topicSelector = isHost && room.status === "LOBBY"
        ? renderTopicPicker(mode || { id: room.modeId }, roomTopic?.id || "", "set-room-topic")
        : '<section class="mode-rule-card"><h3>本局话题</h3><p>' + h(roomTopic?.title || "围绕话题聊天，抓出伪装者。") + '</p></section>';
      app.innerHTML = '<main class="screen wolf-screen">' +
        '<header class="wolf-topbar"><div class="wolf-room-meta"><strong>图灵迷局好友房</strong><span>房间号 ' + h(room.inviteCode) + ' · ' + h(mode?.name || room.modeId) + '</span></div><button class="icon-button" data-action="go-home" aria-label="首页">首页</button></header>' +
        '<section class="wolf-arena"><div class="seat-board">' + players + '</div><section class="phase-panel"><span class="phase-callout">等待准备</span><h1>' + h(room.inviteCode) + '</h1><p>' + h(roomHint) + '</p><button class="secondary-button full" data-action="copy-invite-code">' + h(inviteCopyLabel(room.inviteCode)) + '</button></section></section>' +
        '<section class="room-panel"><h3>开局准备</h3><div class="progress-row"><div><strong>' + h(mode?.name || room.modeId) + '</strong><span>' + h(roomStatusLabel(room.status)) + ' · ' + h(isHost ? "你是房主" : "等待房主") + '</span></div><span class="mode-pill">' + h(readyCount) + '/' + h(readyTarget) + ' 已准备</span></div><p>话题：' + h(roomTopic?.title || "未选择") + '</p>' + topicSelector + '<button class="primary-button full" data-action="ready-room"' + (canReady ? "" : " disabled") + '>' + h(readyButtonTitle) + '</button>' +
        (isHost ? '<button class="secondary-button full" data-action="start-room"' + (canStart ? "" : " disabled") + '>' + h(startButtonTitle) + '</button><p class="muted">' + h(roomHint) + '</p>' : '<p class="muted">准备后等待房主开局。房主离开时会自动换房主。</p>') +
        '<section class="friend-room-timeout-card"><div class="progress-row"><div><strong>好友房已等待 ' + h(elapsedText(roomElapsedSeconds)) + '</strong><span data-room-fallback-copy>' + h(roomFallbackCopy) + '</span></div><span class="mode-pill">' + h(humanCount) + '/' + h(requiredHumans) + ' 真人</span></div><div class="waiting-switch-grid"><button class="secondary-button" data-action="start-mode" data-mode="M01">先玩单线接触</button><button class="quiet-button" data-action="copy-invite-code">' + h(inviteCopyLabel(room.inviteCode)) + '</button></div></section>' +
        debugFillAction +
        '<button class="quiet-button full" data-action="leave-room">离开房间</button></section></main>';
    }

    function friendRoomFallbackCopy(elapsedSeconds, humanCount, requiredHumans) {
      if (humanCount >= requiredHumans) return "真人已到齐，准备后由房主开始。";
      const missing = Math.max(0, requiredHumans - humanCount);
      if (elapsedSeconds >= 90) return "还差 " + missing + " 名真人。等太久时可以先玩单线接触，或复制房号继续拉人。";
      return "还差 " + missing + " 名真人。先复制房号拉好友，超过 90 秒可改玩单线接触。";
    }

    function renderEmptySeat(index) {
      return '<article class="seat-card empty locked"><div class="avatar-stack"><img class="avatar" src="/preview-assets/avatar-lu.png" alt="空位头像" /><span class="badge-number">' + (index + 1) + '</span></div><div><div class="seat-name">空位</div><div class="seat-role">等待入座</div><span class="mode-pill">邀请好友</span></div></article>';
    }

    function renderGame() {
      const game = state.game;
      if (!game) return renderHome();
      const messages = visibleRoomMessages(game);
      app.innerHTML = '<main class="' + currentScreenClass() + '">' +
        renderGameHeader(game) +
        renderStageRail(game) +
        '<section class="wolf-arena">' +
          renderSeatBoard(game) +
          renderPhasePanel(game) +
        '</section>' +
        renderTopicCard(game) +
        '<section class="room-feed"><div class="feed-head"><span>房间发言</span><span>' + h(game.messages.filter((message) => message.senderKind !== "system").length) + ' 条</span></div><section class="message-list">' +
          messages.map((message) => renderMessage(game, message)).join("") +
        '</section></section>' +
        renderGameControls(game) +
        renderTaskCardOverlay(game) +
        renderDebugDock(game) +
        renderGameRulesModal(game) +
      '</main>';
    }

    function visibleRoomMessages(game) {
      return game.messages.filter((message) => message.senderKind !== "system" || message.text.includes("最终陈述"));
    }

    function renderGameHeader(game) {
      return '<header class="wolf-topbar">' +
        '<button class="brand-button wolf-room-meta" data-action="go-home"><strong>图灵迷局</strong><span>' + h(game.roomId ? "好友房" : "快速局") + ' · 房间 ' + h(shortRoomId(game)) + '</span></button>' +
        '<section class="wolf-timer" aria-label="当前阶段"><span>' + h(phaseTitle(game.phase)) + '</span><strong data-countdown>' + h(timerText(game)) + '</strong></section>' +
        '<button class="icon-button" data-action="open-task-card" aria-label="我的任务">任务</button>' +
        '<button class="icon-button" data-action="go-home" aria-label="首页">首页</button>' +
      '</header>';
    }

    function renderStageRail(game) {
      const names = stageNamesForGame(game);
      const active = stageIndex(game.phase, names);
      return '<section class="stage-rail" style="--stage-count:' + h(names.length) + '" aria-label="游戏阶段">' + names.map((name, index) => {
        const step = index + 1;
        const stateClass = step === active ? " active" : step < active ? " done" : "";
        return '<div class="stage-item"><div class="stage-dot' + stateClass + '">' + step + '</div><div class="stage-label' + (step === active ? " active" : "") + '">' + h(name) + '</div></div>';
      }).join("") + '</section>';
    }

    function renderSeatBoard(game) {
      return '<section class="seat-board" aria-label="玩家座位">' + game.players.map((player, index) => {
        const isSelf = player.userId && state.user?.id === player.userId;
        const canSelectSeat = (game.phase === "DISCUSSION" || game.phase === "VOTING") && !isSelf;
        const selected = canSelectSeat && selectedSeatTargetId(game) === player.id ? " marked" : "";
        const current = isSelf ? " current" : "";
        const role = visibleRoleTitle(player, game.phase);
        const aiClass = (game.phase === "REVEAL" || game.phase === "COMPLETED") && role === "AI" ? " ai" : "";
        const tag = canSelectSeat ? "button" : "article";
        const attrs = canSelectSeat ? ' type="button" data-action="select-target" data-player="' + h(player.id) + '"' : "";
        return '<' + tag + ' class="seat-card' + selected + current + (canSelectSeat ? "" : " locked") + '"' + attrs + '>' +
          '<div class="avatar-stack"><img class="avatar' + aiClass + '" src="' + h(avatarFor(player, index, game.phase)) + '" alt="' + h(player.nickname) + ' 头像" /><span class="badge-number">' + (index + 1) + '</span></div>' +
          '<div><div class="seat-name">' + h(player.nickname) + '</div><div class="seat-role' + aiClass + '">' + h(role) + '</div><div class="muted">' + h(isSelf ? "你" : seatHint(player, game.phase)) + '</div></div>' +
        '</' + tag + '>';
      }).join("") + '</section>';
    }

    function renderPhasePanel(game) {
      const title = phasePanelTitle(game);
      const prompt = phasePanelPrompt(game);
      const systemLine = game.messages.find((message) => message.senderKind === "system")?.text || "";
      const topicLine = game.topic?.title || systemLine.replace(/^本局(主题|话题)[:：]\s*/, "") || "围绕话题聊天，抓出伪装者。";
      return '<section class="phase-panel"><span class="phase-callout">' + h(phaseTitle(game.phase)) + '</span><h1>' + h(title) + '</h1><p>' + h(prompt) + '</p><p><strong>本局话题：</strong>' + h(topicLine) + '</p></section>';
    }

    function renderPlayerStrip(game) {
      const count = Math.max(2, Math.min(4, game.players.length));
      return '<section class="player-strip" style="--player-count: ' + count + '">' + game.players.map((player, index) => {
        const marked = selectedSeatTargetId(game) === player.id ? " marked" : "";
        const role = visibleRoleTitle(player, game.phase);
        const aiClass = (game.phase === "REVEAL" || game.phase === "COMPLETED") && role === "AI" ? " ai" : "";
        return '<button class="player-tile' + marked + '" data-action="select-target" data-player="' + h(player.id) + '">' +
          '<div class="avatar-stack"><img class="avatar' + aiClass + '" src="' + h(avatarFor(player, index, game.phase)) + '" alt="' + h(player.nickname) + ' 头像" /><span class="badge-number">' + (index + 1) + '</span></div>' +
          '<div class="player-meta"><div class="player-name">' + h(player.nickname) + '</div><div class="player-role' + aiClass + '">' + h(role) + '</div></div>' +
        '</button>';
      }).join("") + '</section>';
    }

    function selectedSeatTargetId(game) {
      if (!game) return "";
      if (game.phase === "DISCUSSION") return state.selectedDiscussionTargetId;
      if (game.phase === "VOTING") return state.selectedVoteTargetId;
      return "";
    }

    function renderTopicCard(game) {
      return '<section class="topic-card"><div class="topic-icon">盾</div><div><strong>本局话题</strong><p>' + h(game.topic?.title || "围绕话题聊天，抓伪装者。") + '</p></div><button type="button" data-action="show-game-rules">看玩法</button></section>';
    }

    function shouldShowTaskCard(game) {
      return Boolean(game && game.phase === "DISCUSSION" && game.taskCard?.acknowledged === false && !state.seenTaskCards?.[game.id]);
    }

    function shouldRenderTaskCard(game) {
      return Boolean(shouldShowTaskCard(game) || (game?.id && state.reviewingTaskGameId === game.id));
    }

    function currentPlayer(game) {
      return game?.players?.find((player) => player.userId && state.user?.id === player.userId) || null;
    }

    function taskCardTitle(role) {
      if (role === "human") return "侦探任务";
      if (role === "human_undercover") return "阵营任务";
      if (role === "fake_ai") return "诱饵任务";
      if (role === "ai") return "伪装任务";
      return "本局任务";
    }

    function taskGoal(playerOrRole, game) {
      const role = typeof playerOrRole === "string" ? playerOrRole : playerOrRole?.role;
      const hiddenTask = typeof playerOrRole === "string" ? "" : playerOrRole?.hiddenTask;
      if (hiddenTask) return hiddenTask;
      if (game?.modeId === "M01" && role === "human") return "听发言、抓细节，归票时判断对方是真人还是 AI。";
      if (role === "human") return "听发言、抓破绽，归票时找出伪装者。";
      if (role === "human_undercover") return "保护你的 AI 同盟，别让真正 AI 成为唯一最高票。";
      if (role === "fake_ai") return "故意露出 AI 感，吸走怀疑，保护真正 AI。";
      if (role === "ai") return "保持自然发言，尽量撑过投票。";
      return "先观察发言，别暴露判断。";
    }

    function taskWinCondition(playerOrRole, game) {
      const role = typeof playerOrRole === "string" ? playerOrRole : playerOrRole?.role;
      if (game?.modeId === "M01" && role === "human") return "归票时判断对方是真人或 AI，判断正确即完成侦探任务。";
      if (game?.modeId === "M04" && role === "human") return "把票分到两名 AI 身上，让它们的得票都压过所有真人。";
      if (role === "human") return "让真正 AI 成为唯一最高票；投错真人、平票或弃权都会放走伪装者。";
      if (role === "human_undercover") return "让真正 AI 不成为唯一最高票；你被投出也算 AI 同盟达成目标。";
      if (role === "fake_ai") return "吸走怀疑，让真正 AI 不成为唯一最高票。";
      if (role === "ai") return "避免自己成为唯一最高票；利用发言和他人怀疑撑过归票。";
      return "看你有没有完成本局任务。";
    }

    function taskTools(playerOrRole, game) {
      return ["自由发问", "标记线索", "最终陈述", game?.modeId === "M01" ? "真假判断" : "归票"].join(" / ");
    }

    function taskBoundary(playerOrRole) {
      const role = typeof playerOrRole === "string" ? playerOrRole : playerOrRole?.role;
      if (role === "human_undercover") return "不能明说同盟身份；只能用发言把讨论方向带偏。";
      if (role === "fake_ai") return "不能把自己当成真正 AI；你的目标是制造误判，不是直接改票。";
      if (role === "ai") return "不能看到真人私有任务；只能靠发言影响判断。";
      return "不要把语气像 AI 当成答案；投票前只能靠发言判断。";
    }

    function renderTaskDetailRow(title, value) {
      return '<div class="task-detail-row"><strong>' + h(title) + '</strong><span>' + h(value) + '</span></div>';
    }

    function renderTaskCardOverlay(game) {
      if (!shouldRenderTaskCard(game)) return "";
      const player = currentPlayer(game);
      const title = taskCardTitle(player?.role || "hidden");
      const avatar = avatarFor(player, 0, "REVEAL");
      const isReview = !shouldShowTaskCard(game);
      const actionButton = isReview
        ? '<button class="primary-button full" data-action="close-task-card">继续游戏</button>'
        : '<button class="primary-button full" data-action="ack-task-card">开始发言</button>';
      return '<section class="task-card-overlay" role="dialog" aria-modal="true" aria-label="任务卡">' +
        '<section class="task-card-sheet">' +
          '<p class="eyebrow">任务卡</p><h2>' + h(title) + '</h2>' +
          '<section class="task-token"><img class="avatar" src="' + h(avatar) + '" alt="你的头像" /><div><strong>任务目标</strong><p>' + h(taskGoal(player, game)) + '</p></div></section>' +
          '<section class="task-detail-grid" aria-label="任务细节">' +
            renderTaskDetailRow("赢法", taskWinCondition(player, game)) +
            renderTaskDetailRow("可用工具", taskTools(player, game)) +
            renderTaskDetailRow("禁忌", taskBoundary(player)) +
          '</section>' +
          '<ul class="task-tip-list"><li>本局话题：' + h(game.topic?.title || "围绕话题聊天，抓出伪装者。") + '</li><li>其他玩家任务与阵营保持隐藏，投票前只能靠发言判断。</li></ul>' +
          actionButton +
        '</section>' +
      '</section>';
    }

    function renderMessage(game, message) {
      if (message.senderKind === "system") {
        return '<article class="message-row system"><div class="bubble">' + h(message.text) + '</div></article>';
      }
      const player = game.players.find((item) => item.id === message.senderPlayerId);
      const isOwn = player?.userId && state.user?.id === player.userId;
      const rowClass = isOwn ? " own" : "";
      const clueButton = canMarkMessageClue(game, message, player, isOwn)
        ? '<button class="mini-button" data-action="toggle-message-clue" data-message="' + h(message.id) + '">' + h(message.reactionType === "clue" ? "已标线索" : "标为线索") + '</button>'
        : "";
      const aiClass = (game.phase === "REVEAL" || game.phase === "COMPLETED") && player?.role === "ai" ? " avatar-ai" : "";
      return '<article class="message-row' + rowClass + '">' +
        '<img class="avatar avatar-sm' + aiClass + '" src="' + h(avatarFor(player, 0, game.phase)) + '" alt="' + h(player?.nickname || "玩家") + ' 头像" />' +
        '<div><div class="message-head"><strong>' + h(player?.nickname || "玩家") + '</strong><span>' + h(timeLabel(message.createdAt)) + '</span></div>' +
        '<div class="bubble">' + h(message.text) + '</div><div class="message-tools">' + clueButton + '</div></div>' +
      '</article>';
    }

    function canMarkMessageClue(game, message, player, isOwn) {
      return Boolean(game?.phase === "DISCUSSION" && message?.senderKind === "player" && player && !isOwn);
    }

    function renderGameControls(game) {
      if (game.phase === "DISCUSSION") {
        if (shouldShowTaskCard(game)) return '<section class="composer"><p class="composer-note">先确认任务卡，再开始发言。</p></section>';
        return '<section class="composer">' + renderDiscussionTarget(game) + '<div class="composer-row compact"><input id="draft" placeholder="输入本轮发言..." /><button class="send-button" data-action="send-message">发</button></div><p class="composer-note">用自己的话发言、主动追细节；可疑发言点“标为线索”。</p></section>';
      }
      if (game.phase === "FINAL_STATEMENT") {
        return renderFinalStatementPanel(game);
      }
      if (game.phase === "VOTING") {
        if (phaseExpired(game.phaseEndsAt)) {
          return '<section class="vote-panel"><h2>' + h(votePanelTitle(game)) + '</h2><p>归票已结束，正在揭晓身份。</p>' + renderMyVoteStatus(game) + '<button class="quiet-button full" data-action="refresh-game">刷新结果</button></section>';
        }
        const selectedPlayer = selectedVotePlayer(game);
        if (state.confirmingVote && selectedPlayer) {
          return '<section class="vote-panel"><h2>确认归票</h2>' + renderVoteConfirm(game, selectedPlayer) + '</section>';
        }
        const confirmLabel = game.modeId === "M01"
          ? (selectedPlayer ? (game.myVote ? "修改判断" : "确认判断") : "先选择判断")
          : (selectedPlayer ? (game.myVote ? "修改投票" : "确认归票") : "先选择玩家");
        return '<section class="vote-panel"><h2>' + h(votePanelTitle(game)) + '</h2><p>' + h(votePanelPrompt(game)) + '</p>' + renderVoteCarryHint(game) + renderMyVoteStatus(game) + renderVoteCandidates(game) + '<button class="primary-button full" data-action="confirm-vote"' + (selectedPlayer ? "" : " disabled") + '>' + h(confirmLabel) + '</button></section>';
      }
      if (game.phase === "REVEAL") {
        return '<section class="replay-panel"><h2>亮身份</h2><p>票型已定，翻开所有身份。</p>' + renderIdentities(game) + '<button class="primary-button full" data-action="view-replay">看复盘</button></section>';
      }
      return renderReplay(game);
    }

    function renderFinalStatementPanel(game) {
      const submitted = Boolean(game.finalStatement?.submitted);
      if (submitted) {
        return '<section class="composer"><h2>最终陈述已提交</h2><p class="composer-note">等待其他真人补完最后一句，随后进入归票。</p></section>';
      }
      return '<section class="composer"><h2>最终陈述</h2><p class="composer-note">只能补充一句。说明你的判断依据，不再开启新问题。</p><div class="composer-row compact"><input id="draft" placeholder="输入最后陈述..." /><button class="send-button" data-action="send-message">发</button></div></section>';
    }

    function renderDiscussionTarget(game) {
      const player = selectedDiscussionPlayer(game);
      if (!player) {
        return '<section class="discussion-target"><div><strong>点座位盯人</strong><span>先盯住最可疑的一位，归票时会沿用这个目标。</span></div></section>';
      }
      return '<section class="discussion-target"><div><strong>盯住 ' + h(player.nickname) + '</strong><span>归票时会沿用这个目标，可随时换人。</span></div></section>';
    }

    function selectedDiscussionPlayer(game) {
      if (!game || game.phase !== "DISCUSSION" || !state.selectedDiscussionTargetId) return null;
      const player = game.players.find((item) => item.id === state.selectedDiscussionTargetId);
      if (!player || player.userId === state.user?.id) return null;
      return player;
    }

    function renderDebugDock(game) {
      if (!localDebug || !game || game.phase === "COMPLETED") return "";
      return '<details class="dev-dock" open><summary>Dev</summary><div class="dev-actions"><button data-action="send-sample">示例发言</button><button data-action="advance-game">推进阶段</button><button data-action="debug-complete-replay">到复盘</button><button data-action="refresh-game">刷新本局</button></div></details>';
    }

    function renderVoteCandidates(game) {
      if (game.modeId === "M01") {
        const opponent = m01Opponent(game);
        if (!opponent) return '<div class="stack"><section class="vote-status"><strong>等待对手</strong><span>本局还没有可判断对象。</span></section></div>';
        const selectedId = selectedVoteTargetId(game);
        const aiSelected = selectedId === opponent.id;
        const humanSelected = selectedId === "abstain";
        const aiVoted = game.myVote?.targetPlayerId === opponent.id;
        const humanVoted = game.myVote?.targetPlayerId === "abstain";
        const aiStatus = aiVoted ? "当前判断" : aiSelected ? "已选择" : "选择";
        const humanStatus = humanVoted ? "当前判断" : humanSelected ? "已选择" : "选择";
        return '<div class="stack">' +
          '<button class="candidate' + (aiSelected ? " selected" : "") + '" data-action="select-target" data-player="' + h(opponent.id) + '">' +
            '<img class="avatar" src="' + h(avatarFor(opponent, 0, game.phase)) + '" alt="' + h(opponent.nickname) + ' 头像" /><div><strong>判断是 AI</strong><div class="muted">' + h(opponent.nickname) + ' 在伪装真人</div>' + renderVoteEvidence(game, opponent) + '</div><span class="mode-pill">' + h(aiStatus) + '</span></button>' +
          '<button class="candidate' + (humanSelected ? " selected" : "") + '" data-action="select-target" data-player="abstain">' +
            '<div class="avatar truth-avatar">真</div><div><strong>判断是真人</strong><div class="muted">' + h(opponent.nickname) + ' 不是 AI，只是在认真回答。</div><div class="vote-evidence"><span>不是弃票，是真假判断</span></div></div><span class="mode-pill">' + h(humanStatus) + '</span></button>' +
        '</div>';
      }
      return '<div class="stack">' + game.players.filter((player) => player.userId !== state.user?.id).map((player, index) => {
        const selected = selectedVoteTargetId(game) === player.id ? " selected" : "";
        const voted = game.myVote?.targetPlayerId === player.id;
        return '<button class="candidate' + selected + '" data-action="select-target" data-player="' + h(player.id) + '">' +
          '<img class="avatar" src="' + h(avatarFor(player, index, game.phase)) + '" alt="' + h(player.nickname) + ' 头像" /><div><strong>' + h(player.nickname) + '</strong><div class="muted">' + h(visibleRoleTitle(player, game.phase)) + '</div>' + renderVoteEvidence(game, player) + '</div><span class="mode-pill">' + h(voted ? "当前票" : selected ? "已选择" : "选择") + '</span></button>';
      }).join("") + '</div>';
    }

    function votePanelTitle(game) {
      if (game.modeId === "M01") return "判断对方真假";
      return game.modeId === "M04" ? "分票锁定双 AI" : "投票锁定伪装者";
    }

    function votePanelPrompt(game) {
      if (game.modeId === "M01") return "根据对话细节判断对方是真人还是 AI；判断正确才算胜利。";
      if (game.modeId === "M04") return "把票分到两名 AI 身上，让它们的得票都压过所有真人。";
      return "看你标记的发言和最终陈述，归票结束或全员交票前可修改。";
    }

    function m01Opponent(game) {
      return game?.players.find((player) => player.userId !== state.user?.id) || null;
    }

    function selectedVotePlayer(game) {
      if (!game) return null;
      const targetId = selectedVoteTargetId(game);
      if (!targetId) return null;
      if (game.modeId === "M01" && targetId === "abstain") {
        return { id: "abstain", nickname: "对方是真人", kind: "truth_judgement", role: "human" };
      }
      return game.players.find((player) => player.id === targetId) || null;
    }

    function selectedVoteTargetId(game) {
      if (!game) return "";
      const carried = carriedDiscussionTarget(game);
      return state.selectedVoteTargetId || game.myVote?.targetPlayerId || carried?.id || "";
    }

    function carriedDiscussionTarget(game) {
      if (!game || game.phase !== "VOTING" || !state.lastDiscussionTargetId || game.myVote || state.selectedVoteTargetId) return null;
      const player = game.players.find((item) => item.id === state.lastDiscussionTargetId);
      if (!player || player.userId === state.user?.id) return null;
      return player;
    }

    function renderVoteCarryHint(game) {
      const player = carriedDiscussionTarget(game);
      if (!player) return "";
      return '<section class="vote-status carry-target"><strong>已沿用盯人目标：' + h(player.nickname) + '</strong><span>这是你讨论阶段盯住的人。可以直接归票，也可以清空后重选。</span><button class="mini-button" data-action="clear-vote-target">重选</button></section>';
    }

    function renderMyVoteStatus(game) {
      const progress = voteProgressText(game);
      if (!game.myVote) {
        const desc = "先选目标，提交后进入等待。" + (progress ? " " + progress : "");
        return '<section class="vote-status"><strong>还未交票</strong><span>' + h(desc) + '</span></section>';
      }
      if (game.modeId === "M01" && game.myVote.targetPlayerId === "abstain") {
        return '<section class="vote-status"><strong>已判断对方是真人</strong><span>可在揭晓前修改，最后一次提交生效。</span></section>';
      }
      const target = game.players.find((player) => player.id === game.myVote.targetPlayerId);
      const targetName = target?.nickname || "已选目标";
      const title = game.modeId === "M01" ? "已判断 " + targetName + " 是 AI" : "已投给 " + targetName;
      const desc = game.modeId === "M01" ? "可在揭晓前修改，最后一次提交生效。" : "可在归票结束或全员交票前修改，最后一次提交生效。" + (progress ? " " + progress : "");
      return '<section class="vote-status"><strong>' + h(title) + '</strong><span>' + h(desc) + '</span></section>';
    }

    function voteProgressText(game) {
      if (!game?.voteState || game.modeId === "M01") return "";
      const remaining = Number(game.voteState.remaining || 0);
      const submittedCount = Number(game.voteState.submittedCount || 0);
      const total = Number(game.voteState.total || 0);
      if (remaining <= 0) return "全员已交票，正在揭晓。";
      return "还差 " + remaining + " 名真人交票，当前 " + submittedCount + "/" + total + "。";
    }

    function renderVoteEvidence(game, player) {
      const items = playerSavedClues(game, player).slice(0, 2).map((clue) => "标记发言：" + compactText(clue.text, 18));
      if (!items.length) items.push("暂无标记发言");
      return '<div class="vote-evidence">' + items.map((item) => '<span>' + h(item) + '</span>').join("") + '</div>';
    }

    function playerSavedClues(game, player) {
      if (!game || !player) return [];
      return (game.messages || []).filter((message) => message.senderPlayerId === player.id && message.reactionType === "clue");
    }

    function compactText(text, maxLength = 24) {
      const value = String(text || "").trim();
      return value.length > maxLength ? value.slice(0, maxLength - 1) + "…" : value;
    }

    function renderVoteConfirm(game, player) {
      if (game.modeId === "M01" && player.id === "abstain") {
        return '<section class="vote-confirm-card">' +
          '<div><p class="eyebrow">本次判断</p><h3>判断对方是真人</h3></div>' +
          '<section class="vote-confirm-target"><div class="avatar truth-avatar">真</div><div><strong>对方是真人</strong><div class="muted">不是弃票，而是选择“对方并非 AI”。</div></div></section>' +
          '<p class="vote-warning">单线接触提交后会立即揭晓。</p>' +
          '<div class="vote-confirm-actions"><button class="primary-button" data-action="vote">确认提交</button><button class="quiet-button" data-action="cancel-vote-confirm">返回修改</button></div>' +
        '</section>';
      }
      const index = Math.max(0, game.players.findIndex((item) => item.id === player.id));
      const warning = game.modeId === "M01"
        ? "单线接触提交后会立即揭晓。"
        : game.modeId === "M04"
          ? "双源干扰要分票锁定两名 AI，只集火一名 AI 不算胜利。"
          : "提交后可在归票结束或全员交票前修改，最后一次提交生效。";
      const title = game.modeId === "M01" ? "判断 " + player.nickname + " 是 AI" : "投给 " + player.nickname;
      return '<section class="vote-confirm-card">' +
        '<div><p class="eyebrow">' + h(game.modeId === "M01" ? "本次判断" : "本次投票") + '</p><h3>' + h(title) + '</h3></div>' +
        '<section class="vote-confirm-target"><img class="avatar" src="' + h(avatarFor(player, index, game.phase)) + '" alt="' + h(player.nickname) + ' 头像" /><div><strong>' + h(player.nickname) + '</strong><div class="muted">' + h(visibleRoleTitle(player, game.phase)) + '</div></div></section>' +
        '<p class="vote-warning">' + h(warning) + '</p>' +
        '<div class="vote-confirm-actions"><button class="primary-button" data-action="vote">确认提交</button><button class="quiet-button" data-action="cancel-vote-confirm">返回修改</button></div>' +
      '</section>';
    }

    function renderIdentities(game) {
      return '<div class="identity-grid">' + game.players.map((player) =>
        '<div class="identity-item"><strong>' + h(player.nickname) + '</strong><p>' + h(roleTitle(player.role)) + '</p></div>'
      ).join("") + '</div>';
    }

    function renderReplay(game) {
      const replay = game.replay;
      if (!replay) return '<section class="replay-panel"><h2>复盘整理中</h2><button class="quiet-button full" data-action="refresh-game">刷新</button></section>';
      const replayModeId = game.modeId || "M01";
      const replayMode = modeById(replayModeId);
      const replayActionTitle = game.rematchRoomId ? "进入再来一局房间" : game.roomId ? "原房间再来一局" : "同模式再来一局";
      const outcomeWon = replay.winner === "human";
      const resultTitle = replayModeId === "M01" ? (outcomeWon ? "判断正确" : "判断失误") : (outcomeWon ? "抓出伪装者" : "伪装者逃脱");
      const claimable = claimableMissions();
      const keyMessages = (replay.keyMessages || []).map((item, index) =>
        '<div class="timeline-row"><div class="timeline-time">' + (index === 0 ? "关键" : "19:" + String(31 + index).padStart(2, "0")) + '</div><div>' + h(item.text) + (item.strategyTag ? '<p class="clue">' + h(strategyLabel(item.strategyTag)) + '</p>' : "") + '</div></div>'
      ).join("");
      const savedClueNotes = (game.messages || []).filter((message) => message.reactionType === "clue").map((message) => {
        const player = game.players.find((candidate) => candidate.id === message.senderPlayerId);
        return '<div class="timeline-row"><div class="timeline-time">标记</div><div>' + h(player?.nickname || "玩家") + '：“' + h(message.text) + '”</div></div>';
      }).join("");
      return '<section class="replay-panel">' +
        '<section class="result-hero ' + h(outcomeWon ? "win" : "loss") + '"><span class="phase-callout">本局结算</span><h2>' + h(resultTitle) + '</h2><p>' + h(replay.explanation) + '</p></section>' +
        '<section class="settlement-grid"><div class="settlement-stat"><span class="label">阵营结果</span><strong>' + h(outcomeWon ? "胜利" : "失败") + '</strong></div><div class="settlement-stat"><span class="label">完成局数</span><strong>+1</strong></div><div class="settlement-stat"><span class="label">复盘</span><strong>已整理</strong></div></section>' +
        renderReplayTaskResult(game, replay) +
        renderReplayJudgement(game, replay) +
        renderReplayCalibration(game, replay) +
        renderReplayVoteBoard(game, replay) +
        renderReplayIdentityBoard(game, replay) +
        renderAiGoalNotes(game, replay) +
        (savedClueNotes ? '<p class="eyebrow">我标记的发言</p><div class="timeline">' + savedClueNotes + '</div>' : "") +
        '<p class="eyebrow">关键线索</p><div class="timeline">' + keyMessages + '</div>' +
        renderRewardCard(claimable) +
        renderAccountProtectionCard() +
        renderReplaySharePreview(game) +
        renderPostGameReports(game) +
        '<div class="postgame-actions"><button class="primary-button" data-action="replay-again" data-mode="' + h(replayModeId) + '" data-room="' + h(game.roomId || "") + '" data-rematch-room="' + h(game.rematchRoomId || "") + '">' + h(replayActionTitle) + '</button><button class="quiet-button" data-action="share-replay">分享战报</button><button class="quiet-button" data-action="go-records">看战绩</button><button class="quiet-button" data-action="go-home">回大厅</button></div>' +
        renderReportReasonSheet(game) +
      '</section>';
    }

    function renderReplaySharePreview(game) {
      const replay = game?.replay;
      if (!replay) return "";
      const modeTitle = modeDisplayTitle(game?.modeId || "M01");
      const topicTitle = game?.topic?.title || "本局话题";
      const resultTitle = game?.modeId === "M01" ? (replay.winner === "human" ? "判断正确" : "判断失误") : (replay.winner === "human" ? "抓出伪装者" : "伪装者逃脱");
      const keyLine = replay.keyMessages?.find((item) => item.text)?.text || "复盘已整理，来试一局。";
      return '<section class="progress-card share-preview-card"><div class="progress-row"><div><strong>匿名战报卡</strong><span>分享前预览，不带昵称、房号或对局编号。</span></div><span class="mode-pill">可分享</span></div><div class="timeline-row"><div class="timeline-time">模式</div><div>' + h(modeTitle) + ' · ' + h(topicTitle) + '</div></div><div class="timeline-row"><div class="timeline-time">结果</div><div>' + h(resultTitle) + '</div></div><div class="timeline-row"><div class="timeline-time">线索</div><div>' + h(keyLine) + '</div></div><small>' + h(shareLandingUrl(game)) + '</small></section>';
    }

    function renderReplayTaskResult(game, replay) {
      const current = game.players.find((player) => player.userId === state.user?.id);
      const result = (replay.taskResults || []).find((item) => item.playerId === current?.id);
      if (!result) return "";
      return '<p class="eyebrow">我的任务结果</p><section class="vote-status task-result-card"><strong>' + h(result.completed ? "任务完成" : "任务失败") + ' · ' + h(result.title || "本局任务") + '</strong><span>' + h(result.summary || "") + '</span><small>' + h(result.goal || "") + '</small></section>';
    }

    function voteTargetLabel(game, vote, { includeVerb = true } = {}) {
      if (!vote) return "未完成判断";
      if (game.modeId === "M01") {
        if (vote.targetPlayerId === "abstain") return includeVerb ? "判断对方是真人" : "对方是真人";
        const target = game.players.find((player) => player.id === vote.targetPlayerId);
        return includeVerb ? "判断 " + (target?.nickname || "对方") + " 是 AI" : (target?.nickname || "对方") + " 是 AI";
      }
      if (vote.targetPlayerId === "abstain") return includeVerb ? "弃票" : "弃票";
      const target = game.players.find((player) => player.id === vote.targetPlayerId);
      return (includeVerb ? "投给 " : "") + (target?.nickname || "已选目标");
    }

    function renderReplayJudgement(game, replay) {
      const myVote = (replay.voteSummary || []).find((vote) => vote.userId === state.user?.id);
      return '<p class="eyebrow">我的判断</p><div class="timeline"><div class="timeline-row"><div class="timeline-time">我</div><div>' + h(voteTargetLabel(game, myVote)) + '</div></div></div>';
    }

    function renderReplayCalibration(game, replay) {
      const myVote = (replay.voteSummary || []).find((vote) => vote.userId === state.user?.id);
      const aiIds = replayAiPlayerIds(game, replay);
      const voteHit = replayVoteHit(game, myVote, aiIds);
      const voteLine = replayVoteCalibrationLine(myVote, voteHit);
      return '<p class="eyebrow">复盘校准</p><section class="vote-status calibration-card"><strong>' + h(voteLine.title) + '</strong><span>' + h(voteLine.body) + '</span></section>';
    }

    function replayAiPlayerIds(game, replay) {
      const explicitIds = Array.isArray(replay.aiPlayerIds) ? replay.aiPlayerIds.filter(Boolean) : [];
      if (explicitIds.length) return new Set(explicitIds);
      const identityIds = (replay.identitySummary || []).filter((item) => item.role === "ai").map((item) => item.playerId).filter(Boolean);
      if (identityIds.length) return new Set(identityIds);
      return new Set(game.players.filter((player) => player.role === "ai").map((player) => player.id));
    }

    function replayVoteHit(game, vote, aiIds) {
      if (!vote) return null;
      if (game.modeId === "M01" && vote.targetPlayerId === "abstain") return aiIds.size === 0;
      return aiIds.has(vote.targetPlayerId);
    }

    function replayVoteCalibrationLine(vote, hit) {
      if (!vote) return { title: "没有完成最终判断", body: "这局没有有效投票，复盘只能保留发言和标记记录。" };
      if (hit) return { title: "判断命中", body: "你的最终判断和真实身份一致。" };
      return { title: "判断失准", body: "这次最终判断没有命中；下局多问具体细节再下判断。" };
    }

    function renderReplayVoteBoard(game, replay) {
      const votes = replay.voteSummary || [];
      if (!votes.length) return "";
      return '<p class="eyebrow">投票板</p><div class="timeline">' + votes.map((vote) => {
        const voter = game.players.find((player) => player.id === vote.voterPlayerId);
        return '<div class="timeline-row"><div class="timeline-time">票</div><div>' + h(voter?.nickname || "玩家") + '：' + h(voteTargetLabel(game, vote)) + '</div></div>';
      }).join("") + '</div>';
    }

    function renderReplayIdentityBoard(game, replay) {
      const identities = Array.isArray(replay.identitySummary) && replay.identitySummary.length
        ? replay.identitySummary
        : game.players;
      return '<p class="eyebrow">身份结果</p><div class="identity-grid">' + identities.map((item) =>
        '<div class="identity-item"><strong>' + h(item.nickname || game.players.find((player) => player.id === item.playerId)?.nickname || "玩家") + '</strong><p>' + h(roleTitle(item.role)) + '</p></div>'
      ).join("") + '</div>';
    }

    function renderAiGoalNotes(game, replay) {
      const goals = Array.isArray(replay.aiGoals) && replay.aiGoals.length
        ? replay.aiGoals
        : replay.aiPlayerId
          ? [{ playerId: replay.aiPlayerId, goal: replay.aiGoal }]
          : [];
      if (!goals.length) return "";
      return '<p class="eyebrow">AI 目标</p><div class="timeline">' + goals.map((item) => {
        const player = game.players.find((candidate) => candidate.id === item.playerId);
        return '<div class="timeline-row"><div class="timeline-time">AI</div><div>' + h(player?.nickname || "AI") + '：' + h(item.goal || "隐藏到归票结束") + '</div></div>';
      }).join("") + '</div>';
    }

    function claimableMissions() {
      const items = state.summary?.missions?.items;
      if (!Array.isArray(items)) return [];
      return items.filter((item) => item.claimable && !item.claimed);
    }

    function renderRewardCard(claimable) {
      if (!claimable.length) {
        return '<section class="reward-card"><div><p class="panel-kicker">本局奖励</p><h3>战绩已更新</h3><p>回大厅继续开局，或去战绩页看复盘。</p></div><button class="quiet-button" data-action="go-records">看战绩</button></section>';
      }
      const totals = claimable.reduce((acc, item) => {
        acc.clueStars += Number(item.reward?.clueStars || 0);
        acc.xp += Number(item.reward?.xp || 0);
        return acc;
      }, { clueStars: 0, xp: 0 });
      return '<section class="reward-card"><div><p class="panel-kicker">本局奖励</p><h3>' + h(claimable.length) + ' 个任务可领取</h3><p>推理星 +' + h(totals.clueStars) + ' · 经验 +' + h(totals.xp) + '</p></div><button class="primary-button" data-action="go-missions">去领取</button></section>';
    }

    function renderAccountProtectionCard() {
      const completedGames = Number(state.summary?.stats?.completedGames || 0);
      if (completedGames > 1) return "";
      const provider = state.user?.kind || "";
      const isApple = provider === "apple";
      const title = isApple ? "Apple 已保护战绩" : "首局战绩已保存";
      const body = isApple
        ? "这局复盘、经验和装扮会跟随 Apple 账号保留。"
        : "当前使用" + h(accountProviderTitle(provider)) + "固定账号保存战绩；iOS 上可优先使用 Apple 登录，换设备更稳。";
      return '<section class="progress-card account-protection-card"><div class="progress-row"><div><strong>' + h(title) + '</strong><span>' + body + '</span></div><span class="mode-pill">' + h(isApple ? "已绑定" : "账号") + '</span></div><button class="quiet-button full" data-action="go-profile">查看账号</button></section>';
    }

    function accountProviderTitle(provider) {
      if (provider === "apple") return "Apple ";
      if (provider === "wechat") return "微信 ";
      if (provider === "google") return "Google ";
      return "";
    }

    function renderPostGameReports(game) {
      const reportablePlayers = game.players.filter((player) => player.userId && player.userId !== state.user?.id);
      if (!reportablePlayers.length) {
        return "";
      }
      return '<section class="room-panel"><h3>局后处理</h3><p>有人扰局？收局后处理。</p><div class="stack">' +
        reportablePlayers.map((player) => '<div class="candidate"><img class="avatar" src="' + h(avatarFor(player, 0, "COMPLETED")) + '" alt="' + h(player.nickname) + ' 头像" /><div><strong>' + h(player.nickname) + '</strong><div class="muted">本局同桌</div></div><div class="actions"><button class="quiet-button" data-action="open-report-player" data-target="' + h(player.userId) + '">举报</button><button class="quiet-button" data-action="block-player" data-target="' + h(player.userId) + '">拉黑</button><button class="danger-button" data-action="open-report-player" data-target="' + h(player.userId) + '" data-block="true">举报并拉黑</button></div></div>').join("") +
      '</div></section>';
    }

    function reportReasonOptions() {
      return [
        ["post_game_disruptive_play", "扰局发言", "恶意带节奏、刷屏或破坏讨论"],
        ["post_game_harassment", "攻击骚扰", "辱骂、人身攻击或持续骚扰"],
        ["post_game_threat_or_self_harm", "威胁/自伤", "暴力威胁、自伤表达或危险引导"],
        ["post_game_spam_or_scam", "垃圾广告", "广告、引流、诈骗或外部联系方式"],
        ["post_game_player_report", "其他问题", "需要运营查看本局上下文"]
      ];
    }

    function renderReportReasonSheet(game) {
      if (!state.pendingReportTarget) return "";
      const player = game.players.find((item) => item.userId === state.pendingReportTarget);
      const targetName = player?.nickname || "该玩家";
      const blockLabel = state.pendingReportBlock ? "举报并拉黑" : "提交举报";
      return '<section class="rules-overlay" role="dialog" aria-modal="true" aria-label="选择举报理由">' +
        '<section class="rules-modal"><header class="rules-sheet-head"><div><p class="eyebrow">局后处理</p><h2>' + h(blockLabel) + ' ' + h(targetName) + '</h2><p>选择一个理由，运营会查看本局上下文。</p></div><button class="icon-button" data-action="close-report-sheet" aria-label="关闭">关闭</button></header>' +
        '<div class="report-reason-list">' + reportReasonOptions().map(([reason, title, description]) =>
          '<button class="report-reason-card" data-action="submit-report-player" data-reason="' + h(reason) + '"><strong>' + h(title) + '</strong><span>' + h(description) + '</span></button>'
        ).join("") + '</div></section></section>';
    }

    async function login(kind) {
      const nickname = document.querySelector("#nickname")?.value.trim() || "玩家";
      const ageConfirmed = Boolean(document.querySelector("#ageConfirmed")?.checked);
      const communityConfirmed = Boolean(document.querySelector("#communityConfirmed")?.checked);
      if (!ageConfirmed || !communityConfirmed) {
        updateOnboardingEntryState();
        throw new Error("请先确认入场规则");
      }
      const body = kind === "apple"
        ? {
            identityToken: "mock.apple.local-web-preview",
            authorizationCode: "mock.code.local-web-preview",
            nickname,
            ageConfirmed,
            communityConfirmed
          }
        : kind === "google"
          ? {
              identityToken: "mock.google.local-web-preview",
              nickname,
              ageConfirmed,
              communityConfirmed
            }
          : kind === "wechat"
            ? {
                code: "mock.wechat.local-web-preview",
                nickname,
                ageConfirmed,
                communityConfirmed
              }
            : { nickname, ageConfirmed, communityConfirmed };
      const path = kind === "apple" ? "/auth/apple" : kind === "google" ? "/auth/google" : kind === "wechat" ? "/auth/wechat" : "/auth/guest";
      const data = await api(path, { method: "POST", body, auth: false });
      state.token = data.token;
      state.user = data.user;
      state.copiedInviteCode = "";
      state.copyInviteNeedsManual = false;
      sessionStorage.setItem(tokenKey, state.token);
      await loadHomeData();
      state.route = "home";
      applyShareLandingIntent();
      showNotice("已进入图灵迷局");
      render();
    }

    function updateOnboardingEntryState() {
      if (state.route !== "onboarding") return;
      const ageConfirmed = Boolean(document.querySelector("#ageConfirmed")?.checked);
      const communityConfirmed = Boolean(document.querySelector("#communityConfirmed")?.checked);
      const canEnter = ageConfirmed && communityConfirmed;
      const appleButton = document.querySelector("#appleLoginButton");
      const wechatButton = document.querySelector("#wechatLoginButton");
      const googleButton = document.querySelector("#googleLoginButton");
      if (appleButton) appleButton.disabled = !canEnter;
      if (wechatButton) wechatButton.disabled = !canEnter;
      if (googleButton) googleButton.disabled = !canEnter;
    }

    async function startMode(modeId, topicId = selectedTopicForMode(modeId)?.id) {
      const resolvedTopicId = topicId || selectedTopicForMode(modeId)?.id || "";
      const data = await api("/quick-start", { method: "POST", body: { modeId, topicId: resolvedTopicId } });
      resetGameActionState();
      state.game = data.game;
      clearWaitingContext();
      state.route = "game";
      state.seenTaskCards = {};
      render();
    }

    function clearWaitingContext() {
      state.ticketId = null;
      state.waitingModeId = "";
      state.waitingTopicId = "";
      state.waitingStartedAt = "";
    }

    function resetGameActionState() {
      state.selectedDiscussionTargetId = "";
      state.selectedVoteTargetId = "";
      state.lastDiscussionTargetId = "";
      state.confirmingVote = false;
      state.reviewingTaskGameId = "";
    }

    function isFriendRoomMode(modeId, mode = modeById(modeId)) {
      return mode?.matchType === "friend_room" || ["M03", "M04", "M06", "M08"].includes(modeId);
    }

    function shareLandingIntent() {
      const params = new URLSearchParams(location.search);
      const modeId = (params.get("mode") || "").toUpperCase();
      const topicId = params.get("topic") || "";
      if (!/^M\\d{2}$/.test(modeId)) return null;
      return { modeId, topicId };
    }

    function applyShareLandingIntent() {
      if (state.route !== "home") return;
      const intent = shareLandingIntent();
      if (!intent || !modeById(intent.modeId)) return;
      state.homeTab = "lobby";
      state.selectedModeId = intent.modeId;
      const topic = topicsForMode(intent.modeId).find((item) => item.id === intent.topicId) || selectedTopicForMode(intent.modeId);
      state.selectedTopicId = topic?.id || "";
    }

    function shareLandingUrl(game) {
      const url = new URL(location.pathname || "/", location.origin);
      url.searchParams.set("mode", game?.modeId || "M01");
      const topicId = game?.topic?.id || selectedTopicForMode(game?.modeId || "M01")?.id;
      if (topicId) url.searchParams.set("topic", topicId);
      return url.toString();
    }

    async function replayAgain(modeId, roomId, rematchRoomId) {
      const nextModeId = modeId || "M01";
      resetGameActionState();
      // 所有模式统一走快速开始再来一局；好友房联机暂不开发。
      return startMode(nextModeId, selectedTopicForMode(nextModeId)?.id);
    }

    function startTicketPolling() {
      window.clearInterval(state.pollTimer);
      state.pollTimer = window.setInterval(() => {
        pollTicket().catch(() => {});
      }, 2500);
    }

    async function pollTicket() {
      if (!state.ticketId) return;
      const data = await api("/matchmaking/" + encodeURIComponent(state.ticketId));
      if (data.status === "matched") {
        window.clearInterval(state.pollTimer);
        state.game = data.game;
        clearWaitingContext();
        state.route = "game";
        state.seenTaskCards = {};
        resetGameActionState();
        render();
      }
    }

    async function clearWaitingTicket() {
      if (state.ticketId) {
        try {
          const data = await api("/matchmaking/" + encodeURIComponent(state.ticketId), { method: "DELETE" });
          if (data.status === "matched" && data.game) {
            window.clearInterval(state.pollTimer);
            state.game = data.game;
            clearWaitingContext();
            state.route = "game";
            state.seenTaskCards = {};
            resetGameActionState();
            return false;
          }
        } catch {}
      }
      window.clearInterval(state.pollTimer);
      clearWaitingContext();
      return true;
    }

    async function cancelTicket() {
      const canLeave = await clearWaitingTicket();
      if (!canLeave) return render();
      state.route = "home";
      await loadHomeData();
      render();
    }

    async function switchWaitingToMode(modeId) {
      const canSwitch = await clearWaitingTicket();
      if (!canSwitch) return render();
      return startMode(modeId, selectedTopicForMode(modeId)?.id);
    }

    async function createRoom(modeId = "M03", topicId = selectedTopicForMode(modeId)?.id) {
      const data = await api("/rooms", { method: "POST", body: { modeId, topicId, allowAiFill: true } });
      state.room = data.room;
      state.game = null;
      clearWaitingContext();
      state.copiedInviteCode = "";
      state.copyInviteNeedsManual = false;
      resetGameActionState();
      await loadHomeData();
      state.route = "room";
      render();
    }

    async function openRoom(roomId) {
      const data = await api("/rooms/" + encodeURIComponent(roomId));
      state.room = data.room;
      state.game = null;
      clearWaitingContext();
      state.copiedInviteCode = "";
      state.copyInviteNeedsManual = false;
      resetGameActionState();
      state.route = "room";
      render();
    }

    async function rematchRoom(roomId) {
      const data = await api("/rooms/" + encodeURIComponent(roomId) + "/rematch", { method: "POST" });
      state.room = data.room;
      state.game = null;
      clearWaitingContext();
      state.copiedInviteCode = "";
      state.copyInviteNeedsManual = false;
      resetGameActionState();
      await loadHomeData();
      state.route = "room";
      showNotice("已保留成员创建再来一局");
      render();
    }

    async function setRoomTopic(topicId) {
      if (!state.room) return;
      const data = await api("/rooms/" + encodeURIComponent(state.room.id) + "/topic", { method: "POST", body: { topicId } });
      state.room = data.room;
      showNotice("房间话题已更新，成员需要重新准备");
      render();
    }

    async function debugFillAndStartRoom() {
      if (!localDebug || !state.room) return;
      const data = await api("/debug/rooms/" + encodeURIComponent(state.room.id) + "/fill-and-start", { method: "POST" });
      state.room = data.room;
      state.game = data.game;
      clearWaitingContext();
      state.route = "game";
      state.seenTaskCards = {};
      resetGameActionState();
      showNotice("已补齐试玩席位");
      render();
    }

    function handleAppInput(event) {
      updateOnboardingEntryState();
    }

    async function refreshGame() {
      if (!state.game) return;
      const data = await api("/games/" + encodeURIComponent(state.game.id));
      state.game = data.game;
      if (state.game.phase !== "VOTING") state.confirmingVote = false;
      if (state.game.phase === "COMPLETED") await loadHomeData();
      render();
    }

    async function advanceGame() {
      if (!state.game) return;
      const remainingSeconds = Math.ceil((new Date(state.game.phaseEndsAt).getTime() - Date.now()) / 1000);
      const data = await api("/debug/games/" + encodeURIComponent(state.game.id) + "/advance", { method: "POST", body: { seconds: Math.max(1, remainingSeconds + 1) } });
      state.game = data.game;
      if (state.game.phase !== "VOTING") state.confirmingVote = false;
      if (state.game.phase === "COMPLETED") await loadHomeData();
      render();
    }

    async function debugCompleteReplay() {
      if (!localDebug || !state.game) return;
      for (let index = 0; index < 8 && state.game?.phase !== "COMPLETED"; index += 1) {
        if (state.game.phase === "REVEAL") {
          const replayData = await api("/games/" + encodeURIComponent(state.game.id) + "/replay", { method: "POST" });
          state.game = replayData.game;
          break;
        }
        const remainingSeconds = state.game.phaseEndsAt
          ? Math.ceil((new Date(state.game.phaseEndsAt).getTime() - Date.now()) / 1000)
          : 1;
        const data = await api("/debug/games/" + encodeURIComponent(state.game.id) + "/advance", { method: "POST", body: { seconds: Math.max(1, remainingSeconds + 1) } });
        state.game = data.game;
      }
      state.confirmingVote = false;
      state.selectedVoteTargetId = "";
      if (state.game?.phase === "COMPLETED") await loadHomeData();
      render();
    }

    async function viewReplay() {
      if (!state.game) return;
      const data = await api("/games/" + encodeURIComponent(state.game.id) + "/replay", { method: "POST" });
      state.game = data.game;
      state.confirmingVote = false;
      state.selectedVoteTargetId = "";
      if (state.game.phase === "COMPLETED") await loadHomeData();
      render();
    }

    async function sendMessage() {
      const draft = document.querySelector("#draft")?.value.trim();
      if (!draft) return;
      const data = await api("/games/" + encodeURIComponent(state.game.id) + "/messages", { method: "POST", body: { text: draft } });
      state.game = data.game;
      render();
      scrollToLatest();
    }

    async function acknowledgeTaskCard() {
      if (!state.game?.id) return;
      const data = await api("/games/" + encodeURIComponent(state.game.id) + "/task-card", { method: "POST" });
      state.game = data.game;
      state.seenTaskCards[state.game.id] = true;
      state.reviewingTaskGameId = "";
      render();
    }

    function fillDraft(text) {
      const draft = document.querySelector("#draft");
      if (!draft || !text) return;
      draft.value = text;
      draft.focus();
    }

    async function toggleMessageClue(messageId) {
      if (!state.game || state.game.phase !== "DISCUSSION") throw new Error("讨论阶段才能标记发言");
      const data = await api("/games/" + encodeURIComponent(state.game.id) + "/reactions", {
        method: "POST",
        body: { messageId, type: "clue" }
      });
      state.game = data.game;
      showNotice("发言线索已更新");
      render();
    }

    async function vote() {
      const targetPlayerId = selectedVoteTargetId(state.game);
      if (!targetPlayerId) throw new Error("请选择投票目标");
      if (phaseExpired(state.game?.phaseEndsAt)) throw new Error("归票已结束，正在揭晓身份");
      const data = await api("/games/" + encodeURIComponent(state.game.id) + "/votes", {
        method: "POST",
        body: { targetPlayerId }
      });
      state.game = data.game;
      state.confirmingVote = false;
      render();
    }

    function openReportSheet(button) {
      state.pendingReportTarget = button.dataset.target || "";
      state.pendingReportBlock = button.dataset.block === "true";
      render();
    }

    function closeReportSheet() {
      state.pendingReportTarget = "";
      state.pendingReportBlock = false;
      render();
    }

    async function reportPlayer(reason) {
      const targetUserId = state.pendingReportTarget;
      if (!targetUserId) return;
      await api("/reports", {
        method: "POST",
        body: {
          gameId: state.game?.id,
          messageId: null,
          targetUserId,
          reason: reason || "post_game_player_report",
          block: state.pendingReportBlock
        }
      });
      const blocked = state.pendingReportBlock;
      state.pendingReportTarget = "";
      state.pendingReportBlock = false;
      await loadHomeData();
      showNotice(blocked ? "举报已提交，并已拉黑该玩家" : "举报已提交");
      render();
    }

    async function blockPlayer(button) {
      const targetUserId = button.dataset.target || "";
      if (!targetUserId) return;
      await api("/blocks", { method: "POST", body: { targetUserId } });
      await loadHomeData();
      showNotice("已拉黑该玩家，之后不会再同桌");
      render();
    }

    function replayShareText(game) {
      const replay = game?.replay;
      const modeTitle = modeDisplayTitle(game?.modeId || "M01");
      const topicTitle = game?.topic?.title || "本局话题";
      const resultTitle = game?.modeId === "M01" ? (replay?.winner === "human" ? "判断正确" : "判断失误") : (replay?.winner === "human" ? "抓出伪装者" : "伪装者逃脱");
      const keyLine = replay?.keyMessages?.find((item) => item.text)?.text;
      return [
        "图灵迷局战报",
        "模式：" + modeTitle,
        "话题：" + topicTitle,
        "结果：" + resultTitle,
        keyLine ? "关键线索：" + keyLine : "",
        "来一局：" + shareLandingUrl(game)
      ].filter(Boolean).join("\\n");
    }

    async function shareReplay() {
      if (!state.game?.replay) {
        showNotice("战报还没整理好", "error");
        return;
      }
      const text = replayShareText(state.game);
      if (navigator.share) {
        try {
          await navigator.share({ title: "图灵迷局战报", text });
          showNotice("战报已打开分享");
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      try {
        await copyTextToClipboard(text);
        showNotice("战报已复制");
      } catch {
        showNotice("浏览器限制复制，请长按战报内容", "error");
      }
    }

    async function openHistoryGame(gameId) {
      const data = await api("/games/" + encodeURIComponent(gameId));
      state.game = data.game;
      resetGameActionState();
      state.route = "game";
      render();
    }

    async function copyTextToClipboard(text) {
      let copied = false;
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.top = "0";
      input.style.left = "0";
      input.style.opacity = "0";
      document.body.appendChild(input);
      try {
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
        copied = document.execCommand("copy");
      } finally {
        input.remove();
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {}
      }
      if (!copied) throw new Error("copy_failed");
    }

    async function copyInviteCode() {
      const inviteCode = state.room?.inviteCode;
      if (!inviteCode) return;
      try {
        await copyTextToClipboard(inviteCode);
        state.copiedInviteCode = inviteCode;
        state.copyInviteNeedsManual = false;
        showNotice("邀请码已复制");
        render();
      } catch {
        state.copiedInviteCode = inviteCode;
        state.copyInviteNeedsManual = true;
        showNotice("浏览器限制自动复制，请手动复制房号 " + inviteCode, "error");
        render();
      }
    }

    function avatarFor(player, index = 0, phase = "") {
      if (!player) return "/preview-assets/avatar-you.png";
      if (player.userId && state.user?.id === player.userId) return "/preview-assets/avatar-you.png";
      const revealed = phase === "REVEAL" || phase === "COMPLETED";
      if ((revealed && (player.kind === "ai" || player.role === "ai")) || (!phase && player.kind === "ai")) return "/preview-assets/avatar-ai.png";
      return index % 2 === 0 ? "/preview-assets/avatar-lu.png" : "/preview-assets/avatar-you.png";
    }

    function phaseTitle(phase) {
      if (phase === "DISCUSSION") return "开聊中";
      if (phase === "FINAL_STATEMENT") return "最终陈述";
      if (phase === "VOTING") return "归票中";
      if (phase === "REVEAL") return "亮身份";
      if (phase === "COMPLETED") return "复盘";
      return phase;
    }

    function roomStatusLabel(status) {
      if (status === "LOBBY") return "等待准备";
      if (status === "IN_GAME") return "对局中";
      if (status === "CLOSED") return "已关闭";
      return status;
    }

    function playerKindTitle(kind) {
      if (kind === "human") return "真人玩家";
      if (kind === "ai") return "AI 玩家";
      if (kind === "unknown") return "身份未知";
      return kind;
    }

    function phasePanelTitle(game) {
      const phase = game?.phase;
      if (phase === "DISCUSSION") return "开始发言";
      if (phase === "FINAL_STATEMENT") return "最终陈述";
      if (phase === "VOTING" && game?.modeId === "M01") return "真假判断";
      if (phase === "VOTING") return "归票时间";
      if (phase === "REVEAL") return "身份公开";
      if (phase === "COMPLETED") return "本局结束";
      return "准备中";
    }

    function phasePanelPrompt(game) {
      if (game.phase === "DISCUSSION") return "听发言，抓回避、空话和前后不一致。";
      if (game.phase === "FINAL_STATEMENT") return "每名真人只能补一句最后判断，随后进入归票。";
      if (game.phase === "VOTING" && game.modeId === "M01") return "讨论结束，判断对方是真人还是 AI。提交后会立即揭晓。";
      if (game.phase === "VOTING") return "锁定最可疑的座位，归票结束或全员交票前可修改。";
      if (game.phase === "REVEAL") return "身份已亮，准备看复盘。";
      if (game.phase === "COMPLETED") {
        return "复盘已整理，回看关键发言后可以再开一局。";
      }
      return "正在分配任务。";
    }

    function seatHint(player, phase) {
      if (!player) return "空位";
      if (phase === "COMPLETED" || phase === "REVEAL") return roleTitle(player.role);
      return "观察中";
    }

    function visibleRoleTitle(player, phase) {
      if (!player) return "待判断";
      if (phase === "COMPLETED" || phase === "REVEAL") return roleTitle(player.role);
      if (player.userId && state.user?.id === player.userId) return player.role === "human" ? "侦探" : roleTitle(player.role);
      return "待判断";
    }

    function shortRoomId(game) {
      const source = game.roomId || game.id || "local";
      return String(source).replace(/-/g, "").slice(0, 6).toUpperCase();
    }

    function stageNamesForGame(game) {
      return stageNames;
    }

    function stageIndex(phase, names = stageNames) {
      if (phase === "DISCUSSION") return 2;
      if (phase === "FINAL_STATEMENT") return 3;
      if (phase === "VOTING") return 4;
      if (phase === "REVEAL") return 5;
      if (phase === "COMPLETED") return 6;
      return 1;
    }

    function timerText(game) {
      if (!game.phaseEndsAt) return "--:--";
      const seconds = Math.max(0, Math.floor((new Date(game.phaseEndsAt).getTime() - Date.now()) / 1000));
      const minutes = Math.floor(seconds / 60);
      return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    }

    function phaseExpired(value) {
      if (!value) return false;
      const time = new Date(value).getTime();
      return Number.isFinite(time) && time <= Date.now();
    }

    function roleTitle(role) {
      if (role === "human") return "侦探";
      if (role === "human_undercover") return "人类卧底";
      if (role === "fake_ai") return "伪 AI 真人";
      if (role === "ai") return "AI";
      if (role === "hidden") return "隐藏";
      return role;
    }

    function timeLabel(value) {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return "现在";
      return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
    }

    function strategyLabel(tag) {
      if (tag === "balanced_opinion") return "表达太均衡";
      if (tag === "soft_deflection") return "回答较笼统，缺少具体细节";
      if (tag === "partial_agreement") return "部分认同后转移重点";
      if (tag === "goal_shift") return "总往规则上绕";
      if (tag === "llm_mock") return "像模板回答";
      return tag;
    }

    function topicRiskTitle(risk) {
      if (risk === "low") return "轻松话题";
      if (risk === "high") return "谨慎发言";
      return "标准话题";
    }

    function modeDisplayTitle(modeId) {
      return modeById(modeId)?.name || modeId;
    }

    function scrollToLatest() {
      window.setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }, 50);
    }

    function updateLocalClock() {
      if (state.route === "waiting") {
        const elapsed = elapsedSecondsSince(state.waitingStartedAt);
        const elapsedNode = document.querySelector("[data-waiting-elapsed]");
        if (elapsedNode) elapsedNode.textContent = elapsedText(elapsed);
        const fallbackNode = document.querySelector("[data-waiting-fallback-copy]");
        if (fallbackNode && elapsed >= 45) fallbackNode.textContent = "已经等了一会儿，可以先改玩单线接触。";
        return;
      }
      if (state.route !== "game" || !state.game) return;
      if (state.game.phase === "COMPLETED") {
        const shouldPollRematch = state.game.roomId && !state.game.rematchRoomId;
        if (shouldPollRematch && !state.rematchRefreshing && Date.now() - state.lastRematchRefreshAt > 5000) {
          state.rematchRefreshing = true;
          state.lastRematchRefreshAt = Date.now();
          refreshGame()
            .catch(() => {})
            .finally(() => {
              state.rematchRefreshing = false;
            });
        }
        return;
      }
      if (!state.game.phaseEndsAt) return;
      const countdown = document.querySelector("[data-countdown]");
      if (countdown) countdown.textContent = timerText(state.game);
      const seconds = Math.floor((new Date(state.game.phaseEndsAt).getTime() - Date.now()) / 1000);
      if (seconds <= 0 && state.game.phase !== "COMPLETED" && !state.clockRefreshing) {
        state.clockRefreshing = true;
        refreshGame()
          .catch(() => {})
          .finally(() => {
            state.clockRefreshing = false;
          });
      }
    }

    app.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
        const action = button.dataset.action;
        try {
          if (action === "retry") return bootstrap();
          if (action === "mock-apple-login") return login("apple");
          if (action === "mock-wechat-login") return login("wechat");
          if (action === "mock-google-login") return login("google");
        if (action === "logout") {
          sessionStorage.removeItem(tokenKey);
          Object.assign(state, { token: "", user: null, summary: null, gameHistory: [], leaderboard: null, game: null, room: null, copiedInviteCode: "", copyInviteNeedsManual: false, showGameRules: false, selectedModeId: "", selectedTopicId: "", ticketId: null, waitingModeId: "", waitingTopicId: "", waitingStartedAt: "", selectedDiscussionTargetId: "", selectedVoteTargetId: "", lastDiscussionTargetId: "", confirmingVote: false, reviewingTaskGameId: "", route: "onboarding" });
          return render();
        }
        if (action === "delete-account") {
          if (!window.confirm("确认删除账号和个人数据？")) return;
          await api("/account", { method: "DELETE" });
          sessionStorage.removeItem(tokenKey);
          Object.assign(state, { token: "", user: null, summary: null, gameHistory: [], leaderboard: null, game: null, room: null, copiedInviteCode: "", copyInviteNeedsManual: false, showGameRules: false, selectedModeId: "", selectedTopicId: "", ticketId: null, waitingModeId: "", waitingTopicId: "", waitingStartedAt: "", selectedDiscussionTargetId: "", selectedVoteTargetId: "", lastDiscussionTargetId: "", confirmingVote: false, reviewingTaskGameId: "", route: "onboarding" });
          showNotice("账号已删除");
          return render();
        }
        if (action === "show-game-rules") {
          state.showGameRules = true;
          return render();
        }
        if (action === "close-game-rules") {
          state.showGameRules = false;
          return render();
        }
        if (action === "show-mode") {
          state.selectedModeId = button.dataset.mode || "";
          ensureSelectedTopic(state.selectedModeId);
          return render();
        }
        if (action === "close-mode") {
          state.selectedModeId = "";
          return render();
        }
        if (action === "select-topic") {
          state.selectedTopicId = button.dataset.topic || "";
          return render();
        }
        if (action === "confirm-mode") {
          const modeId = button.dataset.mode;
          const topicId = selectedTopicForMode(modeId)?.id;
          state.selectedModeId = "";
          return startMode(modeId, topicId);
        }
        if (action === "replay-again") return replayAgain(button.dataset.mode, button.dataset.room, button.dataset.rematchRoom);
        if (action === "start-mode") return startMode(button.dataset.mode);
        if (action === "home-tab") {
          state.homeTab = normalizedHomeTab(button.dataset.tab || "lobby");
          return render();
        }
        if (action === "refresh-ticket") return pollTicket();
        if (action === "cancel-ticket") return cancelTicket();
        if (action === "waiting-quick-start") return switchWaitingToMode("M01");
        if (action === "create-room") return createRoom(button.dataset.mode || "M03");
        if (action === "copy-invite-code") return copyInviteCode();
        if (action === "set-room-topic") return setRoomTopic(button.dataset.topic);
        if (action === "debug-fill-room") return debugFillAndStartRoom();
        if (action === "ready-room") {
          const data = await api("/rooms/" + encodeURIComponent(state.room.id) + "/ready", { method: "POST", body: { ready: true } });
          state.room = data.room;
          return render();
        }
        if (action === "start-room") {
          const data = await api("/rooms/" + encodeURIComponent(state.room.id) + "/start", { method: "POST" });
          state.room = data.room;
          state.game = data.game;
          clearWaitingContext();
          state.route = "game";
          state.seenTaskCards = {};
          resetGameActionState();
          return render();
        }
        if (action === "leave-room") {
          if (state.room) await api("/rooms/" + encodeURIComponent(state.room.id), { method: "DELETE" });
          state.room = null;
          clearWaitingContext();
          state.copiedInviteCode = "";
          state.copyInviteNeedsManual = false;
          state.route = "home";
          await loadHomeData();
          return render();
        }
        if (action === "go-home") {
          state.game = null;
          state.room = null;
          clearWaitingContext();
          state.copiedInviteCode = "";
          state.copyInviteNeedsManual = false;
          state.showGameRules = false;
          state.selectedModeId = "";
          state.selectedTopicId = "";
          resetGameActionState();
          state.homeTab = "lobby";
          state.route = "home";
          await loadHomeData();
          return render();
        }
        if (action === "go-profile") {
          state.game = null;
          state.room = null;
          clearWaitingContext();
          state.copiedInviteCode = "";
          state.copyInviteNeedsManual = false;
          state.showGameRules = false;
          state.selectedModeId = "";
          state.selectedTopicId = "";
          resetGameActionState();
          state.homeTab = "profile";
          state.route = "home";
          await loadHomeData();
          return render();
        }
        if (action === "go-missions" || action === "go-records") {
          state.game = null;
          state.room = null;
          clearWaitingContext();
          state.copiedInviteCode = "";
          state.copyInviteNeedsManual = false;
          state.showGameRules = false;
          state.selectedModeId = "";
          state.selectedTopicId = "";
          resetGameActionState();
          state.homeTab = action === "go-missions" ? "lobby" : "records";
          state.route = "home";
          await loadHomeData();
          return render();
        }
        if (action === "claim-mission") return claimMission(button.dataset.mission);
        if (action === "claim-all-missions") return claimAllMissions();
        if (action === "unlock-cosmetic") return unlockCosmetic(button.dataset.cosmetic);
        if (action === "equip-cosmetic") return equipCosmetic(button.dataset.cosmetic);
        if (action === "open-history-game") return openHistoryGame(button.dataset.game);
        if (action === "select-target") {
          const player = state.game?.players.find((item) => item.id === button.dataset.player);
          if (player?.userId === state.user?.id) throw new Error("不能选择自己");
          if (state.game?.phase === "DISCUSSION") {
            state.selectedDiscussionTargetId = button.dataset.player;
            state.lastDiscussionTargetId = button.dataset.player;
          } else if (state.game?.phase === "VOTING") {
            state.selectedVoteTargetId = button.dataset.player;
          }
          state.confirmingVote = false;
          return render();
        }
        if (action === "clear-vote-target") {
          state.selectedVoteTargetId = "";
          state.lastDiscussionTargetId = "";
          state.confirmingVote = false;
          return render();
        }
        if (action === "confirm-vote") {
          if (phaseExpired(state.game?.phaseEndsAt)) throw new Error("归票已结束，正在揭晓身份");
          if (!selectedVotePlayer(state.game)) throw new Error("请选择投票目标");
          state.confirmingVote = true;
          return render();
        }
        if (action === "cancel-vote-confirm") {
          state.confirmingVote = false;
          return render();
        }
        if (action === "ack-task-card") {
          return acknowledgeTaskCard();
        }
        if (action === "open-task-card") {
          if (state.game?.id) state.reviewingTaskGameId = state.game.id;
          return render();
        }
        if (action === "close-task-card") {
          state.reviewingTaskGameId = "";
          return render();
        }
        if (action === "send-sample") return fillDraft("我支持允许使用 AI，但必须标注哪些部分用了辅助。");
        if (action === "send-message") return sendMessage();
        if (action === "toggle-message-clue") return toggleMessageClue(button.dataset.message);
        if (action === "view-replay") return viewReplay();
        if (action === "share-replay") return shareReplay();
        if (action === "advance-game") return advanceGame();
        if (action === "debug-complete-replay") return debugCompleteReplay();
        if (action === "refresh-game") return refreshGame();
        if (action === "vote") return vote();
        if (action === "open-report-player") return openReportSheet(button);
        if (action === "block-player") return blockPlayer(button);
        if (action === "close-report-sheet") return closeReportSheet();
        if (action === "submit-report-player") return reportPlayer(button.dataset.reason);
      } catch (error) {
        if (error.message === "vote_not_allowed_in_phase") {
          await refreshGame().catch(() => {});
          showNotice("阶段已变化，请按当前状态继续", "error");
          return;
        }
        showNotice(playerErrorMessage(error.message), "error");
      }
    });

    app.addEventListener("input", handleAppInput);
    app.addEventListener("change", updateOnboardingEntryState);

    bootstrap();
    window.setInterval(updateLocalClock, 1000);
  </script>
</body>
</html>`;
}
