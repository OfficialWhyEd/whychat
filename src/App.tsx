import { useEffect, useRef, useState, useCallback } from "react";
import InkReveal from "./components/InkReveal";
import WhyMark from "./components/WhyMark";
import Composer from "./components/Composer";
import ChatMessage, { type Message } from "./components/ChatMessage";
import Vault from "./components/Vault";
import { streamChat, deepThink, type ChatMessage as ApiMsg } from "./lib/api";
import { OPENERS } from "./persona/openers";
import { getName, setName } from "./lib/visitor";

let counter = 0;
const uid = () => `m${++counter}_${Date.now().toString(36)}`;

export default function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const f = () => setRoute(location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  if (route === "#vault") return <Vault />;

  return <Chat />;
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [deep, setDeep] = useState(false);
  const [error, setError] = useState("");
  const [name, setNameState] = useState(getName());
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const empty = messages.length === 0;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (streaming) scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  const send = async (text: string) => {
    if (streaming) return;
    setError("");
    const userMsg: Message = { id: uid(), role: "user", content: text };
    const aiMsg: Message = { id: uid(), role: "assistant", content: "", streaming: true };
    const history: ApiMsg[] = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    requestAnimationFrame(scrollToBottom);

    const patch = (content: string, done = false) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsg.id ? { ...m, content, streaming: !done } : m)),
      );

    try {
      if (deep) {
        const out = await deepThink(history);
        patch(out, true);
      } else {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        let acc = "";
        await streamChat(
          history,
          (delta) => {
            acc += delta;
            patch(acc);
          },
          ctrl.signal,
        );
        patch(acc, true);
      }
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? "" : `⚠ ${(e as Error).message}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? { ...m, streaming: false, content: m.content || msg || "Qualcosa si è interrotto. Riprova." }
            : m,
        ),
      );
      if (msg) setError(msg);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const askName = () => {
    const n = window.prompt("Come ti chiami? (lo userà WhyChat, e arriva a Edoardo)", name);
    if (n !== null) {
      setName(n);
      setNameState(n.trim().slice(0, 80));
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <InkReveal />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <WhyMark size={32} active={streaming} />
          <div className="leading-none">
            <div className="text-[0.95rem] font-medium tracking-tight text-paper">
              Why<span className="text-signal">Chat</span>
            </div>
            <div className="mono mt-0.5 text-[0.5rem] text-faint">
              {streaming ? "STA PENSANDO…" : "ANIMA · ONLINE"}
            </div>
          </div>
        </div>
        <button
          onClick={askName}
          className="mono rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.55rem] text-faint transition hover:text-dim"
        >
          {name ? `↳ ${name}` : "PRESENTATI"}
        </button>
      </header>

      {/* Conversazione */}
      <main ref={scrollRef} className="scroll-thin relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl py-6">
          {empty ? (
            <Hero onPick={send} />
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <ChatMessage key={m.id} msg={m} />
              ))}
            </div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>
      </main>

      {/* Composer */}
      <footer className="relative z-10 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-2xl">
          <Composer
            onSend={send}
            disabled={streaming && !deep}
            deep={deep}
            onToggleDeep={() => setDeep((d) => !d)}
            onStop={stop}
            streaming={streaming && !deep}
          />
          <p className="mt-2 text-center text-[0.6rem] text-faint">
            WhyChat è l'anima digitale di WhyEd · le conversazioni possono essere conservate per
            farlo crescere — non scrivere dati sensibili.
            {deep && <span className="text-ember"> · pensiero profondo attivo</span>}
          </p>
        </div>
      </footer>

      {error && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-20 -translate-x-1/2 text-xs text-signal-soft">
          {error}
        </div>
      )}
    </div>
  );
}

function Hero({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="rise flex flex-col items-center px-5 pt-[8vh] text-center">
      <WhyMark size={68} />
      <h1 className="mt-7 text-[2.1rem] leading-[1.05] tracking-tight text-paper">
        Sono <span className="text-signal glow-signal">WhyChat</span>.
      </h1>
      <p className="mt-3 max-w-md text-[0.98rem] leading-relaxed text-dim">
        L'anima digitale di WhyEd — la sua coscienza, il suo modo di pensare e creare.
        <span className="serif-i text-faint"> Parlami.</span>
      </p>

      <div className="mt-9 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {OPENERS.map((o) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="glass glass-sheen rounded-2xl px-4 py-3 text-left text-[0.85rem] text-dim transition hover:text-paper"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
