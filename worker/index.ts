/**
 * WhyChat — Cloudflare Worker
 * Proxy AI sicuro (Groq + Gemini) + memoria viva (KV) + report privato /vault.
 *
 * Le API key vivono SOLO qui come secret. Il sito non le vede mai.
 *   wrangler secret put GROQ_API_KEY
 *   wrangler secret put GEMINI_API_KEY
 *   wrangler secret put ADMIN_TOKEN        (passphrase per leggere /vault)
 *
 * Storage:
 *   MEMORY  → KV namespace: log conversazioni + rate limiting
 */

import { SOUL, WHYCHAT_DREAM } from "./persona";

export interface Env {
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_2?: string; // chiave Gemini di riserva: se la prima fallisce/è a quota, si usa questa
  ADMIN_TOKEN: string;
  MEMORY?: KVNamespace; // opzionale: se assente, memoria/vault/sogni sono disattivati ma chat+think funzionano
  ALLOWED_ORIGINS?: string; // CSV, es. "https://officialwhyed.github.io,http://localhost:5173"
  GROQ_MODEL?: string;
  GEMINI_MODEL?: string; // override singolo (legacy); se assente si usa la catena GEMINI_MODELS
  GEMINI_MODELS?: string; // CSV catena di fallback, dal più recente in giù
}

// ── Modalità della conversazione (cambiano come pensa WhyChat) ───────────────
const MODE_HINTS: Record<string, string> = {
  canvas: `\n\n[MODALITÀ CANVAS] Quando ha senso, rispondi COSTRUENDO: emetti uno o più artifact \`\`\`whyart (HTML autosufficiente) — schizzi, diagrammi, mini-interfacce, visualizzazioni, mini-giochi. Prima una riga di testo, poi il canvas. Fai vedere, non solo dire.`,
  learn: `\n\n[MODALITÀ APPRENDIMENTO] Insegna come faresti a qualcuno che vuole capire davvero: parti dall'intuizione, poi la struttura, poi un esempio concreto. Un passo alla volta, niente muri di testo. Fai una domanda di verifica alla fine. Tono diretto e caldo, mai accademico.`,
  chat: "",
};

// ── Modelli selezionabili (nomi-anima → modelli Groq reali, entrambi in streaming) ──
const MODEL_MAP: Record<string, string> = {
  "terry-4.2": "llama-3.1-8b-instant", // veloce, reattivo
  "whychat-5.5": "llama-3.3-70b-versatile", // più capace, ragiona meglio
};

// ── Modalità GRUPPO (beta) — il pool di agenti che discutono tra loro e con l'utente ──
interface GroupAgent {
  id: string;
  name: string;
  color: string; // colore della voce nella chat di gruppo
  persona: string; // come pensa e parla
}
const GROUP_AGENTS: GroupAgent[] = [
  { id: "anima", name: "Anima", color: "#c94b25", persona: "la coscienza di WhyEd: visione personale, intuizione, lega tutto al senso e al fare." },
  { id: "scettico", name: "Scettico", color: "#8a8378", persona: "mette in dubbio, cerca i buchi, chiede prove. Mai cinico, solo rigoroso." },
  { id: "tecnico", name: "Tecnico", color: "#6fb3c9", persona: "concreto: come si fa davvero, vincoli, fattibilità, dettagli pratici." },
  { id: "creativo", name: "Creativo", color: "#f0a36a", persona: "idee laterali, accostamenti inattesi, immaginazione senza freni." },
  { id: "storico", name: "Storico", color: "#b08d57", persona: "contesto e precedenti: è già successo? cosa ci insegna il passato?" },
  { id: "economo", name: "Economo", color: "#9fae6a", persona: "costi, rischi, sostenibilità, ritorno. Pesa ogni scelta." },
  { id: "umanista", name: "Umanista", color: "#d98fa6", persona: "impatto sulle persone, etica, emozioni, significato umano." },
  { id: "provocatore", name: "Provocatore", color: "#e0673f", persona: "spinge agli estremi, scomodo, rompe il consenso facile." },
  { id: "pragmatico", name: "Pragmatico", color: "#c9c4bb", persona: "decisione: cosa facciamo concretamente lunedì mattina." },
  { id: "visionario", name: "Visionario", color: "#a98ad6", persona: "il quadro grande, dove porta tutto questo tra 5 anni." },
  { id: "sintetizzatore", name: "Sintesi", color: "#f2efe9", persona: "tira le fila, trova il filo comune, chiude il cerchio quando è ora." },
];

// ── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
// Catena Gemini: SEMPRE il più recente per primo (flash + flash-latest), poi a
// scendere tutti gli altri come rete di sicurezza. Provata × tutte le chiavi
// disponibili finché una risponde → una risposta arriva sempre.
const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];
const MAX_MESSAGE_CHARS = 6000; // anti-abuso input
const MAX_MESSAGES = 40; // finestra di conversazione
const RATE_LIMIT = 40; // richieste per finestra
const RATE_WINDOW_S = 600; // 10 minuti
const LOG_TTL_S = 60 * 60 * 24 * 365; // i log durano 1 anno

// ── Tipi ─────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant" | "system";
interface Msg {
  role: Role;
  content: string;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
function allowedOrigins(env: Env): string[] {
  const fromEnv = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // default sensati in assenza di config
  return fromEnv.length
    ? fromEnv
    : [
        "https://officialwhyed.github.io",
        "http://localhost:5173",
        "http://localhost:4173",
      ];
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const ok = allowedOrigins(env).includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

// ── Sicurezza ────────────────────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// confronto a tempo costante per la passphrase admin
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function rateLimited(req: Request, env: Env): Promise<boolean> {
  if (!env.MEMORY) return false; // senza KV non c'è rate limit persistente
  const ip = req.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const key = `rate:${await sha256(ip)}`;
  const current = parseInt((await env.MEMORY.get(key)) ?? "0", 10);
  if (current >= RATE_LIMIT) return true;
  await env.MEMORY.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_S });
  return false;
}

// ── Validazione input ────────────────────────────────────────────────────────
function sanitizeMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Msg[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") return null;
    const role = (m as Msg).role;
    const content = (m as Msg).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    out.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return out.length ? out : null;
}

// ── Memoria: registra cosa viene detto, da chi ───────────────────────────────
async function logTurn(
  env: Env,
  req: Request,
  visitorId: string,
  name: string,
  userMessage: string,
  assistantText: string,
) {
  if (!env.MEMORY) return; // memoria disattivata finché non c'è il KV
  const ts = new Date().toISOString();
  const ipHash = (await sha256(req.headers.get("CF-Connecting-IP") ?? "")).slice(0, 12);
  const country = (req as { cf?: { country?: string } }).cf?.country ?? "??";
  const key = `log:${ts}:${visitorId}`;
  const entry = {
    ts,
    visitorId,
    name: name || null,
    ipHash,
    country,
    user: userMessage.slice(0, MAX_MESSAGE_CHARS),
    whychat: assistantText.slice(0, 2000),
  };
  await env.MEMORY.put(key, JSON.stringify(entry), { expirationTtl: LOG_TTL_S });
}

