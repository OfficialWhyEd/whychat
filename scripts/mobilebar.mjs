// One-off: verifica solidità barra su mobile con Cerca+Piano attivi (send non va a capo).
import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 414, height: 820 }, deviceScaleFactor: 2, isMobile: true });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const ta = await p.$("textarea");
await ta.click();
await p.keyboard.type("Progetta un piano dettagliato");
await p.click('button[title="Cerca sul web"]').catch((e) => console.log("no search", e.message));
await p.click('button[title="Plan mode: pianifica prima di rispondere"]').catch((e) => console.log("no plan", e.message));
await p.waitForTimeout(700);
await p.screenshot({ path: "/tmp/wc-mobilebar.png", clip: { x: 0, y: 560, width: 414, height: 260 } });
await b.close();
console.log("✓ shot → /tmp/wc-mobilebar.png");
