import { chromium } from "playwright";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b = await chromium.launch({ executablePath: CHROME }).catch(() => chromium.launch({ channel: "chrome" }));
// desktop: più file
const d = await (await b.newContext({ viewport:{width:1280,height:820}, deviceScaleFactor:2 })).newPage();
await d.goto("http://localhost:4173/whychat/",{waitUntil:"networkidle"});
await d.waitForTimeout(700);
await (await d.$("textarea")).click(); await d.keyboard.type("Guarda");
await d.setInputFiles('input[type="file"]', ["/tmp/Calendario Marzo.pdf","/tmp/pv.zip","/tmp/pv.js","/tmp/pv.csv"]);
await d.waitForTimeout(800);
await d.screenshot({ path:"/tmp/wc-chip-desktop.png", clip:{x:300,y:560,width:680,height:230} });
// mobile: un pdf solo (come la foto di Edo)
const m = await (await b.newContext({ viewport:{width:390,height:820}, deviceScaleFactor:2, isMobile:true })).newPage();
await m.goto("http://localhost:4173/whychat/",{waitUntil:"networkidle"});
await m.waitForTimeout(700);
await (await m.$("textarea")).click(); await m.keyboard.type("");
await m.setInputFiles('input[type="file"]', ["/tmp/Calendario Marzo.pdf"]);
await m.waitForTimeout(800);
await m.screenshot({ path:"/tmp/wc-chip-mobile.png", clip:{x:0,y:560,width:390,height:240} });
await b.close(); console.log("ok");
