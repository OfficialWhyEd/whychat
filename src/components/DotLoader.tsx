import { type ComponentProps, useCallback, useEffect, useRef } from "react";

/**
 * DotLoader — griglia 7×7 di puntini che animano una sequenza di frame.
 * Adattato a WhyChat (niente cn, tipi timer browser). I dot "active" si
 * illuminano col colore passato in dotClassName (es. ember del brand).
 */
type DotLoaderProps = {
  frames: number[][];
  dotClassName?: string;
  isPlaying?: boolean;
  duration?: number;
  repeatCount?: number;
  onComplete?: () => void;
} & ComponentProps<"div">;

export function DotLoader({
  frames,
  isPlaying = true,
  duration = 120,
  dotClassName = "",
  className = "",
  repeatCount = -1,
  onComplete,
  ...props
}: DotLoaderProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const currentIndex = useRef(0);
  const repeats = useRef(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyFrameToDots = useCallback(
    (dots: HTMLDivElement[], frameIndex: number) => {
      const frame = frames[frameIndex];
      if (!frame) return;
      dots.forEach((dot, index) => dot.classList.toggle("active", frame.includes(index)));
    },
    [frames],
  );

  useEffect(() => {
    currentIndex.current = 0;
    repeats.current = 0;
  }, [frames]);

  useEffect(() => {
    if (isPlaying) {
      if (currentIndex.current >= frames.length) currentIndex.current = 0;
      const els = gridRef.current?.children;
      if (!els) return;
      const dots = Array.from(els) as HTMLDivElement[];
      interval.current = setInterval(() => {
        applyFrameToDots(dots, currentIndex.current);
        if (currentIndex.current + 1 >= frames.length) {
          if (repeatCount !== -1 && repeats.current + 1 >= repeatCount) {
            if (interval.current) clearInterval(interval.current);
            onComplete?.();
          }
          repeats.current++;
        }
        currentIndex.current = (currentIndex.current + 1) % frames.length;
      }, duration);
    } else if (interval.current) {
      clearInterval(interval.current);
    }
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [frames, isPlaying, applyFrameToDots, duration, repeatCount, onComplete]);

  return (
    <div {...props} ref={gridRef} className={`grid w-fit grid-cols-7 gap-0.5 ${className}`}>
      {Array.from({ length: 49 }).map((_, i) => (
        <div key={i} className={`h-1.5 w-1.5 rounded-sm ${dotClassName}`} />
      ))}
    </div>
  );
}

// Pattern WhyChat: una barra verticale che spazza da sinistra a destra e torna.
const sweep: number[][] = [];
for (const col of [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]) {
  sweep.push([col, col + 7, col + 14, col + 21, col + 28, col + 35, col + 42]);
}
export const WHYCHAT_LOADING_FRAMES = sweep;
