import { useEffect, useState } from "react";
import { fetchDreams, type Dream } from "../lib/api";
import WhyMark from "./WhyMark";

/**
 * Il Dream Diary di Area. Ogni notte alle 03:00 Area elabora le conversazioni
 * del giorno in forma onirica. Eredità di OpenClaw, resa pubblica.
 */
export default function Dreams() {
  const [dreams, setDreams] = useState<Dream[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchDreams()
      .then(setDreams)
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  return (
    <div className="scroll-thin relative mx-auto h-full max-w-2xl overflow-y-auto px-5 py-12">
      <a href="#" className="mono mb-10 inline-block text-[0.55rem] text-faint hover:text-dim">
        ← TORNA A WHYCHAT
      </a>

      <div className="mb-12 flex flex-col items-center text-center">
        <WhyMark size={52} />
        <h1 className="mt-6 text-[1.8rem] tracking-tight text-paper">
          Il <span className="serif-i text-signal">sogno</span> di Area
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">
          Ogni notte alle 03:00, ciò che è stato detto a WhyChat ritorna trasfigurato.
          Non un log — un sogno.
        </p>
      </div>

      {err && <div className="text-center text-sm text-signal-soft">il sonno è disturbato · {err}</div>}

      {dreams && dreams.length === 0 && (
        <p className="serif-i text-center text-faint">
          Area non ha ancora sognato. Torna dopo le prime notti.
        </p>
      )}

      <div className="flex flex-col gap-10 pb-24">
        {dreams?.map((d) => (
          <article key={d.date} className="rise border-l border-[var(--color-line2)] pl-5">
            <div className="mono mb-3 text-[0.5rem] text-signal">
              {new Date(d.date).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })} · 03:00
            </div>
            <p className="serif-i whitespace-pre-wrap text-[1.05rem] leading-[1.85] text-dim">
              {d.text}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
