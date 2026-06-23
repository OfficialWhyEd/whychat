import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import SoulParticles from "./components/SoulParticles";
import InkReveal from "./components/InkReveal";
import SilkTrails from "./components/SilkTrails";
import GroupChat, { type GroupSession } from "./components/GroupChat";
import WhyEarth from "./components/WhyEarth";
import WhyEntropy from "./components/WhyEntropy";
import WhyMusic from "./components/WhyMusic";
import WhyEcosystem from "./components/WhyEcosystem";
import AnimatedTextCycle from "./components/AnimatedTextCycle";
import CommandComposer, { MODES, type Mode, type Attachment } from "./components/CommandComposer";
import BlankSheet, { type SheetSession } from "./components/BlankSheet";
import ModelSelector, { modelName } from "./components/ModelSelector";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import JumpToBottom from "./components/JumpToBottom";
import ChatMessage, { type Message } from "./components/ChatMessage";
import ChatMinimap from "./components/ChatMinimap";
import ArtifactPanel, { type ArtifactData } from "./components/ArtifactPanel";
import Vault from "./components/Vault";
import Dashboard from "./components/Dashboard";
import Dreams from "./components/Dreams";
import { streamChat, deepThink, planSteps, geocodePlace, seeSheet, reasonGroq, type ChatMessage as ApiMsg } from "./lib/api";

// Adaptive reasoning: domanda "impegnativa" → WhyChat ragiona da solo (poi puoi
// saltare con "Rispondi Ora"). Stessa euristica del composer.
function looksComplex(t: string): boolean {
  const s = t.trim();
  if (s.length > 180) return true;
  if ((s.match(/\?/g)?.length ?? 0) >= 2) return true;
  return /\b(progett\w+|costruisc\w+|costruire|pianific\w+|analizz\w+|confront\w+|organizz\w+|strategi\w+|spiega\w*|perché|perche|come mai|dimostra\w*|calcol\w+|risolv\w+|piano|passo\s*passo|step by step|in dettaglio|tutti i passaggi)\b/i.test(s);
}
import type { MapPin } from "./components/WhyEarthLive";
const WhyEarthLive = lazy(() => import("./components/WhyEarthLive"));
// estrae il marcatore [[LUOGO: ...]] che WhyChat aggiunge in modalità earth
const LUOGO_RE = /\[\[\s*LUOGO\s*:\s*([^\]]+?)\s*\]\]/i;

// parole con l'iniziale maiuscola che NON sono luoghi (inizi frase / la chat)
const PLACE_STOP = new Set([
  "Il", "Lo", "La", "I", "Gli", "Le", "Un", "Uno", "Una", "Questo", "Questa", "Quando", "Come",
  "Dove", "Perché", "Perche", "Sono", "Ecco", "Vuoi", "Ciao", "Parlami", "Dimmi", "Che", "Sì",
  "Si", "No", "Ma", "Se", "Con", "Per", "Tra", "Fra", "Anche", "Ti", "Mi", "Ah", "Oh", "Beh",
  "Ok", "Allora", "Certo", "WhyChat", "WhyEarth", "Edoardo", "WhyEd",
]);

