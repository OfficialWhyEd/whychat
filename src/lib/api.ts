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
): Promise<void> {
  const res = await postWithRetry(
    "/api/chat",
    { messages, visitorId: visitorId(), name: getName(), mode, model },
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

/** Modalità pensiero profondo (Gemini con thinking nativo): ragionamento + risposta. */
export async function deepThink(messages: ChatMessage[]): Promise<DeepResult> {
  const res = await postWithRetry(
    "/api/think",
    { messages, visitorId: visitorId(), name: getName() },
    undefined,
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { thoughts?: string; text?: string };
  return { thoughts: data.thoughts ?? "", text: data.text ?? "" };
}
