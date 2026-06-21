import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { seeDrawing } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import { parseSegments } from "../lib/artifacts";
import Artifact from "./Artifact";
import { ShiningText } from "./ShiningText";
import { WLoader } from "./WLoader";

/**
 * BlankSheet — la modalità OnlyType: il DISEGNO è il prompt. Disegni/scrivi su un
 * foglio (penna, testo, gomma; mouse e dito), poi WhyChat GUARDA il disegno, lo
 * descrive a parole e CREA ciò che rappresenta (sito/SVG/diagramma/gioco/formula).
 * Il foglio è una tendina richiudibile; il placeholder svanisce con motion-blur
 * appena disegni e riappare a foglio vuoto.
 */

type Tool = "pen" | "text" | "eraser";
const COLORS = ["#f2efe9", "#c94b25", "#f0a36a", "#8a8378"];

interface TextNode {
  id: number;
  x: number;
  y: number;
  value: string;
  color: string;
}

// Sessione serializzabile del foglio: disegno (dataURL) + testi. Vive tra le conversazioni.
export interface SheetSession {
  image: string | null;
  texts: TextNode[];
}

interface Props {
  session?: SheetSession;
  onPersist?: (s: SheetSession) => void;
  onExit?: () => void;
}

export default function BlankSheet({ session, onPersist, onExit }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(3);
  const [texts, setTexts] = useState<TextNode[]>(session?.texts ?? []);
  const nextId = useRef((session?.texts?.reduce((m, t) => Math.max(m, t.id), 0) ?? 0) + 1);

  // OnlyType: il disegno → creazione
  const [hasInk, setHasInk] = useState(!!session?.image);
  const [collapsed, setCollapsed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // mirror dei testi per leggerli aggiornati dentro il timer di salvataggio
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const persistTimer = useRef<number | undefined>(undefined);
  // salva (debounced) disegno + testi tra le conversazioni
  const schedulePersist = () => {
    if (!onPersist) return;
    clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const c = canvasRef.current;
      let image: string | null = null;
      try {
        if (c) image = c.toDataURL("image/png");
      } catch {
        image = null;
      }
      onPersist({ image, texts: textsRef.current });
    }, 700);
  };

  // diametro del pennello in px-schermo: la gomma è 6× lo spessore, come nel disegno.
  // È lo stesso valore usato in onMove → il cerchio mostra ESATTAMENTE l'area che tocchi.
  const brush = tool === "eraser" ? size * 6 : size;
  const ringSize = Math.max(brush, 8);

  // Muove il cerchio-pennello scrivendo direttamente sul DOM (transform via ref):
  // niente setState a ogni pointermove → zero lag, anche su Mac Intel.
  const moveCursor = (x: number, y: number) => {
    const el = cursorRef.current;
    if (el) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  };
  const showCursor = (v: boolean) => {
    const el = cursorRef.current;
    if (el) el.style.opacity = v ? "1" : "0";
  };

  // dimensiona il canvas al contenitore (una volta + su resize, preservando il disegno)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const fit = () => {
      const snap = canvas.width ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = wrap.clientWidth + "px";
      canvas.style.height = wrap.clientHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (snap) ctx.putImageData(snap, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // ripristina il disegno salvato (una volta, dopo che il canvas è stato dimensionato)
  useEffect(() => {
    if (!session?.image) return;
    const c = canvasRef.current;
    if (!c) return;
    const img = new Image();
    img.onload = () => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };
    img.src = session.image;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (tool === "text") {
      const { x, y } = pos(e);
      const id = nextId.current++;
      setTexts((t) => [...t, { id, x, y, value: "", color }]);
      setHasInk(true);
      schedulePersist();
      return;
    }
    drawing.current = true;
    setHasInk(true); // appena disegni, il placeholder svanisce (motion-blur)
    last.current = pos(e);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* puntatore sintetico/non valido: il disegno funziona comunque */
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const { x, y } = pos(e);
    moveCursor(x, y); // segue sempre il puntatore, anche senza disegnare
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === "eraser" ? size * 6 : size;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
  };

  const onUp = () => {
    const was = drawing.current;
    drawing.current = false;
    if (was) schedulePersist();
  };

  const clearAll = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setTexts([]);
    setHasInk(false);
    setResult("");
    setErr("");
    schedulePersist();
  };

  // compone disegno + testi su un canvas offscreen → dataURL (il "prompt" visivo)
  const snapshot = (): string | null => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return null;
    const off = document.createElement("canvas");
    off.width = c.width;
    off.height = c.height;
    const o = off.getContext("2d");
    if (!o) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // fondo chiaro: i modelli di visione leggono meglio tratto scuro su chiaro
    o.fillStyle = "#0a0908";
    o.fillRect(0, 0, off.width, off.height);
    o.drawImage(c, 0, 0);
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.textBaseline = "top";
    for (const t of textsRef.current) {
      if (!t.value.trim()) continue;
      o.fillStyle = t.color;
      o.font = "400 24px Outfit, system-ui, sans-serif";
      o.fillText(t.value, t.x, t.y - 20);
    }
    try {
      return off.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  // il cuore di OnlyType: WhyChat guarda il disegno e CREA ciò che rappresenta
  const create = async () => {
    if (busy) return;
    const img = snapshot();
    if (!img || !hasInk) {
      setErr("Disegna o scrivi qualcosa sul foglio, poi premi Crea.");
      return;
    }
    setErr("");
    setBusy(true);
    setResult("");
    setCollapsed(true); // a invio, la tendina del foglio si chiude per dare spazio al risultato
    try {
      const text = await seeDrawing(img, prompt.trim() || undefined);
      setResult(text || "Non sono riuscito a leggere il disegno. Riprova con un tratto più netto.");
    } catch (e) {
      setErr(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* header: esci + titolo + tendina del foglio */}
      <div className="flex items-center gap-2">
        {onExit && (
          <button
            onClick={onExit}
            className="mono rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:border-signal/50 hover:text-paper"
          >
            ESCI ✕
          </button>
        )}
        <span className="mono text-[0.55rem] text-faint">ONLYTYPE · IL DISEGNO È IL PROMPT</span>
        <span className="flex-1" />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mono flex items-center gap-1.5 rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:text-paper"
        >
          {collapsed ? "MOSTRA FOGLIO" : "RIDUCI FOGLIO"}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* TENDINA del foglio: collassa morbida (no unmount → il disegno resta) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
      <div ref={wrapRef} className="glass relative h-[min(54vh,520px)] overflow-hidden rounded-3xl">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerEnter={() => showCursor(tool !== "text")}
          onPointerLeave={() => {
            onUp();
            showCursor(false);
          }}
          className="absolute inset-0"
          style={{ touchAction: "none", cursor: tool === "text" ? "text" : "none" }}
        />

        {/* Puntatore-pennello stile Photoshop: cerchio che mostra l'area esatta del
            tratto e si ingrandisce/rimpicciolisce con lo spessore. Mosso via ref (no lag). */}
        {tool !== "text" && (
          <div
            ref={cursorRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-full opacity-0"
            style={{
              width: ringSize,
              height: ringSize,
              border: `1.5px solid ${tool === "eraser" ? "rgba(242,239,233,0.85)" : color}`,
              boxShadow: "0 0 0 1px rgba(10,9,8,0.55)",
              transition: "width 110ms ease-in-out, height 110ms ease-in-out, border-color 120ms",
              willChange: "transform",
            }}
          />
        )}
        {texts.map((t) => (
          <textarea
            key={t.id}
            autoFocus
            value={t.value}
            onChange={(e) => {
              setTexts((arr) => arr.map((n) => (n.id === t.id ? { ...n, value: e.target.value } : n)));
              schedulePersist();
            }}
            onBlur={() => {
              if (!t.value.trim()) setTexts((arr) => arr.filter((n) => n.id !== t.id));
              schedulePersist();
            }}
            placeholder="scrivi…"
            className="absolute resize-none overflow-hidden bg-transparent text-[1.5rem] leading-tight outline-none placeholder:text-faint/40"
            style={{
              left: t.x,
              top: t.y - 20,
              color: t.color,
              minWidth: 60,
              width: Math.max(60, t.value.length * 14),
              fontFamily: "var(--font-sans)",
            }}
          />
        ))}

        {/* placeholder: svanisce con MOTION-BLUR appena disegni, riappare a foglio vuoto */}
        <AnimatePresence>
          {!hasInk && texts.length === 0 && (
            <motion.div
              key="ph"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(14px)", scale: 1.04 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <p className="mono px-6 text-center text-[0.62rem] leading-relaxed text-faint">
                DISEGNA L'IDEA · WHYCHAT LA LEGGE E LA CREA
                <br />
                <span className="text-faint/60">un sito, un'svg, un grafico, un gioco, una formula</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
        </div>
      </div>

      {/* barra strumenti — visibile solo a foglio aperto; su mobile scorre */}
      <div className={`scroll-thin flex items-center justify-center gap-2 overflow-x-auto px-2 ${collapsed ? "hidden" : ""}`}>
        <div className="glass flex w-max shrink-0 items-center gap-1 rounded-full p-1.5">
          {([
            ["pen", "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"],
            ["text", "M4 7V5h16v2 M9 5v14 M7 19h4"],
            ["eraser", "M20 20H7L3 16a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-6 6"],
          ] as [Tool, string][]).map(([t, d]) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              title={t}
              className={`grid h-9 w-9 place-items-center rounded-full transition ${
                tool === t ? "bg-[rgba(201,75,37,0.2)] text-ember" : "text-faint hover:text-dim"
              }`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-[var(--color-line2)]" />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title="colore"
              className={`h-6 w-6 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-offset-[#100d0b] ring-paper/60" : ""}`}
              style={{ background: c }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-[var(--color-line2)]" />
          <input
            type="range"
            min={1}
            max={12}
            value={size}
            onChange={(e) => setSize(+e.target.value)}
            className="w-16 accent-[#c94b25]"
            title="spessore"
          />
          <button
            onClick={clearAll}
            title="Pulisci"
            className="ml-1 grid h-9 w-9 place-items-center rounded-full text-faint transition hover:text-signal-soft"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
          </button>
        </div>
      </div>

      {/* descrizione opzionale + CREA: il disegno (+parole) → creazione */}
      <div className="flex items-center gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
          disabled={busy}
          placeholder="Descrivi il disegno (opzionale) — es. 'fanne un sito', 'risolvi'"
          className="glass min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-[0.88rem] text-paper placeholder:text-faint focus:outline-none"
        />
        <button
          onClick={create}
          disabled={busy || !hasInk}
          className="mono flex shrink-0 items-center gap-1.5 rounded-full bg-[radial-gradient(125%_120%_at_50%_6%,#ffd2a4,#f0a36a_24%,#d4582c_56%,#8a2f17_100%)] px-4 py-2.5 text-[0.6rem] text-[#0a0908] transition disabled:opacity-35"
          title="WhyChat guarda il disegno e lo crea"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CREA
        </button>
      </div>

      {/* risultato: WhyChat descrive a parole il disegno e costruisce */}
      {(busy || result || err) && (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)] p-4">
          {busy && !result ? (
            <div className="flex items-center gap-2 text-ember">
              <WLoader size={20} />
              <ShiningText text="Guardo il disegno e creo…" className="text-[0.92rem]" />
            </div>
          ) : err ? (
            <p className="text-[0.85rem] text-signal-soft">{err}</p>
          ) : (
            parseSegments(result).map((seg, i) =>
              seg.type === "artifact" ? (
                <Artifact key={i} title={seg.title} html={seg.html} building={seg.building} />
              ) : (
                <div
                  key={i}
                  className="wc-prose text-[0.92rem] leading-[1.7] text-dim"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
                />
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
