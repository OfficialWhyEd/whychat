import { type ReactNode, useState } from "react";

/**
 * AgentPlanning — timeline del ragionamento/planning dell'agente, stile openclaw:
 * passi con stato (in attesa / attivo / fatto / errore), durata, e contenuto
 * espandibile (spiegazioni, comandi/tool). Adattato a WhyChat: niente lucide,
 * colori del brand. Pronto per quando aggiungeremo il vero tool-loop.
 */
export type PlanStepStatus = "pending" | "active" | "success" | "error";

export interface PlanStep {
  id: string;
  title: string;
  content?: ReactNode;
  status: PlanStepStatus;
  duration?: string;
  defaultExpanded?: boolean;
}

const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Spin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.6" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const statusRing: Record<PlanStepStatus, string> = {
  success: "bg-[rgba(159,174,106,0.18)] text-[#9fae6a] ring-[rgba(159,174,106,0.25)]",
  active: "bg-[rgba(240,163,106,0.18)] text-ember ring-[rgba(240,163,106,0.3)]",
  error: "bg-[rgba(224,103,63,0.16)] text-signal-soft ring-[rgba(224,103,63,0.25)]",
  pending: "bg-[rgba(242,239,233,0.05)] text-faint ring-[var(--color-line2)]",
};

export function AgentPlanning({ title = "WhyChat sta pianificando", steps }: { title?: string; steps: PlanStep[] }) {
  const [mainOpen, setMainOpen] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    steps.reduce((a, s) => ({ ...a, [s.id]: s.defaultExpanded || false }), {} as Record<string, boolean>),
  );
  const hasActive = steps.some((s) => s.status === "active");
  const allDone = steps.every((s) => s.status === "success");

  return (
    <div className="my-3 w-full">
      <div className="overflow-hidden rounded-xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)]">
        <button
          onClick={() => setMainOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[rgba(242,239,233,0.03)]"
        >
          <span className="flex items-center gap-2.5">
            <span className={hasActive ? "text-ember" : allDone ? "text-[#9fae6a]" : "text-faint"}>
              {hasActive ? <Spin /> : allDone ? <Check /> : <span className="text-signal">✦</span>}
            </span>
            <span className="text-[0.82rem] font-medium text-paper">{title}</span>
          </span>
          <span className="text-faint">
            <Chevron open={mainOpen} />
          </span>
        </button>

        <div className={`grid transition-all duration-400 ${mainOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <div className="flex flex-col px-4 pb-4 pt-1">
              {steps.map((step, i) => {
                const isOpen = open[step.id];
                const isLast = i === steps.length - 1;
                return (
                  <div key={step.id} className={`relative flex gap-3 ${step.status === "pending" ? "opacity-55" : ""}`}>
                    {!isLast && <div className="absolute left-[10px] top-7 bottom-[-8px] w-px bg-[var(--color-line2)]" />}
                    <div className="relative z-10 mt-0.5 shrink-0">
                      <div className={`grid h-5 w-5 place-items-center rounded-full ring-4 ring-[rgba(16,13,11,0.5)] ${statusRing[step.status]}`}>
                        {step.status === "success" ? <Check /> : step.status === "active" ? <Spin /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pb-4">
                      <button
                        onClick={() => step.content && setOpen((p) => ({ ...p, [step.id]: !p[step.id] }))}
                        className={`flex w-full items-center justify-between gap-2 rounded-md py-0.5 text-left ${step.content ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <span className={`text-[0.82rem] ${step.status === "error" ? "text-signal-soft" : step.status === "active" ? "text-paper" : "text-dim"}`}>
                          {step.title}
                        </span>
                        <span className="flex items-center gap-2 text-faint">
                          {step.duration && <span className="mono text-[0.55rem]">{step.duration}</span>}
                          {step.content && <Chevron open={isOpen} />}
                        </span>
                      </button>
                      {step.content && (
                        <div className={`grid transition-all duration-300 ${isOpen ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                          <div className="overflow-hidden">
                            <div className="wc-prose pt-1 text-[0.78rem] leading-[1.6] text-faint">{step.content}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
