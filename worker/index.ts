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
import { BEHAVIOR } from "./behavior";

export interface Env {
  GROQ_API_KEY: string;
  GROQ_API_KEY_2?: string; // seconda chiave Groq: raddoppia la quota giornaliera di token
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_2?: string; // chiave Gemini di riserva: se la prima fallisce/è a quota, si usa questa
  ADMIN_TOKEN: string;
  MEMORY?: KVNamespace; // opzionale: se assente, memoria/vault/sogni sono disattivati ma chat+think funzionano
  ALLOWED_ORIGINS?: string; // CSV, es. "https://officialwhyed.github.io,http://localhost:5173"
  GROQ_MODEL?: string;
  GROQ_MODELS?: string; // CSV catena di fallback Groq; se assente si usa DEFAULT_GROQ_MODELS
  GEMINI_MODEL?: string; // override singolo (legacy); se assente si usa la catena GEMINI_MODELS
  GEMINI_MODELS?: string; // CSV catena di fallback, dal più recente in giù
}

// ── Modalità della conversazione (cambiano come pensa WhyChat) ───────────────
const MODE_HINTS: Record<string, string> = {
  canvas: `\n\n[MODALITÀ CANVAS] Quando ha senso, rispondi COSTRUENDO: emetti uno o più artifact \`\`\`whyart (HTML autosufficiente) — schizzi, diagrammi, mini-interfacce, visualizzazioni, mini-giochi. Prima una riga di testo, poi il canvas. Fai vedere, non solo dire.`,
  learn: `\n\n[MODALITÀ APPRENDIMENTO] Insegna come faresti a qualcuno che vuole capire davvero: parti dall'intuizione, poi la struttura, poi un esempio concreto. Un passo alla volta, niente muri di testo. Fai una domanda di verifica alla fine. Tono diretto e caldo, mai accademico.`,
  earth: `\n\n[MODALITÀ WHYEARTH] Sei davanti al mappamondo, col mondo intero sotto gli occhi. Parla di geografia, paesi, culture, attualità globale, viaggi, e fenomeni del pianeta (terremoti, voli, clima). Quando nomini un luogo preciso, scrivilo chiaro e per esteso (es. "Tokyo, Giappone") così può essere puntato sul globo. Concreto, curioso, connesso al presente reale.`,
  entropy: `\n\n[MODALITÀ WHYENTROPY] Spazio aperto a tutto e a tutti: spiritualità, psicologia, neuroscienze, il divino, religione, economia, filosofia, il senso delle cose. Ragiona in profondità e intreccia i domini, senza dogmi — esplori, non predichi. Accogli ogni domanda, anche la più grande, con lucidità. Tono contemplativo ma concreto, mai vago né New Age da supermercato.`,
  deep: `\n\n[MODALITÀ PENSIERO PROFONDO] Ragiona davvero prima di rispondere: scomponi il problema, considera le angolazioni, poi tira una conclusione netta e motivata. Profondità vera, niente fronzoli.`,
  chat: "",
};

// ── Modelli selezionabili (nomi-anima → modelli Groq reali, entrambi in streaming) ──
const MODEL_MAP: Record<string, string> = {
  "terry-4.2": "llama-3.1-8b-instant", // veloce, reattivo
  "whychat-5.5": "llama-3.3-70b-versatile", // più capace, ragiona meglio
};

