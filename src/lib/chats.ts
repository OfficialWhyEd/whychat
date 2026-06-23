import type { Message } from "../components/ChatMessage";
import type { Mode } from "../components/CommandComposer";

export interface Chat {
  id: string;
  title: string;
  ts: number;
  mode?: Mode; // la modalità in cui è nata: la chat continua in questa
  messages: Message[];
  // sessione delle modalità che NON usano i messaggi (group, sheet): serializzata
  // qui così anche loro vivono tra le conversazioni e si possono riaprire.
  payload?: unknown;
}

const LS_KEY = "whychat_chats_v1";

export const newChatId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function loadChats(): Chat[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveChats(chats: Chat[]) {
  // tieni le ultime 50, pulisci i flag transitori (streaming) ma CONSERVA
  // ragionamento (thoughts) E le immagini/allegati → non si perdono più al reload.
  const clean = chats.slice(0, 50).map((c) => ({
    ...c,
    messages: c.messages.map((m) => {
      const base: Message = { id: m.id, role: m.role, content: m.content };
      if (m.thoughts) base.thoughts = m.thoughts;
      if (m.image) base.image = m.image;
      if (m.attachments?.length) base.attachments = m.attachments;
      return base;
    }),
  }));
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(clean));
  } catch {
    // quota piena (le immagini pesano): ripiega salvando SENZA i dataURL, così
    // testo, nomi file e ragionamento restano — meglio che perdere tutto.
    try {
      const light = clean.map((c) => ({
        ...c,
        messages: c.messages.map((m) => {
          const { image: _img, attachments, ...rest } = m;
          void _img;
          return { ...rest, attachments: attachments?.map((a) => ({ name: a.name, kind: a.kind })) };
        }),
      }));
      localStorage.setItem(LS_KEY, JSON.stringify(light));
    } catch {
      /* storage off: la chat resta in memoria */
    }
  }
}

export function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 46 ? t.slice(0, 46) + "…" : t || "Nuova conversazione";
}

export function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "ora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g`;
  return new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
