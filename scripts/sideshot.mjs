// One-off: verifica la Sidebar stile Claude (gruppi per data + rename + recency).
import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";
const now = Date.now();
const chats = [
  { id: "a", title: "Fotosintesi spiegata", ts: now - 1000, mode: "chat", messages: [{ id: "1", role: "user", content: "ciao" }] },
  { id: "b", title: "Landing page caffè", ts: now - 3 * 3600_000, mode: "canvas", messages: [{ id: "1", role: "user", content: "ciao" }] },
  { id: "c", title: "Dove crescono i manghi", ts: now - 26 * 3600_000, mode: "earth", messages: [{ id: "1", role: "user", content: "ciao" }] },
  { id: "d", title: "Analisi traccia trap", ts: now - 4 * 86400_000, mode: "music", messages: [{ id: "1", role: "user", content: "ciao" }] },
  { id: "e", title: "Il futuro del lavoro", ts: now - 20 * 86400_000, mode: "group", messages: [{ id: "1", role: "user", content: "ciao" }] },
];
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "networkidle" });
await p.evaluate((c) => localStorage.setItem("whychat_chats_v1", JSON.stringify(c)), chats);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);
// hover sulla prima conversazione per mostrare le azioni rinomina/elimina
await p.mouse.move(120, 230);
await p.waitForTimeout(600);
await p.screenshot({ path: "/tmp/wc-sidebar.png" });
await b.close();
console.log("✓ shot → /tmp/wc-sidebar.png");
