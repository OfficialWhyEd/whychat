import { motion } from "framer-motion";

/**
 * Badge "protocollo WhyChat" — piccolo certificato olografico con la W di WhyChat
 * e una luce che scorre. Leggero, da mettere in basso a sinistra.
 */
export function ProtocolBadge() {
  return (
    <motion.div
      whileHover={{ scale: 1.03, rotate: -0.4 }}
      transition={{ type: "spring", stiffness: 380, damping: 16 }}
      className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1.5"
      title="WhyChat — anima certificata di WhyEd"
    >
      {/* riflesso olografico che scorre */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(110deg, transparent 30%, rgba(240,163,106,0.18) 45%, rgba(201,75,37,0.12) 55%, transparent 70%)",
          backgroundSize: "250% 100%",
        }}
        initial={{ backgroundPosition: "200% 0" }}
        animate={{ backgroundPosition: "-100% 0" }}
        transition={{ repeat: Infinity, duration: 3.4, ease: "linear" }}
      />
      {/* mini-W */}
      <svg viewBox="6 14 66 62" width="16" height="16" fill="none" className="relative shrink-0 text-signal">
        <path
          d="M13,22 C17,40 21,56 25,66 C30,54 34,44 38,38 C42,46 47,58 51,66 C55,56 59,40 63,22"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="relative leading-tight">
        <div className="mono text-[0.5rem] text-paper">WHYCHAT</div>
        <div className="mono text-[0.4rem] tracking-[0.2em] text-faint">ANIMA · PROTOCOL</div>
      </div>
    </motion.div>
  );
}
