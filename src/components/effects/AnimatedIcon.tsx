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
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  active?: boolean;
}) {
  return (
    <motion.span
      className={`inline-flex items-center justify-center ${className}`}
      initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
      animate={{ scale: active ? 1.06 : 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 17, delay }}
      whileHover={{ scale: 1.18, rotate: 4 }}
      whileTap={{ scale: 0.88, rotate: -3 }}
    >
      {children}
    </motion.span>
  );
}

export default AnimatedIcon;
