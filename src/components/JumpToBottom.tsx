import { motion } from "framer-motion";

/**
 * JumpToBottom — comparsa quando hai scrollato su a rileggere e arriva roba nuova:
 * un tasto liquid glass con accento metallico ambra che ti riporta all'ultimo
 * messaggio, senza che la chat ti strappi giù da sola.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export default function JumpToBottom({ onClick, live }: { onClick: () => void; live?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Vai all'ultimo messaggio"
      title="Vai in fondo"
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      transition={{ duration: 0.24, ease: EASE }}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.9 }}
      className="glass absolute bottom-full left-1/2 z-20 mb-3 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full text-ember shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] outline-none focus-visible:ring-2 focus-visible:ring-ember/50"
    >
      {/* riflesso metallico interno: bevel ambra in alto, ombra calda in basso */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 1px 0.5px rgba(255,233,206,0.45), inset 0 -4px 8px -4px rgba(74,22,10,0.5)" }}
      />
      {/* anello "live": contenuto nuovo che scorre sotto mentre leggi sopra */}
      {live && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-ember/50"
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.9, ease: "easeInOut" }}
        />
      )}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="relative">
        <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}
