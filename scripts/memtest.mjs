const URL = "https://whychat-ai.officialwhyed.workers.dev/api/chat";
const H = { "Content-Type": "application/json", "Origin": "https://officialwhyed.github.io" };
async function chat(messages) {
  const res = await fetch(URL, { method: "POST", headers: H, body: JSON.stringify({ messages, visitorId: "memtest_kv_1", name: "EdoTest" }) });
  let out = ""; const r = res.body.getReader(); const d = new TextDecoder();
  while (true) { const { done, value } = await r.read(); if (done) break; out += d.decode(value); }
  return [...out.matchAll(/"content":"((?:[^"\\]|\\.)*)"/g)].map(m=>JSON.parse('"'+m[1]+'"')).join("");
}
console.log("1) dico un fatto…");
await chat([{ role:"user", content:"Ricordati: il mio colore preferito è il CREMISI e bevo solo tè verde." }]);
console.log("   ok, scritto. Aspetto la propagazione KV…");
await new Promise(r=>setTimeout(r, 6000));
console.log("2) chiedo di ricordarlo (nuovo scambio):");
const ans = await chat([{ role:"user", content:"Qual è il mio colore preferito e cosa bevo? Rispondi brevissimo." }]);
console.log("   RISPOSTA:", ans.slice(0, 200));
