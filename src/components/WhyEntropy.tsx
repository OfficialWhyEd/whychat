import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * WhyEntropy — modalità visiva. Una rete geometrica vive tra ordine e caos: i nodi
 * partono in reticolo, derivano in un campo di flusso fino al disordine, poi si
 * ricristallizzano. Sopra, un HUD tecnico (corner accents, dither, equalizer,
 * notazioni mono) tutto nei colori del brand: cremisi / ambra su void.
 * Grafiche geometriche + animazioni, native, zero dipendenze esterne.
 */
export default function WhyEntropy({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ e: 0, nodes: 0, frame: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0,
      H = 0,
      cols = 0,
      rows = 0;
    const nodes: { hx: number; hy: number; x: number; y: number; ph: number }[] = [];

    const build = () => {
      W = parent.clientWidth || 800;
      H = parent.clientHeight || 600;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes.length = 0;
      const gap = Math.max(46, Math.min(66, Math.hypot(W, H) / 22));
      cols = Math.ceil(W / gap) + 1;
      rows = Math.ceil(H / gap) + 1;
      const ox = (W - (cols - 1) * gap) / 2;
      const oy = (H - (rows - 1) * gap) / 2;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const hx = ox + i * gap;
          const hy = oy + j * gap;
          nodes.push({ hx, hy, x: hx, y: hy, ph: i * 0.7 + j * 1.3 });
        }
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(parent);

    let raf = 0;
    let t = 0;
    let frame = 0;
    const TH = 96;
    const TH2 = TH * TH;

    const draw = () => {
      t += reduce ? 0 : 0.016;
      frame++;
      // entropia: onda morbida 0..1 (periodo ~40s). reduce-motion = stato fisso ordinato-ish.
      const e0 = reduce ? 0.35 : 0.5 - 0.5 * Math.cos(t * 0.16);
      // rampa NON-lineare: l'ordine resta cristallino più a lungo, poi il caos erutta.
      // (curva a S: e^1.7 schiaccia il basso, così ORDER è nitido e CHAOS esplode)
      const e = Math.pow(e0, 1.7);
      ctx.clearRect(0, 0, W, H);

      // posizioni: reticolo advettato da un CAMPO DI FLUSSO coerente. I vicini
      // condividono l'angolo del campo → la maglia si stira a vortici (tessuto in
      // turbolenza), non rumore indipendente. drift cresce col caos; un secondo
      // ottava (turbolenza fine) entra solo nel CAOS (∝ e²) per la frammentazione.
      const drift = e * 64;
      const turb = e * e * 30;
      for (const n of nodes) {
        // angolo del campo: funzione liscia di (posizione, tempo) → swirl condivisi
        const ang = Math.sin(n.hx * 0.0095 + t * 0.45) * 1.7 + Math.cos(n.hy * 0.011 - t * 0.34) * 1.7;
        const ang2 = Math.cos(n.hx * 0.027 - t * 0.6) * 3.0 + Math.sin(n.hy * 0.031 + t * 0.5) * 3.0;
        n.x = n.hx + Math.cos(ang) * drift + Math.cos(ang2) * turb;
        n.y = n.hy + Math.sin(ang) * drift + Math.sin(ang2) * turb;
      }

      // archi tra vicini di griglia: la maglia che si tende e si spezza
      for (let idx = 0; idx < nodes.length; idx++) {
        const i = idx % cols;
        const j = (idx - i) / cols;
        const na = nodes[idx];
        const neigh: typeof nodes = [];
        if (i < cols - 1) neigh.push(nodes[idx + 1]);
        if (j < rows - 1) neigh.push(nodes[idx + cols]);
        if (i < cols - 1 && j < rows - 1) neigh.push(nodes[idx + cols + 1]);
        if (i > 0 && j < rows - 1) neigh.push(nodes[idx + cols - 1]);
        for (const nb of neigh) {
          const dx = na.x - nb.x;
          const dy = na.y - nb.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < TH2) {
            const al = 1 - d2 / TH2;
            const s = Math.min(1, Math.sqrt(d2) / 120); // quanto è teso → vira all'ambra
            const r = (201 + 39 * s) | 0;
            const g = (75 + 88 * s) | 0;
            const bl = (37 + 53 * s) | 0;
            ctx.strokeStyle = `rgba(${r},${g},${bl},${0.04 + al * 0.34})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(na.x, na.y);
            ctx.lineTo(nb.x, nb.y);
            ctx.stroke();
          }
        }
      }

      // nodi
      ctx.fillStyle = "rgba(240,163,106,0.5)";
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.1, 0, 6.283);
        ctx.fill();
      }

      // poligoni centrali in rotazione: l'ordine geometrico al cuore del caos
      const cx = W / 2;
      const cy = H / 2;
      const poly = (r: number, sides: number, rot: number, col: string, lw: number) => {
        ctx.beginPath();
        for (let k = 0; k <= sides; k++) {
          const ang = rot + (k / sides) * 6.283;
          const px = cx + Math.cos(ang) * r;
          const py = cy + Math.sin(ang) * r;
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();
      };
      const R = Math.min(W, H) * 0.22 * (0.82 + 0.18 * e);
      poly(R, 3, t * 0.2, `rgba(201,75,37,${0.16 + 0.3 * (1 - e)})`, 1.3);
      poly(R * 0.72, 6, -t * 0.16, `rgba(240,163,106,${0.14 + 0.24 * (1 - e)})`, 1);
      poly(R * 1.26, 3, -t * 0.12 + Math.PI, `rgba(201,75,37,0.1)`, 1);

      // ── GEOMETRIA SACRA: sfera wireframe + spirale aurea (φ), al cuore ────────
      // Additiva sopra i poligoni: più nitida nell'ORDINE, si dissolve nel CAOS.
      const sa = 0.08 + 0.52 * (1 - e); // alpha: nitida nell'ordine
      const baseR = Math.min(W, H) * 0.155;
      // sfera: contorno + meridiani che ruotano (ellissi a raggio orizzontale variabile)
      ctx.strokeStyle = `rgba(240,163,106,${sa * 0.6})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, 6.283);
      ctx.stroke();
      for (let m = 0; m < 6; m++) {
        const rx = baseR * Math.cos((m / 6) * Math.PI + t * 0.18);
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(rx), baseR, 0, 0, 6.283);
        ctx.strokeStyle = `rgba(240,163,106,${sa * 0.32})`;
        ctx.stroke();
      }
      // equatore
      ctx.beginPath();
      ctx.ellipse(cx, cy, baseR, baseR * 0.26, 0, 0, 6.283);
      ctx.strokeStyle = `rgba(201,75,37,${sa * 0.4})`;
      ctx.stroke();
      // spirale aurea: r = r0 · φ^(θ / (π/2)) — cresce di φ ogni quarto di giro
      const PHI = 1.6180339887;
      const k = Math.log(PHI) / (Math.PI / 2);
      ctx.strokeStyle = `rgba(201,75,37,${sa})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const a0 = -t * 0.16;
      let begun = false;
      for (let s2 = 0; s2 <= 260; s2++) {
        const th = (s2 / 260) * 5 * Math.PI * 2;
        const rr = 1.6 * Math.exp(k * th);
        if (rr > baseR) break;
        const px = cx + Math.cos(th + a0) * rr;
        const py = cy + Math.sin(th + a0) * rr;
        begun ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), (begun = true));
      }
      ctx.stroke();

      if (frame % 6 === 0) setHud({ e, nodes: nodes.length, frame });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const order = 1 - hud.e; // 1 = ordine, 0 = caos
  const state = hud.e < 0.33 ? "ORDER" : hud.e < 0.66 ? "DRIFT" : "CHAOS";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* dither sui due lati: texture geometrica */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 opacity-30" style={DITHER} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 opacity-30" style={DITHER} />

      {/* corner frame accents */}
      <span className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l border-t border-[var(--color-line2)]" />
      <span className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r border-t border-[var(--color-line2)]" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 border-b border-l border-[var(--color-line2)]" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 border-b border-r border-[var(--color-line2)]" />

      {/* header tecnico */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="mono -skew-x-12 text-sm font-bold tracking-[0.2em] text-paper">WHYENTROPY</span>
          <span className="h-3 w-px bg-[var(--color-line2)]" />
          <span className="mono text-[0.5rem] text-faint">EST. 2026</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono hidden text-[0.55rem] text-ember sm:inline">ENTROPY {hud.e.toFixed(3)}</span>
          <span className="hidden h-1 w-1 rounded-full bg-[var(--color-line2)] sm:inline-block" />
          <span className="mono hidden text-[0.55rem] text-faint sm:inline">NODES {hud.nodes}</span>
          {onExit && (
            <button
              onClick={onExit}
              className="mono pointer-events-auto rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:border-signal/50 hover:text-paper"
            >
              ESCI ✕
            </button>
          )}
        </div>
      </div>

      {/* marcatore sezione */}
      <div className="pointer-events-none absolute left-1/2 top-16 flex w-[min(78%,420px)] -translate-x-1/2 items-center gap-2">
        <span className="mono text-[0.5rem] text-faint">001</span>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        <span className="mono text-[0.5rem] tracking-[0.25em] text-dim">SYSTEM · ENTROPY</span>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        <span className="mono text-[0.5rem] text-faint">∞</span>
      </div>

      {/* stato al centro-basso: ORDER → CHAOS */}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center gap-2">
        <div className="mono flex items-center gap-2 text-[0.55rem] tracking-[0.3em] text-faint">
          <span className={order > 0.6 ? "text-ember" : ""}>ORDER</span>
          <span>→</span>
          <span className={order < 0.4 ? "text-signal-soft" : ""}>CHAOS</span>
        </div>
        {/* barra entropia */}
        <div className="h-[3px] w-[min(60%,300px)] overflow-hidden rounded-full bg-[rgba(242,239,233,0.08)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${hud.e * 100}%`, background: "linear-gradient(90deg,#c94b25,#f0a36a)" }}
          />
        </div>
        <span className="mono text-[0.5rem] tracking-[0.2em] text-dim">{state}</span>
      </div>

      {/* footer tecnico: equalizer + render pulse */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="mono text-[0.5rem] text-faint">SYSTEM.ACTIVE</span>
          <div className="hidden h-3 items-end gap-[3px] sm:flex">
            {BARS.map((d, i) => (
              <motion.span
                key={i}
                className="w-[2px] origin-bottom bg-[rgba(240,163,106,0.55)]"
                style={{ height: 12 }}
                animate={{ scaleY: [0.3, 1, 0.5, 0.85, 0.3] }}
                transition={{ duration: 1.6 + d, repeat: Infinity, ease: "easeInOut", delay: d }}
              />
            ))}
          </div>
          <span className="mono text-[0.5rem] text-faint">V1.0.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono hidden text-[0.5rem] text-faint sm:inline">RENDERING</span>
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((d) => (
              <motion.span
                key={d}
                className="h-1 w-1 rounded-full bg-ember"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: d }}
              />
            ))}
          </div>
          <span className="mono text-[0.5rem] text-faint">FRAME {hud.frame}</span>
        </div>
      </div>
    </div>
  );
}

const DITHER: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(0deg, transparent 0 1px, rgba(240,163,106,0.5) 1px 2px), repeating-linear-gradient(90deg, transparent 0 1px, rgba(240,163,106,0.5) 1px 2px)",
  backgroundSize: "3px 3px",
};

const BARS = [0, 0.18, 0.34, 0.12, 0.46, 0.26, 0.06, 0.4];