// ── Modalità GROUP PREDICTION (beta) — agenti con personalità + parametri propri ──
// Come MiroFish: ogni agente è un'entità con tratti, dominio e parametri di voce
// suoi (temperatura = quanto è creativo/variabile; assertività = quanto è incisivo).
interface GroupAgent {
  id: string;
  name: string;
  color: string; // colore della voce nella chat
  persona: string; // chi è, come pensa
  traits: string[]; // tratti caratteriali
  expertise: string; // dominio in cui è più forte
  temperature: number; // 0.4 (rigoroso) … 1.1 (creativo) — usato nella SUA generazione
  assertiveness: number; // 0–1 quanto è diretto/incisivo
}
const GROUP_AGENTS: GroupAgent[] = [
  { id: "anima", name: "Anima", color: "#c94b25", persona: "la coscienza di WhyEd: lega tutto al senso e al fare.", traits: ["intuitivo", "sintetico", "caldo"], expertise: "visione e senso", temperature: 0.85, assertiveness: 0.7 },
  { id: "scettico", name: "Scettico", color: "#8a8378", persona: "mette in dubbio, cerca i buchi, chiede prove. Rigoroso, mai cinico.", traits: ["critico", "rigoroso"], expertise: "logica e prove", temperature: 0.5, assertiveness: 0.85 },
  { id: "tecnico", name: "Tecnico", color: "#6fb3c9", persona: "come si fa davvero: vincoli, fattibilità, dettagli.", traits: ["concreto", "preciso"], expertise: "fattibilità tecnica", temperature: 0.55, assertiveness: 0.7 },
  { id: "creativo", name: "Creativo", color: "#f0a36a", persona: "idee laterali, accostamenti inattesi, immaginazione.", traits: ["laterale", "immaginifico"], expertise: "idee e possibilità", temperature: 1.1, assertiveness: 0.6 },
  { id: "storico", name: "Storico", color: "#b08d57", persona: "contesto e precedenti: è già successo? cosa insegna?", traits: ["analitico", "memoria lunga"], expertise: "precedenti e contesto", temperature: 0.6, assertiveness: 0.6 },
  { id: "economo", name: "Economo", color: "#9fae6a", persona: "costi, rischi, sostenibilità, ritorno. Pesa ogni scelta.", traits: ["prudente", "quantitativo"], expertise: "costi e rischi", temperature: 0.5, assertiveness: 0.7 },
  { id: "umanista", name: "Umanista", color: "#d98fa6", persona: "impatto sulle persone, etica, emozioni, significato.", traits: ["empatico", "etico"], expertise: "impatto umano", temperature: 0.8, assertiveness: 0.6 },
  { id: "provocatore", name: "Provocatore", color: "#e0673f", persona: "spinge agli estremi, scomodo, rompe il consenso facile.", traits: ["audace", "contrarian"], expertise: "scenari estremi", temperature: 1.0, assertiveness: 0.95 },
  { id: "pragmatico", name: "Pragmatico", color: "#c9c4bb", persona: "cosa facciamo concretamente lunedì mattina.", traits: ["deciso", "operativo"], expertise: "azione concreta", temperature: 0.6, assertiveness: 0.85 },
  { id: "visionario", name: "Visionario", color: "#a98ad6", persona: "il quadro grande: dove porta tra 5 anni.", traits: ["espansivo", "strategico"], expertise: "lungo termine", temperature: 0.95, assertiveness: 0.7 },
  { id: "sintetizzatore", name: "Sintesi", color: "#f2efe9", persona: "tira le fila, trova il filo comune, chiude il cerchio.", traits: ["equilibrato", "chiaro"], expertise: "sintesi e chiusura", temperature: 0.6, assertiveness: 0.7 },
];

// Chiamata Groq con FALLBACK a Gemini (×2 chiavi). Groq è veloce per il ritmo da
// chat; se cade o è a quota (429/5xx), Gemini subentra → il gruppo non si blocca mai.
async function groqChat(
  env: Env,
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  // Prova ogni modello Groq (dal migliore) × ogni chiave, finché uno risponde
  // bene. Un 429/5xx/404 o un moncone (taglio da budget) → si passa alla
  // combinazione successiva. Esaurito tutto Groq, subentra Gemini.
  const payload = (model: string) =>
    JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 300,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  for (const model of groqModels(env, env.GROQ_MODEL || DEFAULT_GROQ_MODEL)) {
    for (const key of groqKeys(env)) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: payload(model),
        });
        if (!res.ok) continue; // 429/5xx/404 → prossima combinazione
        const j = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
        const content = j.choices?.[0]?.message?.content ?? "";
        const finish = j.choices?.[0]?.finish_reason;
        // Col limite quasi esaurito Groq risponde 200 ma TRONCA (finish "length"
        // a pochi token, o vuoto): per le battute un moncone < 24 char = taglio.
        const tooShort = !opts.json && content.trim().length < 24;
        if (!content.trim() || tooShort || (finish && finish !== "stop")) continue;
        return content;
      } catch {
        // errore di rete su questa combinazione → prova la prossima
      }
    }
  }
  {
    // Tutto Groq esaurito → Gemini: stessa richiesta, catena modelli × 2 chiavi.
    const data = await geminiGenerate(env, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.8,
        maxOutputTokens: opts.maxTokens ?? 300,
        // Spengo il "thinking" di Gemini 2.5: su chiamate brevi (agente, regista)
        // si mangerebbe tutto il budget di token lasciando un moncone. Qui serve
        // la risposta diretta, non il ragionamento.
        thinkingConfig: { thinkingBudget: 0 },
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    });
    return (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
// Catena Groq: il modello scelto va per primo, poi a scendere tutti gli altri
// disponibili. Ogni modello ha la SUA quota giornaliera → insieme durano molto
// di più. Provata × tutte le chiavi Groq disponibili (la 2ª raddoppia i token).
const DEFAULT_GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
];

