import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseSegments } from "../lib/artifacts";
import type { Message } from "./ChatMessage";

// ── Chat Minimap / Navigator ─────────────────────────────────────────────────
// Una colonna sottile sul bordo destro della chat: ogni messaggio è un tick,
// gli artifact sono diamanti ember (pinnabili). Un indicatore segue il viewport
// e si ridimensiona con la conversazione. Click su un tick → salti a quel punto.
// Pensata per chat lunghe: "magari qualcuno vuole tornare a un punto della chat
// ed è andato così avanti che può aiutare molto per ripercorrere i passi".

export interface MinimapItem {
  id: string;
  role: "user" | "assistant";
  frac: number; // posizione 0..1 nel contenuto scrollabile
  label: string; // "nome" del messaggio (estratto breve)
  artifact?: string; // titolo dell'artifact, se presente → pin
}

// Estrae un'etichetta breve e pulita dal contenuto (niente markdown/fence).
function labelOf(text: string): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[\s*LUOGO\s*:[^\]]*\]\]/gi, " ")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 64) || "…";
}

// Titolo del primo artifact nel messaggio (per il pin), se c'è.
function artifactOf(text: string): string | undefined {
  for (const seg of parseSegments(text)) {
    if (seg.type === "artifact") return seg.title || "artifact";
  }
  return undefined;
}

export default function ChatMinimap({
  scrollRef,
  messages,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  messages: Message[];
}) {
  const [items, setItems] = useState<MinimapItem[]>([]);
  const [view, setView] = useState({ top: 0, height: 1 }); // finestra viewport 0..1
  const [hover, setHover] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const rafRef = useRef(0);

  // Misura: per ogni messaggio nel DOM calcola la frazione verticale; ricava
  // la finestra del viewport. Throttle via rAF (lo streaming cambia le altezze).
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const total = el.scrollHeight || 1;
    const nodes = el.querySelectorAll<HTMLElement>("[data-mid]");
    const map = new Map<string, HTMLElement>();
    nodes.forEach((n) => map.set(n.dataset.mid!, n));
    const next: MinimapItem[] = messages.map((m) => {
      const node = map.get(m.id);
      const frac = node ? Math.min(1, Math.max(0, node.offsetTop / total)) : 0;
      return {
        id: m.id,
        role: m.role,
        frac,
        label: labelOf(m.content),
        artifact: m.role === "assistant" ? artifactOf(m.content) : undefined,
      };
    });
    setItems(next);
    setView({
      top: el.scrollTop / total,
      height: Math.min(1, el.clientHeight / total),
    });
  }, [messages, scrollRef]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
  }, [measure]);

  useLayoutEffect(() => {
    schedule();
  }, [messages, schedule]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    // osserva anche il contenuto interno (le altezze cambiano durante lo stream)
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    window.addEventListener("resize", schedule);
    return () => {
      el.removeEventListener("scroll", schedule);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRef, schedule]);

  const jumpTo = useCallback(
    (id: string) => {
      const el = scrollRef.current;
      if (!el) return;
      const node = el.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);
      if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [scrollRef],
  );

  // Sotto le 4 voci non serve: la chat è già tutta a colpo d'occhio.
  if (items.length < 4) return null;

  const pins = items.filter((i) => i.artifact);

  return (
    <div
      className="pointer-events-none absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 select-none sm:block"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        setExpanded(false);
        setHover(null);
      }}
      aria-hidden
    >
      {/* rail */}
      <div
        className="pointer-events-auto relative h-[58vh] max-h-[560px] w-6 transition-all duration-300"
        style={{ width: expanded ? 168 : 24 }}
      >
        {/* linea guida */}
        <div className="absolute right-[10px] top-0 h-full w-px bg-[var(--color-line2)]" />

        {/* finestra del viewport */}
        <div
          className="absolute right-[5px] w-[11px] rounded-full bg-[rgba(240,163,106,0.10)] ring-1 ring-[rgba(240,163,106,0.28)] transition-[top,height] duration-150"
          style={{ top: `${view.top * 100}%`, height: `${Math.max(2, view.height * 100)}%` }}
        />

        {/* tick per messaggio */}
        {items.map((it) => {
          const isHover = hover === it.id;
          return (
            <button
              key={it.id}
              onClick={() => jumpTo(it.id)}
              onMouseEnter={() => setHover(it.id)}
              className="group absolute right-0 flex h-4 -translate-y-1/2 items-center justify-end"
              style={{ top: `${it.frac * 100}%`, width: expanded ? 168 : 24 }}
            >
              {/* etichetta (nome del messaggio) — appare ad hover/espanso */}
              <span
                className={`mono mr-2 max-w-[128px] truncate rounded-md border border-[var(--color-line2)] bg-[rgba(16,13,11,0.92)] px-1.5 py-0.5 text-[0.5rem] backdrop-blur transition-all duration-200 ${
                  expanded || isHover ? "opacity-100" : "pointer-events-none translate-x-1 opacity-0"
                } ${it.role === "user" ? "text-dim" : "text-faint"}`}
              >
                {it.artifact ? `◆ ${it.artifact}` : it.label}
              </span>
              {/* il tick */}
              {it.artifact ? (
                <span
                  className={`block h-[7px] w-[7px] rotate-45 rounded-[1px] transition-all ${
                    isHover ? "scale-150 bg-ember" : "bg-signal-soft"
                  }`}
                />
              ) : (
                <span
                  className={`block rounded-full transition-all ${
                    it.role === "user"
                      ? "h-[5px] w-[5px] bg-[var(--color-dim)]"
                      : "h-[3px] w-[10px] bg-[var(--color-faint)]"
                  } ${isHover ? "scale-150 bg-ember" : ""}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* contatore pin artifact in cima al rail */}
      {pins.length > 0 && (
        <div className="mono absolute -top-5 right-0 text-[0.45rem] uppercase tracking-wider text-faint/70">
          ◆ {pins.length}
        </div>
      )}
    </div>
  );
}
