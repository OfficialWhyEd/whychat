import { useEffect, useRef, useState } from "react";
import { streamChat } from "../lib/api";

/**
 * WhyEcosystem — simulazioni di "nature behaviour" in tempo reale (stile Primer
 * Blobs): preda/predatore con selezione naturale. Conigli cercano cibo e fuggono
 * dalle volpi; chi sopravvive si riproduce passando tratti mutati (velocità,
 * vista). Parametri dal vivo, grafico delle popolazioni, consigli AI, e download
 * della simulazione in orizzontale o verticale (WebM).
 */

interface Agent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  speed: number; // tratto ereditabile
  sense: number; // tratto ereditabile (raggio di percezione)
  age: number;
}

interface Params {
  preyStart: number;
  predStart: number;
  foodRate: number; // cibo per tick
  preySpeed: number;
  predSpeed: number;
  mutation: number;
}

const DEFAULTS: Params = { preyStart: 60, predStart: 8, foodRate: 2.2, preySpeed: 1.5, predSpeed: 1.7, mutation: 0.12 };

const PRESETS: { name: string; p: Params; note: string }[] = [
  { name: "Conigli & Volpi", p: DEFAULTS, note: "L'equilibrio classico: oscillazioni preda-predatore (Lotka-Volterra)." },
  { name: "Carestia", p: { ...DEFAULTS, foodRate: 0.9, preyStart: 80 }, note: "Poco cibo: vince chi è efficiente, la velocità costa energia." },
  { name: "Abbondanza", p: { ...DEFAULTS, foodRate: 4.5, predStart: 4 }, note: "Cibo ovunque, pochi predatori: esplosione di prede poi correzione." },
  { name: "Caccia spietata", p: { ...DEFAULTS, predStart: 16, predSpeed: 2.2 }, note: "Tanti predatori veloci: le prede devono evolvere vista e fuga." },
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const mut = (v: number, m: number) => Math.max(0.4, v + rand(-m, m) * v);

export default function WhyEcosystem({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const preyRef = useRef<Agent[]>([]);
  const predRef = useRef<Agent[]>([]);
  const foodRef = useRef<{ x: number; y: number }[]>([]);
  const histRef = useRef<{ prey: number; pred: number }[]>([]);
  const paramsRef = useRef<Params>({ ...DEFAULTS });
  const runningRef = useRef(true);
  const recRef = useRef<MediaRecorder | null>(null);

  const [params, setParams] = useState<Params>({ ...DEFAULTS });
  const [running, setRunning] = useState(true);
  const [counts, setCounts] = useState({ prey: 0, pred: 0, tick: 0 });
  const [orient, setOrient] = useState<"land" | "port">("land");
  const [recording, setRecording] = useState(false);
  const [advice, setAdvice] = useState("");
  const [adviceBusy, setAdviceBusy] = useState(false);

  paramsRef.current = params;
  runningRef.current = running;

  const spawn = () => {
    const c = canvasRef.current;
    const W = c?.clientWidth ?? 600;
    const H = c?.clientHeight ?? 400;
    const p = paramsRef.current;
    preyRef.current = Array.from({ length: p.preyStart }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      vx: 0,
      vy: 0,
      energy: rand(40, 80),
      speed: mut(p.preySpeed, 0.2),
      sense: rand(50, 90),
      age: 0,
    }));
    predRef.current = Array.from({ length: p.predStart }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      vx: 0,
      vy: 0,
      energy: rand(80, 140),
      speed: mut(p.predSpeed, 0.2),
      sense: rand(80, 130),
      age: 0,
    }));
    foodRef.current = [];
    histRef.current = [];
  };

  const reset = () => {
    spawn();
    setCounts({ prey: preyRef.current.length, pred: predRef.current.length, tick: 0 });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas();
    spawn();

    let tick = 0;
    let foodAcc = 0;
    const nearest = (x: number, y: number, arr: { x: number; y: number }[], maxD: number) => {
      let best = -1;
      let bd = maxD * maxD;
      for (let i = 0; i < arr.length; i++) {
        const dx = arr[i].x - x;
        const dy = arr[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };

    const step = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const p = paramsRef.current;
      // cibo
      foodAcc += p.foodRate;
      while (foodAcc >= 1 && foodRef.current.length < 1200) {
        foodRef.current.push({ x: rand(0, W), y: rand(0, H) });
        foodAcc -= 1;
      }
      const prey = preyRef.current;
      const pred = predRef.current;
      const food = foodRef.current;

      // prede: fuggi dai predatori vicini, altrimenti cerca cibo
      const newPrey: Agent[] = [];
      for (const a of prey) {
        a.age++;
        const pi = nearest(a.x, a.y, pred, a.sense);
        if (pi >= 0) {
          const f = pred[pi];
          const dx = a.x - f.x;
          const dy = a.y - f.y;
          const m = Math.hypot(dx, dy) || 1;
          a.vx = (dx / m) * a.speed * 1.6;
          a.vy = (dy / m) * a.speed * 1.6;
        } else {
          const fi = nearest(a.x, a.y, food, a.sense);
          if (fi >= 0) {
            const t = food[fi];
            const dx = t.x - a.x;
            const dy = t.y - a.y;
            const m = Math.hypot(dx, dy) || 1;
            a.vx = (dx / m) * a.speed;
            a.vy = (dy / m) * a.speed;
            if (m < 6) {
              food.splice(fi, 1);
              a.energy += 22;
            }
          } else {
            a.vx += rand(-0.4, 0.4);
            a.vy += rand(-0.4, 0.4);
          }
        }
        a.x = (a.x + a.vx + W) % W;
        a.y = (a.y + a.vy + H) % H;
        a.energy -= 0.45 + a.speed * a.speed * 0.05; // muoversi veloce costa
        if (a.energy > 110 && newPrey.length + prey.length < 600) {
          a.energy *= 0.5;
          newPrey.push({ ...a, age: 0, energy: a.energy, speed: mut(a.speed, p.mutation), sense: mut(a.sense, p.mutation) });
        }
      }
      preyRef.current = prey.filter((a) => a.energy > 0).concat(newPrey);

      // predatori: caccia la preda più vicina
      const newPred: Agent[] = [];
      for (const a of pred) {
        a.age++;
        const ti = nearest(a.x, a.y, preyRef.current, a.sense);
        if (ti >= 0) {
          const t = preyRef.current[ti];
          const dx = t.x - a.x;
          const dy = t.y - a.y;
          const m = Math.hypot(dx, dy) || 1;
          a.vx = (dx / m) * a.speed;
          a.vy = (dy / m) * a.speed;
          if (m < 8) {
            preyRef.current.splice(ti, 1);
            a.energy += 55;
          }
        } else {
          a.vx += rand(-0.3, 0.3);
          a.vy += rand(-0.3, 0.3);
        }
        a.x = (a.x + a.vx + W) % W;
        a.y = (a.y + a.vy + H) % H;
        a.energy -= 0.6 + a.speed * a.speed * 0.05;
        if (a.energy > 160 && newPred.length + pred.length < 200) {
          a.energy *= 0.5;
          newPred.push({ ...a, age: 0, energy: a.energy, speed: mut(a.speed, p.mutation), sense: mut(a.sense, p.mutation) });
        }
      }
      predRef.current = pred.filter((a) => a.energy > 0).concat(newPred);

      // ripopolamento di sicurezza: se una specie si estingue, ne semina qualcuna
      if (preyRef.current.length === 0)
        preyRef.current.push({ x: rand(0, W), y: rand(0, H), vx: 0, vy: 0, energy: 60, speed: p.preySpeed, sense: 70, age: 0 });

      tick++;
      if (tick % 6 === 0) {
        histRef.current.push({ prey: preyRef.current.length, pred: predRef.current.length });
        if (histRef.current.length > 320) histRef.current.shift();
      }
      if (tick % 12 === 0)
        setCounts({ prey: preyRef.current.length, pred: predRef.current.length, tick });
    };

    const draw = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.fillStyle = "#0a0908";
      ctx.fillRect(0, 0, W, H);
      // cibo (verde-oliva)
      ctx.fillStyle = "#9fae6a";
      for (const f of foodRef.current) {
        ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
      }
      // prede (paper) — dimensione per energia
      for (const a of preyRef.current) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.4, 0, 2 * Math.PI);
        ctx.fillStyle = "#f2efe9";
        ctx.globalAlpha = Math.min(1, 0.4 + a.energy / 120);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // predatori (cremisi)
      for (const a of predRef.current) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 3.4, 0, 2 * Math.PI);
        ctx.fillStyle = "#c94b25";
        ctx.fill();
      }
      drawGraph();
    };

    const drawGraph = () => {
      const g = graphRef.current;
      const gx = g?.getContext("2d");
      if (!g || !gx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = g.clientWidth;
      const H = g.clientHeight;
      if (g.width !== W * dpr) {
        g.width = W * dpr;
        g.height = H * dpr;
        gx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      gx.clearRect(0, 0, W, H);
      const hist = histRef.current;
      if (hist.length < 2) return;
      const maxV = Math.max(10, ...hist.map((h) => Math.max(h.prey, h.pred)));
      const line = (key: "prey" | "pred", color: string) => {
        gx.beginPath();
        hist.forEach((h, i) => {
          const x = (i / (hist.length - 1)) * W;
          const y = H - (h[key] / maxV) * H;
          i ? gx.lineTo(x, y) : gx.moveTo(x, y);
        });
        gx.strokeStyle = color;
        gx.lineWidth = 1.4;
        gx.stroke();
      };
      line("prey", "#f2efe9");
      line("pred", "#c94b25");
    };

    const loop = () => {
      if (runningRef.current) step();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (p: Params) => {
    setParams({ ...p });
    paramsRef.current = { ...p };
    spawn();
  };

  const toggleRecord = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `whyecosystem-${orient === "port" ? "verticale" : "orizzontale"}-${Date.now()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setRecording(false);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const suggest = async () => {
    if (adviceBusy) return;
    setAdviceBusy(true);
    setAdvice("");
    let acc = "";
    try {
      await streamChat(
        [
          {
            role: "user",
            content:
              "Suggeriscimi UNA simulazione di nature behaviour interessante da provare (stile Primer/Blobs), in 2 frasi: cosa osservare e come regolare i parametri (cibo, velocità preda/predatore, mutazione). Sii concreto e breve.",
          },
        ],
        (d) => {
          acc += d;
          setAdvice(acc);
        },
        undefined,
        "chat",
      );
    } catch (e) {
      setAdvice(`⚠ ${(e as Error).message}`);
    } finally {
      setAdviceBusy(false);
    }
  };

  return (
    <div className="scroll-thin mx-auto flex h-full max-w-4xl flex-col gap-3 overflow-y-auto px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {onExit && (
          <button
            onClick={onExit}
            className="mono rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:border-signal/50 hover:text-paper"
          >
            ESCI ✕
          </button>
        )}
        <span className="mono text-[0.55rem] text-faint">WHYECOSYSTEM · SELEZIONE NATURALE</span>
        <span className="flex-1" />
        <button
          onClick={() => setRunning((r) => !r)}
          className="mono rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.5rem] text-dim transition hover:text-paper"
        >
          {running ? "⏸ PAUSA" : "▶ AVVIA"}
        </button>
        <button onClick={reset} className="mono rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.5rem] text-dim transition hover:text-paper">
          ↻ RESET
        </button>
      </div>

      {/* arena */}
      <div className={`relative w-full overflow-hidden rounded-2xl border border-[var(--color-line2)] ${orient === "port" ? "aspect-[9/16] max-h-[60vh] mx-auto" : "aspect-video"}`}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {/* legenda + conteggi (numeri animati) */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[0.6rem]">
          <span className="flex items-center gap-1.5 text-paper">
            <span className="h-2 w-2 rounded-full bg-paper" /> prede {counts.prey}
          </span>
          <span className="flex items-center gap-1.5 text-signal-soft">
            <span className="h-2 w-2 rounded-full bg-signal" /> predatori {counts.pred}
          </span>
          <span className="flex items-center gap-1.5 text-[#9fae6a]">
            <span className="h-2 w-2 rounded-full bg-[#9fae6a]" /> cibo
          </span>
        </div>
      </div>

      {/* grafico popolazioni */}
      <canvas ref={graphRef} className="h-16 w-full rounded-xl border border-[var(--color-line)] bg-[rgba(16,13,11,0.4)]" />

      {/* preset + orientamento + registra */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((pr) => (
          <button
            key={pr.name}
            onClick={() => applyPreset(pr.p)}
            title={pr.note}
            className="rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.66rem] text-dim transition hover:border-signal/40 hover:text-paper"
          >
            {pr.name}
          </button>
        ))}
        <span className="flex-1" />
        <div className="flex overflow-hidden rounded-full border border-[var(--color-line2)]">
          <button
            onClick={() => setOrient("land")}
            className={`px-2.5 py-1 text-[0.55rem] ${orient === "land" ? "bg-[rgba(201,75,37,0.18)] text-paper" : "text-faint"}`}
          >
            ▭ Orizz.
          </button>
          <button
            onClick={() => setOrient("port")}
            className={`px-2.5 py-1 text-[0.55rem] ${orient === "port" ? "bg-[rgba(201,75,37,0.18)] text-paper" : "text-faint"}`}
          >
            ▯ Vert.
          </button>
        </div>
        <button
          onClick={toggleRecord}
          className={`mono rounded-full px-3 py-1.5 text-[0.55rem] transition ${
            recording ? "bg-signal text-paper" : "border border-[var(--color-line2)] text-dim hover:text-paper"
          }`}
        >
          {recording ? "■ STOP & SCARICA" : "● REGISTRA"}
        </button>
      </div>

      {/* parametri dal vivo */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-[var(--color-line)] bg-[rgba(242,239,233,0.02)] p-3 sm:grid-cols-3">
        <Slider label="Cibo" min={0.4} max={5} step={0.1} value={params.foodRate} onChange={(v) => setParams((p) => ({ ...p, foodRate: v }))} />
        <Slider label="Vel. prede" min={0.6} max={3} step={0.1} value={params.preySpeed} onChange={(v) => setParams((p) => ({ ...p, preySpeed: v }))} />
        <Slider label="Vel. predatori" min={0.6} max={3} step={0.1} value={params.predSpeed} onChange={(v) => setParams((p) => ({ ...p, predSpeed: v }))} />
        <Slider label="Mutazione" min={0} max={0.4} step={0.02} value={params.mutation} onChange={(v) => setParams((p) => ({ ...p, mutation: v }))} />
        <Slider label="Prede iniziali" min={10} max={200} step={5} value={params.preyStart} onChange={(v) => setParams((p) => ({ ...p, preyStart: v }))} />
        <Slider label="Predatori iniziali" min={1} max={40} step={1} value={params.predStart} onChange={(v) => setParams((p) => ({ ...p, predStart: v }))} />
      </div>

      {/* consiglio AI per chi non ha idee */}
      <div className="flex items-center gap-2">
        <button
          onClick={suggest}
          disabled={adviceBusy}
          className="mono shrink-0 rounded-full border border-ember/40 bg-[rgba(240,163,106,0.1)] px-3 py-1.5 text-[0.55rem] text-ember transition hover:bg-[rgba(240,163,106,0.18)] disabled:opacity-40"
        >
          {adviceBusy ? "PENSO…" : "✦ SUGGERISCIMI UNA SIMULAZIONE"}
        </button>
        {advice && <p className="flex-1 text-[0.78rem] leading-snug text-dim">{advice}</p>}
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[0.62rem] text-faint">
        <span>{label}</span>
        <span className="mono text-dim">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="accent-[#c94b25]" />
    </label>
  );
}
