import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "../lib/markdown";
import { speak, stop as ttsStop, ttsSupported, voice } from "../lib/tts";
import { parseSegments } from "../lib/artifacts";
import Artifact from "./Artifact";
import WhyMark from "./WhyMark";
import { YouTubeEmbed, extractYouTubeIds } from "./YouTubeEmbed";
import { AgentPlanning, type PlanStep, type PlanStepStatus } from "./AgentPlanning";
import FileChip from "./FileChip";
import ReasoningPanel from "./ReasoningPanel";
import { AnimatedIcon } from "./effects/AnimatedIcon";
import type { PlanStepData } from "../lib/api";

// tag tool → etichetta breve nella timeline (stile openclaw/Claude Code)
const TOOL_LABEL: Record<string, string> = {
  analisi: "analisi",
  ricerca: "ricerca",
  sintesi: "sintesi",
  codice: "codice",
  verifica: "verifica",
};

// mappa il piano (dati) → passi con stato per la timeline AgentPlanning
function planToSteps(plan: PlanStepData[], active: number, streaming: boolean): PlanStep[] {
  return plan.map((s, i) => {
    const status: PlanStepStatus =
      !streaming || i < active ? "success" : i === active ? "active" : "pending";
    return {
      id: String(i),
      title: s.title,
      status,
      duration: TOOL_LABEL[s.tool] ?? s.tool,
      content: s.detail ? (
        <span className="flex items-start gap-2">
          <span className="mono shrink-0 rounded bg-[rgba(240,163,106,0.14)] px-1.5 py-0.5 text-[0.5rem] text-ember">
            {TOOL_LABEL[s.tool] ?? s.tool}
          </span>
          <span>{s.detail}</span>
        </span>
      ) : undefined,
    };
  });
}

// micro-azioni generiche (fallback se non c'è una domanda da cui pescare il tema)
const THINK_PHASES = [
  "Leggo la richiesta",
  "Collego le idee",
  "Cerco il filo",
  "Soppeso le parole",
  "Compongo",
  "Affino",
  "Rileggo",
];

// parole da ignorare quando estraggo il "tema" della domanda
const STOP = new Set([
  "come", "cosa", "quando", "dove", "perché", "perche", "quale", "quali", "chi", "quanto", "quanta",
  "che", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "da", "in", "con", "su", "per",
  "tra", "fra", "del", "della", "dei", "delle", "dello", "degli", "mi", "ti", "si", "ci", "vi", "ne",
  "è", "e", "ed", "o", "ma", "se", "non", "più", "meno", "molto", "poco", "fammi", "dimmi", "spiegami",
  "parlami", "scrivimi", "puoi", "vorrei", "voglio", "dammi", "raccontami", "the", "what", "how", "why",
  "and", "for", "with", "about", "tell", "give", "make", "write", "explain", "your", "you",
]);

// Estrae il "tema" della domanda (le 1-2 parole più contentful) per mostrare
// a COSA sta ragionando, non solo "sto ragionando". "in pochissime parole".
function topicOf(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  if (!words.length) return "";
  const uniq = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 2);
  return uniq.join(" ");
}

// Fasi di ragionamento ANCORATE al tema della domanda (stile Claude Code).
function thinkPhasesFor(prompt: string): string[] {
  const topic = topicOf(prompt);
  if (!topic) return THINK_PHASES;
  return [`Penso a «${topic}»`, `Cerco il filo su ${topic}`, "Soppeso le parole", "Compongo", "Affino"];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  thoughts?: string; // ragionamento (modalità pensiero profondo)
  plan?: PlanStepData[]; // piano agente (plan mode) → timeline
  planActive?: number; // indice del passo in corso (precedenti = fatti)
  image?: string; // immagine singola (OnlyType: snapshot del foglio)
  attachments?: { image?: string; name: string; kind: string }[]; // allegati (più file)
}