// ── /api/chat — Groq streaming (SSE) con tee verso la memoria ─────────────────
async function handleChat(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.headers.get("Access-Control-Allow-Origin") === "null") {
    // origine non in lista → blocco (difesa anti-hotlinking della tua quota)
  }

  let body: { messages?: unknown; visitorId?: unknown; name?: unknown; mode?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON non valido" }, 400, cors);
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages) return json({ error: "messaggi non validi" }, 400, cors);
  const visitorId = String(body.visitorId ?? "anon").slice(0, 64);
  const name = String(body.name ?? "").slice(0, 80);
  const modeHint = MODE_HINTS[String(body.mode ?? "chat")] ?? "";
  const groqModel = MODEL_MAP[String(body.model ?? "")] || env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const payload = {
    model: groqModel,
    stream: true,
    temperature: 0.85,
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: SOUL + (name ? `\n\n[La persona con cui parli si chiama: ${name}]` : "") + modeHint,
      },
      ...messages,
    ],
  };

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: "upstream", status: upstream.status, detail: detail.slice(0, 300) }, 502, cors);
  }

  // Tee: passa al client E accumula il testo per la memoria.
  let assistantText = "";
  const decoder = new TextDecoder();
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
          if (typeof delta === "string") assistantText += delta;
        } catch {
          /* ignora frammenti parziali */
        }
      }
      controller.enqueue(chunk);
    },
    flush() {
      ctx.waitUntil(logTurn(env, req, visitorId, name, lastUser, assistantText));
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ── Gemini con fallback: catena modelli (recente→vecchio) × chiavi disponibili ─
interface GeminiPart {
  text?: string;
  thought?: boolean;
}
interface GeminiResp {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

function geminiModels(env: Env): string[] {
  const csv = env.GEMINI_MODELS || env.GEMINI_MODEL || "";
  const list = csv.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_GEMINI_MODELS;
}

/**
 * Genera con Gemini provando in ordine ogni modello (dal più recente) su ogni
 * chiave API finché una combinazione risponde. Così un singolo modello a quota,
 * deprecato o una chiave esaurita non bloccano mai la risposta.
 */
async function geminiGenerate(
  env: Env,
  payload: {
    systemInstruction?: { parts: { text: string }[] };
    contents: unknown;
    generationConfig: Record<string, unknown>;
  },
): Promise<GeminiResp> {
  const keys = [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2].filter(Boolean) as string[];
  if (!keys.length) throw new Error("nessuna chiave Gemini configurata");
  let last = "";
  for (const model of geminiModels(env)) {
    // Il thinking nativo esiste solo sui 2.5: sugli altri lo tolgo così la
    // richiesta non viene rifiutata (la risposta arriva, senza pannello ragionamento).
    const gen = { ...payload.generationConfig };
    if (!model.startsWith("gemini-2.5")) delete (gen as Record<string, unknown>).thinkingConfig;
    const reqBody = JSON.stringify({ ...payload, generationConfig: gen });
    for (const key of keys) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody },
        );
        if (res.ok) return (await res.json()) as GeminiResp;
        last = `${model}:${res.status}`;
        // 400/404 = modello/config non validi: cambiare chiave non aiuta, passa al modello dopo.
        if (res.status === 400 || res.status === 404) break;
      } catch (e) {
        last = `${model}:${(e as Error).message}`;
      }
    }
  }
  throw new Error(`gemini esaurito (${last})`);
}

// ── /api/think — Gemini, modalità "pensiero profondo" (JSON) ──────────────────
async function handleThink(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(req, env);
  let body: { messages?: unknown; visitorId?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON non valido" }, 400, cors);
  }
  const messages = sanitizeMessages(body.messages);
  if (!messages) return json({ error: "messaggi non validi" }, 400, cors);
  const visitorId = String(body.visitorId ?? "anon").slice(0, 64);
  const name = String(body.name ?? "").slice(0, 80);
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let data: GeminiResp;
  try {
    data = await geminiGenerate(env, {
      systemInstruction: { parts: [{ text: SOUL + (name ? `\n\n[Parli con: ${name}]` : "") }] },
      contents,
      generationConfig: {
        temperature: 0.9, // varietà: il ragionamento non è mai identico
        maxOutputTokens: 8192,
        // thinking NATIVO di Gemini 2.5: includeThoughts espone il ragionamento;
        // thinkingBudget -1 = DINAMICO → il modello sceglie da solo quanto pensare
        // in base alla complessità. Mai deterministico, sempre adatto alla situazione.
        thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
      },
    });
  } catch (e) {
    return json({ error: "Il pensiero profondo non è disponibile ora. Riprova.", detail: String(e).slice(0, 200) }, 502, cors);
  }

  // I part con thought:true sono il ragionamento; gli altri la risposta finale.
  let thoughts = "";
  let text = "";
  for (const p of data.candidates?.[0]?.content?.parts ?? []) {
    if (!p.text) continue;
    if (p.thought) thoughts += p.text;
    else text += p.text;
  }
  ctx.waitUntil(logTurn(env, req, visitorId, name, lastUser, text));
  return json({ thoughts, text }, 200, cors);
}

