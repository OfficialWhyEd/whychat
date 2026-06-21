"use client";

import { type MotionValue, motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

/**
 * Counter — numero che "scorre" cifra per cifra (slot-machine), brandizzato.
 * Usato quando un risultato è meglio mostrarlo come numero animato che come testo
 * statico. Adattato da motion/react → framer-motion.
 */
interface CounterProps {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
  fontSize?: number;
}

export function Counter({ from = 0, to, duration, className, fontSize = 28 }: CounterProps) {
  const [value, setValue] = useState(from);
  const padding = Math.round(fontSize * 0.25);
  const height = fontSize + padding;

  useEffect(() => {
    setValue(from);
    const span = Math.max(1, Math.abs(to - from));
    const stepMs = ((duration ?? Math.min(1.4, span * 0.04)) / span) * 1000;
    const dir = to >= from ? 1 : -1;
    let cur = from;
    const id = setInterval(() => {
      cur += dir;
      setValue(cur);
      if (cur === to) clearInterval(id);
    }, Math.max(16, stepMs));
    return () => clearInterval(id);
  }, [from, to, duration]);

  const places: number[] = [];
  let p = 1;
  while (p <= Math.max(1, Math.abs(to))) {
    places.unshift(p);
    p *= 10;
  }

  return (
    <span
      style={{ fontSize }}
      className={cn("inline-flex overflow-hidden leading-none tabular-nums font-medium text-ember", className)}
    >
      {value < 0 && <span className="px-[1px]">-</span>}
      {places.map((place) => (
        <Digit key={place} place={place} value={Math.abs(value)} height={height} />
      ))}
    </span>
  );
}

function Digit({ place, value, height }: { place: number; value: number; height: number }) {
  const valueRoundedToPlace = Math.floor(value / place);
  const animated = useSpring(valueRoundedToPlace, { stiffness: 140, damping: 20 });
  useEffect(() => {
    animated.set(valueRoundedToPlace);
  }, [animated, valueRoundedToPlace]);
  return (
    <span style={{ height }} className="relative inline-block w-[0.62ch]">
      {[...Array(10)].map((_, i) => (
        <NumberCell key={i} mv={animated} number={i} height={height} />
      ))}
    </span>
  );
}

function NumberCell({ mv, number, height }: { mv: MotionValue<number>; number: number; height: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    let offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) memo -= 10 * height;
    return memo;
  });
  return (
    <motion.span style={{ y }} className="absolute inset-0 flex items-center justify-center">
      {number}
    </motion.span>
  );
}

export default Counter;
