import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Logo — la scritta del marchio (font Loverine) che si COMPONE lettera per lettera
 * con l'effetto Apple (blur + risalita, ease-in/out morbido), tiene, poi si dissolve
 * e si ricompone in loop. Mantiene lo shimmer "dia" continuo sulle lettere.
 */
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
  exit: { transition: { staggerChildren: 0.028 } },
};
const letter: Variants = {
  hidden: { opacity: 0, y: "0.45em", filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: "-0.4em", filter: "blur(8px)", transition: { duration: 0.42, ease: [0.55, 0, 1, 0.45] } },
};

export default function Logo({
  text = "WhyChat",
  className = "",
  hold = 7000,
}: {
  text?: string;
  className?: string;
  hold?: number;
}) {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setCycle((c) => c + 1), hold);
    return () => clearTimeout(t);
  }, [cycle, hold]);

  return (
    <span className={`font-logo inline-block leading-none ${className}`} aria-label={text}>
      <AnimatePresence mode="wait">
        <motion.span
          key={cycle}
          variants={container}
          initial="hidden"
          animate="show"
          exit="exit"
          className="inline-flex"
        >
          {text.split("").map((ch, i) => (
            <motion.span key={i} variants={letter} className="logo-letter inline-block">
              {ch === " " ? " " : ch}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