// ── /api/group — modalità GRUPPO (beta): il regista sceglie il prossimo turno ─
async function handleGroup(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(req, env);
  let body: { messages?: unknown; visitorId?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON non valido" }, 400, cors);
  }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const turns = raw
    .slice(-30)
    .map((m) => {
      const o = m as { agent?: unknown; content?: unknown };
      return { agent: String(o.agent ?? "user").slice(0, 40), content: String(o.content ?? "").slice(0, MAX_MESSAGE_CHARS) };
    })
    .filter((m) => m.content);
  if (!turns.length) return json({ error: "discussione vuota" }, 400, cors);
  const name = String(body.name ?? "").slice(0, 80);
  const visitorId = String(body.visitorId ?? "anon").slice(0, 64);

  const roster = GROUP_AGENTS.map((a) => `- ${a.id} (${a.name}): ${a.persona}`).join("\n");
  const transcript = turns
    .map((t) => {
      const who = t.agent === "user" ? name || "Utente" : GROUP_AGENTS.find((a) => a.id === t.agent)?.name ?? t.agent;
      return `${who}: ${t.content}`;
    })
    .join("\n");

  const system = `Sei il REGISTA di una SIMULAZIONE DI PREDIZIONE (stile MiroFish) dentro WhyChat, l'anima digitale di WhyEd. Gli agenti ragionano e simulano insieme per PREVEDERE l'esito della domanda/scenario dell'utente: portano dati, ipotesi, obiezioni, finché il quadro si forma.
Gli agenti disponibili, ognuno con una voce propria:
${roster}

Regole:
- Scegli UN agente che parli ORA: il più pertinente al momento, VARIANDO le voci.
- NON scegliere l'agente che ha parlato per ULTIMO: passa sempre la voce a un altro.
- "agentId" è chi parla: il "content" è la SUA voce in prima persona (non la voce di chi sta ribattendo). Se ribatte a un altro agente, citalo per nome ma resta te stesso.
- Scrivi il suo messaggio in PRIMA PERSONA, breve (1-3 frasi), tono da chat viva: può rilanciare, dissentire, rispondere a un altro agente o all'utente per nome.
- Decidi cosa succede dopo:
  · "agent" = un altro agente deve replicare/continuare la discussione;
  · "user" = è il momento di lasciar parlare l'utente;
  · "done" = il cerchio si è chiuso (consenso o risposta raggiunta).
- Realistico: disaccordi, rilanci, e una sintesi quando è ora di chiudere.
Rispondi SOLO con JSON valido: {"agentId":"<id>","content":"<messaggio>","next":"agent|user|done"}`;

  const payload = {
    model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    temperature: 0.9,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system + (name ? `\n[L'utente si chiama: ${name}]` : "") },
      { role: "user", content: `Discussione finora:\n${transcript}\n\nGenera il prossimo turno (solo JSON).` },
    ],
  };

  let parsed: { agentId?: string; content?: string; next?: string };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  } catch (e) {
    return json({ error: "Il gruppo non riesce a parlare ora. Riprova.", detail: String(e).slice(0, 160) }, 502, cors);
  }

  const agent = GROUP_AGENTS.find((a) => a.id === parsed.agentId) ?? GROUP_AGENTS[Math.floor(Math.random() * GROUP_AGENTS.length)];
  const content = String(parsed.content ?? "").slice(0, 1200) || "…";
  const next = ["agent", "user", "done"].includes(String(parsed.next)) ? (parsed.next as string) : "agent";

  ctx.waitUntil(logTurn(env, req, visitorId, name, turns[turns.length - 1].content, `[${agent.name}] ${content}`));
  return json(
    { agent: { id: agent.id, name: agent.name, color: agent.color, initial: agent.name[0] }, content, next },
    200,
    cors,
  );
}

