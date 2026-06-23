import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * AnimatedIcon — avvolge qualsiasi icona/simbolo e la "anima" quando triggerata:
 * entra con un pop (scala+rotazione, spring), reagisce all'hover e al tap. È il
 * mattone per rendere VIVO ogni simbolo (stile Apple "hello", ma per le icone).
 */
export function AnimatedIcon({
  children,
  className = "",
  delay = 0,
  active = false,
  pop = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  active?: boolean;
  pop?: boolean; // pop-in al mount (default). false = solo hover/tap (icone fisse della toolbar)
}) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ transformOrigin: "center", willChange: "transform" }}
      initial={pop ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: active ? 1.06 : 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26, delay }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.9 }}
    >
      {children}
    </motion.span>
  );
}

export default AnimatedIcon;