export default function ChatMessage({
  msg,
  onRetry,
  prompt = "",
  onOpenArtifact,
  onRespondNow,
}: {
  msg: Message;
  onRetry?: () => void;
  prompt?: string; // la domanda che ha generato questa risposta → tema del ragionamento
  onOpenArtifact?: (title: string, html: string) => void; // apri l'artifact nel pannello laterale
  onRespondNow?: () => void; // adaptive reasoning: salta il ragionamento e rispondi ora
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // mentre QUESTO messaggio parla, l'ampiezza reale del TTS pilota il bordo
  // metallico (variabile CSS --v 0..1). Niente luce al centro: la voce vive
  // sui bordi del testo bot e sulle particelle.
  useEffect(() => {
    if (!speaking) {
      bodyRef.current?.style.setProperty("--v", "0");
      return;
    }
    let raf = 0;
    const loop = () => {
      bodyRef.current?.style.setProperty("--v", voice.level.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  // se il messaggio sparisce/cambia mentre parla, ferma la voce
  useEffect(() => () => ttsStop(), []);

  const toggleSpeak = () => {
    if (speaking) {
      ttsStop();
      setSpeaking(false);
    } else {
      speak(msg.content, setSpeaking);
    }
  };

  // Ragionamento "vivo" stile Claude Code: non solo "sto ragionando" ma cosa sta
  // facendo davvero. Se c'è ragionamento in streaming (deep) mostro l'ultima riga
  // reale; altrimenti ciclo micro-azioni personalizzate.
  const [phaseI, setPhaseI] = useState(0);
  const thinking = !!msg.streaming && !msg.content;
  const phases = useRef<string[]>(THINK_PHASES);
  phases.current = thinkPhasesFor(prompt);
  useEffect(() => {
    if (!thinking) return;
    const id = setInterval(() => setPhaseI((i) => (i + 1) % phases.current.length), 1600);
    return () => clearInterval(id);
  }, [thinking]);
  const lastThought = msg.thoughts
    ? (msg.thoughts.split(/\n+/).filter((s) => s.trim()).pop() || "")
        .replace(/[#*_>`\-]+/g, "")
        .trim()
        .slice(0, 90)
    : "";
  const thinkingLabel = lastThought || phases.current[phaseI % phases.current.length];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard non disponibile */
    }
  };

  if (isUser) {
    return (
      <div className="rise flex justify-end px-4">
        <div className="flex max-w-[78%] flex-col items-end gap-1.5">
          {msg.image && (
            <img
              src={msg.image}
              alt="immagine allegata"
              className="max-h-56 rounded-2xl rounded-br-md border border-[var(--color-line2)] object-contain"
            />
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {msg.attachments.map((a, i) =>
                a.image ? (
                  <img
                    key={i}
                    src={a.image}
                    alt={a.name}
                    className="h-20 w-20 rounded-xl border border-[var(--color-line2)] object-cover"
                  />
                ) : (
                  <FileChip key={i} name={a.name} />
                ),
              )}
            </div>
          )}
          {msg.content && (
            <div className="rounded-2xl rounded-br-md border border-[var(--color-line2)] bg-[rgba(242,239,233,0.06)] px-4 py-2.5 text-[0.95rem] leading-relaxed text-paper">
              {msg.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rise flex gap-3 px-4">
      <div className="mt-0.5 shrink-0">
        <WhyMark size={28} active={msg.streaming} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mono mb-1 text-[0.55rem] text-faint">WHYCHAT</div>

        {msg.plan && msg.plan.length > 0 && (
          <AgentPlanning steps={planToSteps(msg.plan, msg.planActive ?? 0, !!msg.streaming)} />
        )}

        {msg.thoughts && (
          <details
            open={msg.streaming ? true : undefined}
            className="group mb-3 overflow-hidden rounded-xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)]"
          >
            <summary className="mono flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[0.55rem] text-faint transition-colors hover:text-dim [&::-webkit-details-marker]:hidden">
              <span className="text-signal">✦</span> RAGIONAMENTO
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                className="ml-auto transition-transform duration-200 group-[[open]]:rotate-180"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div
              className="wc-prose border-t border-[var(--color-line)] px-3 py-2.5 text-[0.82rem] leading-[1.6] text-faint"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.thoughts) }}
            />
          </details>
        )}

        {thinking ? (
          <ReasoningPanel thoughts={msg.thoughts ?? ""} label={thinkingLabel} onRespondNow={onRespondNow} />
        ) : (
          <div ref={bodyRef} className={`wc-bot-body${speaking ? " wc-speak" : ""}`}>
            {parseSegments(msg.content || "").map((seg, i) =>
              seg.type === "artifact" ? (
                <Artifact key={i} title={seg.title} html={seg.html} building={seg.building} onOpen={onOpenArtifact} />
              ) : (
                <div
                  key={i}
                  className="wc-prose text-[0.95rem] leading-[1.7] text-dim"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
                />
              ),
            )}
            {msg.streaming && <span className="caret" />}
          </div>
        )}

        {/* link YouTube → player ottimizzato direttamente in chat */}
        {!msg.streaming &&
          extractYouTubeIds(msg.content).map((vid) => <YouTubeEmbed key={vid} id={vid} />)}

        {/* azioni sotto la risposta (solo a risposta completa) */}
        {!msg.streaming && msg.content && (
          <div className="mt-2.5 flex items-center gap-0.5">
            {ttsSupported() && (
              <button
                onClick={toggleSpeak}
                title={speaking ? "Ferma voce" : "Ascolta"}
                className={`grid h-7 w-7 place-items-center rounded-md transition hover:bg-[rgba(242,239,233,0.06)] ${speaking ? "text-ember" : "text-faint hover:text-paper"}`}
              >
                <AnimatedIcon pop={false} active={speaking}>
                  {speaking ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  )}
                </AnimatedIcon>
              </button>
            )}
            <button
              onClick={copy}
              title={copied ? "Copiato" : "Copia"}
              className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
            >
              <AnimatedIcon pop={false} active={copied}>
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                )}
              </AnimatedIcon>
            </button>
            {onRetry && (
              <button
                onClick={onRetry}
                title="Rigenera"
                className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
              >
                <AnimatedIcon pop={false}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </AnimatedIcon>
              </button>
            )}
            <button
              onClick={() => setVote((v) => (v === "up" ? null : "up"))}
              title="Mi piace"
              className={`grid h-7 w-7 place-items-center rounded-md transition hover:bg-[rgba(242,239,233,0.06)] ${vote === "up" ? "text-signal" : "text-faint hover:text-paper"}`}
            >
              <AnimatedIcon pop={false} active={vote === "up"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm0 0 4.5-7.5a1.5 1.5 0 0 1 2.7 1.2L13 9h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 19H7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </AnimatedIcon>
            </button>
            <button
              onClick={() => setVote((v) => (v === "down" ? null : "down"))}
              title="Non mi piace"
              className={`grid h-7 w-7 place-items-center rounded-md transition hover:bg-[rgba(242,239,233,0.06)] ${vote === "down" ? "text-signal-soft" : "text-faint hover:text-paper"}`}
            >
              <AnimatedIcon pop={false} active={vote === "down"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3zm0 0-4.5 7.5a1.5 1.5 0 0 1-2.7-1.2L11 15H5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.2 5H17" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </AnimatedIcon>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
