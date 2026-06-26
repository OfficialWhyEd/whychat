import { useEffect } from "react";
import { motion, useMotionValue, useTransform, useReducedMotion } from "framer-motion";

/**
 * Wordmark "WhyChat" — la SCRITTA CHE SI COMPONE. Una linea-penna luminosa scrive
 * la parola da sinistra a destra (entra), si ferma e la parola respira (viva),
 * poi la riscrive. Font Loverine (var --font-logo). Niente PNG, niente maschere
 * tagliate: il reveal è un clip pulito sincronizzato alla penna. Ease morbido
 * stile Pixar (in/out). Rispetta prefers-reduced-motion (resta scritta, ferma).
 */
export default function Wordmark({ className = "", text = "WhyChat" }: { className?: string; text?: string }) {
  const reduce = useReducedMotion();
  const p = useMotionValue(reduce ? 1 : 0); // 0 = vuota · 1 = scritta

  useEffect(() => {
    if (reduce) {
      p.set(1);
      return;
    }
    let cancelled = false;
    let raf = 0;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    // tween rAF con easing scelto (out morbido per scrivere, in per dissolvere)
    const tween = (to: number, durMs: number, ease: (t: number) => number) =>
      new Promise<void>((res) => {
        const from = p.get();
        const t0 = performance.now();
        const tick = (now: number) => {
          if (cancelled) return res();
          const k = Math.min(1, (now - t0) / durMs);
          p.set(from + (to - from) * ease(k));
          if (k < 1) raf = requestAnimationFrame(tick);
          else res();
        };
        raf = requestAnimationFrame(tick);
      });
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4); // Pixar-ish: parte svelta, si posa
    const easeIn = (t: number) => t * t * t;
    (async () => {
      while (!cancelled) {
        await tween(1, 1500, easeOut); // ENTRA: la penna scrive la parola
        await wait(5400); // SI FERMA: resta scritta e respira (respiro sul wrapper)
        if (cancelled) break;
        await tween(0, 500, easeIn); // RISCRIVE: dissolve veloce e riparte
        await wait(220);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [p, reduce]);

  // reveal: la parola è visibile da sinistra fino alla penna (clip pulito, niente tagli)
  const clip = useTransform(p, (v) => `inset(-14% ${(1 - v) * 100}% -14% -3%)`);
  // posizione della penna luminosa = bordo del reveal
  const penLeft = useTransform(p, (v) => `${v * 100}%`);
  // la penna è visibile solo MENTRE scrive (non a parola ferma né vuota)
  const penOpacity = useTransform(p, (v) => (v > 0.012 && v < 0.992 ? 1 : 0));

  return (
    <motion.div
      role="img"
      aria-label={text}
      className={`relative inline-block ${className}`}
      style={{ transformOrigin: "center" }}
      // VIVO: la parola, una volta scritta, respira appena (scala+luminosità)
      animate={reduce ? undefined : { scale: [1, 1.016, 1], opacity: [0.96, 1, 0.96] }}
      transition={{ duration: 5.4, ease: "easeInOut", repeat: Infinity }}
    >
      {/* la parola che si scopre dietro la penna */}
      <motion.span
        aria-hidden
        style={{
          clipPath: clip,
          WebkitClipPath: clip,
          fontFamily: "var(--font-logo)",
          backgroundImage: "linear-gradient(177deg, #f7f4ee 0%, #ded8cd 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          display: "inline-block",
          lineHeight: 1,
          letterSpacing: "-0.01em",
        }}
        className="select-none text-[clamp(2.6rem,9vw,4.4rem)]"
      >
        {text}
      </motion.span>

      {/* penna luminosa: la linea che "scrive" la parola */}
      <motion.span
        aria-hidden
        style={{
          left: penLeft,
          opacity: penOpacity,
          top: "-8%",
          bottom: "-8%",
          width: 2,
          position: "absolute",
          background: "linear-gradient(180deg, transparent, #f7f4ee 18%, #f0a36a 50%, #f7f4ee 82%, transparent)",
          boxShadow: "0 0 10px 1px rgba(240,163,106,0.7), 0 0 22px 3px rgba(201,75,37,0.35)",
          borderRadius: 2,
        }}
      />
    </motion.div>
  );
}
