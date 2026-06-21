import { useEffect, useRef, useState } from "react";
import { seeSheet, streamChat, deepThink, type ChatMessage as ApiMsg } from "../lib/api";
import ChatMessageView from "./ChatMessage";

/**
 * BlankSheet — la modalità OnlyType (beta): un foglio bianco dove fai quello che
 * vuoi. Disegni con penna, scrivi testo, cancelli — perfetto con mouse, trackpad
 * e dito (Pointer Events + touch-action none). La barra in basso è lo strumento.
 *
 * In più: WhyChat GUARDA il foglio e lo rappresenta in PAROLE (chat con visione,
 * Gemini multimodale via /api/see). Il foglio è richiudibile a tendina per dare
 * spazio alla conversazione. Il placeholder sparisce in motion-blur quando inizi
 * a disegnare e riappare quando il foglio torna vuoto.
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

interface ChatLine {
  id: number;
  role: "user" | "assistant";
  content: string;
  thoughts?: string; // ragionamento (quando Groq passa la palla a Gemini)
}

// Sessione serializzabile del foglio: disegno (dataURL) + testi + chat. Vive tra le conversazioni.
export interface SheetSession {
  image: string | null;
  texts: TextNode[];
  chat?: ChatLine[];
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

  // foglio richiudibile (tendina) + traccia se c'è inchiostro (per il placeholder)
  const [collapsed, setCollapsed] = useState(false);
  const [inkEmpty, setInkEmpty] = useState(!session?.image);

  // chat con visione: WhyChat guarda il foglio e risponde in parole
  const [chat, setChat] = useState<ChatLine[]>(session?.chat ?? []);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatNextId = useRef((session?.chat?.reduce((m, c) => Math.max(m, c.id), 0) ?? 0) + 1);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef(chat);
  chatRef.current = chat;

  // mirror dei testi per leggerli aggiornati dentro il timer di salvataggio
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const persistTimer = useRef<number | undefined>(undefined);
  // salva (debounced) disegno + testi + chat tra le conversazioni
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
      onPersist({ image, texts: textsRef.current, chat: chatRef.current });
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
      // guardia: se il foglio è nascosto (tendina) non ridimensionare → niente
      // perdita del disegno quando clientWidth/Height vanno a 0.
      if (!wrap.clientWidth || !wrap.clientHeight) return;
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

  // tieni la chat scrollata in fondo quando arrivano messaggi
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

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
    setInkEmpty(false); // hai iniziato a disegnare → il placeholder sparisce (motion blur)
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
    setInkEmpty(true); // foglio vuoto → il placeholder riappare
    schedulePersist();
  };

  // snapshot del foglio per la visione: ridotto e su fondo scuro così i tratti
  // (colorati su trasparente) sono ben visibili al modello. JPEG leggero.
  const snapshot = (): string => {
    const c = canvasRef.current;
    if (!c) return "";
    const maxW = 1024;
    const scale = Math.min(1, maxW / c.width);
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(c.width * scale));
    off.height = Math.max(1, Math.round(c.height * scale));
    const octx = off.getContext("2d");
    if (!octx) return "";
    octx.fillStyle = "#100d0b";
    octx.fillRect(0, 0, off.width, off.height);
    octx.drawImage(c, 0, 0, off.width, off.height);
    try {
      return off.toDataURL("image/jpeg", 0.85);
    } catch {
      return "";
    }
  };

  const askSheet = async (text: string) => {
    if (busy) return;
    // ROUTER: c'è un disegno? → serve la VISTA (Gemini, più lento ma necessario).
    // Niente disegno (solo testo) → cosa semplice → Groq DIRETTO e velocissimo.
    const hasDrawing = !inkEmpty || textsRef.current.length > 0;
    const written = textsRef.current
      .map((t) => t.value.trim())
      .filter(Boolean)
      .join(" · ");
    const typed = text.trim();
    if (!hasDrawing && !typed) return; // niente da fare
    const prompt =
      (typed || "Guarda il mio foglio: cosa vedi? Rappresenta in parole il disegno e l'idea dietro.") +
      (written ? `\n\n[Testi scritti sul foglio: ${written}]` : "");

    const userLine: ChatLine = { id: chatNextId.current++, role: "user", content: typed || "👁 descrivi il mio foglio" };
    const aiLine: ChatLine = { id: chatNextId.current++, role: "assistant", content: "" };
    const history: ApiMsg[] = chatRef.current.slice(-8).map((m) => ({ role: m.role, content: m.content }));

    setChat((c) => [...c, userLine, aiLine]);
    setChatInput("");
    setBusy(true);
    setCollapsed(true); // all'invio il foglio si richiude (animato) → spazio alla risposta
    let acc = "";
    const onTok = (d: string) => {
      acc += d;
      setChat((c) => c.map((m) => (m.id === aiLine.id ? { ...m, content: acc } : m)));
    };
    try {
      if (hasDrawing) {
        const img = snapshot();
        if (img) await seeSheet(img, prompt, history, onTok);
      } else {
        // Groq diretto (veloce). Ma è GROQ a decidere: se è semplice crea/risponde
        // subito; se è davvero complesso scrive [[RAGIONA]] e passiamo a Gemini.
        const groqPrompt =
          prompt +
          "\n\n(Sistema: se questa richiesta è semplice, creala/rispondi subito. Se invece è DAVVERO complessa e richiede ragionamento profondo, rispondi SOLO ed esattamente con [[RAGIONA]] e nient'altro.)";
        await streamChat([...history, { role: "user", content: groqPrompt }], onTok, undefined, "canvas", "whychat-5.5", false);
        if (acc.trim().toUpperCase().includes("[[RAGIONA")) {
          // escalation decisa dal modello → ragionamento Google (Gemini)
          acc = "";
          setChat((c) => c.map((m) => (m.id === aiLine.id ? { ...m, content: "", thoughts: "" } : m)));
          let thoughts = "";
          await deepThink(
            [...history, { role: "user", content: prompt }],
            (d) => {
              thoughts += d;
              setChat((c) => c.map((m) => (m.id === aiLine.id ? { ...m, thoughts } : m)));
            },
            onTok,
          );
        }
      }
    } catch (e) {
      const msg = `⚠ ${(e as Error).message}`;
      setChat((c) => c.map((m) => (m.id === aiLine.id ? { ...m, content: m.content || msg } : m)));
    } finally {
      setBusy(false);
      schedulePersist();
    }
  };

  const onChatKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.trim() && !busy) askSheet(chatInput);
    }
  };

  const showPlaceholder = inkEmpty && texts.length === 0;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* testata: tendina (sx) + ESCI FUORI dal foglio (dx) → non copre il disegno */}
      <div className="flex shrink-0 items-center justify-between gap-2">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="glass mono flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.55rem] text-faint transition hover:text-paper"
        title={collapsed ? "Riapri il foglio" : "Richiudi il foglio"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-300 ${collapsed ? "-rotate-90" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        FOGLIO {collapsed ? "· riapri" : ""}
      </button>
        {onExit && (
          <button
            onClick={onExit}
            className="mono rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1 text-[0.5rem] text-faint backdrop-blur transition hover:border-signal/50 hover:text-paper"
          >
            ESCI ✕
          </button>
        )}
      </div>

      {/* il foglio (canvas + strumenti) — display:none quando a tendina, così il
          disegno resta in memoria e non si perde */}
      <div
        className={`flex min-h-0 flex-[3] flex-col gap-2 overflow-hidden transition-[max-height,opacity,transform] duration-[450ms] ease-out ${
          collapsed ? "pointer-events-none max-h-0 -translate-y-1 opacity-0" : "max-h-[1200px] translate-y-0 opacity-100"
        }`}
      >
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

          {/* placeholder: sparisce in motion-blur quando inizi a disegnare, riappare a foglio vuoto */}
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center"
            style={{
              opacity: showPlaceholder ? 1 : 0,
              filter: showPlaceholder ? "blur(0px)" : "blur(16px)",
              transform: showPlaceholder ? "scale(1)" : "scale(1.06)",
              transition: "opacity 480ms ease, filter 480ms ease, transform 480ms ease",
            }}
          >
            <p className="mono text-[0.6rem] text-faint">FOGLIO BIANCO · DISEGNA O SCRIVI · MOUSE E DITO</p>
          </div>
        </div>

        {/* barra strumenti — su mobile scorre invece di sovrapporsi */}
        <div className="scroll-thin flex items-center justify-center gap-2 overflow-x-auto px-2">
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

      {/* chat con visione: WhyChat guarda il foglio e lo rappresenta in parole */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div ref={chatScrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {chat.length === 0 ? (
            <div className="grid h-full place-items-center px-4 text-center">
              <p className="mono text-[0.55rem] leading-relaxed text-faint">
                DISEGNA QUELLO CHE VUOI, POI CHIEDI A WHYCHAT
                <br />
                LUI CAPISCE LO SKETCH E LO CREA DAVVERO (SITO · SVG · GIOCO · CALCOLO)
              </p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-4 px-1 py-1">
              {chat.map((m, i) => (
                <ChatMessageView
                  key={m.id}
                  msg={{
                    id: String(m.id),
                    role: m.role,
                    content: m.content,
                    thoughts: m.thoughts,
                    streaming: busy && i === chat.length - 1 && m.role === "assistant",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
          <button
            onClick={() => askSheet("")}
            disabled={busy}
            title="WhyChat guarda il foglio"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--color-line2)] text-dim transition hover:text-paper disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onChatKey}
            rows={1}
            placeholder="chiedi a WhyChat del tuo foglio…"
            className="glass max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-2xl bg-transparent px-4 py-2.5 text-sm text-paper outline-none placeholder:text-faint"
          />
          <button
            onClick={() => chatInput.trim() && askSheet(chatInput)}
            disabled={busy || !chatInput.trim()}
            title="Invia"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#c94b25] text-[#100d0b] transition hover:brightness-110 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