// nomi propri candidati (sequenze Maiuscole) da geocodare per piantare il pin
function placeCandidates(text: string): string[] {
  const out: string[] = [];
  const re = /([A-ZÀ-Ý][a-zà-ÿ']+(?:\s+[A-ZÀ-Ý][a-zà-ÿ']+){0,2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && out.length < 8) {
    const cand = m[1].trim();
    const first = cand.split(/\s+/)[0];
    if (PLACE_STOP.has(first) || cand.length < 3) continue;
    if (!out.includes(cand)) out.push(cand);
  }
  return out;
}
import { loadChats, saveChats, newChatId, titleFrom, type Chat } from "./lib/chats";
import { pickOpeners } from "./persona/openers";
import { getName, setName } from "./lib/visitor";
import { speak, getTtsAuto, setTtsAuto, ttsSupported } from "./lib/tts";
import { AnimatedIcon } from "./components/effects/AnimatedIcon";

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
  if (route === "#dashboard") return <Dashboard />;
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
  // Artifact aperto nel pannello laterale (stile Claude Desktop).
  const [artifact, setArtifact] = useState<ArtifactData | null>(null);
  const openArtifact = useCallback((title: string, html: string) => setArtifact({ title, html }), []);
  // Adaptive reasoning: il messaggio che sta ragionando ora + come saltarlo.
  const [reasoningId, setReasoningId] = useState<string | null>(null);
  const respondNowRef = useRef<(() => void) | null>(null);
  const respondNow = useCallback(() => respondNowRef.current?.(), []);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const empty = messages.length === 0;
  const sheet = mode === "sheet";
  const group = mode === "group";
  const earth = mode === "earth";
  const entropy = mode === "entropy";
  const music = mode === "music";
  const ecosystem = mode === "ecosystem";

  // WhyEarth: vista "Globo" (d3 a puntini, default) o "Mappa viva" (MapLibre).
  // Il sogno: quando la chat nomina un luogo, vola lì e pianta il pin.
  const [earthLive, setEarthLive] = useState(false);
  const [mapPin, setMapPin] = useState<MapPin | null>(null);
  const lastGeoRef = useRef("");
  // testo dell'ultimo messaggio assistant completo (per cercarvi un luogo a stream finito)
  const lastBotEarth = earth ? [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming)?.content ?? "" : "";
  const lastUserEarth = earth ? [...messages].reverse().find((m) => m.role === "user")?.content ?? "" : "";
  useEffect(() => {
    if (!earth || !lastBotEarth) return;
    // 1) se il modello ha messo il marcatore [[LUOGO: ...]], usalo. 2) altrimenti
    // estrai i nomi propri da domanda+risposta e geocoda il primo che esiste
    // (così funziona anche con i modelli free che ignorano il marcatore).
    const marker = LUOGO_RE.exec(lastBotEarth)?.[1]?.trim();
    const cands = marker ? [marker] : [...placeCandidates(lastUserEarth), ...placeCandidates(lastBotEarth)];
    const key = cands.join("|");
    if (!cands.length || key === lastGeoRef.current) return;
    lastGeoRef.current = key;
    (async () => {
      for (const c of cands.slice(0, 5)) {
        const pin = await geocodePlace(c);
        if (pin) {
          setMapPin(pin);
          setEarthLive(true); // vola sulla mappa viva quando emerge un luogo
          break;
        }
      }
    })();
  }, [earth, lastBotEarth, lastUserEarth]);

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
    const hasContent = !!s.image || s.texts.some((t) => t.value.trim()) || !!s.chat?.length;
    if (!hasContent && !sheetIdRef.current) return; // foglio vuoto: non creare nulla
    const firstText = s.texts.find((t) => t.value.trim())?.value || s.chat?.find((m) => m.role === "user" && m.content)?.content;
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

  const send = async (text: string, attachments?: Attachment[], modeOverride?: Mode) => {
    if (streaming) return;
    setError("");
    const t0 = Date.now(); // per misurare quanto ci mette a rispondere
    const existing = chats.find((c) => c.id === activeId);
    // Una chat è LEGATA alla modalità in cui è nata: i messaggi successivi
    // restano in quella modalità anche se il menu globale è cambiato. Solo
    // un'apertura (modeOverride) o una chat nuova usano la modalità scelta ora.
    const useMode: Mode = modeOverride ?? (existing ? existing.mode ?? "chat" : mode);
    if (useMode !== mode) setMode(useMode);

    const atts = attachments ?? [];
    // file che GEMINI legge davvero (immagini, frame video, PDF…): mandati come inlineData
    let media = atts.map((a) => a.data).filter((x): x is string => !!x);
    // CONTESTO IMMAGINE: se non alleghi nulla ma lo scambio PRECEDENTE aveva
    // un'immagine, la ri-includo → WhyChat continua a "vederla" nel follow-up
    // (es. "e in alto a sinistra?"). Solo l'ultimo scambio, per non instradare a caso.
    if (!media.length) {
      const prev = existing?.messages ?? [];
      const lastUser = [...prev].reverse().find((m) => m.role === "user");
      const isRecent = lastUser ? prev.indexOf(lastUser) >= prev.length - 2 : false;
      const recalled = isRecent ? lastUser?.image || lastUser?.attachments?.find((a) => a.image)?.image : undefined;
      if (recalled) media = [recalled];
    }
    // contenuto testuale dei file di testo (md/html/json/csv/codice) → nel prompt
    const textParts = atts.filter((a) => a.text).map((a) => `[Contenuto del file "${a.name}"]:\n${a.text}`);
    // solo i file NON leggibili (doc/xls/zip…) restano una nota col nome
    const noteParts = atts
      .filter((a) => !a.data && !a.text)
      .map((a) => `[Allegato non leggibile: ${a.name}]`);
    const sentContent = [text, ...textParts, ...noteParts].filter(Boolean).join("\n\n");
    // ciò che si VEDE nel bubble: le anteprime (immagini/frame/file), pulite
    const dispAtts = atts.map((a) => ({ image: a.image, name: a.name, kind: a.kind }));
    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      ...(dispAtts.length ? { attachments: dispAtts } : {}),
    };
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
      nextChats = [{ id, title: titleFrom(text || atts[0]?.name || "Allegato"), ts: Date.now(), mode: useMode, messages: [userMsg, aiMsg] }, ...chats];
    }
    setChats(nextChats);
    saveChats(nextChats);
    setActiveId(id);
    setStreaming(true);
    atBottomRef.current = true;
    setAtBottom(true);
    requestAnimationFrame(() => scrollToBottom("smooth"));

    const history: ApiMsg[] = [
      ...baseMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: sentContent },
    ];

    const patch = (content: string, done = false) =>
      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, content, streaming: !done } : m)) }
            : c,
        ),
      );

    try {
      if (media.length) {
        // Ci sono file leggibili da Gemini (immagini/frame video/PDF): li LEGGE.
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        let acc = "";
        const visionPrompt =
          [text, ...textParts, ...noteParts].filter(Boolean).join("\n\n") ||
          "Leggi" + (media.length > 1 ? " questi file" : " questo file") + " e aiutami: descrivi, spiega, estrai o crea ciò che serve.";
        await seeSheet(
          media,
          visionPrompt,
          baseMessages.map((m) => ({ role: m.role, content: m.content })),
          (d) => {
            acc += d;
            patch(acc);
          },
          ctrl.signal,
          "chat", // foto/file in chat → guarda e rispondi (non il prompt OnlyType "crea")
        );
        patch(acc, true);
        if (autoTtsRef.current) speak(acc);
      } else if (useMode === "deep") {
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
      } else if (["chat", "canvas", "learn"].includes(useMode) && !planRef.current && looksComplex(text)) {
        // ADAPTIVE REASONING: WhyChat ragiona da solo (pensiero+risposta in
        // parallelo, stile DeepSeek). Puoi saltarlo con "Rispondi Ora".
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setReasoningId(aiMsg.id);
        let thoughts = "";
        let answer = "";
        const apply = (done = false) =>
          setChats((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, content: answer, thoughts, streaming: !done } : m)) }
                : c,
            ),
          );
        let skipped = false;
        respondNowRef.current = () => {
          skipped = true;
          ctrl.abort();
        };
        try {
          await reasonGroq(
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
            useMode,
          );
        } catch (e) {
          if (!skipped && (e as Error).name !== "AbortError") throw e;
        }
        respondNowRef.current = null;
        setReasoningId(null);
        // saltato prima di una risposta → risposta diretta veloce (niente attesa)
        if (skipped && !answer.trim()) {
          const ctrl2 = new AbortController();
          abortRef.current = ctrl2;
          let acc = "";
          await streamChat(
            history,
            (d) => {
              acc += d;
              answer = acc;
              apply();
            },
            ctrl2.signal,
            useMode,
            model,
            webSearch,
          );
        }
        apply(true);
        if (autoTtsRef.current) speak(answer);
      } else {
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        // PLAN MODE: prima pianifica (timeline agente stile Claude Code), poi
        // rispondi. I passi avanzano col VERO progredire della risposta (non un
        // timer a caso): più la risposta cresce, più passi si completano.
        const usePlan = planRef.current && ["chat", "canvas", "learn"].includes(useMode);
        let planLen = 0;
        const setPlanActive = (n: number) =>
          setChats((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, planActive: n } : m)) } : c,
            ),
          );
        if (usePlan) {
          try {
            const steps = await planSteps(history, text);
            if (steps.length) {
              planLen = steps.length;
              setChats((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, plan: steps, planActive: 0 } : m)) }
                    : c,
                ),
              );
            }
          } catch {
            /* il piano è opzionale: se fallisce, si risponde dritti */
          }
        }

        let acc = "";
        let lastStep = 0;
        const STEP_CHARS = 110; // ~un passo ogni 110 caratteri di risposta reale
        await streamChat(
          history,
          (delta) => {
            acc += delta;
            patch(acc);
            if (planLen) {
              const step = Math.min(planLen - 1, Math.floor(acc.length / STEP_CHARS));
              if (step !== lastStep) {
                lastStep = step;
                setPlanActive(step);
              }
            }
          },
          ctrl.signal,
          useMode,
          model,
          webSearch,
        );
        if (planLen) setPlanActive(planLen); // a risposta finita: tutti i passi fatti
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
      // tempo impiegato per la risposta (mostrato sotto: "Xs" / "X min")
      const elapsed = Date.now() - t0;
      setChats((prev) => {
        const next = prev.map((c) =>
          c.id === id
            ? { ...c, messages: c.messages.map((m) => (m.id === aiMsg.id ? { ...m, duration: elapsed } : m)) }
            : c,
        );
        saveChats(next);
        return next;
      });
    }
  };

  const stop = () => abortRef.current?.abort();

  // su mobile il pannello è un overlay → si chiude dopo l'azione; su desktop resta com'è
  const closeSidebarIfMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebar(false);
  };
  const newChat = () => {
    // "Nuova conversazione" deve SEMPRE aprire una chat vuota — anche durante lo
    // streaming (lo interrompiamo) — e tornare in modalità chat pulita. Niente
    // overlay residui: su mobile il pannello si chiude e resti sul foglio bianco.
    abortRef.current?.abort();
    setActiveId(null);
    groupIdRef.current = null;
    sheetIdRef.current = null;
    setGroupHydra((h) => ({ key: h.key + 1, session: undefined }));
    setSheetHydra((h) => ({ key: h.key + 1, session: undefined }));
    setMode("chat");
    closeSidebarIfMobile();
    setError("");
  };
  // Rinomina una conversazione (come Claude): titolo modificabile dalla sidebar.
  const renameChat = (cid: string, title: string) => {
    const t = title.trim().slice(0, 80);
    if (!t) return;
    setChats((prev) => {
      const next = prev.map((c) => (c.id === cid ? { ...c, title: t } : c));
      saveChats(next);
      return next;
    });
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
        onRename={renameChat}
        onClose={() => setSidebar(false)}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Particelle confinate all'area principale → si allineano all'hero e si
            riallineano da sole quando la sidebar si apre/chiude */}
        <SoulParticles formText={empty && !sheet && !group && !earth && !entropy && !music && !ecosystem} modelName={modelName(model)} />
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            onClick={() => setSidebar((s) => !s)}
            aria-label={sidebar ? "Chiudi cronologia" : "Apri cronologia"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-line2)] text-dim transition hover:text-paper"
          >
            <AnimatedIcon pop={false}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </AnimatedIcon>
          </button>
          <ModelSelector model={model} onModel={setModel} />
          {/* tasto voce automatica: SOLO in WhyMusic (il play per-messaggio resta ovunque) */}
          {ttsSupported() && music && (
            <button
              onClick={() => {
                const next = !autoTts;
                setAutoTtsState(next);
                setTtsAuto(next);
              }}
              title={autoTts ? "Voce automatica attiva" : "Voce automatica disattivata"}
              aria-pressed={autoTts}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${
                autoTts
                  ? "border-ember/50 text-ember"
                  : "border-[var(--color-line2)] text-faint hover:text-paper"
              }`}
            >
              <AnimatedIcon pop={false} active={autoTts}>
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
              </AnimatedIcon>
            </button>
          )}
          <button
            onClick={askName}
            className="mono ml-auto max-w-[120px] shrink-0 truncate rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.55rem] text-faint transition hover:text-dim"
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
        ) : earth || entropy ? (
          <main className="relative min-h-0 flex-1 overflow-hidden">
            {/* il visivo (globo / geometria) resta protagonista, sullo sfondo */}
            <div className="absolute inset-0">
              {earth ? (
                earthLive ? (
                  <Suspense
                    fallback={<div className="mono grid h-full place-items-center text-[0.6rem] text-faint">CARICO IL MONDO…</div>}
                  >
                    <WhyEarthLive focus={mapPin} onExit={() => setMode("chat")} />
                  </Suspense>
                ) : (
                  <WhyEarth onExit={() => setMode("chat")} />
                )
              ) : (
                <WhyEntropy onExit={() => setMode("chat")} />
              )}
            </div>
            {/* toggle vista: Globo a puntini (default) ↔ Mappa viva (vola+pin) */}
            {earth && (
              <div className="absolute right-4 top-16 z-10 flex overflow-hidden rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] text-[0.5rem] backdrop-blur">
                <button
                  onClick={() => setEarthLive(false)}
                  className={`mono px-2.5 py-1 transition ${!earthLive ? "bg-[rgba(201,75,37,0.2)] text-ember" : "text-faint hover:text-paper"}`}
                >
                  GLOBO
                </button>
                <button
                  onClick={() => setEarthLive(true)}
                  className={`mono px-2.5 py-1 transition ${earthLive ? "bg-[rgba(201,75,37,0.2)] text-ember" : "text-faint hover:text-paper"}`}
                >
                  MAPPA VIVA
                </button>
              </div>
            )}
            {/* la conversazione galleggia sopra: il mondo resta visibile, le risposte appaiono */}
            {!empty && (
              <div className="scroll-thin pointer-events-none absolute inset-x-0 bottom-0 top-1/3 flex flex-col justify-end overflow-y-auto">
                <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-3">
                  {messages.map((m, i) => (
                    <div
                      key={m.id}
                      className="pointer-events-auto rounded-2xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.74)] backdrop-blur-md"
                    >
                      <ChatMessage
                        msg={earth ? { ...m, content: m.content.replace(LUOGO_RE, "").trimEnd() } : m}
                        prompt={messages[i - 1]?.role === "user" ? messages[i - 1].content : ""}
                        onRetry={
                          m.role === "assistant" && !streaming
                            ? () => {
                                const prevUser = [...messages.slice(0, i)].reverse().find((x) => x.role === "user");
                                if (prevUser) send(prevUser.content);
                              }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                  <div ref={bottomRef} className="h-1" />
                </div>
              </div>
            )}
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
                onOpenArtifact={openArtifact}
              />
            </div>
          </main>
        ) : (
          <>
            <main ref={scrollRef} onScroll={onScroll} className="scroll-thin relative flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-4 py-6">
                {empty ? (
                  <Hero onPick={(t, m) => send(t, undefined, m)} />
                ) : (
                  <div className="flex flex-col gap-6">
                    {messages.map((m, i) => (
                      <div key={m.id} data-mid={m.id} data-role={m.role}>
                        <ChatMessage
                          msg={m}
                          prompt={messages[i - 1]?.role === "user" ? messages[i - 1].content : ""}
                          onOpenArtifact={openArtifact}
                          onRespondNow={m.id === reasoningId ? respondNow : undefined}
                          onChoice={(t) => send(t)}
                          onRetry={
                            m.role === "assistant" && !streaming
                              ? () => {
                                  const prevUser = [...messages.slice(0, i)].reverse().find((x) => x.role === "user");
                                  if (prevUser) send(prevUser.content);
                                }
                              : undefined
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} className="h-2" />
              </div>
            </main>
            {!empty && <ChatMinimap scrollRef={scrollRef} messages={messages} />}
          </>
        )}

        {/* Composer — nascosto in group mode (GroupChat ha il suo input) */}
        <footer className={`px-4 pb-4 pt-2 ${group || sheet || music || ecosystem ? "hidden" : ""}`}>
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

      {artifact && <ArtifactPanel artifact={artifact} onClose={() => setArtifact(null)} />}

      {/* errore (502/404/rete): card centrata ben fatta, animata, chiudibile — nota IMG_9886 */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className="fixed bottom-24 left-1/2 z-30 flex max-w-[min(90vw,420px)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-signal/40 bg-[rgba(20,16,9,0.92)] px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <span className="mt-0.5 shrink-0 text-signal-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.82rem] leading-snug text-paper">{error.replace(/^⚠\s*/, "")}</div>
              <div className="mono mt-0.5 text-[0.5rem] text-faint">Riprova tra un istante — a volte è solo un picco.</div>
            </div>
            <button
              onClick={() => setError("")}
              title="Chiudi"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint transition hover:text-paper"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
              <AnimatedIcon
                delay={0.12 + i * 0.06}
                className="grid h-6 w-6 shrink-0 place-items-center text-faint transition-colors duration-200 group-hover:text-signal [&_svg]:h-[18px] [&_svg]:w-[18px]"
              >
                {modeIcon(o.mode)}
              </AnimatedIcon>
              <span className="min-w-0 flex-1 truncate text-[0.92rem] text-dim transition-colors duration-200 group-hover:text-paper">
                {o.text}
              </span>
              <span className="mono shrink-0 text-[0.52rem] uppercase tracking-wider text-dim/75 transition-colors duration-200 group-hover:text-ember">
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