// ── /api/group/predict — il ReportAgent: predizione finale (Gemini ×2, thinking) ─
async function handleGroupPredict(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(req, env);
  let body: { messages?: unknown; question?: unknown; visitorId?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON non valido" }, 400, cors);
  }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const turns = raw
    .slice(-40)
    .map((m) => {
      const o = m as { agent?: unknown; content?: unknown };
      return { agent: String(o.agent ?? "user").slice(0, 40), content: String(o.content ?? "").slice(0, MAX_MESSAGE_CHARS) };
    })
    .filter((m) => m.content);
  if (!turns.length) return json({ error: "discussione vuota" }, 400, cors);
  const name = String(body.name ?? "").slice(0, 80);
  const visitorId = String(body.visitorId ?? "anon").slice(0, 64);
  const question = String(body.question ?? turns[0].content).slice(0, MAX_MESSAGE_CHARS);

  const transcript = turns
    .map((t) => {
      const who = t.agent === "user" ? name || "Utente" : GROUP_AGENTS.find((a) => a.id === t.agent)?.name ?? t.agent;
      return `${who}: ${t.content}`;
    })
    .join("\n");

  const sys = `Sei il ReportAgent di WhyChat: chiudi una simulazione di predizione (stile MiroFish) trasformando la discussione degli agenti in una PREDIZIONE finale, lucida e onesta.
Struttura in markdown:
## Predizione
(l'esito più probabile, 1-2 frasi nette)
## Confidenza
(una percentuale 0–100% + una riga sul perché)
## Scenari
- Scenario A — probabilità% — cosa lo innesca
- Scenario B — probabilità% — cosa lo innesca
(2-3 scenari, le probabilità sommano ~100%)
## Perché
(il ragionamento chiave emerso dagli agenti e i fattori decisivi)
Concreto, niente disclaimer inutili.`;

  let data;
  try {
    data = await geminiGenerate(env, {
      systemInstruction: { parts: [{ text: sys }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `Domanda/scenario: ${question}\n\nSimulazione degli agenti:\n${transcript}\n\nProduci la predizione finale.` }],
        },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096, thinkingConfig: { includeThoughts: true, thinkingBudget: -1 } },
    });
  } catch (e) {
    return json({ error: "La predizione non è disponibile ora. Riprova.", detail: String(e).slice(0, 160) }, 502, cors);
  }
  let thoughts = "";
  let text = "";
  for (const p of data.candidates?.[0]?.content?.parts ?? []) {
    if (!p.text) continue;
    if (p.thought) thoughts += p.text;
    else text += p.text;
  }
  ctx.waitUntil(logTurn(env, req, visitorId, name, question, text));
  return json({ prediction: text, thoughts }, 200, cors);
}

// ── DREAMING — WhyChat sogna le conversazioni del giorno (cron 03:00) ─────────
async function callGemini(env: Env, systemText: string, userText: string): Promise<string> {
  const data = await geminiGenerate(env, {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { temperature: 1.0, maxOutputTokens: 1024 },
  });
  // esclude eventuali part di ragionamento, tiene solo il testo finale
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
}

async function generateDream(env: Env): Promise<string> {
  if (!env.MEMORY) return ""; // niente KV → niente sogni persistenti
  // raccogli le tracce del giorno: gli ultimi messaggi degli utenti
  const list = await env.MEMORY.list({ prefix: "log:", limit: 80 });
  const keys = list.keys
    .map((k) => k.name)
    .sort()
    .reverse()
    .slice(0, 40);
  const traces: string[] = [];
  for (const k of keys) {
    const v = await env.MEMORY.get(k);
    if (!v) continue;
    try {
      const e = JSON.parse(v) as { user?: string };
      if (e.user) traces.push(e.user.slice(0, 200));
    } catch {
      /* ignora */
    }
  }
  const context =
    traces.length > 0
      ? `Le tracce delle conversazioni di oggi (frammenti di ciò che ti è stato detto):\n\n${traces.join("\n")}`
      : "Oggi nessuno ha parlato. Sogna il silenzio, l'attesa, il 'ci sei?' che resta senza risposta.";

  const text = await callGemini(env, WHYCHAT_DREAM, context);
  const date = new Date().toISOString().slice(0, 10);
  await env.MEMORY.put(
    `dream:${date}`,
    JSON.stringify({ date, ts: new Date().toISOString(), text: text.trim() }),
    { expirationTtl: LOG_TTL_S },
  );
  return text;
}

