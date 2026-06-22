import { useEffect, useRef, useState } from "react";
import { relativeTime, type Chat } from "../lib/chats";
import Logo from "./Logo";
import { MODES, type Mode } from "./CommandComposer";
import { ProtocolBadge } from "./ProtocolBadge";
import { AnimatedIcon } from "./effects/AnimatedIcon";

// icona della modalità in cui è nata la chat (default: chat)
const chatModeIcon = (m?: Mode) => MODES.find((x) => x.id === (m ?? "chat"))?.icon ?? null;

// Raggruppa per data come Claude Desktop: Oggi / Ieri / Ultimi 7 giorni / Prima.
function sectionOf(ts: number): string {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return "Oggi";
  if (ts >= startToday - 86400_000) return "Ieri";
  if (ts >= startToday - 7 * 86400_000) return "Ultimi 7 giorni";
  return "Prima";
}
const SECTION_ORDER = ["Oggi", "Ieri", "Ultimi 7 giorni", "Prima"];

interface Props {
  chats: Chat[];
  activeId: string | null;
  open: boolean;
  streaming: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: () => void;
}

export default function Sidebar({
  chats,
  activeId,
  open,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onClose,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startRename = (c: Chat) => {
    setDraft(c.title);
    setEditing(c.id);
  };
  const commitRename = () => {
    if (editing) onRename(editing, draft);
    setEditing(null);
  };

  // Più recente in cima, sempre. Poi spezzata in sezioni temporali.
  const sorted = [...chats].sort((a, b) => b.ts - a.ts);
  const groups = SECTION_ORDER.map((label) => ({
    label,
    items: sorted.filter((c) => sectionOf(c.ts) === label),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* scrim mobile — sfuma con lo stesso ritmo del pannello */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed z-40 flex h-full flex-col border-[var(--color-line)] bg-[rgba(16,13,11,0.72)] backdrop-blur-xl transition-[transform,width] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:static md:z-10 ${
          open
            ? "w-[268px] translate-x-0 border-r"
            : "w-[268px] -translate-x-full border-r md:w-0 md:translate-x-0 md:overflow-hidden md:border-r-0"
        }`}
        style={{ willChange: "transform,width" }}
      >
        {/* brand: solo la scritta WhyChat, con l'effetto dia (niente orb) */}
        <div className="flex items-center gap-2 px-3.5 pb-3 pt-4">
          <Logo text="WhyChat" className="text-[1.7rem] tracking-tight" />
          <div className="flex-1" />
          <button
            onClick={onClose}
            aria-label="Chiudi cronologia"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* nuova chat */}
        <div className="px-3 pb-2">
          <button
            onClick={onNew}
            className="group flex w-full items-center gap-2 rounded-xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.03)] px-3 py-2.5 text-[0.82rem] text-dim transition hover:border-signal/50 hover:text-paper"
          >
            <AnimatedIcon pop={false} className="text-signal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </AnimatedIcon>
            Nuova conversazione
          </button>
        </div>

        {/* history */}
        <div className="scroll-thin flex-1 overflow-y-auto px-2 py-1">
          {chats.length === 0 ? (
            <p className="px-3 py-6 text-center text-[0.72rem] leading-relaxed text-faint">
              Le tue conversazioni
              <br />
              appariranno qui.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((g) => (
                <div key={g.label} className="flex flex-col gap-0.5">
                  <div className="mono px-3 pb-0.5 pt-1.5 text-[0.46rem] uppercase tracking-[0.14em] text-faint/70">
                    {g.label}
                  </div>
                  {g.items.map((c) => {
                    const isActive = c.id === activeId;
                    const isEditing = editing === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`group relative flex items-center rounded-lg transition ${
                          isActive ? "bg-[rgba(201,75,37,0.14)]" : "hover:bg-[rgba(242,239,233,0.04)]"
                        }`}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") setEditing(null);
                            }}
                            onBlur={commitRename}
                            className="min-w-0 flex-1 rounded-lg bg-[rgba(0,0,0,0.35)] px-3 py-2 text-[0.8rem] text-paper outline-none ring-1 ring-signal/40"
                          />
                        ) : (
                          <button
                            onClick={() => onSelect(c.id)}
                            onDoubleClick={() => startRename(c)}
                            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                          >
                            <span
                              className={`grid h-4 w-4 shrink-0 place-items-center [&_svg]:h-3.5 [&_svg]:w-3.5 ${
                                isActive ? "text-signal" : "text-faint"
                              }`}
                              title={MODES.find((x) => x.id === (c.mode ?? "chat"))?.label}
                            >
                              {chatModeIcon(c.mode)}
                            </span>
                            <span
                              className={`min-w-0 flex-1 truncate text-[0.8rem] ${
                                isActive ? "text-paper" : "text-dim"
                              }`}
                            >
                              {c.title}
                            </span>
                            <span className="mono shrink-0 text-[0.5rem] text-faint transition-opacity group-hover:opacity-0">
                              {relativeTime(c.ts)}
                            </span>
                          </button>
                        )}
                        {!isEditing && (
                          <div className="absolute right-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                              onClick={() => startRename(c)}
                              title="Rinomina"
                              className="grid h-6 w-6 place-items-center rounded-md text-faint transition hover:bg-[rgba(0,0,0,0.3)] hover:text-paper"
                            >
                              <AnimatedIcon pop={false}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                  <path
                                    d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </AnimatedIcon>
                            </button>
                            <button
                              onClick={() => onDelete(c.id)}
                              title="Elimina"
                              className="grid h-6 w-6 place-items-center rounded-md text-faint transition hover:bg-[rgba(0,0,0,0.3)] hover:text-signal-soft"
                            >
                              <AnimatedIcon pop={false}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                  <path
                                    d="M6 7h12M9 7V5h6v2M7 7l1 13h8l1-13"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </AnimatedIcon>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-col gap-2 border-t border-[var(--color-line)] px-3 py-3">
          <a
            href="#dreams"
            title="I sogni di WhyChat"
            className="mono rounded-lg border border-[var(--color-line2)] px-3 py-2 text-center text-[0.52rem] text-faint transition hover:text-ember"
          >
            ☾ SOGNI
          </a>
          <ProtocolBadge />
        </div>
      </aside>
    </>
  );
}
