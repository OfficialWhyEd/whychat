import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chat = { id:"c_ch", title:"Scelte", ts:Date.now(), mode:"chat", messages:[
  { id:"u1", role:"user", content:"Aiutami con un'idea" },
  { id:"a1", role:"assistant", content:"Posso partire da diversi angoli. Da dove vuoi cominciare?\n\n[[SCELTE: Più tecnico | Più semplice | Dammi tre idee | Disegniamolo]]" },
]};
const b = await chromium.launch({ executablePath: CHROME }).catch(()=>chromium.launch({channel:"chrome"}));
const ctx = await b.newContext({ viewport:{width:1280,height:820}, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.goto("http://localhost:4173/whychat/",{waitUntil:"networkidle"});
await p.evaluate((c)=>localStorage.setItem("whychat_chats_v1",JSON.stringify([c])), chat);
await p.reload({waitUntil:"networkidle"});
await p.waitForTimeout(700);
await p.evaluate(()=>{ const btn=[...document.querySelectorAll("button")].find(n=>/Scelte/.test(n.textContent||"")&&n.title!=="Elimina"); btn?.click(); });
await p.waitForTimeout(900);
await p.screenshot({ path:"/tmp/wc-choices.png", clip:{x:300,y:60,width:680,height:260} });
await b.close(); console.log("ok");
