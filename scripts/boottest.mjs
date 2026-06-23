const URL = "https://whychat-ai.officialwhyed.workers.dev/api/chat";
const H = { "Content-Type": "application/json", "Origin": "https://officialwhyed.github.io" };
const res = await fetch(URL, { method:"POST", headers:H, body: JSON.stringify({ messages:[{role:"user", content:"Ciao, chi sei?"}], visitorId: "boottest_new_"+Date.now(), name: "" }) });
let out=""; const r=res.body.getReader(); const d=new TextDecoder();
while(true){const{done,value}=await r.read();if(done)break;out+=d.decode(value);}
const ans=[...out.matchAll(/"content":"((?:[^"\\]|\\.)*)"/g)].map(m=>JSON.parse('"'+m[1]+'"')).join("");
console.log(ans.slice(0, 600));
