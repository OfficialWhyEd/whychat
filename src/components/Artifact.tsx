import { useState } from "react";

/**
 * Artifact: un canvas vivo dentro la chat. WhyChat genera HTML autosufficiente
 * (sketch, diagrammi, mini-giochi) che renderizziamo in un iframe SANDBOXED:
 * lo script dell'artifact NON può toccare la pagina, lo storage o la rete.
 */
export default function Artifact({
  title,
  html,
  building,
  onOpen,
}: {
  title: string;
  html: string;
  building: boolean;
  onOpen?: (title: string, html: string) => void; // apri nel pannello laterale (Claude Desktop)
}) {
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (building) {
    return (
      <div className="glass glass-sheen my-2 overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="breathe inline-block h-2 w-2 rounded-full bg-signal" />
          <span className="mono text-[0.55rem] text-faint">WHYCHAT STA COSTRUENDO · {title.toUpperCase()}</span>
        </div>
      </div>
    );
  }

  const frame = (full: boolean) => (
    <iframe
      key={`${reloadKey}-${html.length}`}
      title={title}
      srcDoc={html}
      sandbox="allow-scripts allow-pointer-lock allow-popups allow-modals"
      className="w-full border-0 bg-[#0a0908]"
      style={{ height: full ? "100%" : 380 }}
    />
  );

  return (
    <>
      <figure className="glass my-2 overflow-hidden rounded-2xl">
        <figcaption className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
          <span className="mono text-[0.55rem] text-faint">◆ {title.toUpperCase()}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              title="Ricarica"
              className="rounded-md px-2 py-1 text-[0.7rem] text-faint transition hover:text-paper"
            >
              ↻
            </button>
            <button
              onClick={() => (onOpen ? onOpen(title, html) : setOpen(true))}
              title="Apri nel pannello"
              className="rounded-md px-2 py-1 text-[0.7rem] text-faint transition hover:text-paper"
            >
              ⤢
            </button>
          </div>
        </figcaption>
        {frame(false)}
      </figure>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(5,4,3,0.85)] p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="mono text-[0.6rem] text-dim">◆ {title.toUpperCase()}</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--color-line2)] px-4 py-1.5 text-sm text-dim transition hover:text-paper"
            >
              chiudi ✕
            </button>
          </div>
          <div className="glass flex-1 overflow-hidden rounded-2xl">{frame(true)}</div>
        </div>
      )}
    </>
  );
}