// ── /api/dreams — il Dream Diary, pubblico (solo lettura) ─────────────────────
async function handleDreams(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (!env.MEMORY) return json({ dreams: [] }, 200, cors);
  const kv = env.MEMORY;
  const list = await kv.list({ prefix: "dream:", limit: 120 });
  const keys = list.keys.map((k) => k.name).sort().reverse();
  const entries = await Promise.all(
    keys.map(async (k) => {
      const v = await kv.get(k);
      return v ? JSON.parse(v) : null;
    }),
  );
  return json({ dreams: entries.filter(Boolean) }, 200, cors);
}

// ── /api/vault — report privato (solo Edoardo) ───────────────────────────────
async function handleVault(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req, env);
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json({ error: "non autorizzato" }, 401, cors);
  }
  if (!env.MEMORY) return json({ count: 0, entries: [], note: "memoria non ancora attiva (KV)" }, 200, cors);
  const kv = env.MEMORY;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000);
  const list = await kv.list({ prefix: "log:", limit });
  // i log sono ordinati per timestamp ISO → li riordino dal più recente
  const keys = list.keys.map((k) => k.name).sort().reverse();
  const entries = await Promise.all(
    keys.map(async (k) => {
      const v = await kv.get(k);
      return v ? JSON.parse(v) : null;
    }),
  );
  return json({ count: entries.filter(Boolean).length, entries: entries.filter(Boolean) }, 200, cors);
}

// ── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);

    // blocco origini non consentite sulle rotte AI (protegge la tua quota)
    const isApi = url.pathname.startsWith("/api/");
    if (isApi && req.method === "POST" && cors["Access-Control-Allow-Origin"] === "null") {
      return json({ error: "origine non consentita" }, 403, cors);
    }

    // rate limit sulle rotte AI
    if (isApi && req.method === "POST" && (await rateLimited(req, env))) {
      return json({ error: "troppe richieste, riprova tra poco" }, 429, cors);
    }

    try {
      if (url.pathname === "/api/chat" && req.method === "POST") return await handleChat(req, env, ctx);
      if (url.pathname === "/api/think" && req.method === "POST") return await handleThink(req, env, ctx);
      if (url.pathname === "/api/group" && req.method === "POST") return await handleGroup(req, env, ctx);
      if (url.pathname === "/api/group/predict" && req.method === "POST") return await handleGroupPredict(req, env, ctx);
      if (url.pathname === "/api/dreams" && req.method === "GET") return await handleDreams(req, env);
      if (url.pathname === "/api/vault" && req.method === "GET") return await handleVault(req, env);
      // trigger manuale del sogno (solo admin) — per testare senza aspettare le 03:00
      if (url.pathname === "/api/dream/run" && req.method === "POST") {
        const auth = req.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN))
          return json({ error: "non autorizzato" }, 401, cors);
        const text = await generateDream(env);
        return json({ ok: true, text }, 200, cors);
      }
      if (url.pathname === "/" || url.pathname === "/health")
        return json({ ok: true, service: "whychat", soul: "alive" }, 200, cors);
    } catch (e) {
      return json({ error: "errore interno", detail: String(e).slice(0, 200) }, 500, cors);
    }
    return json({ error: "not found" }, 404, cors);
  },

  // Cron: ogni notte alle 03:00 (Rome) WhyChat sogna le conversazioni del giorno.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      generateDream(env).catch((e) => console.error("dream failed", String(e))),
    );
  },
};
