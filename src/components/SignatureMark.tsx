import { motion } from "framer-motion";

/**
 * Il logo "WhyChat" scritto a mano: il tratto si disegna come una firma, resta un
 * attimo, poi si ritira e si riscrive — in loop, a ritmo naturale (non veloce).
 * Tecnica: stroke-dashoffset su testo (font firma), come il path-draw di Apple "hello".
 */
const LEN = 2200; // ≥ lunghezza reale del contorno: garantisce disegno e ritiro completi

export default function SignatureMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 250 70"
      className={className}
      role="img"
      aria-label="WhyChat"
      fill="none"
    >
      <motion.text
        x="6"
        y="50"
        fontFamily='"Caveat", cursive'
        fontSize="54"
        fontWeight={700}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: LEN }}
        initial={{ strokeDashoffset: LEN }}
        animate={{ strokeDashoffset: [LEN, 0, 0, LEN] }}
        transition={{
          duration: 6.5,
          times: [0, 0.42, 0.78, 1], // scrive · resta · si ritira
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0.5,
        }}
      >
        WhyChat
      </motion.text>
    </svg>
  );
}
