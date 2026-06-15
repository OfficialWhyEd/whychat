import { visitorId, getName } from "./visitor";

// Endpoint del Worker. Override con VITE_WORKER_URL in build.
export const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined) ??
  "https://whychat-ai.officialwhyed.workers.dev";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Streaming chat verso il Worker (Groq SSE, formato OpenAI).
 * onToken viene chiamato per ogni frammento di testo.
 */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${WORKER_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, visitorId: visitorId(), name: getName() }),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `errore ${res.status}`);
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

/** Il Dream Diary di Area (pubblico, solo lettura). */
export async function fetchDreams(): Promise<Dream[]> {
  const res = await fetch(`${WORKER_URL}/api/dreams`);
  if (!res.ok) throw new Error(`errore ${res.status}`);
  const data = (await res.json()) as { dreams?: Dream[] };
  return data.dreams ?? [];
}

/** Modalità pensiero profondo (Gemini, risposta intera). */
export async function deepThink(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/think`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, visitorId: visitorId(), name: getName() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `errore ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}
