import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OriginButton from "./OriginButton";
import { Typewriter } from "./Typewriter";

// Suggerimenti che si auto-digitano nella barra vuota (solo modalità chat).
const PLACEHOLDERS = ["Parlami di un'idea…", "Chi sei davvero?", "Come pensi quando crei?", "Aiutami a partire…"];

export type Mode = "chat" | "canvas" | "deep" | "learn" | "sheet" | "group" | "earth";

interface ModeDef {
  id: Mode;
  label: string;
  desc: string;
  tag?: string;
  icon: React.ReactNode;
}

const I = (d: string, extra?: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra}
  </svg>
);

export const MODES: ModeDef[] = [
  { id: "chat", label: "Chat", desc: "Conversazione, come sempre", icon: I("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z") },
  { id: "canvas", label: "Canvas", desc: "Disegna l'idea, fa cose", icon: I("M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586", <circle cx="11" cy="11" r="2" />) },
  { id: "deep", label: "Deep thinking", desc: "Ragiona a fondo (Gemini)", tag: "∞", icon: I("M9.5 2a4.5 4.5 0 0 0-4.5 4.5c-.9.5-1.5 1.5-1.5 2.7 0 .9.4 1.8 1 2.4-.3.5-.5 1.1-.5 1.9a3 3 0 0 0 3 3 3 3 0 0 0 3 3V2z M14.5 2a4.5 4.5 0 0 1 4.5 4.5c.9.5 1.5 1.5 1.5 2.7 0 .9-.4 1.8-1 2.4.3.5.5 1.1.5 1.9a3 3 0 0 1-3 3 3 3 0 0 1-3 3V2z") },
  { id: "learn", label: "Apprendimento", desc: "Impara un passo alla volta", icon: I("M22 10L12 5 2 10l10 5 10-5z M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5") },
  { id: "sheet", label: "OnlyType", desc: "Foglio bianco: fai quello che vuoi", tag: "beta", icon: I("M12 3v18M3 12h18", <circle cx="12" cy="12" r="9" />) },
  {
    id: "group",
    label: "Group Prediction",
    desc: "Più agenti predicono insieme",
    tag: "beta",
    icon: I("M10.8 8.4 8 13.6M13.2 8.4 16 13.6M9 16.5h6", (
      <>
        <circle cx="12" cy="6" r="2.5" />
        <circle cx="6.5" cy="16" r="2.5" />
        <circle cx="17.5" cy="16" r="2.5" />
      </>
    )) },
  {
    id: "earth",
    label: "WhyEarth",
    desc: "Il mondo al centro, interattivo",
    tag: "beta",
    icon: I("M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18", <circle cx="12" cy="12" r="9" />),
  },
];

// Easing morbido: entra in ease-out (decelera arrivando), esce in ease-in
// (accelera andandosene). Insieme = "ease in e ease out".
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.55, 0, 1, 0.45] as const;

const container = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: "auto", transition: { height: { duration: 0.32, ease: EASE_OUT }, staggerChildren: 0.05 } },
  exit: { opacity: 0, height: 0, transition: { height: { duration: 0.24, ease: EASE_IN }, opacity: { duration: 0.16 } } },
};
const itemV = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE_IN } },
};

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  mode: Mode;
  onMode: (m: Mode) => void;
  onStop?: () => void;
  streaming: boolean;
  search?: boolean;
  onToggleSearch?: () => void;
}

