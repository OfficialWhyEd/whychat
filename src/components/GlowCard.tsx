import { useEffect, useRef, type ReactNode } from "react";

/**
 * GlowCard — i box "importanti" hanno un bordo particolare che si illumina
 * seguendo il puntatore. Adattato a WhyChat (niente cn; hue caldo del brand).
 */
interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "orange" | "crimson" | "amber";
  radius?: number;
}

const hueMap = { orange: { base: 24, spread: 60 }, crimson: { base: 8, spread: 50 }, amber: { base: 38, spread: 60 } };

export function GlowCard({ children, className = "", glowColor = "orange", radius = 16 }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = (e: PointerEvent) => {
      const el = cardRef.current;
      if (!el) return;
      el.style.setProperty("--x", String(e.clientX.toFixed(0)));
      el.style.setProperty("--xp", (e.clientX / window.innerWidth).toFixed(3));
      el.style.setProperty("--y", String(e.clientY.toFixed(0)));
    };
    document.addEventListener("pointermove", sync);
    return () => document.removeEventListener("pointermove", sync);
  }, []);

  const { base, spread } = hueMap[glowColor];
  const css = `
    [data-glow]::before, [data-glow]::after {
      pointer-events: none; content: ""; position: absolute; inset: -1px;
      border: 1.5px solid transparent; border-radius: calc(var(--radius) * 1px);
      background-attachment: fixed; background-repeat: no-repeat; background-position: 50% 50%;
      background-size: calc(100% + 3px) calc(100% + 3px);
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box; mask-composite: intersect;
    }
    [data-glow]::before {
      background-image: radial-gradient(180px 180px at calc(var(--x,0) * 1px) calc(var(--y,0) * 1px),
        hsl(var(--hue) 90% 62% / 0.9), transparent 70%);
    }
  `;
  const style = {
    "--radius": radius,
    "--hue": `calc(${base} + (var(--xp, 0) * ${spread}))`,
  } as React.CSSProperties;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div ref={cardRef} data-glow style={style} className={`relative rounded-2xl ${className}`}>
        {children}
      </div>
    </>
  );
}
