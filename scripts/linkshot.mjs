import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chat = { id:"c_link", title:"Link preview", ts:Date.now(), mode:"chat", messages:[
  { id:"u1", role:"user", content:"Dammi una fonte sulla fotosintesi" },
  { id:"a1", role:"assistant", content:"Trovi tutto qui: [Fotosintesi su Wikipedia](https://it.wikipedia.org/wiki/Fotosintesi_clorofilliana). È una buona sintesi." },
]};
const b = await chromium.launch({ executablePath: CHROME }).catch(()=>chromium.launch({channel:"chrome"}));
const ctx = await b.newContext({ viewport:{width:1280,height:820}, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.goto("http://localhost:4173/whychat/",{waitUntil:"networkidle"});
await p.evaluate((c)=>localStorage.setItem("whychat_chats_v1",JSON.stringify([c])), chat);
await p.reload({waitUntil:"networkidle"});
await p.waitForTimeout(600);
await p.evaluate(()=>{ const btn=[...document.querySelectorAll("button")].find(n=>/Link preview/.test(n.textContent||"")&&n.title!=="Elimina"); btn?.click(); });
await p.waitForTimeout(900);
const a = await p.$("main a[href]");
if (a) await a.hover();
await p.waitForTimeout(700);
await p.screenshot({ path:"/tmp/wc-linkprev.png" });
await b.close(); console.log("ok", !!a);
