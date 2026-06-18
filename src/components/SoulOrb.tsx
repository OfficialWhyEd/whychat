import { useEffect, useRef } from "react";

/**
 * SoulOrb — l'anima di WhyChat, in canvas 2D puro (niente three.js).
 * Sfera scura e traslucida con un rim-glow che brucia (crimson → ember),
 * uno specular che deriva (dà il volume), e due halo che respirano.
 * ~2KB a runtime invece di 800KB di WebGL: stesso spirito, peso zero.
 */
export default function SoulOrb({ size = 180, active = false }: { size?: number; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.38; // raggio nucleo

    let intensity = 0; // 0 quiete → 1 attivo
    let raf = 0;
    const t0 = performance.now();

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const target = activeRef.current ? 1 : 0.26 + Math.sin(t * 1.1) * 0.06;
      intensity += (target - intensity) * 0.06;
      const breath = 1 + Math.sin(t * (activeRef.current ? 2.2 : 1.2)) * 0.025;
      const r = R * breath;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      // alone esterno morbido
      const halo = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 2.1);
      halo.addColorStop(0, `rgba(201,75,37,${0.16 + intensity * 0.22})`);
      halo.addColorStop(0.5, `rgba(201,75,37,${0.05 + intensity * 0.08})`);
      halo.addColorStop(1, "rgba(201,75,37,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
      ctx.fill();

      // corpo: cuore scuro traslucido → vetro
      const body = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      body.addColorStop(0, "rgba(18,14,12,0.30)");
      body.addColorStop(0.62, "rgba(24,16,13,0.55)");
      body.addColorStop(1, "rgba(40,18,12,0.85)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // rim-glow fresnel: anello che brucia crimson → ember
      const rim = ctx.createRadialGradient(0, 0, r * 0.74, 0, 0, r);
      rim.addColorStop(0, "rgba(201,75,37,0)");
      rim.addColorStop(0.82, `rgba(201,75,37,${0.4 + intensity * 0.4})`);
      rim.addColorStop(1, `rgba(240,163,106,${0.7 + intensity * 0.3})`);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // specular che deriva: dà il volume di sfera
      const sa = t * (activeRef.current ? 0.5 : 0.22);
      const sx = Math.cos(sa) * r * 0.32;
      const sy = Math.sin(sa * 0.8) * r * 0.32 - r * 0.18;
      const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.7);
      spec.addColorStop(0, `rgba(255,220,190,${0.28 + intensity * 0.18})`);
      spec.addColorStop(1, "rgba(255,220,190,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // due cerchi-halo sottili che ruotano e pulsano
      for (let k = 0; k < 2; k++) {
        const rr = r * (1.18 + k * 0.18);
        const op = (0.3 - k * 0.18) * (0.7 + Math.sin(t * (1.3 + k) + k) * 0.3) * (0.6 + intensity * 0.5);
        ctx.strokeStyle = `rgba(201,75,37,${Math.max(op, 0)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      // statico: una passata in stato quiete
      intensity = active ? 0.6 : 0.3;
      frame(t0);
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
