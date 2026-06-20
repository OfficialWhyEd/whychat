import { forwardRef, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

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
  /** Stile extra (es. background del bottone) — viene fuso con x/y magnetici. */
  style?: React.CSSProperties;
  /** Layer a tutta superficie (es. riflesso liquid metal), reso direttamente nel bottone
   *  così `inset-0` si ancora al cerchio intero e non al wrapper del contenuto. */
  overlay?: ReactNode;
}

const fillTransition = { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.6 };

const OriginButton = forwardRef<HTMLButtonElement, OriginButtonProps>(function OriginButton(
  { children, onClick, disabled, type = "button", className = "", fill = "#c94b25", fillText, title, style: extraStyle, overlay },
  forwardedRef,
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  // Micro-fisica magnetica: il bottone insegue il cursore di pochi px.
  // Motion values fuori dal render cycle (mai useState) → 60fps anche su mobile.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 280, damping: 18, mass: 0.5 });
  const y = useSpring(my, { stiffness: 280, damping: 18, mass: 0.5 });
  const PULL = 0.3; // quanto insegue
  const MAX = 5; // px massimi di spostamento

  const magnetize = (e: React.PointerEvent) => {
    const el = innerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    mx.set(Math.max(-MAX, Math.min(MAX, dx * PULL)));
    my.set(Math.max(-MAX, Math.min(MAX, dy * PULL)));
  };
  const demagnetize = () => {
    mx.set(0);
    my.set(0);
  };

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
      onPointerMove={(e) => {
        if (!disabled) magnetize(e);
      }}
      onPointerLeave={() => {
        setActive(false);
        demagnetize();
      }}
      onPointerUp={() => setActive(false)}
      className={`relative overflow-hidden isolate ${className}`}
      style={{ x, y, ...extraStyle, ...(fillText && active ? { color: fillText } : {}) }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -z-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={false}
        animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
        style={{ left: origin.x, top: origin.y, width: coverSize, height: coverSize, background: fill }}
        transition={fillTransition}
      />
      {overlay}
      <span className="relative z-10 inline-flex w-full items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
});

export default OriginButton;
