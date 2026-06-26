import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DiaText } from "./effects/DiaText";

/**
 * Logo — la scritta WhyChat (font Loverine) come UN gesto unico e preciso: entra
 * morbida (blur+fade, ease-in-out), una banda di colore "dia" la attraversa da
 * sinistra a destra sul testo VERO (niente contorni tracciati, niente maschere
 * strane), tiene, poi esce/sparisce e ricomincia. Pulito, enfatizzato, stiloso.
 */
const SWEEP = 1.8; // durata della banda dia (entrata) — ease-in-out interno
const ENTER = 0.55;

export default function Logo({
  text = "WhyChat",
  className = "",
  hold = 5200,
}: {
  text?: string;
  className?: string;
  hold?: number;
}) {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setCycle((c) => c + 1), hold + SWEEP * 1000 + 700);
    return () => clearTimeout(t);
  }, [cycle, hold]);

  return (
    <span className={`font-logo inline-block overflow-visible ${className}`} aria-label={text}>
      <AnimatePresence mode="wait">
        <motion.span
          key={cycle}
          className="inline-block"
          style={{ filter: "drop-shadow(0 0 20px rgba(201,75,37,0.28))" }}
          initial={{ opacity: 0, filter: "blur(12px)", y: 8 }}
          animate={{
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            transition: { duration: ENTER, ease: [0.22, 1, 0.36, 1] },
          }}
          exit={{
            opacity: 0,
            filter: "blur(12px)",
            y: -8,
            transition: { duration: 0.5, ease: [0.55, 0, 1, 0.45] },
          }}
        >
          <DiaText text={text} triggerOnView={false} duration={SWEEP} className="inline-block" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
