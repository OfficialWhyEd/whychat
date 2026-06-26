"use client";

import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "../../lib/utils";

/**
 * DiaText — rivelazione con una banda di colore che attraversa il testo (effetto
 * "dia"). Brandizzato WhyChat (palette ember/signal/paper). Usato per il logo e
 * ovunque un testo debba entrare con un micro-effetto invece che "boom" standard.
 * Adattato da motion/react → framer-motion. Supporta testo singolo o ciclo.
 */
const BRAND_COLORS = ["#c94b25", "#f0a36a", "#f2efe9", "#f0a36a", "#c94b25"];
const BAND_HALF = 17;
const SWEEP_START = -BAND_HALF;
const SWEEP_END = 100 + BAND_HALF;
const TEXT_SWAP_EASE = [0.22, 1, 0.36, 1] as const;

type DiaTextMotionProps = ComponentPropsWithoutRef<typeof motion.span>;

export type DiaTextProps = Omit<
  DiaTextMotionProps,
  "children" | "style" | "animate" | "transition" | "color" | "className"
> & {
  text: string | string[];
  colors?: string[];
  textColor?: string;
  duration?: number;
  delay?: number;
  repeat?: boolean;
  repeatDelay?: number;
  triggerOnView?: boolean;
  once?: boolean;
  className?: string;
  fixedWidth?: boolean;
};

