// One-off: mostra la barra con un'immagine allegata (preview + pulsante).
import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
// un'immagine di test (screenshot della pagina stessa)
await p.screenshot({ path: "/tmp/seed-img.png" });
// scrivi un testo e allega
const ta = await p.$("textarea");
await ta.click();
await p.keyboard.type("Cosa vedi in questa immagine?");
await p.setInputFiles('input[type="file"]', "/tmp/seed-img.png");
await p.waitForTimeout(900);
// ritaglia la zona della barra (in basso)
await p.screenshot({ path: "/tmp/wc-composer-image.png", clip: { x: 280, y: 560, width: 720, height: 240 } });
await b.close();
console.log("✓ shot → /tmp/wc-composer-image.png");
