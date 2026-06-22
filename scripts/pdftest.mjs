import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const p = await b.newPage();
await p.setContent("<h1>Promemoria WhyChat</h1><p>La parola segreta del test è: MELOGRANO.</p>");
const pdf = await p.pdf({ format: "A6" });
await b.close();
const dataUrl = "data:application/pdf;base64," + pdf.toString("base64");
const res = await fetch("https://whychat-ai.officialwhyed.workers.dev/api/see", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Origin": "https://officialwhyed.github.io" },
  body: JSON.stringify({ images: [dataUrl], prompt: "Qual è la parola segreta scritta nel PDF? Rispondi con una parola." }),
});
console.log("HTTP", res.status);
let out = "";
const reader = res.body.getReader(); const dec = new TextDecoder();
while (true) { const { done, value } = await reader.read(); if (done) break; out += dec.decode(value); }
const txt = [...out.matchAll(/"content":"([^"]*)"/g)].map(m=>m[1]).join("");
console.log("RISPOSTA:", txt.slice(0, 200) || out.slice(0, 200));
