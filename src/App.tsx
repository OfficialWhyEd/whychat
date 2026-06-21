import { useEffect, useRef, useState, useCallback } from "react";
import SoulParticles from "./components/SoulParticles";
import InkReveal from "./components/InkReveal";
import SilkTrails from "./components/SilkTrails";
import GroupChat, { type GroupSession } from "./components/GroupChat";
import WhyEarth from "./components/WhyEarth";
import WhyEntropy from "./components/WhyEntropy";
import WhyMusic from "./components/WhyMusic";
import WhyEcosystem from "./components/WhyEcosystem";
import AnimatedTextCycle from "./components/AnimatedTextCycle";
import CommandComposer, { MODES, type Mode } from "./components/CommandComposer";
import BlankSheet, { type SheetSession } from "./components/BlankSheet";
import ModelSelector, { modelName } from "./components/ModelSelector";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import JumpToBottom from "./components/JumpToBottom";
import ChatMessage, { type Message } from "./components/ChatMessage";
import Vault from "./components/Vault";
import Dreams from "./components/Dreams";
import { streamChat, deepThink, planSteps, type ChatMessage as ApiMsg } from "./lib/api";
import { loadChats, saveChats, newChatId, titleFrom, type Chat } from "./lib/chats";
import { pickOpeners } from "./persona/openers";
import { getName, setName } from "./lib/visitor";
import { speak, getTtsAuto, setTtsAuto, ttsSupported } from "./lib/tts";

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
  const [webSearch, setWebSearch] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const planRef = useRef(planMode);
  planRef.current = planMode;
  const [error, setError] = useState("");
  const [name, setNameState] = useState(getName());
  const [autoTts, setAutoTtsState] = useState(getTtsAuto);
  const autoTtsRef = useRef(autoTts);
  autoTtsRef.current = autoTts;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sessione gruppo: vive tra le conversazioni come tutte le altre.
  const groupIdRef = useRef<string | null>(null);
  const [groupHydra, setGroupHydra] = useState<{ key: number; session?: GroupSession }>({ key: 0 });
  // Stessa cosa per il foglio OnlyType.
  const sheetIdRef = useRef<string | null>(null);
  const [sheetHydra, setSheetHydra] = useState<{ key: number; session?: SheetSession }>({ key: 0 });
  // Sei "attaccato" al fondo? Se hai scrollato su per rileggere, NON ti strappiamo giù.
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const empty = messages.length === 0;
  const sheet = mode === "sheet";
  const group = mode === "group";
  const earth = mode === "earth";
  const entropy = mode === "entropy";
  const music = mode === "music";
  const ecosystem = mode === "ecosystem";

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    else bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Aggiorna "sei in fondo?" mentre scrolli a mano (soglia 120px).
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottomRef.current = near;
    setAtBottom((p) => (p === near ? p : near));
  }, []);

  // Durante lo streaming resta incollato SOLO se eri già in fondo. Istantaneo per non
  // litigare con lo smooth ad ogni token.
  useEffect(() => {
    if (streaming && atBottomRef.current) scrollToBottom("auto");
  }, [messages, streaming, scrollToBottom]);

  // Aprendo/cambiando chat parti dall'ultimo messaggio.
  useEffect(() => {
    atBottomRef.current = true;
    setAtBottom(true);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [activeId, scrollToBottom]);

  // Salva/aggiorna la sessione gruppo nelle conversazioni (upsert su id stabile).
  const persistGroup = useCallback((s: GroupSession) => {
    const title = titleFrom(s.topic || s.items.find((i) => !i.who)?.content || "Group Prediction");
    setChats((prev) => {
      let id = groupIdRef.current;
      let next: Chat[];
      if (id && prev.some((c) => c.id === id)) {
        next = prev.map((c) => (c.id === id ? { ...c, ts: Date.now(), title, mode: "group", payload: s } : c));
      } else {
        id = newChatId();
        groupIdRef.current = id;
        next = [{ id, title, ts: Date.now(), mode: "group", messages: [], payload: s }, ...prev];
      }
      saveChats(next);
      return next;
    });
    if (groupIdRef.current) setActiveId(groupIdRef.current);
  }, []);

  // Salva/aggiorna il foglio OnlyType tra le conversazioni.
  const persistSheet = useCallback((s: SheetSession) => {
    const hasContent = !!s.image || s.texts.some((t) => t.value.trim());
    if (!hasContent && !sheetIdRef.current) return; // foglio vuoto: non creare nulla
    const firstText = s.texts.find((t) => t.value.trim())?.value;
    const title = titleFrom(firstText || "Foglio OnlyType");
    setChats((prev) => {
      let id = sheetIdRef.current;
      let next: Chat[];
      if (id && prev.some((c) => c.id === id)) {
        next = prev.map((c) => (c.id === id ? { ...c, ts: Date.now(), title, mode: "sheet", payload: s } : c));
      } else {
        id = newChatId();
        sheetIdRef.current = id;
        next = [{ id, title, ts: Date.now(), mode: "sheet", messages: [], payload: s }, ...prev];
      }
      saveChats(next);
      return next;
    });
    if (sheetIdRef.current) setActiveId(sheetIdRef.current);
  }, []);

  const send = async (text: string, modeOverride?: Mode) => {
    if (streaming) return;
    setError("");
    const existing = chats.find((c) => c.id === activeId);
    // Una chat è LEGATA alla modalità in cui è nata: i messaggi successivi
    // restano in quella modalità anche se il menu globale è cambiato. Solo
    // un'apertura (modeOverride) o una chat nuova usano la modalità scelta ora.
    const useMode: Mode = modeOverride ?? (existing ? existing.mode ?? "chat" : mode);
    if (useMode !== mode) setMode(useMode);
    const userMsg: Message = { id: uid(), role: "user", content: text };
    const aiMsg: Message = { id: uid(), role: "assistant", content: "", streaming: true };

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
    atBottomRef.current = true;
    setAtBottom(true);
    requestAnimationFrame(() => scrollToBottom("smooth"));

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
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        let thoughts = "";
        let answer = "";
        const apply = (done = false) =>
          setChats((prev) =>
            prev.map((c) =>
              c.id === id
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === aiMsg.id ? { ...m, content: answer, thoughts, streaming: !done } : m,
                    ),
                  }
                : c,
            ),
          );
        await deepThink(
          history,
          (d) => {
            thoughts += d;
            apply();
          },
          (d) => {
            answer += d;
            apply();
          },
          ctrl.signal,
        );
        apply(true);
        if (autoTtsRef.current) speak(answer);
      } else {
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        // PLAN MODE: prima pianifica (timeline agente stile Claude Code), poi rispondi
        const usePlan = planRef.current && ["chat", "canvas", "learn"].includes(useMode);
        let planTimer: ReturnType<typeof setInterval> | null = null;
        if (usePlan) {
          try {
            const steps = await planSteps(history, text);
            if (steps.length) {
              setChats((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, plan: steps, planActive: 0 } : m)) }
                    : c,
                ),
              );
              let activeStep = 0;
              planTimer = setInterval(() => {
                activeStep += 1;
                setChats((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, planActive: activeStep } : m)) }
                      : c,
                  ),
                );
                if (activeStep >= steps.length && planTimer) {
                  clearInterval(planTimer);
                  planTimer = null;
                }
              }, 650);
            }
          } catch {
            /* il piano è opzionale: se fallisce, si risponde dritti */
          }
        }

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
          webSearch,
        );
        if (planTimer) clearInterval(planTimer);
        patch(acc, true);
        if (autoTtsRef.current) speak(acc);
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
    if (mode === "group") {
      groupIdRef.current = null;
      setGroupHydra((h) => ({ key: h.key + 1, session: undefined }));
    }
    if (mode === "sheet") {
      sheetIdRef.current = null;
      setSheetHydra((h) => ({ key: h.key + 1, session: undefined }));
    }
    closeSidebarIfMobile();
    setError("");
  };
  const selectChat = (cid: string) => {
    const c = chats.find((x) => x.id === cid);
    setActiveId(cid);
    if (c?.mode) setMode(c.mode); // la chat continua nella sua modalità
    if (c?.mode === "group") {
      groupIdRef.current = cid;
      setGroupHydra((h) => ({ key: h.key + 1, session: c.payload as GroupSession }));
    }
    if (c?.mode === "sheet") {
      sheetIdRef.current = cid;
      setSheetHydra((h) => ({ key: h.key + 1, session: c.payload as SheetSession }));
    }
    closeSidebarIfMobile();
    setError("");
  };
  const deleteChat = (cid: string) => {
    const next = chats.filter((c) => c.id !== cid);
    setChats(next);
    saveChats(next);
    if (cid === activeId) setActiveId(null);
    if (cid === groupIdRef.current) {
      groupIdRef.current = null;
      if (mode === "group") setGroupHydra((h) => ({ key: h.key + 1, session: undefined }));
    }
    if (cid === sheetIdRef.current) {
      sheetIdRef.current = null;
      if (mode === "sheet") setSheetHydra((h) => ({ key: h.key + 1, session: undefined }));
    }
  };
  // Cambiare modalità mentre una chat è in corso NON la tocca (resta legata alla
  // sua): apre una nuova conversazione nella modalità scelta, come Claude/ChatGPT.
  // A chat vuota imposta soltanto la modalità di partenza.
  const changeMode = (m: Mode) => {
    setMode(m);
    if (active && active.messages.length > 0 && m !== (active.mode ?? "chat")) {
      setActiveId(null);
      setError("");
    }
    if (m === "group") {
      const isGroup = active?.mode === "group";
      groupIdRef.current = isGroup ? active!.id : null;
      setGroupHydra((h) => ({ key: h.key + 1, session: isGroup ? (active!.payload as GroupSession) : undefined }));
    }
    if (m === "sheet") {
      const isSheet = active?.mode === "sheet";
      sheetIdRef.current = isSheet ? active!.id : null;
      setSheetHydra((h) => ({ key: h.key + 1, session: isSheet ? (active!.payload as SheetSession) : undefined }));
    }
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
        <SoulParticles formText={empty && !sheet && !group && !earth && !music && !ecosystem} modelName={modelName(model)} />
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
          {ttsSupported() && (
            <button
              onClick={() => {
                const next = !autoTts;
                setAutoTtsState(next);
                setTtsAuto(next);
              }}
              title={autoTts ? "Voce automatica attiva" : "Voce automatica disattivata"}
              aria-pressed={autoTts}
              className={`ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${
                autoTts
                  ? "border-ember/50 text-ember"
                  : "border-[var(--color-line2)] text-faint hover:text-paper"
              }`}
            >
              {autoTts ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                  <path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                  <path d="M17 9l5 5M22 9l-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={askName}
            className="mono max-w-[120px] shrink-0 truncate rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.55rem] text-faint transition hover:text-dim"
          >
            {name ? `↳ ${name}` : "PRESENTATI"}
          </button>
        </header>

        {/* Area centrale */}
        {group ? (
          <main className="min-h-0 flex-1">
            <GroupChat
              key={groupHydra.key}
              session={groupHydra.session}
              onPersist={persistGroup}
              onExit={() => setMode("chat")}
            />
          </main>
        ) : earth ? (
          <main className="min-h-0 flex-1">
            <WhyEarth onExit={() => setMode("chat")} />
          </main>
        ) : entropy ? (
          <main className="min-h-0 flex-1">
            <WhyEntropy onExit={() => setMode("chat")} />
          </main>
        ) : music ? (
          <main className="min-h-0 flex-1">
            <WhyMusic onExit={() => setMode("chat")} />
          </main>
        ) : ecosystem ? (
          <main className="min-h-0 flex-1">
            <WhyEcosystem onExit={() => setMode("chat")} />
          </main>
        ) : sheet ? (
          <main className="min-h-0 flex-1 px-4 pb-3">
            <div className="mx-auto h-full max-w-4xl">
              <BlankSheet
                key={sheetHydra.key}
                session={sheetHydra.session}
                onPersist={persistSheet}
                onExit={() => setMode("chat")}
              />
            </div>
          </main>
        ) : (
          <main ref={scrollRef} onScroll={onScroll} className="scroll-thin relative flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 py-6">
              {empty ? (
                <Hero onPick={send} />
              ) : (
                <div className="flex flex-col gap-6">
                  {messages.map((m, i) => (
                    <ChatMessage
                      key={m.id}
                      msg={m}
                      onRetry={
                        m.role === "assistant" && !streaming
                          ? () => {
                              const prevUser = [...messages.slice(0, i)].reverse().find((x) => x.role === "user");
                              if (prevUser) send(prevUser.content);
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
              <div ref={bottomRef} className="h-2" />
            </div>
          </main>
        )}

        {/* Composer — nascosto in group mode (GroupChat ha il suo input) */}
        <footer className={`px-4 pb-4 pt-2 ${group || earth || entropy || sheet || music || ecosystem ? "hidden" : ""}`}>
          <div className="relative mx-auto max-w-2xl">
            <AnimatePresence>
              {!atBottom && !empty && !sheet && !earth && !entropy && (
                <JumpToBottom
                  key="jump"
                  live={streaming}
                  onClick={() => {
                    atBottomRef.current = true;
                    setAtBottom(true);
                    scrollToBottom("smooth");
                  }}
                />
              )}
            </AnimatePresence>
            <CommandComposer
              onSend={send}
              disabled={busy}
              mode={mode}
              onMode={changeMode}
              onStop={stop}
              streaming={busy}
              search={webSearch}
              onToggleSearch={() => setWebSearch((s) => !s)}
              plan={planMode}
              onTogglePlan={() => setPlanMode((p) => !p)}
            />
            <p className="mx-auto mt-2.5 max-w-md text-center text-[0.6rem] leading-relaxed text-faint">
              <span className="text-dim/70">{modelName(model)}</span> · le conversazioni possono
              essere conservate per farlo crescere. Niente dati sensibili.
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
  group: "gruppo",
  earth: "earth",
  entropy: "entropy",
  music: "music",
  ecosystem: "ecosystem",
};
const modeIcon = (m: Mode) => MODES.find((x) => x.id === m)?.icon ?? null;

function Hero({ onPick }: { onPick: (t: string, m?: Mode) => void }) {
  // set simmetrico e SEMPRE DIVERSO, scelto una volta all'apertura della schermata
  const [openers] = useState(() => pickOpeners(4));
  return (
    <div className="rise flex flex-col items-center text-center">
      {/* spazio dove le particelle compongono il nome/benvenuto (sfondo) */}
      <div style={{ height: "clamp(170px, 28vh, 260px)" }} />

      <p className="max-w-md text-balance px-3 text-[1.08rem] leading-relaxed text-paper/90 sm:px-0 sm:text-[1.18rem]">
        L'anima digitale di WhyEd: la sua coscienza, il suo modo di{" "}
        <AnimatedTextCycle
          words={["pensare", "creare", "scrivere", "comporre", "immaginare"]}
          interval={2600}
          className="serif-i text-ember"
        />
        .<span className="serif-i text-paper"> Parlami.</span>
      </p>

      <div className="mt-4 h-px w-12 bg-gradient-to-r from-transparent via-signal/50 to-transparent" />

      {/* aperture — lista editoriale (niente griglia di card), legate alle modalità */}
      <ul className="mt-9 w-full max-w-md text-left">
        {openers.map((o, i) => (
          <motion.li
            key={o.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              onClick={() => onPick(o.text, o.mode)}
              className="group flex w-full items-center gap-3 border-t border-[var(--color-line)] py-3.5 last:border-b"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center text-faint transition-colors duration-200 group-hover:text-signal [&_svg]:h-[18px] [&_svg]:w-[18px]"
                aria-hidden
              >
                {modeIcon(o.mode)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.92rem] text-dim transition-colors duration-200 group-hover:text-paper">
                {o.text}
              </span>
              <span className="mono shrink-0 text-[0.5rem] uppercase tracking-wider text-faint/60 transition-colors duration-200 group-hover:text-ember">
                {MODE_SHORT[o.mode]}
              </span>
              <span
                className="shrink-0 -translate-x-1 text-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-signal group-hover:opacity-100"
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
