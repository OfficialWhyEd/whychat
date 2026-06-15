import { useEffect, useRef, useState } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  deep: boolean;
  onToggleDeep: () => void;
  onStop?: () => void;
  streaming: boolean;
}

export default function Composer({ onSend, disabled, deep, onToggleDeep, onStop, streaming }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="glass glass-sheen rounded-[26px] p-2 pl-4">
      <div className="flex items-end gap-2">
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
          }}
          placeholder="Scrivi a WhyChat…"
          className="scroll-thin max-h-[200px] flex-1 resize-none bg-transparent py-2.5 text-[0.98rem] leading-relaxed text-paper placeholder:text-faint focus:outline-none"
        />

        <button
          onClick={onToggleDeep}
          title="Pensiero profondo (Gemini)"
          className={`mb-0.5 grid h-9 w-9 place-items-center rounded-full border text-[0.6rem] mono transition ${
            deep
              ? "border-[var(--color-signal)] bg-[rgba(201,75,37,0.18)] text-ember"
              : "border-[var(--color-line2)] text-faint hover:text-dim"
          }`}
        >
          ∞
        </button>

        {streaming ? (
          <button
            onClick={onStop}
            title="Ferma"
            className="mb-0.5 grid h-10 w-10 place-items-center rounded-full bg-[rgba(242,239,233,0.1)] text-paper transition hover:bg-[rgba(242,239,233,0.18)]"
          >
            <span className="block h-3 w-3 rounded-[3px] bg-paper" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            title="Invia"
            className="group relative mb-0.5 grid h-10 w-10 place-items-center overflow-hidden rounded-full transition disabled:opacity-35"
            style={{ background: "linear-gradient(180deg,#e0673f,#c94b25)" }}
          >
            <span className="absolute inset-0 origin-bottom scale-y-0 bg-[#a73c1c] transition-transform duration-300 group-hover:scale-y-100" />
            <svg className="relative z-10" width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="#0a0908" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
