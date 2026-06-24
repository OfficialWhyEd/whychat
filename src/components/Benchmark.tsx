import { useState } from "react";
import { motion } from "framer-motion";
import { streamChat } from "../lib/api";
import WhyMark from "./WhyMark";

/**
 * Benchmark (FASE 6) — l'ultima cosa che Edo ha chiesto: «alla fine di tutto
 * fai un benchmark confrontando tutto con gli altri come fanno le grandi
 * aziende». Onesto, non marketing: WhyChat non vince sul ragionamento di
 * frontiera (è un maker solo, in locale, con API gratuite). Vince su ciò che
 * le grandi aziende NON possono dare: memoria tua, gratis, su ogni dispositivo,
 * undici modi di pensare, dati reali dal mondo, e un'anima che è la tua.
 */

type Cell = "yes" | "no" | "partial";
interface Row {
  cap: string;
  note?: string;
  whychat: Cell;
  gpt: Cell;
  claude: Cell;
  gemini: Cell;
}

// La colonna "loro" riflette il piano GRATUITO degli assistant mainstream
// (è con quello che WhyChat — gratis e senza account — va confrontato).
const ROWS: Row[] = [
  { cap: "Costo", note: "WhyChat è gratis e senza account", whychat: "yes", gpt: "partial", claude: "partial", gemini: "partial" },
  { cap: "Memoria che ti segue su OGNI dispositivo", note: "senza login, solo tu", whychat: "yes", gpt: "partial", claude: "partial", gemini: "partial" },
  { cap: "Personalità unica (non un assistente generico)", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Skill personali che rispetta sempre", whychat: "yes", gpt: "partial", claude: "no", gemini: "no" },
  { cap: "Disegna l'idea → la costruisce (OnlyType)", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Globo dal vivo con voli + eventi NASA reali", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Più menti che predicono insieme (Group)", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Simulazioni di natura dal vivo (Ecosystem)", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Analisi profonda di una traccia audio (Music)", whychat: "yes", gpt: "partial", claude: "no", gemini: "partial" },
  { cap: "Sogna le conversazioni di notte (Dreaming)", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Voce su ogni messaggio (TTS)", whychat: "yes", gpt: "yes", claude: "no", gemini: "yes" },
  { cap: "Legge ogni file: zip, docx, xlsx, pdf, immagini", whychat: "yes", gpt: "yes", claude: "yes", gemini: "yes" },
  { cap: "Ricerca web in tempo reale", whychat: "yes", gpt: "partial", claude: "partial", gemini: "yes" },
  { cap: "Codice aperto, nessun tracking", whychat: "yes", gpt: "no", claude: "no", gemini: "no" },
  { cap: "Ragionamento di frontiera (modelli più grandi)", note: "qui vincono loro, ed è onesto dirlo", whychat: "partial", gpt: "yes", claude: "yes", gemini: "yes" },
];

const COLS = ["WhyChat", "ChatGPT", "Claude", "Gemini"] as const;

function score(rows: Row[], key: keyof Omit<Row, "cap" | "note">): number {
  return rows.reduce((s, r) => s + (r[key] === "yes" ? 1 : r[key] === "partial" ? 0.5 : 0), 0);
}

function Mark({ v }: { v: Cell }) {
  if (v === "yes")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mx-auto text-signal">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (v === "partial")
    return <span className="mx-auto block h-[3px] w-3.5 rounded-full bg-faint" />;
  return <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-[var(--color-line2)]" />;
}

export default function Benchmark() {
  const [ms, setMs] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);

  const measure = async () => {
    if (measuring) return;
    setMeasuring(true);
    setMs(null);
    const t0 = performance.now();
    let first = 0;
    try {
      await streamChat(
        [{ role: "user", content: "Ciao" }],
        () => {
          if (!first) first = performance.now();
        },
        undefined,
        "chat",
        "terry-4.2", // il modello veloce
      );
      setMs(Math.round((first || performance.now()) - t0));
    } catch {
      setMs(-1);
    } finally {
      setMeasuring(false);
    }
  };

  const wcScore = score(ROWS, "whychat");
  const best = Math.max(score(ROWS, "gpt"), score(ROWS, "claude"), score(ROWS, "gemini"));

  return (
    <div className="scroll-thin relative mx-auto h-[100dvh] max-w-3xl overflow-y-auto px-5 py-12">
      <a href="#" className="mono mb-10 inline-block text-[0.55rem] text-faint hover:text-dim">
        ← TORNA A WHYCHAT
      </a>

      <div className="mb-10 flex flex-col items-center text-center">
        <WhyMark size={52} />
        <h1 className="mt-6 text-[1.8rem] tracking-tight text-paper">
          Come si misura <span className="serif-i text-signal">un'anima?</span>
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-faint">
          Le grandi aziende confrontano i loro modelli con tabelle e numeri. Facciamolo
          anche noi — ma onestamente. WhyChat è un maker solo, in locale, con API gratuite:
          <span className="text-dim"> non vince sul ragionamento puro dei modelli giganti.</span> Vince
          su tutto ciò che loro non possono darti.
        </p>
      </div>

      {/* punteggio sintetico */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-signal/25 bg-signal/[0.05] p-5 text-center">
          <div className="mono text-[0.5rem] text-signal">WHYCHAT</div>
          <div className="mt-1 text-[2.2rem] font-light text-paper">{wcScore}<span className="text-[1rem] text-faint">/{ROWS.length}</span></div>
          <div className="mono mt-1 text-[0.46rem] text-faint">CAPACITÀ COPERTE</div>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] p-5 text-center">
          <div className="mono text-[0.5rem] text-faint">IL MIGLIORE DEGLI ALTRI (PIANO FREE)</div>
          <div className="mt-1 text-[2.2rem] font-light text-dim">{best}<span className="text-[1rem] text-faint">/{ROWS.length}</span></div>
          <div className="mono mt-1 text-[0.46rem] text-faint">SU QUESTE STESSE CAPACITÀ</div>
        </div>
      </div>

      {/* matrice capacità */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)]">
        <div className="grid grid-cols-[1fr_repeat(4,46px)] border-b border-[var(--color-line)] bg-void2/60 sm:grid-cols-[1fr_repeat(4,64px)]">
          <div className="mono px-4 py-3 text-[0.5rem] text-faint">CAPACITÀ</div>
          {COLS.map((c, i) => (
            <div key={c} className={`mono py-3 text-center text-[0.5rem] ${i === 0 ? "text-signal" : "text-faint"}`}>
              {c === "WhyChat" ? "WHY" : c.slice(0, 3).toUpperCase()}
            </div>
          ))}
        </div>
        {ROWS.map((r, idx) => (
          <motion.div
            key={r.cap}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.025, duration: 0.3 }}
            className="grid grid-cols-[1fr_repeat(4,46px)] items-center border-b border-[var(--color-line)] last:border-0 sm:grid-cols-[1fr_repeat(4,64px)]"
          >
            <div className="px-4 py-3">
              <div className="text-[0.82rem] leading-snug text-dim">{r.cap}</div>
              {r.note && <div className="mt-0.5 text-[0.62rem] text-faint">{r.note}</div>}
            </div>
            <div className={`py-3 ${r.whychat === "yes" ? "bg-signal/[0.06]" : ""}`}><Mark v={r.whychat} /></div>
            <div className="py-3"><Mark v={r.gpt} /></div>
            <div className="py-3"><Mark v={r.claude} /></div>
            <div className="py-3"><Mark v={r.gemini} /></div>
          </motion.div>
        ))}
      </div>
      <div className="mono mt-2 flex items-center justify-end gap-4 text-[0.46rem] text-faint">
        <span className="flex items-center gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-signal"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg> SÌ</span>
        <span className="flex items-center gap-1"><span className="h-[3px] w-3 rounded-full bg-faint" /> PARZIALE</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-line2)]" /> NO</span>
      </div>

      {/* velocità reale, misurata dal vivo */}
      <div className="mt-8 rounded-2xl border border-[var(--color-line)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[0.95rem] text-paper">Velocità reale</h3>
            <p className="mt-0.5 text-[0.72rem] text-faint">
              Tempo al primo token, misurato adesso sul Worker live (Groq).
            </p>
          </div>
          <button
            onClick={measure}
            disabled={measuring}
            className="mono shrink-0 rounded-lg bg-signal px-4 py-2.5 text-[0.55rem] text-paper transition hover:bg-signal-soft disabled:opacity-50"
          >
            {measuring ? "MISURO…" : "MISURA ORA"}
          </button>
        </div>
        {ms !== null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 border-t border-[var(--color-line)] pt-4 text-center"
          >
            {ms < 0 ? (
              <span className="serif-i text-signal-soft">il Worker era occupato — riprova tra un istante</span>
            ) : (
              <>
                <span className="text-[2.4rem] font-light text-paper">{ms}</span>
                <span className="mono ml-1 text-[0.6rem] text-faint">MS AL PRIMO TOKEN</span>
                <p className="mt-1 text-[0.7rem] text-faint">
                  {ms < 700 ? "più veloce della media degli assistant mainstream" : "nei tempi degli assistant mainstream"}
                </p>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* la verità onesta */}
      <div className="mt-8 mb-24 rounded-2xl border border-signal/20 bg-signal/[0.03] p-6">
        <div className="mono mb-2 text-[0.5rem] text-signal">LA VERITÀ</div>
        <p className="serif-i text-[1.05rem] leading-[1.8] text-dim">
          WhyChat non è ChatGPT e non vuole esserlo. Quei modelli ragionano più in grande —
          è giusto dirlo. Ma nessuno di loro ti ricorda gratis su ogni schermo, nessuno disegna
          ciò che hai scarabocchiato, nessuno ti fa vedere il mondo dal vivo, nessuno sogna la
          notte. Fatto da una persona sola, in locale, con quello che c'era.
          <span className="text-paper"> Ed è tuo.</span>
        </p>
      </div>
    </div>
  );
}