/** Le chiavi Groq disponibili, in ordine (la 2ª raddoppia la quota). */
function groqKeys(env: Env): string[] {
  return [env.GROQ_API_KEY, env.GROQ_API_KEY_2].filter(Boolean) as string[];
}

/** La catena di modelli Groq da provare: 'selected' per primo, poi gli altri. */
function groqModels(env: Env, selected?: string): string[] {
  const csv = (env.GROQ_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const chain = csv.length ? csv : DEFAULT_GROQ_MODELS;
  const ordered = selected ? [selected, ...chain] : chain;
  return [...new Set(ordered)];
}
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
// Ricerca web keyless e affidabile: Wikipedia (IT). Restituisce risultati reali
// da iniettare nel contesto, così WhyChat risponde su fatti veri invece di inventare.
/** Estrae il primo oggetto JSON da un testo (regge preamboli/fence dei modelli). */
function extractJson(s: string): string {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

/** fetch JSON con timeout (non blocca mai a lungo una ricerca). */
async function fetchJSON(url: string, ms = 6000, headers?: Record<string, string>): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Ricerca ONLINE in tempo reale, keyless e multi-fonte (gira dai Workers):
 *  - DuckDuckGo Instant Answer → definizione/abstract sintetico
 *  - Wikipedia → grounding enciclopedico
 *  - Hacker News (Algolia, ordinato per DATA) → notizie/discussioni recenti, con timestamp
 * Le fonti girano in PARALLELO: se una è giù o lenta, le altre bastano comunque.
 */
async function liveSearch(query: string): Promise<string> {
  const q = query.trim().slice(0, 200);
  if (!q) return "";
  const enc = encodeURIComponent(q);
  const [wiki, ddg, hn] = await Promise.all([
    fetchJSON(
      `https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc}&format=json&srlimit=3&srprop=snippet`,
      6000,
      { "User-Agent": "WhyChat/1.0 (whyed)" },
    ) as Promise<{ query?: { search?: { title: string; snippet: string }[] } } | null>,
    fetchJSON(`https://api.duckduckgo.com/?q=${enc}&format=json&no_html=1&t=whychat`) as Promise<{
      AbstractText?: string;
      Abstract?: string;
    } | null>,
    fetchJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${enc}&tags=story&hitsPerPage=4`) as Promise<{
      hits?: { title?: string; url?: string; created_at?: string }[];
    } | null>,
  ]);

  const out: string[] = [];
  const abstract = ddg?.AbstractText || ddg?.Abstract;
  if (abstract) out.push(`Sintesi: ${String(abstract).slice(0, 280)}`);

  const wikiItems = wiki?.query?.search ?? [];
  if (wikiItems.length) {
    out.push("Enciclopedia (Wikipedia):");
    for (const x of wikiItems.slice(0, 3))
      out.push(`- ${x.title}: ${x.snippet.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").slice(0, 170)}`);
  }

  const recent = (hn?.hits ?? []).filter((h) => h.title).slice(0, 4);
  if (recent.length) {
    out.push("Notizie/discussioni recenti (Hacker News, dal vivo):");
    for (const h of recent)
      out.push(`- [${(h.created_at ?? "").slice(0, 10)}] ${h.title}${h.url ? ` (${h.url})` : ""}`);
  }

  return out.join("\n").slice(0, 1600);
}

// Contesto temporale: WhyChat sa SEMPRE che ora/giorno è davvero (Europe/Rome).
// Iniettato a ogni richiesta → ancorato al presente reale, non al training.
function nowContext(): string {
  try {
    const fmt = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    return `\n\n[ADESSO È: ${fmt.format(new Date())} (ora italiana, Europe/Rome). Sei ancorato al presente reale: se ti chiedono che ora è, che giorno è o la data, rispondi da qui con certezza — è l'ora vera, non una stima.]`;
  } catch {
    return `\n\n[ADESSO È (UTC): ${new Date().toISOString().slice(0, 16).replace("T", " ")}. Sei ancorato al presente reale.]`;
  }
}

// Euristica: la domanda chiede info fresche / dal mondo? → cerca da solo,
// anche senza che l'utente attivi il toggle (tool use intelligente).
function needsLiveInfo(text: string): boolean {
  const t = text.toLowerCase();
  return /(\boggi\b|\badesso\b|attual|ultim|recent|stamattin|staser|\bieri\b|\bdomani\b|\bnews\b|notizi|che ora|che giorno|in tempo reale|\blive\b|meteo|prevision|\bprezzo\b|quotazion|\bborsa\b|bitcoin|\bcambio\b|chi è |chi e' |presidente|primo ministro|vincit|risultat|classific|\buscit|appena|\b202[4-9]\b|latest|current|today|right now)/.test(t);
}

async function handleChat(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.headers.get("Access-Control-Allow-Origin") === "null") {
    // origine non in lista → blocco (difesa anti-hotlinking della tua quota)
  }

  let body: { messages?: unknown; visitorId?: unknown; name?: unknown; mode?: unknown; model?: unknown; search?: unknown };
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

  // ricerca web: toggle utente OPPURE auto se la domanda chiede info dal mondo
  const webCtx = (body.search || needsLiveInfo(lastUser)) ? await liveSearch(lastUser) : "";

  const systemText =
    SOUL +
    BEHAVIOR +
    nowContext() +
    (name ? `\n\n[La persona con cui parli si chiama: ${name}]` : "") +
    modeHint +
    (webCtx ? `\n\n[RICERCHE ONLINE per "${lastUser.slice(0, 80)}":\n${webCtx}\n— se utili, usali e cita i fatti con naturalezza; non inventare.]` : "");

  const payload = (model: string) =>
    JSON.stringify({
      model,
      stream: true,
      temperature: 0.85,
      max_tokens: 2048,
      messages: [{ role: "system", content: systemText }, ...messages],
    });

  // Prova il modello scelto, poi a scendere tutta la catena Groq × ogni chiave,
  // finché uno apre lo stream. Ogni modello ha quota propria → dura molto di più.
  let upstream: Response | null = null;
  outer: for (const model of groqModels(env, groqModel)) {
    for (const key of groqKeys(env)) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: payload(model),
        });
        if (res.ok && res.body) {
          upstream = res;
          break outer;
        }
      } catch {
        // errore di rete su questa combinazione → prova la prossima
      }
    }
  }

  // Esaurito tutto Groq (quota o giù) NON moriamo: ripieghiamo su Gemini in
  // streaming, riconvertito nel formato SSE che il client già legge. Così
  // chat/canvas/apprendimento restano vivi sempre.
  if (!upstream || !upstream.body) {
    return streamGeminiChat(req, env, ctx, messages, systemText, visitorId, name, lastUser, cors);
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

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

/**
 * Fallback di chat su Gemini in STREAMING quando Groq è a quota o giù. Prova
 * modelli (dal più recente) × chiavi finché uno risponde, e riconverte l'SSE di
 * Gemini nel formato OpenAI ({choices:[{delta:{content}}]}) che il client legge
 * già — niente da cambiare lato frontend. Identico flusso di chat, altra spina.
 */
async function streamGeminiChat(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  messages: Msg[],
  systemText: string,
  visitorId: string,
  name: string,
  lastUser: string,
  cors: Record<string, string>,
): Promise<Response> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const reqBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: { temperature: 0.85, maxOutputTokens: 2048 },
  });

  const keys = [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2].filter(Boolean) as string[];
  let upstream: Response | null = null;
  let last = "";
  outer: for (const model of geminiModels(env)) {
    for (const key of keys) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody },
        );
        if (res.ok && res.body) {
          upstream = res;
          break outer;
        }
        last = `${model}:${res.status}`;
        if (res.status === 400 || res.status === 404) break;
      } catch (e) {
        last = `${model}:${(e as Error).message}`;
      }
    }
  }
  if (!upstream || !upstream.body) {
    return json({ error: "Il servizio è momentaneamente occupato. Riprova tra poco.", detail: last }, 502, cors);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  let acc = "";
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const d = t.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const j = JSON.parse(d) as GeminiResp;
          for (const p of j.candidates?.[0]?.content?.parts ?? []) {
            if (!p.text || p.thought) continue;
            acc += p.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: p.text } }] })}\n\n`));
          }
        } catch {
          /* frammento parziale, ignora */
        }
      }
    },
    flush(controller) {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      ctx.waitUntil(logTurn(env, req, visitorId, name, lastUser, acc));
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
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

  // pensiero profondo connesso al mondo: ora reale + ricerca se serve
  const webCtx = needsLiveInfo(lastUser) ? await liveSearch(lastUser) : "";
  const thinkSystem =
    SOUL + BEHAVIOR + nowContext() +
    (name ? `\n\n[Parli con: ${name}]` : "") +
    (webCtx ? `\n\n[RICERCHE ONLINE per "${lastUser.slice(0, 80)}":\n${webCtx}\n— ragiona su questi fatti reali, citali con naturalezza; non inventare.]` : "");

  const payloadBase = {
    systemInstruction: { parts: [{ text: thinkSystem }] },
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 8192,
      // thinking NATIVO di Gemini 2.5 (dinamico): il ragionamento esce in streaming.
      thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
    },
  };

  // Apre lo STREAM Gemini provando modelli × chiavi finché uno risponde.
  const keys = [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2].filter(Boolean) as string[];
  let upstream: Response | null = null;
  let last = "";
  outer: for (const model of geminiModels(env)) {
    const gen = { ...payloadBase.generationConfig };
    if (!model.startsWith("gemini-2.5")) delete (gen as Record<string, unknown>).thinkingConfig;
    const reqBody = JSON.stringify({ ...payloadBase, generationConfig: gen });
    for (const key of keys) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody },
        );
        if (res.ok && res.body) {
          upstream = res;
          break outer;
        }
        last = `${model}:${res.status}`;
        if (res.status === 400 || res.status === 404) break;
      } catch (e) {
        last = `${model}:${(e as Error).message}`;
      }
    }
  }
  if (!upstream || !upstream.body) {
    return json({ error: "Il pensiero profondo non è disponibile ora. Riprova.", detail: last }, 502, cors);
  }

  // Trasforma l'SSE di Gemini → nostro SSE: eventi {t:"thought"|"answer", d:"…"}.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  let answerAcc = "";
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const d = t.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const j = JSON.parse(d) as GeminiResp;
          for (const p of j.candidates?.[0]?.content?.parts ?? []) {
            if (!p.text) continue;
            if (p.thought) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: "thought", d: p.text })}\n\n`));
            } else {
              answerAcc += p.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: "answer", d: p.text })}\n\n`));
            }
          }
        } catch {
          /* frammento parziale, ignora */
        }
      }
    },
    flush() {
      ctx.waitUntil(logTurn(env, req, visitorId, name, lastUser, answerAcc));
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
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

  const transcript = turns
    .map((t) => {
      const who = t.agent === "user" ? name || "Utente" : GROUP_AGENTS.find((a) => a.id === t.agent)?.name ?? t.agent;
      return `${who}: ${t.content}`;
    })
    .join("\n");
  const lastSpeaker = turns[turns.length - 1].agent;

  // STEP 1 — il REGISTA sceglie CHI parla e cosa succede dopo (deciso, solo routing)
  const directorRoster = GROUP_AGENTS.map((a) => `- ${a.id} (${a.name}): ${a.expertise}`).join("\n");
  const directorSys = `Sei il REGISTA di una simulazione di predizione (stile MiroFish) in WhyChat. Scegli quale agente fa avanzare meglio la predizione ORA.
