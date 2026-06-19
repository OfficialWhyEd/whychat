import { forwardRef, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * OriginButton — il componente che mi hai mandato (21st.dev), riscritto sui token di WhyChat.
 * Un riempimento circolare nasce esattamente dal punto in cui entra il puntatore e dilata
 * fino a coprire il bottone. Su press affonda leggermente. framer-motion, hardware-accelerated.
 */
interface OriginButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  /** Colore del riempimento che si espande dal puntatore. */
  fill?: string;
  /** Colore del testo quando il riempimento è attivo. */
  fillText?: string;
  title?: string;
}

const fillTransition = { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.6 };

const OriginButton = forwardRef<HTMLButtonElement, OriginButtonProps>(function OriginButton(
  { children, onClick, disabled, type = "button", className = "", fill = "#c94b25", fillText, title },
  forwardedRef,
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  // Dimensione del cerchio: la diagonale piena, così copre il bottone da qualunque angolo parta.
  const coverSize = 640;

  const setRef = (node: HTMLButtonElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const updateOriginFromPointer = (e: React.PointerEvent) => {
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setOrigin({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <motion.button
      ref={setRef}
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.025 }}
      whileTap={disabled ? undefined : { scale: 0.93 }}
      transition={{ type: "spring", stiffness: 420, damping: 14, mass: 0.7 }}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        updateOriginFromPointer(e);
        setActive(true);
      }}
      onPointerEnter={(e) => {
        if (disabled) return;
        updateOriginFromPointer(e);
        setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      onPointerUp={() => setActive(false)}
      className={`relative overflow-hidden isolate ${className}`}
      style={fillText && active ? { color: fillText } : undefined}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -z-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={false}
        animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
        style={{ left: origin.x, top: origin.y, width: coverSize, height: coverSize, background: fill }}
        transition={fillTransition}
      />
      <span className="relative z-10 inline-flex w-full items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
});

export default OriginButton;
