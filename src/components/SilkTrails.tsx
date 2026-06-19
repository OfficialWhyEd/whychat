import { useEffect, useRef } from "react";

/**
 * Scie sinuose che seguono il puntatore — versione SOBRIA ("poco poco"):
 * poche scie, colori caldi del brand, alpha bassissima, glow leggero.
 * Catena di nodi a molla (come l'effetto silk classico) ma incapsulata: niente
 * variabili globali, cleanup completo, pausa quando la tab non è visibile.
 */
type Node = { x: number; y: number; vx: number; vy: number };
type Trail = { spring: number; friction: number; nodes: Node[] };

const TRAILS = 22;
const SIZE = 26;
const DAMP = 0.02;
const TENSION = 0.985;

export default function SilkTrails() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let running = true;
    let raf = 0;
    let phase = Math.random() * Math.PI * 2;
    let trails: Trail[] = [];

    const build = () => {
      trails = [];
      for (let i = 0; i < TRAILS; i++) {
        const nodes: Node[] = [];
        for (let j = 0; j < SIZE; j++) nodes.push({ x: pos.x, y: pos.y, vx: 0, vy: 0 });
        trails.push({ spring: 0.42 + (i / TRAILS) * 0.02, friction: 0.5 + (Math.random() * 0.01 - 0.005), nodes });
      }
    };
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const render = () => {
      if (!running) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      phase += 0.0015;
      const hue = 18 + Math.sin(phase) * 6; // oscilla nel caldo: crimson → ember
      ctx.strokeStyle = `hsla(${hue}, 82%, 56%, 0.022)`;
      ctx.lineWidth = 6;
      for (const tr of trails) {
        let spring = tr.spring;
        const head = tr.nodes[0];
        head.vx += (pos.x - head.x) * spring;
        head.vy += (pos.y - head.y) * spring;
        for (let i = 0; i < tr.nodes.length; i++) {
          const t = tr.nodes[i];
          if (i > 0) {
            const p = tr.nodes[i - 1];
            t.vx += (p.x - t.x) * spring;
            t.vy += (p.y - t.y) * spring;
            t.vx += p.vx * DAMP;
            t.vy += p.vy * DAMP;
          }
          t.vx *= tr.friction;
          t.vy *= tr.friction;
          t.x += t.vx;
          t.y += t.vy;
          spring *= TENSION;
        }
        ctx.beginPath();
        ctx.moveTo(tr.nodes[0].x, tr.nodes[0].y);
        let i = 1;
        for (; i < tr.nodes.length - 2; i++) {
          const e = tr.nodes[i];
          const t = tr.nodes[i + 1];
          ctx.quadraticCurveTo(e.x, e.y, (e.x + t.x) * 0.5, (e.y + t.y) * 0.5);
        }
        const e = tr.nodes[i];
        const t = tr.nodes[i + 1];
        ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
        ctx.stroke();
      }
      raf = requestAnimationFrame(render);
    };

    const move = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
    };
    const onVis = () => {
      running = !document.hidden;
      if (running) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(render);
      }
    };

    resize();
    build();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0, mixBlendMode: "screen" }}
    />
  );
}
