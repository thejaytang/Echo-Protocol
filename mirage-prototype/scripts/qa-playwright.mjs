// QA screenshot script for the redesigned mirage-prototype.
//
// This replaces the previous version, which hardcoded an absolute playwright
// path and project root from an earlier machine/session, and used stale UI
// copy ("游客进入", "确认举报", "提交投票") that no longer matches the
// current App.jsx (Apple/微信/Google login, 确认任务, 确认归票, etc.).
//
// Usage:
//   1. cd mirage-prototype
//   2. npm install -D playwright   (one-time; needs network access to
//      download the Chromium binary — this failed inside the Cowork sandbox
//      due to restricted egress, so this has not been run end-to-end yet)
//   3. npm run dev                 (in one terminal, leave it running)
//   4. node scripts/qa-playwright.mjs   (in another terminal)
//
// Screenshots are written to qa-artifacts-v2/ next to this project, using
// paths relative to this script so it works regardless of where the repo is
// checked out.

import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const outDir = path.join(root, "qa-artifacts-v2");
await fs.mkdir(outDir, { recursive: true });

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173/";

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});

page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
}

// 1. Onboarding
await page.goto(baseUrl, { waitUntil: "networkidle" });
await shot("01-onboarding.png");

await page.getByLabel("我已完成年龄确认，并理解这是限时游戏房间。").check();
await page.getByLabel("我同意社区规范，不分享真实姓名、地址、电话、学校或支付信息。").check();
await page.getByRole("button", { name: "Apple 登录" }).click();
await page.waitForTimeout(250);
await shot("02-home.png");

// 2. Start a round -> mission card ritual (Brief 1.3.A)
await page.getByRole("button", { name: "快速开始" }).click();
await page.waitForTimeout(200);
await shot("03-mission-card.png");
await page.getByRole("button", { name: "确认任务" }).click();
await page.waitForTimeout(500); // collapse animation
await shot("04-game.png");

// 3. Send a message
await page.getByPlaceholder("输入消息...").fill("我先投阿言，他的回答一直缺少具体信息。");
await page.getByRole("button", { name: "发送消息" }).click();
await page.waitForTimeout(200);
await shot("05-message-sent.png");

// 4. Vote
await page.getByRole("button", { name: "投票" }).click();
await page.waitForTimeout(200);
await shot("06-vote.png");
await page.locator(".vote-option", { hasText: "阿言" }).click();
await page.getByRole("button", { name: "确认归票" }).click();
await page.waitForTimeout(200);

// 5. Reveal ritual (Brief 1.3.B) — skip the flip animation for a deterministic screenshot
await shot("07-reveal-flipping.png");
await page.getByRole("button", { name: "跳过动画" }).click();
await page.waitForTimeout(400);
await shot("08-reveal-result.png");

// 6. Replay ritual (Brief 1.3.C) — hit scenario, then the miss demo toggle
await page.getByRole("button", { name: "查看复盘" }).click();
await page.waitForTimeout(200);
await shot("09-replay-hit.png");
await page.getByRole("button", { name: "查看误判示例" }).click();
await page.waitForTimeout(200);
await shot("10-replay-miss.png");

// 7. Share card preview (Brief 2.3)
await page.getByRole("button", { name: "分享战报" }).click();
await page.waitForTimeout(200);
await shot("11-share-card.png");
await page.getByRole("button", { name: "关闭预览" }).click();

await browser.close();

if (errors.length) {
  console.error(`QA finished with ${errors.length} page/console error(s):`);
  for (const line of errors) console.error(` - ${line}`);
  process.exitCode = 1;
} else {
  console.log(`QA screenshots written to ${outDir}, no page/console errors.`);
}