export default function CommandComposer({ onSend, disabled, mode, onMode, onStop, streaming, search, onToggleSearch }: Props) {
  const [value, setValue] = useState("");
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
  };

  const pick = (m: Mode) => {
    onMode(m);
    setMenu(false);
    ref.current?.focus();
  };

  return (
    <div className="relative">
      {/* Palette modalità */}
      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              exit="exit"
              className="glass absolute bottom-[calc(100%+8px)] left-0 z-20 w-full overflow-hidden rounded-2xl"
            >
              <div className="mono px-4 pb-1 pt-3 text-[0.5rem] text-faint">MODALITÀ</div>
              <ul className="px-1.5 pb-2">
                {MODES.map((m) => {
                  const active = m.id === mode;
                  return (
                    <motion.li key={m.id} variants={itemV} layout>
                      <button
                        onClick={() => pick(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          active ? "bg-[rgba(201,75,37,0.16)]" : "hover:bg-[rgba(242,239,233,0.05)]"
                        }`}
                      >
                        <span className={active ? "text-signal" : "text-dim"}>{m.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`text-[0.86rem] ${active ? "text-paper" : "text-dim"}`}>{m.label}</span>
                            {m.tag && (
                              <span className="mono rounded-full bg-[rgba(240,163,106,0.16)] px-1.5 py-0.5 text-[0.46rem] text-ember">
                                {m.tag}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[0.66rem] text-faint">{m.desc}</span>
                        </span>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Barra */}
      <div className="glass glass-sheen rounded-[26px] p-2 pl-2 transition-all duration-300 focus-within:shadow-[0_0_28px_-8px_rgba(201,75,37,0.55)] focus-within:ring-1 focus-within:ring-signal/30">
        <div className="flex items-end gap-2">
          {/* chip modalità → apre la palette */}
          <button
            onClick={() => setMenu((s) => !s)}
            title="Scegli modalità"
            className={`mb-0.5 flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-2 text-[0.62rem] transition ${
              mode === "chat"
                ? "border-[var(--color-line2)] text-faint hover:text-dim"
                : "border-signal/45 bg-[rgba(201,75,37,0.14)] text-ember"
            }`}
          >
            <span className={mode === "chat" ? "text-dim" : "text-ember"}>{current.icon}</span>
            {mode !== "chat" && <span className="mono">{current.label}</span>}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="opacity-60">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* tasto: cerca sul web (Wikipedia) — inietta risultati reali nel contesto */}
          {onToggleSearch && (
            <motion.button
              type="button"
              onClick={onToggleSearch}
              title="Cerca sul web"
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className={`mb-0.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 transition ${
                search ? "border-signal/50 bg-[rgba(201,75,37,0.14)] text-ember" : "border-[var(--color-line2)] text-faint hover:text-dim"
              }`}
            >
              <motion.span animate={{ rotate: search ? 180 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeLinecap="round" />
                </svg>
              </motion.span>
              <AnimatePresence>
                {search && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mono overflow-hidden whitespace-nowrap text-[0.6rem]"
                  >
                    CERCA
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          <div className="relative flex-1">
            {/* placeholder che si auto-digita quando la barra è vuota (chat) */}
            {!value && mode !== "sheet" && (
              <div className="pointer-events-none absolute left-0 top-0 flex h-full items-center overflow-hidden whitespace-nowrap py-2.5 text-[0.98rem] leading-relaxed text-faint">
                <Typewriter text={PLACEHOLDERS} speed={55} deleteSpeed={28} waitTime={2200} showCursor={false} />
              </div>
            )}
            <textarea
              ref={ref}
              value={value}
              rows={1}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") setMenu(false);
              }}
              placeholder={mode === "sheet" ? "Scrivi un pensiero sul foglio…" : ""}
              className="scroll-thin max-h-[200px] w-full resize-none bg-transparent py-2.5 text-[0.98rem] leading-relaxed text-paper placeholder:text-faint focus:outline-none"
            />
          </div>

          {streaming ? (
            <button
              onClick={onStop}
              title="Ferma"
              className="mb-0.5 grid h-10 w-10 place-items-center rounded-full bg-[rgba(242,239,233,0.1)] text-paper transition hover:bg-[rgba(242,239,233,0.18)]"
            >
              <span className="block h-3 w-3 rounded-[3px] bg-paper" />
            </button>
          ) : (
            <OriginButton
              onClick={submit}
              disabled={disabled || !value.trim()}
              title="Invia"
              fill="#a73c1c"
              className="mb-0.5 grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-35"
            >
              <span className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg,#e0673f,#c94b25)", zIndex: -1 }} />
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="#0a0908" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </OriginButton>
          )}
        </div>
      </div>
    </div>
  );
}
