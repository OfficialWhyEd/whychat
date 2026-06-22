// One-off: verifica OnlyType come CHAT continuabile (thread multi-turno + artifact).
import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";
const thread = [
  { id: "m1", role: "user", content: "fanne un bottone" },
  {
    id: "m2",
    role: "assistant",
    content:
      "Ecco il bottone che hai disegnato:\n\n```html\n<!doctype html><html><body style=\"margin:0;display:grid;place-items:center;height:100vh;background:#0a0908\"><button style=\"padding:1rem 2.5rem;border:0;border-radius:999px;background:#c94b25;color:#fff;font:600 1.1rem system-ui\">Premi</button></body></html>\n```",
  },
  { id: "m3", role: "user", content: "rendilo blu e più grande" },
  {
    id: "m4",
    role: "assistant",
    content:
      "Fatto, ora è blu e più grande:\n\n```html\n<!doctype html><html><body style=\"margin:0;display:grid;place-items:center;height:100vh;background:#0a0908\"><button style=\"padding:1.5rem 3.5rem;border:0;border-radius:999px;background:#2563eb;color:#fff;font:700 1.6rem system-ui\">Premi</button></body></html>\n```",
  },
];
const chat = { id: "c_ot", title: "OnlyType chat", ts: Date.now(), mode: "sheet", messages: [], payload: { image: null, texts: [], chat: thread } };
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "networkidle" });
await p.evaluate((c) => localStorage.setItem("whychat_chats_v1", JSON.stringify([c])), chat);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((n) => /OnlyType chat/.test(n.textContent || "") && n.title !== "Elimina");
  btn?.click();
});
await p.waitForTimeout(1200);
await p.screenshot({ path: "/tmp/wc-onlytype-chat.png" });
await b.close();
console.log("✓ shot → /tmp/wc-onlytype-chat.png");
