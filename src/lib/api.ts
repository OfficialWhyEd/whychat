import { visitorId, getName } from "./visitor";

// Endpoint del Worker. Override con VITE_WORKER_URL in build.
export const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined) ??
  "https://whychat-ai.officialwhyed.workers.dev";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Status transitori del gateway: vale la pena riprovare (Worker freddo, Groq lento).
const TRANSIENT = new Set([502, 503, 504]);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * POST con retry sui 502/503/504 (Bad Gateway & co.): fino a 3 tentativi con
 * backoff crescente. Riprova solo PRIMA che lo stream parta → nessun token
 * duplicato. Un AbortError interrompe subito, senza ritentare.
 */
async function postWithRetry(
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  attempts = 3,
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!TRANSIENT.has(res.status) || i === attempts - 1) return res;
    last = res;
    await sleep(600 * (i + 1), signal); // 600ms, 1200ms
  }
  return last!;
}

/** Errore leggibile a partire dalla risposta non-ok (niente "errore 502" crudo). */
async function readError(res: Response): Promise<string> {
  if (TRANSIENT.has(res.status))
    return "Il server è momentaneamente occupato. Riprova tra un istante.";
  const err = (await res.json().catch(() => ({}))) as { error?: string };
  return err.error ?? `Qualcosa è andato storto (${res.status}).`;
}

/**
 * Streaming chat verso il Worker (Groq SSE, formato OpenAI).
 * onToken viene chiamato per ogni frammento di testo.
 */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal,
  mode = "chat",
  model = "whychat-5.5",
  search = false,
): Promise<void> {
  const res = await postWithRetry(
    "/api/chat",
    { messages, visitorId: visitorId(), name: getName(), mode, model, search },
    signal,
  );

  if (!res.ok || !res.body) {
    throw new Error(await readError(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string") onToken(delta);
      } catch {
        /* frammento parziale, ignora */
      }
    }
  }
}

export interface Dream {
  date: string;
  ts: string;
  text: string;
}

/** Il sogno di WhyChat (pubblico, solo lettura). */
export async function fetchDreams(): Promise<Dream[]> {
  const res = await fetch(`${WORKER_URL}/api/dreams`);
  if (!res.ok) throw new Error(`errore ${res.status}`);
  const data = (await res.json()) as { dreams?: Dream[] };
  return data.dreams ?? [];
}

export interface DeepResult {
  thoughts: string; // il ragionamento del modello (vero, dinamico)
  text: string; // la risposta finale
}

/**
 * Modalità pensiero profondo (Gemini thinking nativo) IN STREAMING: il
 * ragionamento e la risposta arrivano token dopo token, come su Claude.
 * onThought = pezzo di ragionamento; onAnswer = pezzo di risposta finale.
 */
export async function deepThink(
  messages: ChatMessage[],
  onThought: (delta: string) => void,
  onAnswer: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await postWithRetry("/api/think", { messages, visitorId: visitorId(), name: getName() }, signal);
  if (!res.ok || !res.body) throw new Error(await readError(res));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const d = t.slice(5).trim();
      if (!d) continue;
      try {
        const ev = JSON.parse(d) as { t?: string; d?: string };
        if (ev.t === "thought" && ev.d) onThought(ev.d);
        else if (ev.t === "answer" && ev.d) onAnswer(ev.d);
      } catch {
        /* frammento parziale, ignora */
      }
    }
  }
}

// ── Plan (P5/P6): scompone un compito in passi mostrati come timeline agente ──
export interface PlanStepData {
  title: string;
  tool: string;
  detail?: string;
}
export async function planSteps(messages: ChatMessage[], task?: string): Promise<PlanStepData[]> {
  const res = await postWithRetry("/api/plan", { messages, task, visitorId: visitorId(), name: getName() }, undefined);
  if (!res.ok) throw new Error(await readError(res));
  const d = (await res.json()) as { steps?: PlanStepData[] };
  return d.steps ?? [];
}

// ── OnlyType vision (P8): il disegno È il prompt → WhyChat lo crea ────────────
export async function seeDrawing(image: string, prompt?: string, signal?: AbortSignal): Promise<string> {
  const res = await postWithRetry("/api/see", { image, prompt, visitorId: visitorId(), name: getName() }, signal);
  if (!res.ok) throw new Error(await readError(res));
  const d = (await res.json()) as { text?: string };
  return d.text ?? "";
}

// ── WhyMusic (P9): analisi profonda dalle metriche audio estratte nel browser ─
export async function analyzeMusic(features: Record<string, unknown>, ask?: string): Promise<string> {
  const res = await postWithRetry("/api/music", { features, ask, visitorId: visitorId(), name: getName() }, undefined);
  if (!res.ok) throw new Error(await readError(res));
  const d = (await res.json()) as { text?: string };
  return d.text ?? "";
}

// ── Group Prediction (beta): simulazione a più agenti stile MiroFish ──────────
export interface GroupAgentMeta {
  id: string;
  name: string;
  color: string;
  initial: string;
}
export interface GroupTurn {
  agent: GroupAgentMeta;
  content: string;
  next: "agent" | "user" | "done";
}
export interface GroupMsg {
  agent: string; // id agente, oppure "user"
  content: string;
}

/** Un turno della discussione: il regista sceglie chi parla e cosa succede dopo. */
export async function groupTurn(messages: GroupMsg[]): Promise<GroupTurn> {
  const res = await postWithRetry("/api/group", { messages, visitorId: visitorId(), name: getName() }, undefined);
  if (!res.ok) throw new Error(await readError(res));
  const d = (await res.json()) as Partial<GroupTurn>;
  return {
    agent: d.agent ?? { id: "anima", name: "Anima", color: "#c94b25", initial: "A" },
    content: d.content ?? "…",
    next: d.next ?? "user",
  };
}

/** La predizione finale (ReportAgent, Gemini ×2 + thinking). */
export async function groupPredict(messages: GroupMsg[], question: string): Promise<DeepResult & { prediction: string }> {
  const res = await postWithRetry(
    "/api/group/predict",
    { messages, question, visitorId: visitorId(), name: getName() },
    undefined,
  );
  if (!res.ok) throw new Error(await readError(res));
  const d = (await res.json()) as { prediction?: string; thoughts?: string };
  return { prediction: d.prediction ?? "", thoughts: d.thoughts ?? "", text: d.prediction ?? "" };
}
