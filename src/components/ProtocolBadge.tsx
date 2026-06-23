import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Badge "protocollo WhyChat" — piccolo certificato olografico, cliccabile: apre
 * un pannello che spiega in modo semplice tutto ciò che WhyChat usa davvero
 * (modelli, modalità, ricerche online in tempo reale, dati live, architettura).
 */

// Le specifiche reali del sistema, raccontate semplici.
const SPECS: { title: string; note?: string; items: { k: string; v: string }[] }[] = [
  {
    title: "Memoria & identità",
    note: "ti riconosce su ogni dispositivo, in tempo reale",
    items: [
      { k: "Ti ricorda", v: "le conversazioni restano fra una sessione e l'altra" },
      { k: "Ovunque", v: "stesso te su telefono e computer — non riparti da zero" },
      { k: "Personalizzato", v: "impara il tuo modo e i tuoi interessi, e cambia con te" },
      { k: "Primo incontro", v: "ti accoglie e si presenta su misura" },
    ],
  },
  {
    title: "Intelligenza",
    note: "se un modello è a quota, passa al successivo — non si ferma mai",
    items: [
      { k: "WhyChat 5.5", v: "Llama 3.3 70B su Groq, in streaming" },
      { k: "Ragiona da solo", v: "decide quando pensare a fondo; puoi anche saltarlo" },
      { k: "Deep thinking", v: "Gemini 2.5, ragionamento vivo e mostrato" },
      { k: "Resilienza", v: "6 chiavi Groq + 2 Gemini in cascata" },
    ],
  },
  {
    title: "Modalità",
    items: [
      { k: "Chat", v: "conversazione, con memoria" },
      { k: "Deep thinking", v: "ragiona a fondo e mostra il pensiero" },
      { k: "OnlyType", v: "disegni un'idea → la crea davvero" },
      { k: "Group Prediction", v: "più menti che discutono e prevedono" },
      { k: "WhyEarth", v: "il mondo interattivo, dati reali, immagini" },
      { k: "WhyMusic", v: "analizza una traccia nei dettagli" },
      { k: "WhyEcosystem", v: "simulazioni di natura, dal vivo" },
      { k: "WhyEntropy", v: "spazio aperto: mente, senso, geometria" },
    ],
  },
  {
    title: "Legge i tuoi file",
    note: "anche più insieme, e ne capisce il contesto",
    items: [
      { k: "Immagini & video", v: "le vede (dal video legge un fotogramma)" },
      { k: "PDF & testo/codice", v: "li legge davvero, non solo il nome" },
      { k: "ZIP", v: "lo spacchetta e legge cosa contiene" },
    ],
  },
  {
    title: "Connesso al mondo",
    note: "cerca online in tempo reale quando serve",
    items: [
      { k: "Ricerche", v: "Wikipedia, Hacker News — fatti reali, citati" },
      { k: "Dati live", v: "terremoti (USGS), voli, globo" },
      { k: "Ora reale", v: "sa sempre data e ora, fuso italiano" },
    ],
  },
  {
    title: "Architettura",
    items: [
      { k: "Edge globale", v: "Cloudflare Workers, streaming SSE" },
      { k: "Memoria", v: "su KV all'edge: veloce, ovunque, in tempo reale" },
      { k: "Privacy", v: "nessuna chiave nel browser, segreti al sicuro" },
    ],
  },
];

const WMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="6 14 66 62" width="16" height="16" fill="none" className={className}>
    <path
      d="M13,22 C17,40 21,56 25,66 C30,54 34,44 38,38 C42,46 47,58 51,66 C55,56 59,40 63,22"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function ProtocolBadge() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03, rotate: -0.4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 16 }}
        className="relative flex w-full items-center gap-2 overflow-hidden rounded-lg border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1.5 text-left transition-colors hover:border-signal/40"
        title="Cosa c'è dentro WhyChat — apri le specifiche"
      >
        {/* riflesso olografico che scorre */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, rgba(240,163,106,0.18) 45%, rgba(201,75,37,0.12) 55%, transparent 70%)",
            backgroundSize: "250% 100%",
          }}
          initial={{ backgroundPosition: "200% 0" }}
          animate={{ backgroundPosition: "-100% 0" }}
          transition={{ repeat: Infinity, duration: 3.4, ease: "linear" }}
        />
        <WMark className="relative shrink-0 text-signal" />
        <div className="relative flex-1 leading-tight">
          <div className="mono text-[0.5rem] text-paper">WHYCHAT</div>
          <div className="mono text-[0.4rem] tracking-[0.2em] text-faint">ANIMA · PROTOCOL</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="relative shrink-0 text-faint">
          <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      {createPortal(
        <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* scrim */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

            <motion.div
              role="dialog"
              aria-label="Specifiche di WhyChat"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex max-h-[82vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--color-line2)] bg-[#14100b] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]"
            >
              {/* header */}
              <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-signal/30 bg-[rgba(201,75,37,0.1)] text-signal">
                  <WMark />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.95rem] text-paper">Dentro WhyChat</div>
                  <div className="mono text-[0.5rem] tracking-[0.18em] text-faint">ANIMA · PROTOCOL · v5.5</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Chiudi"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* corpo scrollabile */}
              <div className="scroll-thin flex flex-col gap-6 overflow-y-auto px-5 py-5">
                {SPECS.map((sec, si) => (
                  <motion.section
                    key={sec.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + si * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-2 flex items-baseline gap-2">
                      <h3 className="mono text-[0.55rem] uppercase tracking-[0.18em] text-ember">{sec.title}</h3>
                      {sec.note && <span className="text-[0.6rem] text-faint">— {sec.note}</span>}
                    </div>
                    <div>
                      {sec.items.map((it) => (
                        <div
                          key={it.k}
                          className="flex flex-col gap-0.5 border-t border-[var(--color-line)] py-2 first:border-t-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                        >
                          <span className="shrink-0 text-[0.82rem] text-paper">{it.k}</span>
                          <span className="min-w-0 break-words text-[0.72rem] leading-snug text-dim sm:text-right">{it.v}</span>
                        </div>
                      ))}
                    </div>
                  </motion.section>
                ))}

                <p className="border-t border-[var(--color-line)] pt-4 text-[0.66rem] leading-relaxed text-faint">
                  WhyChat è l'anima digitale di WhyEd: pensa in streaming, cerca il mondo in tempo
                  reale, ricorda le tue conversazioni per crescere. Tutto open, niente magia nascosta.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
