import { useEffect, useRef, useState } from "react";

/**
 * BlankSheet — la modalità OnlyType (beta): un foglio bianco dove fai quello che
 * vuoi. Disegni con penna, scrivi testo, cancelli — perfetto con mouse, trackpad
 * e dito (Pointer Events + touch-action none). La barra in basso è lo strumento.
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
}

export default function BlankSheet({ session, onPersist }: Props) {
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
      schedulePersist();
      return;
    }
    drawing.current = true;
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
    schedulePersist();
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={wrapRef} className="glass relative flex-1 overflow-hidden rounded-3xl">
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

        {texts.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className="mono text-[0.6rem] text-faint">FOGLIO BIANCO · DISEGNA O SCRIVI · MOUSE E DITO</p>
          </div>
        )}
      </div>

      {/* barra strumenti — su mobile scorre invece di sovrapporsi */}
      <div className="scroll-thin mt-3 flex items-center justify-center gap-2 overflow-x-auto px-2">
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
    </div>
  );
}
