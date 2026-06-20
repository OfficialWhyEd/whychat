// QA visiva riusabile — "browser control" per WhyChat.
// Pilota il Chrome di sistema (click/type/navigate/screenshot) come fa
// Antigravity Browser Control, ma da CLI e ripetibile.
//
// Prerequisito: il preview gira già →  npm run preview   (porta 4173)
//
// Esempi:
//   npm run shot -- --out /tmp/home.png
//   npm run shot -- --mode WhyEarth --type Tokyo --wait 3000 --out /tmp/earth.png
//   npm run shot -- --mode "Group Prediction" --type "Il futuro del lavoro" --out /tmp/group.png
//   npm run shot -- --w 414 --out /tmp/mobile.png            (mobile)
//   npm run shot -- --mode WhyEarth --field "input[placeholder*='Cerca un luogo']" --type Tokyo --out /tmp/earth.png
//
// Flag: --url --out --mode --type --field --wait --w --h --dpr --noenter
//   --field <css>  campo in cui scrivere (default: textarea del composer)
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const has = (k) => argv.includes(`--${k}`);

const URL = arg("url", "http://localhost:4173/whychat/");
const OUT = arg("out", "/tmp/wc-shot.png");
const MODE = arg("mode", null);
const TYPE = arg("type", null);
const WAIT = Number(arg("wait", "2200"));
const W = Number(arg("w", "1280"));
const H = Number(arg("h", "820"));
const DPR = Number(arg("dpr", "2"));

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push("PAGEERR: " + e.message));
p.on("console", (m) => m.type() === "error" && errors.push("CONSOLE: " + m.text()));

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(900);

if (MODE) {
  await p.click('button[title="Scegli modalità"]').catch(() => {});
  await p.waitForTimeout(450);
  // click via DOM: evita le intercettazioni del menu animato
  const ok = await p.evaluate((label) => {
    const btn = [...document.querySelectorAll("button")].find((b) => new RegExp(label, "i").test(b.textContent || ""));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, MODE);
  if (!ok) errors.push(`MODE non trovata: ${MODE}`);
  await p.waitForTimeout(1200);
}

if (TYPE) {
  const FIELD = arg("field", null);
  const field = FIELD
    ? await p.$(FIELD)
    : (await p.$("textarea")) || (await p.$('input[type="text"]')) || (await p.$("input"));
  if (field) {
    await field.click();
    await p.keyboard.type(TYPE);
    if (!has("noenter")) await p.keyboard.press("Enter");
  } else {
    errors.push("Nessun campo di testo trovato per --type");
  }
}

await p.waitForTimeout(WAIT);
await p.screenshot({ path: OUT });
await b.close();

console.log(`✓ shot → ${OUT}  (${W}x${H}@${DPR}x${MODE ? `, mode=${MODE}` : ""}${TYPE ? `, type="${TYPE}"` : ""})`);
if (errors.length) console.log("⚠ errori pagina:\n  " + errors.slice(0, 8).join("\n  "));
