// One-off: verifica la Dashboard con dati mock (la KV reale è spenta).
import { chromium } from "playwright";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/#dashboard";

const MODES = ["chat", "deep", "sheet", "group", "earth", "music", "reason"];
const NAMES = ["Marco", "Giulia", null, "Luca", "Sara", null, "Ahmed"];
const CC = ["IT", "IT", "US", "FR", "IT", "DE", "GB"];
const Q = [
  "Come funziona la fotosintesi?",
  "Scrivimi una landing page per un caffè",
  "Dove si producono più manghi?",
  "Il futuro del lavoro nel 2030",
  "Analizza questa traccia trap",
  "Spiegami la relatività",
  "Disegna un logo minimale",
];
const entries = [];
for (let i = 0; i < 60; i++) {
  const v = i % 7;
  entries.push({
    ts: new Date(Date.now() - i * 3600_000).toISOString(),
    visitorId: "v_" + v + "x",
    name: NAMES[v],
    ipHash: "ab12cd34" + v,
    country: CC[v],
    mode: MODES[i % MODES.length],
    user: Q[i % Q.length],
    whychat: "Risposta di WhyChat…",
  });
}

const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.route("**/api/vault*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: entries.length, entries }) }),
);
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.fill('input[type="password"]', "demo");
await p.click("text=Apri");
await p.waitForTimeout(1200);
// espandi il primo visitatore
await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((n) => /msg/.test(n.textContent || ""));
  btn?.click();
});
await p.waitForTimeout(900);
await p.screenshot({ path: "/tmp/wc-dashboard.png", fullPage: true });
await b.close();
console.log("✓ shot → /tmp/wc-dashboard.png");
