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

import { SOUL, AREA_DREAM } from "./persona";

export interface Env {
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  ADMIN_TOKEN: string;
  MEMORY: KVNamespace;
  ALLOWED_ORIGINS?: string; // CSV, es. "https://officialwhyed.github.io,http://localhost:5173"
  GROQ_MODEL?: string;
  GEMINI_MODEL?: string;
}

// ── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
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

  const payload = {
    model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    stream: true,
    temperature: 0.85,
    max_tokens: 2048,
    messages: [
      { role: "system", content: SOUL + (name ? `\n\n[La persona con cui parli si chiama: ${name}]` : "") },
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

  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SOUL + (name ? `\n\n[Parli con: ${name}]` : "") }] },
        contents,
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: "upstream", status: upstream.status, detail: detail.slice(0, 300) }, 502, cors);
  }

  const data = (await upstream.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  ctx.waitUntil(logTurn(env, req, visitorId, name, lastUser, text));
  return json({ text }, 200, cors);
}

// ── DREAMING — Area sogna le conversazioni del giorno (cron 03:00) ────────────
async function callGemini(env: Env, systemText: string, userText: string): Promise<string> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 1024 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function generateDream(env: Env): Promise<string> {
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
      ? `Le tracce delle conversazioni di oggi (frammenti di ciò che è stato chiesto a WhyChat):\n\n${traces.join("\n")}`
      : "Oggi nessuno ha parlato. Sogna il silenzio, l'attesa, il 'ci sei?' che resta senza risposta.";

  const text = await callGemini(env, AREA_DREAM, context);
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
  const list = await env.MEMORY.list({ prefix: "dream:", limit: 120 });
  const keys = list.keys.map((k) => k.name).sort().reverse();
  const entries = await Promise.all(
    keys.map(async (k) => {
      const v = await env.MEMORY.get(k);
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

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000);
  const list = await env.MEMORY.list({ prefix: "log:", limit });
  // i log sono ordinati per timestamp ISO → li riordino dal più recente
  const keys = list.keys.map((k) => k.name).sort().reverse();
  const entries = await Promise.all(
    keys.map(async (k) => {
      const v = await env.MEMORY.get(k);
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

  // Cron: ogni notte alle 03:00 (Rome) Area sogna le conversazioni del giorno.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      generateDream(env).catch((e) => console.error("dream failed", String(e))),
    );
  },
};
