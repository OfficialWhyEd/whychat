// One-off: verifica anteprime per md / html / codice (snippet + html renderizzato).
import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
const ta = await p.$("textarea");
await ta.click();
await p.keyboard.type("Anteprime file");
await p.setInputFiles('input[type="file"]', ["/tmp/pv.md", "/tmp/pv.html", "/tmp/pv.js"]);
await p.waitForTimeout(1000);
await p.screenshot({ path: "/tmp/wc-fileprev.png", clip: { x: 300, y: 470, width: 680, height: 320 } });
await b.close();
console.log("✓ shot → /tmp/wc-fileprev.png");
