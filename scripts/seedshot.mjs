// One-off: semina una conversazione lunga e cattura il Chat Minimap (desktop+mobile).
import { chromium } from "playwright";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:4173/whychat/";

const chat = {
  id: "c_seed_minimap",
  title: "Prova minimap",
  ts: Date.now(),
  mode: "chat",
  messages: [
    { id: "s1", role: "user", content: "Spiegami come funziona la fotosintesi in modo semplice." },
    { id: "s2", role: "assistant", content: "La fotosintesi è il processo con cui le piante trasformano luce, acqua e anidride carbonica in zuccheri e ossigeno. Avviene nei cloroplasti, grazie alla clorofilla che cattura la luce." },
    { id: "s3", role: "user", content: "E quanto ossigeno produce un albero in un anno?" },
    { id: "s4", role: "assistant", content: "Un albero adulto produce in media circa 100-120 kg di ossigeno all'anno, abbastanza per due persone. Dipende molto dalla specie e dalle dimensioni della chioma." },
    { id: "s5", role: "user", content: "Fammi un piccolo diagramma del ciclo." },
    { id: "s6", role: "assistant", content: "Ecco il ciclo visualizzato:\n\n```html\n<!doctype html><html><body style=\"margin:0;background:#0a0908;color:#f0a36a;font-family:sans-serif;display:grid;place-items:center;height:100vh\"><div><h2>Sole → Foglia → O₂</h2></div></body></html>\n```\n\nIl sole alimenta la foglia, che rilascia ossigeno." },
    { id: "s7", role: "user", content: "Grazie! Ultima cosa: la respirazione cellulare è l'opposto?" },
    { id: "s8", role: "assistant", content: "Esatto: la respirazione cellulare consuma ossigeno e zuccheri per produrre energia, rilasciando anidride carbonica. È complementare alla fotosintesi, formando un ciclo continuo." },
  ],
};

const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));

async function shot(w, h, out) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.evaluate((c) => localStorage.setItem("whychat_chats_v1", JSON.stringify([c])), chat);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  // apri la chat dalla sidebar (clicca il titolo)
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (n) => /Prova minimap/.test(n.textContent || "") && n.title !== "Elimina",
    );
    btn?.click();
  });
  await p.waitForTimeout(1000);
  // hover sul rail per espanderlo
  await p.mouse.move(w - 14, h / 2);
  await p.waitForTimeout(700);
  await p.screenshot({ path: out });
  await ctx.close();
  console.log("✓ shot →", out, `${w}x${h}`);
}

await shot(1280, 820, "/tmp/wc-minimap-desktop.png");
await shot(414, 820, "/tmp/wc-minimap-mobile.png");
await b.close();
