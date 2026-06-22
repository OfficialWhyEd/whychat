// One-off: verifica il pannello Artifact stile Claude Desktop (split chat|artifact).
import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";
const chat = {
  id: "c_art",
  title: "Artifact panel",
  ts: Date.now(),
  mode: "chat",
  messages: [
    { id: "u1", role: "user", content: "Fammi una mini landing per un caffè." },
    {
      id: "a1",
      role: "assistant",
      content:
        "Ecco la landing:\n\n```html\n<!doctype html><html><body style=\"margin:0;font-family:system-ui;background:#1a1410;color:#f0e6d8;display:grid;place-items:center;height:100vh;text-align:center\"><div><h1 style=\"font-size:3rem;margin:0;color:#f0a36a\">Caffè Lumière</h1><p style=\"opacity:.8\">Tostato a mano, ogni mattina.</p><button style=\"margin-top:1rem;padding:.8rem 2rem;border:0;border-radius:999px;background:#c94b25;color:#fff;font-size:1rem\">Ordina ora</button></div></body></html>\n```\n\nL'ho aperta nel pannello a fianco.",
    },
  ],
};
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "networkidle" });
await p.evaluate((c) => localStorage.setItem("whychat_chats_v1", JSON.stringify([c])), chat);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((n) => /Artifact panel/.test(n.textContent || "") && n.title !== "Elimina");
  btn?.click();
});
await p.waitForTimeout(900);
// clicca il pulsante "Apri nel pannello"
await p.click('button[title="Apri nel pannello"]').catch(() => {});
await p.waitForTimeout(1100);
await p.screenshot({ path: "/tmp/wc-artifact-panel.png" });
await b.close();
console.log("✓ shot → /tmp/wc-artifact-panel.png");
