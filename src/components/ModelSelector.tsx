import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ModelDef {
  id: string;
  name: string;
  desc: string;
  badge?: string;
}

export const MODELS: ModelDef[] = [
  { id: "whychat-5.5", name: "WhyChat 5.5", desc: "Più capace, ragiona meglio", badge: "consigliato" },
  { id: "terry-4.2", name: "WhyChat Terry 4.2", desc: "Veloce, reattivo" },
];

export const modelName = (id: string) => MODELS.find((m) => m.id === id)?.name ?? MODELS[0].name;

export default function ModelSelector({
  model,
  onModel,
}: {
  model: string;
  onModel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.id === model) ?? MODELS[0];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.7rem] text-dim transition hover:border-signal/40 hover:text-paper"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        <span className="font-medium">{current.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="glass absolute left-1/2 top-[calc(100%+8px)] z-50 w-[248px] -translate-x-1/2 overflow-hidden rounded-2xl p-1.5"
          >
            {MODELS.map((m) => {
              const active = m.id === model;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onModel(m.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? "bg-[rgba(201,75,37,0.14)]" : "hover:bg-[rgba(242,239,233,0.05)]"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-[0.82rem] font-semibold ${active ? "text-paper" : "text-dim"}`}>
                        {m.name}
                      </span>
                      {m.badge && (
                        <span className="mono rounded-full bg-[rgba(240,163,106,0.16)] px-1.5 py-0.5 text-[0.44rem] text-ember">
                          {m.badge}
                        </span>
                      )}
                    </span>
                    <span className="block text-[0.66rem] text-faint">{m.desc}</span>
                  </span>
                  {active && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-signal">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
