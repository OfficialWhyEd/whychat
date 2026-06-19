import { useEffect, useRef, useState, useCallback } from "react";
import SoulParticles from "./components/SoulParticles";
import InkReveal from "./components/InkReveal";
import SilkTrails from "./components/SilkTrails";
import AnimatedTextCycle from "./components/AnimatedTextCycle";
import CommandComposer, { MODES, type Mode } from "./components/CommandComposer";
import BlankSheet from "./components/BlankSheet";
import ModelSelector, { modelName } from "./components/ModelSelector";
import OriginButton from "./components/OriginButton";
import Sidebar from "./components/Sidebar";
import ChatMessage, { type Message } from "./components/ChatMessage";
import Vault from "./components/Vault";
import Dreams from "./components/Dreams";
import { streamChat, deepThink, type ChatMessage as ApiMsg } from "./lib/api";
import { loadChats, saveChats, newChatId, titleFrom, type Chat } from "./lib/chats";
import { pickOpeners } from "./persona/openers";
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
  if (route === "#dreams") return <Dreams />;
  return <Chat />;
}

function Chat() {
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [model, setModel] = useState("whychat-5.5");
  const [error, setError] = useState("");
  const [name, setNameState] = useState(getName());
  // stato del pannello: ricorda come l'hai lasciato (aperto/chiuso); default per
  // viewport solo la prima volta
  const [sidebar, setSidebar] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("whychat_sidebar") : null;
    if (saved !== null) return saved === "1";
    return typeof window !== "undefined" && window.innerWidth >= 768;
  });
  useEffect(() => {
    localStorage.setItem("whychat_sidebar", sidebar ? "1" : "0");
  }, [sidebar]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const empty = messages.length === 0;
  const sheet = mode === "sheet";

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (streaming) scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  const send = async (text: string, modeOverride?: Mode) => {
    if (streaming) return;
    setError("");
    // un'apertura legata a una modalità avvia (e fa continuare) la chat in quella modalità
    const useMode = modeOverride ?? mode;
    if (modeOverride && modeOverride !== mode) setMode(modeOverride);
    const userMsg: Message = { id: uid(), role: "user", content: text };
    const aiMsg: Message = { id: uid(), role: "assistant", content: "", streaming: true };

    const existing = chats.find((c) => c.id === activeId);
    const baseMessages = existing?.messages ?? [];
    let id = activeId;
    let nextChats: Chat[];
    if (existing) {
      nextChats = chats.map((c) =>
        c.id === id ? { ...c, ts: Date.now(), messages: [...c.messages, userMsg, aiMsg] } : c,
      );
    } else {
      id = newChatId();
      nextChats = [{ id, title: titleFrom(text), ts: Date.now(), mode: useMode, messages: [userMsg, aiMsg] }, ...chats];
    }
    setChats(nextChats);
    saveChats(nextChats);
    setActiveId(id);
    setStreaming(true);
    requestAnimationFrame(scrollToBottom);

    const history: ApiMsg[] = [...baseMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    const patch = (content: string, done = false) =>
      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, content, streaming: !done } : m)) }
            : c,
        ),
      );

    try {
      if (useMode === "deep") {
        const { thoughts, text } = await deepThink(history);
        setChats((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === aiMsg.id ? { ...m, content: text, thoughts, streaming: false } : m,
                  ),
                }
              : c,
          ),
        );
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
          useMode,
          model,
        );
        patch(acc, true);
      }
      setChats((prev) => {
        saveChats(prev);
        return prev;
      });
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? "" : `⚠ ${(e as Error).message}`;
      setChats((prev) => {
        const next = prev.map((c) =>
          c.id === id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === aiMsg.id
                    ? { ...m, streaming: false, content: m.content || msg || "Qualcosa si è interrotto. Riprova." }
                    : m,
                ),
              }
            : c,
        );
        saveChats(next);
        return next;
      });
      if (msg) setError(msg);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  // su mobile il pannello è un overlay → si chiude dopo l'azione; su desktop resta com'è
  const closeSidebarIfMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebar(false);
  };
  const newChat = () => {
    if (streaming) return;
    setActiveId(null);
    closeSidebarIfMobile();
    setError("");
  };
  const selectChat = (cid: string) => {
    const c = chats.find((x) => x.id === cid);
    setActiveId(cid);
    if (c?.mode) setMode(c.mode); // la chat continua nella sua modalità
    closeSidebarIfMobile();
    setError("");
  };
  const deleteChat = (cid: string) => {
    const next = chats.filter((c) => c.id !== cid);
    setChats(next);
    saveChats(next);
    if (cid === activeId) setActiveId(null);
  };
  const askName = () => {
    const n = window.prompt("Come ti chiami? (lo userà WhyChat, e arriva a Edoardo)", name);
    if (n !== null) {
      setName(n);
      setNameState(n.trim().slice(0, 80));
    }
  };

  const busy = streaming && mode !== "deep";

  return (
    <div className="relative flex h-full">
      <SilkTrails />
      <InkReveal />

      <Sidebar
        chats={chats}
        activeId={activeId}
        open={sidebar}
        streaming={streaming}
        onSelect={selectChat}
        onNew={newChat}
        onDelete={deleteChat}
        onClose={() => setSidebar(false)}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Particelle confinate all'area principale → si allineano all'hero e si
            riallineano da sole quando la sidebar si apre/chiude */}
        <SoulParticles formText={empty && !sheet} modelName={modelName(model)} />
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            onClick={() => setSidebar((s) => !s)}
            aria-label={sidebar ? "Chiudi cronologia" : "Apri cronologia"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-line2)] text-dim transition hover:text-paper"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <ModelSelector model={model} onModel={setModel} />
          <button
            onClick={askName}
            className="mono ml-auto rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.55rem] text-faint transition hover:text-dim"
          >
            {name ? `↳ ${name}` : "PRESENTATI"}
          </button>
        </header>

        {/* Area centrale */}
        {sheet ? (
          <main className="min-h-0 flex-1 px-4 pb-3">
            <div className="mx-auto h-full max-w-4xl">
              <BlankSheet />
            </div>
          </main>
        ) : (
          <main className="scroll-thin relative flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 py-6">
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
        )}

        {/* Composer */}
        <footer className="px-4 pb-4 pt-2">
          <div className="mx-auto max-w-2xl">
            <CommandComposer
              onSend={send}
              disabled={busy}
              mode={mode}
              onMode={setMode}
              onStop={stop}
              streaming={busy}
            />
            <p className="mt-2 text-center text-[0.6rem] text-faint">
              WhyChat · {modelName(model)} · le conversazioni possono essere conservate per farlo
              crescere — non scrivere dati sensibili.
            </p>
          </div>
        </footer>
      </div>

      {error && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-20 -translate-x-1/2 text-xs text-signal-soft">
          {error}
        </div>
      )}
    </div>
  );
}