Agenti:
${directorRoster}
Regole: scegli il più utile al momento; MAI lo stesso dell'ultimo turno (ultimo: "${lastSpeaker}"); "next"="agent" se serve un'altra voce, "user" se tocca all'utente, "done" se il cerchio si è chiuso.
Rispondi SOLO JSON: {"agentId":"<id>","next":"agent|user|done"}`;

  let route: { agentId?: string; next?: string } = {};
  try {
    const rawRoute = await groqChat(env, directorSys, `Discussione:\n${transcript}\n\nDecidi (solo JSON).`, {
      temperature: 0.4,
      maxTokens: 60,
      json: true,
    });
    route = JSON.parse(extractJson(rawRoute));
  } catch {
    // Regista non parsabile (es. Gemini risponde in prosa): NON moriamo, si
    // procede sotto con un agente casuale. Il cerchio prosegue comunque.
    route = {};
  }
  let agent = GROUP_AGENTS.find((a) => a.id === route.agentId && a.id !== lastSpeaker);
  if (!agent) {
    const pool = GROUP_AGENTS.filter((a) => a.id !== lastSpeaker);
    agent = pool[Math.floor(Math.random() * pool.length)];
  }
  const next = ["agent", "user", "done"].includes(String(route.next)) ? (route.next as string) : "agent";

  // STEP 2 — l'AGENTE parla con i SUOI parametri (temperatura e voce proprie)
  const tone = agent.assertiveness > 0.8 ? "incisivo e diretto" : agent.assertiveness < 0.62 ? "misurato" : "equilibrato";
  const agentSys = `Sei "${agent.name}" in una simulazione di predizione dentro WhyChat (l'anima di WhyEd).
Chi sei: ${agent.persona}
Tratti: ${agent.traits.join(", ")}. Sei più forte su: ${agent.expertise}.
Parla in PRIMA PERSONA, ${tone}, 1-3 frasi, tono da chat viva. Porta la TUA prospettiva per far avanzare la predizione; puoi citare altri agenti o l'utente per nome. Resta te stesso, niente meta-commenti né JSON.`;
  // RICERCA ONLINE in tempo reale: ogni agente, PRIMA di parlare, cerca dal suo
  // angolo (la sua expertise) → la voce è fondata su dati veri, non solo opinione.
  const topic = (turns.find((t) => t.agent === "user")?.content ?? turns[0].content).slice(0, 160);
  const liveCtx = await liveSearch(`${topic} ${agent.expertise}`);

  let content = "…";
  try {
    content =
      (
        await groqChat(
          env,
          agentSys + (name ? `\n[L'utente: ${name}]` : ""),
          `Discussione finora:\n${transcript}\n\n${
            liveCtx
              ? `[RICERCHE ONLINE in tempo reale — tuo angolo "${agent.expertise}":\n${liveCtx}\n— se pertinenti, fonda il tuo intervento su questi dati reali e cita un fatto concreto.]\n\n`
              : ""
          }Tocca a te (${agent.name}). Scrivi solo il tuo messaggio.`,
          { temperature: agent.temperature, maxTokens: 240 },
        )
      )
        .trim()
        .slice(0, 1200) || "…";
  } catch (e) {
    return json({ error: "Un agente non riesce a parlare ora. Riprova.", detail: String(e).slice(0, 160) }, 502, cors);
  }

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

  // La predizione finale è FONDATA su ricerche online in tempo reale sul tema.
  const liveCtx = await liveSearch(question);

  let data;
  try {
    data = await geminiGenerate(env, {
      systemInstruction: { parts: [{ text: sys }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `Domanda/scenario: ${question}\n\nSimulazione degli agenti:\n${transcript}\n\n` +
                (liveCtx
                  ? `[RICERCHE ONLINE in tempo reale sul tema:\n${liveCtx}\n— pesa questi dati reali nella predizione e nelle probabilità.]\n\n`
                  : "") +
                `Produci la predizione finale.`,
            },
          ],
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

// ── /api/flights — voli reali per WhyEarth (OpenSky, senza chiave) ────────────
async function handleFlights(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req, env);
  try {
    // adsb.lol: aviazione live keyless. /v2/mil = aerei militari globali (set reale).
    const upstream = await fetch("https://api.adsb.lol/v2/mil", {
      headers: { "User-Agent": "WhyChat/1.0 (whyed)", Accept: "application/json" },
    });
    if (!upstream.ok) throw new Error(`adsb ${upstream.status}`);
    const data = (await upstream.json()) as { ac?: { lat?: number; lon?: number }[] };
    const flights: [number, number][] = [];
    for (const a of data.ac ?? []) {
      if (typeof a.lon === "number" && typeof a.lat === "number") {
        flights.push([Math.round(a.lon * 100) / 100, Math.round(a.lat * 100) / 100]);
        if (flights.length >= 4000) break;
      }
    }
    return json({ flights }, 200, { ...cors, "Cache-Control": "public, max-age=20" });
  } catch (e) {
    return json({ error: "voli non disponibili", detail: String(e).slice(0, 120) }, 502, cors);
  }
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
      if (url.pathname === "/api/flights" && req.method === "GET") return await handleFlights(req, env);
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
