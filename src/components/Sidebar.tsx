import { relativeTime, type Chat } from "../lib/chats";
import SoulOrb from "./SoulOrb";

// L'orb è l'anima-logo di WhyChat. Ora canvas 2D puro: leggero, import diretto.

interface Props {
  chats: Chat[];
  activeId: string | null;
  open: boolean;
  streaming: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function Sidebar({
  chats,
  activeId,
  open,
  streaming,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: Props) {
  return (
    <>
      {/* scrim mobile */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed z-40 flex h-full w-[268px] flex-col border-r border-[var(--color-line)] bg-[rgba(16,13,11,0.72)] backdrop-blur-xl transition-transform duration-300 md:static md:z-10 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ willChange: "transform" }}
      >
        {/* brand: l'orb è il logo */}
        <div className="flex items-center gap-1 px-3 pb-3 pt-3">
          <div className="-m-1">
            <SoulOrb size={48} active={streaming} />
          </div>
          <div className="display text-[1.4rem] leading-none text-paper">
            Why<span className="text-signal">Chat</span>
          </div>
        </div>

        {/* nuova chat */}
        <div className="px-3 pb-2">
          <button
            onClick={onNew}
            className="group flex w-full items-center gap-2 rounded-xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.03)] px-3 py-2.5 text-[0.82rem] text-dim transition hover:border-signal/50 hover:text-paper"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-signal">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
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
            <div className="flex flex-col gap-0.5">
              {chats.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group relative flex items-center rounded-lg transition ${
                      isActive ? "bg-[rgba(201,75,37,0.14)]" : "hover:bg-[rgba(242,239,233,0.04)]"
                    }`}
                  >
                    <button
                      onClick={() => onSelect(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          isActive ? "bg-signal" : "bg-[var(--color-line2)]"
                        }`}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-[0.8rem] ${
                          isActive ? "text-paper" : "text-dim"
                        }`}
                      >
                        {c.title}
                      </span>
                      <span className="mono shrink-0 text-[0.5rem] text-faint">
                        {relativeTime(c.ts)}
                      </span>
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      title="Elimina"
                      className="absolute right-1.5 grid h-6 w-6 place-items-center rounded-md text-faint opacity-0 transition hover:bg-[rgba(0,0,0,0.3)] hover:text-signal-soft group-hover:opacity-100"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 7h12M9 7V5h6v2M7 7l1 13h8l1-13"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center gap-2 border-t border-[var(--color-line)] px-3 py-3">
          <a
            href="#dreams"
            title="I sogni di WhyChat"
            className="mono flex-1 rounded-lg border border-[var(--color-line2)] px-3 py-2 text-center text-[0.52rem] text-faint transition hover:text-ember"
          >
            ☾ SOGNI
          </a>
        </div>
      </aside>
    </>
  );
}