// etichetta breve della modalità, mostrata su ogni apertura ("che si capisca")
const MODE_SHORT: Record<Mode, string> = {
  chat: "chat",
  canvas: "canvas",
  deep: "deep",
  learn: "impara",
  sheet: "onlytype",
};
const modeIcon = (m: Mode) => MODES.find((x) => x.id === m)?.icon ?? null;

function Hero({ onPick }: { onPick: (t: string, m?: Mode) => void }) {
  // set simmetrico e SEMPRE DIVERSO, scelto una volta all'apertura della schermata
  const [openers] = useState(() => pickOpeners(4));
  return (
    <div className="rise flex flex-col items-center text-center">
      {/* spazio dove le particelle compongono il nome/benvenuto (sfondo) */}
      <div style={{ height: "clamp(170px, 28vh, 260px)" }} />

      <p className="max-w-sm text-balance text-[1.05rem] font-light leading-relaxed text-dim">
        L'anima digitale di WhyEd: la sua coscienza, il suo modo di{" "}
        <AnimatedTextCycle
          words={["pensare", "creare", "scrivere", "comporre", "immaginare"]}
          interval={2600}
          className="serif-i text-ember"
        />
        .<span className="serif-i text-paper"> Parlami.</span>
      </p>

      <div className="mt-3 h-px w-10 bg-gradient-to-r from-transparent via-signal/50 to-transparent" />

      {/* aperture — simmetriche, sempre diverse, per lo più legate alle modalità */}
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
        {openers.map((o) => (
          <OriginButton
            key={o.text}
            onClick={() => onPick(o.text, o.mode)}
            fill="rgba(201,75,37,0.18)"
            className="group h-full rounded-xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.55)] px-3.5 py-3 text-[0.85rem] text-dim backdrop-blur-md transition-colors duration-200 hover:border-signal/40 hover:bg-[rgba(22,17,14,0.7)] hover:text-paper"
          >
            <span className="shrink-0 text-faint transition-colors group-hover:text-signal" aria-hidden>
              {modeIcon(o.mode)}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{o.text}</span>
            <span className="mono shrink-0 text-[0.46rem] uppercase text-faint/70 transition-colors group-hover:text-ember">
              {MODE_SHORT[o.mode]}
            </span>
          </OriginButton>
        ))}
      </div>
    </div>
  );
}
