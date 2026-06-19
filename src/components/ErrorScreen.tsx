import { WLoader } from "./WLoader";
import { ShiningText } from "./ShiningText";

/**
 * Schermata d'errore/404 — centrata, scura, ben fatta: la "W" di WhyChat che si
 * disegna + testo shimmer + (eventuale) codice/dettaglio e un'azione per riprendere.
 * Riusata per qualunque errore (crash app, 404, ecc.).
 */
export function ErrorScreen({
  code,
  message = "Qualcosa si è rotto",
  detail,
}: {
  code?: string;
  message?: string;
  detail?: string;
}) {
  return (
    <div className="flex h-full min-h-screen w-full flex-col items-center justify-center gap-5 bg-void px-6 text-center">
      <WLoader size={76} className="text-signal" />
      {code && <div className="mono text-[0.6rem] tracking-[0.3em] text-faint">{code}</div>}
      <ShiningText text={message} className="text-[1.15rem]" />
      {detail && <p className="max-w-sm text-balance text-[0.85rem] leading-relaxed text-faint">{detail}</p>}
      <button
        onClick={() => location.reload()}
        className="mono mt-1 rounded-full border border-[var(--color-line2)] px-4 py-2 text-[0.6rem] text-dim transition hover:border-signal/50 hover:text-paper"
      >
        RICARICA
      </button>
    </div>
  );
}
