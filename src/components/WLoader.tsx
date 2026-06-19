import { useEffect, useRef, useState } from "react";

/**
 * Loader = la "W" di WhyChat che si disegna in loop continuo (stroke che entra,
 * si completa e scorre via, poi ricomincia). Stesso tratto della firma.
 * Niente dipendenze: misura la lunghezza del path e anima lo stroke-dashoffset.
 */
const KEYFRAMES = `@keyframes wDraw {
  0%   { stroke-dashoffset: var(--w-len); }
  45%  { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: calc(var(--w-len) * -1); }
}`;
let injected = false;

export function WLoader({ size = 20, className = "" }: { size?: number; className?: string }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (!injected) {
      injected = true;
      const s = document.createElement("style");
      s.innerHTML = KEYFRAMES;
      document.head.appendChild(s);
    }
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, []);

  return (
    <svg viewBox="6 14 66 62" width={size} height={size} fill="none" className={className} role="status" aria-label="Caricamento">
      <path
        ref={pathRef}
        d="M13,22 C17,40 21,56 25,66 C30,54 34,44 38,38 C42,46 47,58 51,66 C55,56 59,40 63,22"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          len
            ? ({ strokeDasharray: len, "--w-len": len, animation: "wDraw 2s ease-in-out infinite" } as React.CSSProperties)
            : { opacity: 0 }
        }
      />
    </svg>
  );
}
