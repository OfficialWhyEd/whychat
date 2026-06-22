import { useEffect, useRef, useState } from "react";
import { ShiningText } from "./ShiningText";
import { WLoader } from "./WLoader";

// ── Pannello di ragionamento vivo (adattato da 21st.dev "AI Thinking Block") ──
// Mostra i pensieri di WhyChat che scorrono con fade in alto/basso + uno shimmer
// "sta ragionando" + il timer. Dopo qualche secondo compare "Rispondi Ora" per
// saltare il ragionamento e avere subito la risposta (adaptive reasoning).
// Adattato ai token WhyChat: dark, ember; niente dipendenze shadcn.

export default function ReasoningPanel({
  thoughts,
  label,
  onRespondNow,
  respondAfterMs = 6500,
}: {
  thoughts: string;
  label?: string; // micro-azione corrente (es. "Penso a «fotosintesi»")
  onRespondNow?: () => void;
  respondAfterMs?: number;
}) {
  const [secs, setSecs] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const skip = setTimeout(() => setCanSkip(true), respondAfterMs);
    return () => {
      clearInterval(t);
      clearTimeout(skip);
    };
  }, [respondAfterMs]);

  // auto-scroll ai pensieri più recenti man mano che arrivano
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thoughts]);

  return (
    <div className="my-1 w-full max-w-xl">
      <div className="mb-2 flex items-center gap-2">
        <WLoader size={18} />
        <ShiningText text={label ? `${label}…` : "Sto ragionando…"} className="text-[0.92rem]" />
        <span className="mono text-[0.55rem] text-faint tabular-nums">{secs}s</span>
        {canSkip && onRespondNow && (
          <button
            onClick={onRespondNow}
            className="mono ml-auto shrink-0 rounded-full border border-ember/50 bg-[rgba(240,163,106,0.12)] px-2.5 py-1 text-[0.55rem] text-ember transition hover:bg-[rgba(240,163,106,0.2)]"
          >
            RISPONDI ORA
          </button>
        )}
      </div>

      {thoughts.trim() && (
        <div className="relative overflow-hidden rounded-xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)]">
          {/* fade in alto e in basso (come l'originale) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[rgba(16,13,11,0.9)] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[rgba(16,13,11,0.9)] to-transparent" />
          <div ref={boxRef} className="scroll-none max-h-[120px] overflow-y-auto px-3 py-2.5">
            <p className="whitespace-pre-wrap text-[0.8rem] leading-[1.6] text-faint">{thoughts}</p>
          </div>
        </div>
      )}
    </div>
  );
}
