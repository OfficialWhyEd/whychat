import { useState } from "react";

// ── Pannello Artifact (stile Claude Desktop) ─────────────────────────────────
// Agganciato a destra: la chat resta a sinistra, l'artifact vive qui accanto —
// non un overlay che copre tutto. Su mobile diventa a tutto schermo.
// Richiesta a mano (IMG_9918): "sidebar + artifact ESATTAMENTE identico a Claude Desktop".

export interface ArtifactData {
  title: string;
  html: string;
}

export default function ArtifactPanel({ artifact, onClose }: { artifact: ArtifactData; onClose: () => void }) {
  const [reloadKey, setReloadKey] = useState(0);

  const openInTab = () => {
    const blob = new Blob([artifact.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <aside
      className="fixed inset-0 z-50 flex flex-col bg-[rgba(5,4,3,0.96)] backdrop-blur-xl md:static md:z-10 md:w-[clamp(340px,42vw,640px)] md:shrink-0 md:bg-[rgba(10,9,8,0.6)] md:backdrop-blur-none"
    >
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2.5">
        <span className="mono min-w-0 flex-1 truncate text-[0.58rem] text-dim">◆ {artifact.title.toUpperCase()}</span>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          title="Ricarica"
          className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
        >
          ↻
        </button>
        <button
          onClick={openInTab}
          title="Apri in una scheda"
          className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onClose}
          title="Chiudi"
          className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* il canvas vivo */}
      <iframe
        key={`${reloadKey}-${artifact.html.length}`}
        title={artifact.title}
        srcDoc={artifact.html}
        sandbox="allow-scripts allow-pointer-lock allow-popups allow-modals"
        className="w-full flex-1 border-0 bg-[#0a0908]"
      />
    </aside>
  );
}
