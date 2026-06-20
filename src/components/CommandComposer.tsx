import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion();
  // "Armato": c'è testo pronto da inviare. Il primario si accende, la barra respira.
  const armed = value.trim().length > 0 && !disabled;

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
              {/* fondo solido: il menu non lascia trasparire la chat dietro */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[#141009]/92" />
              <div className="relative mono px-4 pb-1 pt-3 text-[0.5rem] text-faint">MODALITÀ</div>
              <ul className="relative px-1.5 pb-2">
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

      {/* Barra — due righe: testo sopra, controlli sotto. Mai sovrapposizioni. */}
      <div
        className={`glass glass-sheen rounded-[26px] px-3 pb-2.5 pt-2.5 ring-1 ring-inset transition-shadow duration-300 ${
          armed
            ? "ring-signal/30 shadow-[inset_0_1px_0.5px_rgba(255,252,247,0.22),0_0_32px_-9px_rgba(201,75,37,0.5)]"
            : "ring-transparent focus-within:ring-signal/25 focus-within:shadow-[inset_0_1px_0.5px_rgba(255,252,247,0.22),0_0_26px_-10px_rgba(201,75,37,0.42)]"
        }`}
      >
        {/* riga 1 — il testo */}
        <div className="relative px-0.5">
          {/* placeholder che si auto-digita quando la barra è vuota (chat) */}
          {!value && mode !== "sheet" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start overflow-hidden whitespace-nowrap py-1 text-[1rem] leading-7 text-faint">
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
            className="scroll-thin block max-h-[200px] w-full resize-none bg-transparent py-1 text-[1rem] leading-7 text-paper placeholder:text-faint focus:outline-none"
          />
        </div>

        {/* riga 2 — i controlli, allineati e simmetrici */}
        <div className="mt-2 flex items-center gap-2">
          {/* modalità → apre la palette */}
          <motion.button
            onClick={() => setMenu((s) => !s)}
            title="Scegli modalità"
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.66rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal/45 ${
              mode === "chat"
                ? "border-[var(--color-line2)] text-dim hover:border-[rgba(242,239,233,0.22)] hover:text-paper"
                : "border-signal/45 bg-[rgba(201,75,37,0.14)] text-ember hover:bg-[rgba(201,75,37,0.2)]"
            }`}
          >
            <span className={mode === "chat" ? "text-faint" : "text-ember"}>{current.icon}</span>
            <span className="mono whitespace-nowrap">{mode === "chat" ? "MODALITÀ" : current.label}</span>
            <motion.svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" className="opacity-60"
              animate={{ rotate: menu ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </motion.svg>
          </motion.button>

          {/* tasto: cerca sul web (Wikipedia) — inietta risultati reali nel contesto */}
          {onToggleSearch && (
            <motion.button
              type="button"
              onClick={onToggleSearch}
              title="Cerca sul web"
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal/45 ${
                search ? "border-signal/50 bg-[rgba(201,75,37,0.14)] text-ember hover:bg-[rgba(201,75,37,0.2)]" : "border-[var(--color-line2)] text-dim hover:border-[rgba(242,239,233,0.22)] hover:text-paper"
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
                    className="mono overflow-hidden whitespace-nowrap text-[0.62rem]"
                  >
                    CERCA
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {/* spinge il send a destra: bilancia la riga */}
          <div className="flex-1" />

          {streaming ? (
            <button
              onClick={onStop}
              title="Ferma"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(242,239,233,0.1)] text-paper transition hover:bg-[rgba(242,239,233,0.18)]"
            >
              <span className="block h-3 w-3 rounded-[3px] bg-paper" />
            </button>
          ) : (
            <OriginButton
              onClick={submit}
              disabled={disabled || !value.trim()}
              title="Invia"
              // hover translucido: un alito caldo che segue il cursore, il metallo resta visibile
              fill="rgba(255,228,198,0.42)"
              fillText="#0a0908"
              style={{
                // Metallo fuso: top illuminato (ambra) che cola verso il cremisi profondo.
                background:
                  "radial-gradient(125% 120% at 50% 6%, #ffd2a4 0%, #f0a36a 24%, #d4582c 56%, #b23d1d 80%, #8a2f17 100%)",
              }}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#0a0908] outline-none transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-ember/60 disabled:opacity-35 ${
                armed ? "shadow-[0_0_22px_-4px_rgba(224,103,63,0.55)]" : ""
              }`}
              overlay={
                <>
                  {/* bande metalliche morbide (soft-light, lente): anisotropia senza effetto spinner */}
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-1/2 mix-blend-soft-light"
                    style={{
                      background:
                        "conic-gradient(from 0deg at 50% 50%, rgba(255,242,224,0), rgba(255,242,224,0.85), rgba(120,42,22,0.55), rgba(255,226,192,0.7), rgba(120,42,22,0.45), rgba(255,242,224,0))",
                      opacity: 0.5,
                    }}
                    animate={reduce ? undefined : { rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
                  />
                  {/* glint: un lampo stretto che gira sul metallo (light che lo accarezza) */}
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-1/2 mix-blend-screen"
                    style={{
                      background:
                        "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 64deg, rgba(255,249,237,0.8) 82deg, transparent 100deg, transparent 360deg)",
                    }}
                    animate={reduce ? undefined : { rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 7, ease: "linear" }}
                  />
                  {/* specular fisso alto-sinistra: curvatura lucida del metallo */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ zIndex: 1, background: "radial-gradient(44% 34% at 37% 19%, rgba(255,250,242,0.72), transparent 64%)" }}
                  />
                  {/* fresnel rim + bevel: highlight ambra in alto, ombra calda sotto */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      zIndex: 1,
                      boxShadow:
                        "inset 0 1.5px 1px rgba(255,236,214,0.55), inset 0 0 0 1px rgba(255,230,205,0.14), inset 0 -3px 7px -2px rgba(74,22,10,0.55)",
                    }}
                  />
                </>
              }
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="relative">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </OriginButton>
          )}
        </div>
      </div>
    </div>
  );
}
