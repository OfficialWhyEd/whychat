import { useEffect, useRef } from "react";

/**
 * Ambient ink — un alone d'inchiostro vivo che segue il puntatore.
 * Strato di sfondo, dietro la chat. Crimson tenue, scie che svaniscono.
 * Reattivo ma leggero: si spegne se l'utente preferisce meno movimento.
 */
export default function InkReveal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type Stamp = { x: number; y: number; born: number; r: number };
    const stamps: Stamp[] = [];
    const LIFE = 1400;
    let target = { x: w / 2, y: h * 0.4 };
    const glow = { x: target.x, y: target.y };
    let last = { x: target.x, y: target.y };

    const onMove = (e: PointerEvent) => {
      target = { x: e.clientX, y: e.clientY };
      const d = Math.hypot(target.x - last.x, target.y - last.y);
      if (d > 14 && stamps.length < 90) {
        stamps.push({ x: target.x, y: target.y, born: performance.now(), r: 60 + Math.random() * 40 });
        last = { ...target };
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // alone morbido che insegue il cursore
      glow.x += (target.x - glow.x) * 0.06;
      glow.y += (target.y - glow.y) * 0.06;
      const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 320);
      g.addColorStop(0, "rgba(201, 75, 37, 0.10)");
      g.addColorStop(0.5, "rgba(201, 75, 37, 0.035)");
      g.addColorStop(1, "rgba(201, 75, 37, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (!reduce) {
        const now = performance.now();
        for (let i = stamps.length - 1; i >= 0; i--) {
          const s = stamps[i];
          const age = (now - s.born) / LIFE;
          if (age >= 1) {
            stamps.splice(i, 1);
            continue;
          }
          const r = s.r * (0.4 + age * 0.8);
          const a = (1 - age) * 0.06;
          const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
          sg.addColorStop(0, `rgba(240, 163, 106, ${a})`);
          sg.addColorStop(1, "rgba(240, 163, 106, 0)");
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
