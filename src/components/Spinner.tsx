/**
 * Spinner — varianti di caricamento, riscritte per WhyChat: solo SVG puro,
 * niente lucide-react né alias @/. Eredita il colore (currentColor) → si tinge
 * col contesto (ember, signal, faint…). Uso globale e coerente per i loading.
 */
type Variant = "circle" | "ring" | "bars" | "ellipsis" | "infinite";

interface SpinnerProps {
  variant?: Variant;
  size?: number;
  className?: string;
}

export function Spinner({ variant = "circle", size = 20, className = "" }: SpinnerProps) {
  const common = { width: size, height: size, className };

  if (variant === "circle") {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.4" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === "ellipsis") {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        {[4, 12, 20].map((cx, i) => (
          <circle key={cx} cx={cx} cy="12" r="2">
            <animate
              attributeName="cy"
              calcMode="spline"
              dur="0.6s"
              begin={`${i * 0.12}s`}
              values="12;6;12"
              keySplines=".33,.66,.66,1;.33,0,.66,.33"
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
    );
  }

  if (variant === "bars") {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        {[1, 9, 17].map((x, i) => (
          <rect key={x} x={x} y="1" width="6" height="22" rx="1">
            <animate
              attributeName="height"
              values="22;10;22"
              dur="0.8s"
              begin={`${-0.8 + i * 0.15}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              values="1;7;1"
              dur="0.8s"
              begin={`${-0.8 + i * 0.15}s`}
              repeatCount="indefinite"
            />
          </rect>
        ))}
      </svg>
    );
  }

  if (variant === "ring") {
    return (
      <svg {...common} viewBox="0 0 44 44" stroke="currentColor">
        <g fill="none" fillRule="evenodd" strokeWidth="2">
          {[0, -0.9].map((begin) => (
            <circle key={begin} cx="22" cy="22" r="1">
              <animate attributeName="r" begin={`${begin}s`} dur="1.8s" values="1;20" keySplines="0.165,0.84,0.44,1" keyTimes="0;1" calcMode="spline" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" begin={`${begin}s`} dur="1.8s" values="1;0" keySplines="0.3,0.61,0.355,1" keyTimes="0;1" calcMode="spline" repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      </svg>
    );
  }

  // infinite
  return (
    <svg {...common} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeDasharray="205.27 51.32"
        strokeLinecap="round"
        d="M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z"
        style={{ transform: "scale(0.8)", transformOrigin: "50px 50px" }}
      >
        <animate attributeName="stroke-dashoffset" repeatCount="indefinite" dur="2s" keyTimes="0;1" values="0;256.59" />
      </path>
    </svg>
  );
}