const sweepEase = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function buildGradient(pos: number, colors: string[], textColor: string) {
  const bandStart = pos - BAND_HALF;
  const bandEnd = pos + BAND_HALF;
  if (bandStart >= 100) return `linear-gradient(90deg, ${textColor}, ${textColor})`;
  const count = colors.length;
  const parts: string[] = [];
  if (bandStart > 0) parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`);
  colors.forEach((color, index) => {
    const pct = count === 1 ? pos : bandStart + (index / (count - 1)) * BAND_HALF * 2;
    parts.push(`${color} ${pct.toFixed(2)}%`);
  });
  if (bandEnd < 100) parts.push(`transparent ${bandEnd.toFixed(2)}%`, "transparent 100%");
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

function measureWidths(element: HTMLElement, texts: string[]) {
  const ghost = element.cloneNode() as HTMLElement;
  Object.assign(ghost.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    width: "auto",
    whiteSpace: "nowrap",
  });
  element.parentElement?.appendChild(ghost);
  const widths = texts.map((entry) => {
    ghost.textContent = entry;
    return ghost.getBoundingClientRect().width;
  });
  ghost.remove();
  return widths;
}

export const DiaText = forwardRef<HTMLSpanElement, DiaTextProps>(
  (
    {
      text,
      colors = BRAND_COLORS,
      textColor = "var(--color-paper)",
      duration = 1.2,
      delay = 0,
      repeat = false,
      repeatDelay = 0.5,
      triggerOnView = true,
      once = true,
      className,
      fixedWidth = false,
      ...props
    },
    ref,
  ) => {
    const spanRef = useRef<HTMLSpanElement | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [measuredWidths, setMeasuredWidths] = useState<number[]>([]);

    const indexRef = useRef(0);
    const hasPlayedRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const controlsRef = useRef<AnimationPlaybackControls | undefined>(undefined);
    const previousTextKeyRef = useRef("");

    const sweepPos = useMotionValue(SWEEP_START);
    const textOpacity = useMotionValue(1);
    const textBlur = useMotionValue(0);
    const textShift = useMotionValue(0);
    const inView = useInView(spanRef, { once, amount: 0.1 });
    const previousActiveIndexRef = useRef(0);

    const texts = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
    const textKey = useMemo(() => texts.join("\0"), [texts]);
    const isMulti = texts.length > 1;
    const isVisible = triggerOnView ? inView : true;

    const backgroundImage = useTransform(sweepPos, (pos) => buildGradient(pos, colors, textColor));
    const contentFilter = useTransform(textBlur, (blur) => `blur(${blur.toFixed(2)}px)`);
    const contentTransform = useTransform(textShift, (shift) => `translateY(${(-2 + shift).toFixed(2)}px)`);

    const fixedW = useMemo(
      () => (isMulti && fixedWidth && measuredWidths.length > 0 ? Math.max(...measuredWidths) : undefined),
      [fixedWidth, isMulti, measuredWidths],
    );
    const animatedW = useMemo(
      () => (isMulti && !fixedWidth && measuredWidths[activeIndex] != null ? measuredWidths[activeIndex] : undefined),
      [activeIndex, fixedWidth, isMulti, measuredWidths],
    );

    const containerStyle = useMemo(
      (): NonNullable<DiaTextMotionProps["style"]> => ({
        ...(isMulti && {
          display: "inline-block",
          overflow: "hidden",
          whiteSpace: "nowrap",
          verticalAlign: "bottom",
          ...(fixedW != null && { width: fixedW }),
        }),
      }),
      [fixedW, isMulti],
    );

    const contentStyle = useMemo(
      (): NonNullable<DiaTextMotionProps["style"]> => ({
        display: "inline-block",
        color: "transparent",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundSize: "100% 100%",
        backgroundImage,
        opacity: textOpacity,
        filter: contentFilter,
        transform: contentTransform,
        willChange: "filter, opacity, transform",
        // La box dello sfondo (background-clip:text) deve coprire TUTTO l'inchiostro
        // del glifo, anche i riccioli alti/bassi dei font corsivi: senza margine
        // verticale le ascendenti/discendenti restano senza fill → "tagliate".
        // Multi-testo (contatori) gira in un contenitore overflow:hidden → niente padding.
        ...(isMulti
          ? { lineHeight: 1.15 }
          : { lineHeight: 1.32, padding: "0.16em 0.1em 0.22em" }),
      }),
      [backgroundImage, contentFilter, contentTransform, textOpacity, isMulti],
    );

    const clearCycle = useCallback(() => {
      controlsRef.current?.stop();
      controlsRef.current = undefined;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }, []);

    const playRef = useRef<() => void>(() => undefined);
    playRef.current = () => {
      clearCycle();
      sweepPos.set(SWEEP_START);
      controlsRef.current = animate(sweepPos, SWEEP_END, {
        duration,
        delay,
        ease: sweepEase,
        onComplete() {
          if (!repeat || texts.length === 0) return;
          timerRef.current = setTimeout(() => {
            const next = (indexRef.current + 1) % texts.length;
            indexRef.current = next;
            setActiveIndex(next);
            playRef.current();
          }, repeatDelay * 1000);
        },
      });
    };

    useEffect(() => {
      if (textKey === previousTextKeyRef.current) return;
      previousTextKeyRef.current = textKey;
      indexRef.current = 0;
      setActiveIndex(0);
      hasPlayedRef.current = false;
      clearCycle();
      sweepPos.set(SWEEP_START);
      if (isVisible) {
        hasPlayedRef.current = true;
        playRef.current();
      }
    }, [clearCycle, isVisible, sweepPos, textKey]);

    useEffect(() => {
      const element = spanRef.current;
      if (!(element && isMulti)) {
        setMeasuredWidths([]);
        return;
      }
      setMeasuredWidths(measureWidths(element, texts));
    }, [isMulti, texts]);

    useEffect(() => {
      if (!isVisible) {
        if (!once) hasPlayedRef.current = false;
        return;
      }
      if (once && hasPlayedRef.current) return;
      hasPlayedRef.current = true;
      playRef.current();
      return clearCycle;
    }, [clearCycle, isVisible, once]);

    useEffect(() => {
      if (!isMulti) {
        textOpacity.set(1);
        textBlur.set(0);
        textShift.set(0);
        previousActiveIndexRef.current = activeIndex;
        return;
      }
      if (previousActiveIndexRef.current === activeIndex) return;
      previousActiveIndexRef.current = activeIndex;
      textOpacity.set(0.58);
      textBlur.set(8);
      textShift.set(5.5);
      const a = animate(textOpacity, 1, { duration: 0.26, ease: TEXT_SWAP_EASE });
      const b = animate(textBlur, 0, { duration: 0.34, ease: TEXT_SWAP_EASE });
      const c = animate(textShift, 0, { duration: 0.34, ease: TEXT_SWAP_EASE });
      return () => {
        a.stop();
        b.stop();
        c.stop();
      };
    }, [activeIndex, isMulti, textBlur, textOpacity, textShift]);

    useEffect(() => clearCycle, [clearCycle]);

    const setRefs = (node: HTMLSpanElement | null) => {
      spanRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    return (
      <motion.span
        animate={animatedW != null ? { width: animatedW } : undefined}
        className={cn("align-bottom leading-[100%]", className)}
        ref={setRefs}
        style={containerStyle}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        {...props}
      >
        <motion.span aria-hidden className="inline-block" style={contentStyle}>
          {texts[activeIndex]}
        </motion.span>
        <span className="sr-only">{texts[activeIndex]}</span>
      </motion.span>
    );
  },
);

DiaText.displayName = "DiaText";
export default DiaText;
