import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import OriginButton from "./OriginButton";
import { Typewriter } from "./Typewriter";
import { voice } from "../lib/tts";
import { AnimatedIcon } from "./effects/AnimatedIcon";
import { LiquidGlassFilter, svgBackdropSupported } from "./effects/LiquidGlass";
import LiquidGlassGL, { liquidGLSupported } from "./effects/LiquidGlassGL";
import FileChip from "./FileChip";
import {
  MessageSquare,
  PenTool,
  BrainCircuit,
  GraduationCap,
  SquarePen,
  Users,
  Globe,
  Hexagon,
  Music,
  Sprout,
  Paperclip,
  ListTodo,
  ChevronDown,
} from "lucide-react";
import { docxToText, xlsxToText, isDocx, isXlsx } from "../lib/office";

// X di rimozione DENTRO l'angolo (mai tagliata dallo scroll) per immagini/video
function RemoveX({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Rimuovi"
      className="absolute right-0.5 top-0.5 z-10 grid h-5 w-5 place-items-center rounded-full border border-[var(--color-line2)] bg-[#141009]/90 text-faint shadow-sm backdrop-blur-sm transition hover:text-paper"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// Suggerimenti che si auto-digitano nella barra vuota (solo modalità chat).
const PLACEHOLDERS = ["Parlami di un'idea…", "Chi sei davvero?", "Come pensi quando crei?", "Aiutami a partire…"];

export type Mode = "chat" | "canvas" | "deep" | "learn" | "sheet" | "group" | "earth" | "entropy" | "music" | "ecosystem";

interface ModeDef {
  id: Mode;
  label: string;
  desc: string;
  tag?: string;
  icon: React.ReactNode;
}

// icone modalità: lucide, nitide e centrate (qualità Claude). Strokewidth coerente.
const ic = (Comp: typeof MessageSquare) => <Comp size={16} strokeWidth={1.7} />;

export const MODES: ModeDef[] = [
  { id: "chat", label: "Chat", desc: "Conversazione, come sempre", icon: ic(MessageSquare) },
  { id: "canvas", label: "Canvas", desc: "Disegna l'idea, fa cose", icon: ic(PenTool) },
  { id: "deep", label: "Deep thinking", desc: "Ragiona a fondo (Gemini)", tag: "∞", icon: ic(BrainCircuit) },
  { id: "learn", label: "Apprendimento", desc: "Impara un passo alla volta", icon: ic(GraduationCap) },
  { id: "sheet", label: "OnlyType", desc: "Foglio bianco: fai quello che vuoi", tag: "beta", icon: ic(SquarePen) },
  { id: "group", label: "Group Prediction", desc: "Più agenti predicono insieme", tag: "beta", icon: ic(Users) },
  { id: "earth", label: "WhyEarth", desc: "Il mondo al centro, interattivo", tag: "beta", icon: ic(Globe) },
  { id: "entropy", label: "WhyEntropy", desc: "Ordine geometrico che si dissolve in caos", tag: "beta", icon: ic(Hexagon) },
  { id: "music", label: "WhyMusic", desc: "Analizza una traccia nel dettaglio", tag: "beta", icon: ic(Music) },
  { id: "ecosystem", label: "WhyEcosystem", desc: "Simulazioni di natura, dal vivo", tag: "beta", icon: ic(Sprout) },
];

// Easing morbido: entra in ease-out (decelera arrivando), esce in ease-in
// (accelera andandosene). Insieme = "ease in e ease out".
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.55, 0, 1, 0.45] as const;

const container = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: "auto", transition: { height: { duration: 0.32, ease: EASE_OUT }, staggerChildren: 0.05 } },
  exit: { opacity: 0, height: 0, transition: { height: { duration: 0.24, ease: EASE_IN }, opacity: { duration: 0.16 } } },
};
const itemV = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE_IN } },
};

// Un allegato generico: ogni tipo di file. Per immagini e video portiamo un
// fotogramma (image dataURL) al vision; per file di testo/codice il contenuto.
export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "video" | "text" | "file";
  image?: string; // dataURL per la VISTA (thumbnail immagine o frame del video)
  data?: string; // dataURL da far LEGGERE a Gemini (immagine / frame / PDF / …)
  text?: string; // contenuto testuale (txt/md/csv/json/codice)
  url?: string; // objectURL per l'anteprima del video
}

interface Props {
  onSend: (text: string, attachments?: Attachment[]) => void;
  disabled: boolean;
  mode: Mode;
  onMode: (m: Mode) => void;
  onStop?: () => void;
  streaming: boolean;
  search?: boolean;
  onToggleSearch?: () => void;
  plan?: boolean;
  onTogglePlan?: () => void;
  name?: string; // se noto, WhyChat personalizza i suggerimenti (dopo il primo, generale)
}

// plan mode disponibile in TUTTE le modalità non-beta (utile ovunque)
const PLANNABLE: Mode[] = ["chat", "canvas", "deep", "learn"];
// euristica "domanda complessa/lunga" → suggerisci di pianificare
function looksComplex(t: string): boolean {
  const s = t.trim();
  if (s.length > 180) return true;
  if ((s.match(/\?/g)?.length ?? 0) >= 2) return true;
  return /\b(progett\w+|costruisc\w+|costruire|pianific\w+|analizz\w+|confront\w+|organizz\w+|strategi\w+|piano|passo\s*passo|step by step|in dettaglio|tutti i passaggi)\b/i.test(
    s,
  );
}

export default function CommandComposer({ onSend, disabled, mode, onMode, onStop, streaming, search, onToggleSearch, plan, onTogglePlan, name }: Props) {
  // Suggerimenti: il PRIMO è sempre generale; se WhyChat conosce la persona, dal
  // secondo in poi (quindi "dopo un tot") entrano frasi personalizzate col nome.
  const placeholders = name
    ? [PLACEHOLDERS[0], `${name}, da dove partiamo?`, `Cosa hai in mente, ${name}?`, "Chi sono io per te?"]
    : PLACEHOLDERS;
  const [value, setValue] = useState("");
  const [menu, setMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]); // più file insieme
  const ref = useRef<HTMLTextAreaElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  const reduce = useReducedMotion();
  // liquid glass: misura la barra per dimensionare la mappa-lente di rifrazione
  const [glassSize, setGlassSize] = useState({ w: 0, h: 0 });
  const lgOn = useRef(svgBackdropSupported()).current;
  // vetro WebGL VERO (campiona+rifrange lo sfondo, funziona anche su iPhone)
  const glOn = useRef(liquidGLSupported()).current;
  // "Armato": c'è testo o almeno un allegato. Il primario si accende.
  const armed = (value.trim().length > 0 || attachments.length > 0) && !disabled;

  const aid = () => `at_${Math.random().toString(36).slice(2, 9)}`;
  const addAttach = (a: Attachment) => setAttachments((prev) => [...prev, a]);
  const removeAttach = (id: string) =>
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone?.url) URL.revokeObjectURL(gone.url);
      return prev.filter((a) => a.id !== id);
    });

  // ridimensiona un'immagine (Image/canvas) a max 1280px → dataURL jpeg compatto
  const downscale = (img: HTMLImageElement | HTMLVideoElement, w: number, h: number): string => {
    const max = 1280;
    const scale = Math.min(1, max / Math.max(w || 1, h || 1));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((w || 1) * scale));
    c.height = Math.max(1, Math.round((h || 1) * scale));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  };

  const isTextLike = (mime: string, name: string) =>
    mime.startsWith("text/") ||
    /(json|javascript|typescript|xml|csv|html|css|markdown|x-sh|x-python)/.test(mime) ||
    /\.(txt|md|markdown|csv|json|js|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|h|css|scss|html|xml|yml|yaml|toml|ini|sh|sql|log)$/i.test(name);

  const isImageExt = (ext: string) => /^(png|jpg|jpeg|gif|webp|bmp)$/i.test(ext);
  const imgDataURL = (img: HTMLImageElement, fallback: string) =>
    img.width ? downscale(img, img.width, img.height) : fallback;

  // ZIP: lo SPACCHETTA (JSZip, lazy) e aggiunge i file leggibili dentro come
  // allegati singoli, così WhyChat ne legge il contenuto e ne capisce il contesto.
  const onZip = async (file: File) => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((e) => !e.dir);
      let count = 0;
      for (const e of entries) {
        if (count >= 18) break;
        const ename = e.name;
        if (/__MACOSX|\.DS_Store|\/$/.test(ename)) continue;
        const ext = (ename.split(".").pop() || "").toLowerCase();
        if (isImageExt(ext)) {
          const b64 = await e.async("base64");
          const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
          const dataUrl = `data:${mime};base64,${b64}`;
          const img = new Image();
          await new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
            img.src = dataUrl;
          });
          const d = imgDataURL(img, dataUrl);
          addAttach({ id: aid(), name: ename, kind: "image", image: d, data: d });
          count++;
        } else if (ext === "pdf") {
          const b64 = await e.async("base64");
          addAttach({ id: aid(), name: ename, kind: "file", data: `data:application/pdf;base64,${b64}` });
          count++;
        } else if (isTextLike("", ename)) {
          const txt = await e.async("string");
          addAttach({ id: aid(), name: ename, kind: "text", text: txt.slice(0, 12000) });
          count++;
        }
      }
      if (count === 0) addAttach({ id: aid(), name: file.name, kind: "file" }); // zip senza file leggibili
    } catch {
      addAttach({ id: aid(), name: file.name || "archivio.zip", kind: "file" });
    }
  };

  // Importa QUALSIASI file (anche più insieme). Immagini→frame; video→anteprima
  // playabile + un fotogramma per il vision; testo/codice→contenuto; ZIP→spacchettato; altri→chip.
  const onFiles = (files: FileList | null | undefined) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = aid();
      const mime = file.type || "";
      const name = file.name || "file";
      if (mime.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const d = downscale(img, img.width, img.height);
            addAttach({ id, name, kind: "image", image: d, data: d }); // data → Gemini lo legge
          };
          img.onerror = () => addAttach({ id, name, kind: "image", image: String(reader.result), data: String(reader.result) });
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      } else if (mime.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        // anteprima subito (playabile); il frame per il vision arriva quando il video è pronto
        addAttach({ id, name, kind: "video", url });
        const v = document.createElement("video");
        v.muted = true;
        v.preload = "auto";
        (v as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
        v.crossOrigin = "anonymous";
        v.src = url;
        const grab = () => {
          try {
            const frame = downscale(v, v.videoWidth, v.videoHeight);
            // image = anteprima, data = ciò che Gemini legge (il fotogramma)
            setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, image: frame, data: frame } : a)));
          } catch {
            /* niente frame: resta l'anteprima video */
          }
        };
        v.onloadeddata = () => {
          const t = Math.min(1, (v.duration || 2) / 2);
          if (Number.isFinite(t) && t > 0) v.currentTime = t;
          else grab();
        };
        v.onseeked = grab;
        // fallback: se 'seeked' non scatta, prova lo stesso dopo 1.5s
        setTimeout(grab, 1500);
      } else if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
        // PDF: lo legge Gemini direttamente (inlineData application/pdf)
        const reader = new FileReader();
        reader.onload = () => addAttach({ id, name, kind: "file", data: String(reader.result) });
        reader.readAsDataURL(file);
      } else if (isDocx(name, mime)) {
        // .docx: estraiamo il testo dei paragrafi (OOXML via jszip)
        addAttach({ id, name, kind: "text", text: "" });
        void docxToText(file)
          .then((txt) => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, text: txt || "(documento vuoto)" } : a))))
          .catch(() => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, kind: "file", text: undefined } : a))));
      } else if (isXlsx(name, mime)) {
        // .xlsx: estraiamo le celle in formato tabellare
        addAttach({ id, name, kind: "text", text: "" });
        void xlsxToText(file)
          .then((txt) => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, text: txt || "(foglio vuoto)" } : a))))
          .catch(() => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, kind: "file", text: undefined } : a))));
      } else if (mime.includes("zip") || /\.zip$/i.test(name)) {
        // ZIP: spacchetta e aggiunge i file dentro (async)
        void onZip(file);
      } else if (isTextLike(mime, name)) {
        const reader = new FileReader();
        reader.onload = () => addAttach({ id, name, kind: "text", text: String(reader.result).slice(0, 12000) });
        reader.readAsText(file);
      } else {
        addAttach({ id, name, kind: "file" });
      }
    }
  };
  // suggerimento plan mode per domande complesse/lunghe (consigliata, non forzata)
  const suggestPlan = !plan && !!onTogglePlan && PLANNABLE.includes(mode) && looksComplex(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  // misura la barra (per la mappa-lente del liquid glass) e si aggiorna al resize
  useEffect(() => {
    if (!lgOn) return;
    const el = glassRef.current;
    if (!el) return;
    const update = () => setGlassSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lgOn]);

  // Il contorno della barra reagisce al TTS: una variabile CSS --tts (0..1) segue
  // l'ampiezza reale della voce e accende bordo + alone, sincronizzati col parlato.
  useEffect(() => {
    let raf = 0;
    const run = () => {
      const el = barRef.current;
      if (el) el.style.setProperty("--tts", voice.level.toFixed(3));
      if (voice.speaking || voice.level > 0.01) raf = requestAnimationFrame(run);
      else if (el) el.style.setProperty("--tts", "0");
    };
    const unsub = voice.subscribe(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(run);
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);

  const submit = () => {
    const t = value.trim();
    if ((!t && attachments.length === 0) || disabled) return;
    onSend(t, attachments);
    setValue("");
    setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pick = (m: Mode) => {
    onMode(m);
    setMenu(false);
    ref.current?.focus();
  };

  return (
    <div className="relative">
      {/* Palette modalità */}
      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              exit="exit"
              className="glass absolute bottom-[calc(100%+8px)] left-0 z-20 w-full overflow-hidden rounded-2xl"
            >
              {/* fondo solido: il menu non lascia trasparire la chat dietro */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[#141009]/92" />
              <div className="relative mono px-4 pb-1 pt-3 text-[0.5rem] text-faint">MODALITÀ</div>
              <ul className="scroll-thin relative max-h-[min(58vh,420px)] overflow-y-auto px-1.5 pb-2">
                {MODES.map((m) => {
                  const active = m.id === mode;
                  return (
                    <motion.li key={m.id} variants={itemV} layout>
                      <button
                        onClick={() => pick(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          active ? "bg-[rgba(201,75,37,0.16)]" : "hover:bg-[rgba(242,239,233,0.05)]"
                        }`}
                      >
                        <AnimatedIcon active={active} className={active ? "text-signal" : "text-dim"}>
                          {m.icon}
                        </AnimatedIcon>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`text-[0.86rem] ${active ? "text-paper" : "text-dim"}`}>{m.label}</span>
                            {m.tag && (
                              <span className="mono rounded-full bg-[rgba(240,163,106,0.16)] px-1.5 py-0.5 text-[0.46rem] text-ember">
                                {m.tag}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[0.66rem] text-faint">{m.desc}</span>
                        </span>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Suggerimento plan mode: appare per domande complesse, si accetta con un tap */}
      <AnimatePresence>
        {suggestPlan && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="mb-2 flex items-center gap-2 rounded-xl border border-ember/30 bg-[rgba(240,163,106,0.08)] px-3 py-2"
          >
            <span className="text-ember">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex-1 text-[0.74rem] leading-snug text-dim">
              Domanda impegnativa — vuoi che <span className="text-paper">pianifichi</span> prima?
            </span>
            <button
              onClick={onTogglePlan}
              className="mono shrink-0 rounded-full border border-ember/50 bg-[rgba(240,163,106,0.14)] px-2.5 py-1 text-[0.55rem] text-ember transition hover:bg-[rgba(240,163,106,0.22)]"
            >
              PIANIFICA
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra — due righe: testo sopra, controlli sotto. Mai sovrapposizioni. */}
      <div ref={barRef} className="relative isolate" style={{ "--tts": "0" } as React.CSSProperties}>
        {/* VETRO WEBGL: campiona le particelle dietro e le rifrange (rifrazione vera, niente riflessi) */}
        {glOn && <LiquidGlassGL className="z-0" radius={26} displace={64} aberration={0.06} blur={2.0} />}
        {/* solo un contorno sottile per definire il bordo + leggera ombra sotto per
            profondità. NESSUN riflesso bianco (la rifrazione la fa il WebGL). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[26px]"
          style={{
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 -10px 22px -16px rgba(0,0,0,0.5)",
          }}
        />
        {/* contorno reattivo al TTS: bordo + alone che pulsano con la voce reale */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[26px] border"
          style={{
            borderColor: "rgba(240,163,106,calc(var(--tts,0) * 0.85))",
            boxShadow:
              "0 0 calc(var(--tts,0) * 46px) calc(var(--tts,0) * 8px) rgba(240,163,106,calc(var(--tts,0) * 0.5)), inset 0 0 calc(var(--tts,0) * 22px) rgba(201,75,37,calc(var(--tts,0) * 0.35))",
          }}
        />
      {lgOn && !glOn && <LiquidGlassFilter id="composer-liquid-glass" width={glassSize.w} height={glassSize.h} scale={26} aberration={5} />}
      <div
        ref={glassRef}
        style={{
          // Se il vetro WebGL è attivo, il fondo è TRASPARENTE: la rifrazione vera
          // arriva dal canvas dietro. Altrimenti fallback frosted (SVG su Chromium).
          background: glOn
            ? "transparent"
            : "linear-gradient(180deg, rgba(242,239,233,0.06), rgba(242,239,233,0.015)), rgba(16,11,8,0.5)",
          backdropFilter: glOn
            ? "none"
            : lgOn
              ? "blur(8px) saturate(160%) url(#composer-liquid-glass)"
              : "blur(18px) saturate(150%)",
          WebkitBackdropFilter: glOn ? "none" : "blur(18px) saturate(150%)",
        }}
        className={`glass glass-sheen relative z-10 rounded-[26px] px-3 pb-2.5 pt-2.5 ring-1 ring-inset transition-shadow duration-300 ${
          armed
            ? "ring-signal/30 shadow-[inset_0_1px_0.5px_rgba(255,252,247,0.22),0_0_32px_-9px_rgba(201,75,37,0.5)]"
            : "ring-transparent focus-within:ring-signal/25 focus-within:shadow-[inset_0_1px_0.5px_rgba(255,252,247,0.22),0_0_26px_-10px_rgba(201,75,37,0.42)]"
        }`}
      >
        {/* preview degli allegati (più file insieme): anteprime affiancate, niente scritta */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="scroll-none mb-1.5 flex items-center gap-2 overflow-x-auto px-0.5 pb-0.5 pt-1"
            >
              {attachments.map((a) =>
                a.kind === "video" && a.url ? (
                  <div key={a.id} className="relative shrink-0">
                    <video
                      src={a.url}
                      muted
                      playsInline
                      controls
                      className="h-16 w-24 rounded-xl border border-[var(--color-line2)] bg-black object-cover"
                    />
                    <RemoveX onClick={() => removeAttach(a.id)} />
                  </div>
                ) : a.image ? (
                  <div key={a.id} className="relative shrink-0">
                    <img src={a.image} alt={a.name} className="h-16 w-16 rounded-xl border border-[var(--color-line2)] object-cover" />
                    <RemoveX onClick={() => removeAttach(a.id)} />
                  </div>
                ) : (
                  // ogni altro file → chip stile Claude (icona + nome + tipo)
                  <div key={a.id} className="shrink-0">
                    <FileChip name={a.name} onRemove={() => removeAttach(a.id)} />
                  </div>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* riga 1 — il testo. pl-[11px] = stesso inset del contenuto del bottone
            MODALITÀ (px-2.5 + bordo), così il testo parte ALLINEATO con l'icona sotto. */}
        <div className="relative pl-[11px] pr-1">
          {/* placeholder che si auto-digita quando la barra è vuota (chat) */}
          {!value && mode !== "sheet" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start overflow-hidden whitespace-nowrap py-1 pl-[11px] text-[1rem] leading-7 text-faint">
              <Typewriter text={placeholders} speed={55} deleteSpeed={28} waitTime={2200} showCursor={false} />
            </div>
          )}
          <textarea
            ref={ref}
            value={value}
            rows={1}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") setMenu(false);
            }}
            placeholder={mode === "sheet" ? "Scrivi un pensiero sul foglio…" : ""}
            className="scroll-thin block max-h-[200px] w-full resize-none bg-transparent py-1 text-[1rem] leading-7 text-paper placeholder:text-faint focus:outline-none"
          />
        </div>

        {/* riga 2 — i controlli. Tutto SOLIDO: niente va a capo, niente si nasconde.
            Su mobile i toggle sono solo-icona (le scritte appaiono da sm in su) così
            modalità + allega + cerca + piano + invio stanno tutti in riga. */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* modalità → apre la palette */}
          <motion.button
            onClick={() => setMenu((s) => !s)}
            title="Scegli modalità"
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 480, damping: 18 }}
            className={`flex h-9 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.66rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal/45 ${
              mode === "chat"
                ? "border-[var(--color-line2)] text-dim hover:border-[rgba(242,239,233,0.22)] hover:text-paper"
                : "border-signal/45 bg-[rgba(201,75,37,0.14)] text-ember hover:bg-[rgba(201,75,37,0.2)]"
            }`}
          >
            <span
              className={`grid h-4 w-4 shrink-0 place-items-center [&_svg]:h-[15px] [&_svg]:w-[15px] ${
                mode === "chat" ? "text-faint" : "text-ember"
              }`}
            >
              {/* il simbolo "molleggia" dentro ad ogni cambio modalità (stile Apple
                  hello): entra con spring scala+rotazione, si posa SEMPRE dritto. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mode}
                  className="grid place-items-center"
                  style={{ transformOrigin: "center" }}
                  initial={reduce ? { opacity: 0 } : { scale: 0.3, rotate: -35, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { scale: 0.3, rotate: 30, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 24 }}
                >
                  {current.icon}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="mono truncate leading-none">{mode === "chat" ? "MODALITÀ" : current.label}</span>
            <motion.span
              className="grid h-3 w-3 shrink-0 place-items-center opacity-60 [&_svg]:h-3 [&_svg]:w-3"
              style={{ transformOrigin: "center" }}
              animate={{ rotate: menu ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              <ChevronDown size={12} strokeWidth={2.4} />
            </motion.span>
          </motion.button>

          {/* tasto: allega QUALSIASI file (graffetta). Immagini/video → vision, testo → contenuto */}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <motion.button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Allega file (immagini, video, testo, qualsiasi — anche più insieme)"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 480, damping: 18 }}
            className={`relative flex h-9 shrink-0 items-center justify-center rounded-full border px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal/45 ${
              attachments.length ? "border-signal/50 bg-[rgba(201,75,37,0.14)] text-ember" : "border-[var(--color-line2)] text-dim hover:border-[rgba(242,239,233,0.22)] hover:text-paper"
            }`}
          >
            <span className="grid h-[15px] w-[15px] place-items-center">
              <Paperclip size={15} strokeWidth={1.7} />
            </span>
            {attachments.length > 1 && (
              <span className="mono absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[0.5rem] text-void">
                {attachments.length}
              </span>
            )}
          </motion.button>

          {/* tasto: cerca sul web (Wikipedia) — inietta risultati reali nel contesto */}
          {onToggleSearch && (
            <motion.button
              type="button"
              onClick={onToggleSearch}
              title="Cerca sul web"
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal/45 ${
                search ? "border-signal/50 bg-[rgba(201,75,37,0.14)] text-ember hover:bg-[rgba(201,75,37,0.2)]" : "border-[var(--color-line2)] text-dim hover:border-[rgba(242,239,233,0.22)] hover:text-paper"
              }`}
            >
              <motion.span
                className="grid h-[15px] w-[15px] shrink-0 place-items-center"
                style={{ transformOrigin: "center" }}
                animate={{ rotate: search ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
              >
                <Globe size={15} strokeWidth={1.7} />
              </motion.span>
              <AnimatePresence>
                {search && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mono hidden overflow-hidden whitespace-nowrap text-[0.62rem] sm:inline-block"
                  >
                    CERCA
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {/* tasto: plan mode — pianifica prima di rispondere (timeline agente) */}
          {onTogglePlan && PLANNABLE.includes(mode) && (
            <motion.button
              type="button"
              onClick={onTogglePlan}
              title="Plan mode: pianifica prima di rispondere"
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal/45 ${
                plan
                  ? "border-ember/50 bg-[rgba(240,163,106,0.14)] text-ember hover:bg-[rgba(240,163,106,0.22)]"
                  : "border-[var(--color-line2)] text-dim hover:border-[rgba(242,239,233,0.22)] hover:text-paper"
              }`}
            >
              <span className="grid h-[15px] w-[15px] place-items-center">
                <ListTodo size={15} strokeWidth={1.7} />
              </span>
              <AnimatePresence>
                {plan && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mono hidden overflow-hidden whitespace-nowrap text-[0.62rem] sm:inline-block"
                  >
                    PIANO
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          </div>

          {streaming ? (
            <button
              onClick={onStop}
              title="Ferma"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(242,239,233,0.1)] text-paper transition hover:bg-[rgba(242,239,233,0.18)]"
            >
              <span className="block h-3 w-3 rounded-[3px] bg-paper" />
            </button>
          ) : (
            <OriginButton
              onClick={submit}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              title="Invia"
              fill="rgba(255,228,198,0.42)"
              fillText="#0a0908"
              style={{
                background:
                  "radial-gradient(125% 120% at 50% 6%, #ffd2a4 0%, #f0a36a 24%, #d4582c 56%, #b23d1d 80%, #8a2f17 100%)",
              }}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#0a0908] outline-none transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-ember/60 disabled:opacity-35 ${
                armed ? "shadow-[0_0_22px_-4px_rgba(224,103,63,0.55)]" : ""
              }`}
              overlay={
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full mix-blend-soft-light"
                    style={{
                      background:
                        "repeating-linear-gradient(118deg, rgba(255,238,214,0.12) 0px, rgba(120,42,22,0.12) 1.6px, rgba(255,238,214,0.12) 3.2px)",
                      opacity: 0.55,
                    }}
                  />
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen"
                    style={{
                      background:
                        "radial-gradient(36% 28% at 50% 40%, rgba(255,248,236,0.85), rgba(255,210,170,0.18) 55%, transparent 72%)",
                    }}
                    animate={reduce ? undefined : { x: [-5, 6, -5], y: [-4, 4, -4] }}
                    transition={{
                      x: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
                      y: { duration: 7.5, repeat: Infinity, ease: "easeInOut" },
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ zIndex: 1, background: "radial-gradient(38% 30% at 35% 18%, rgba(255,250,242,0.72), transparent 60%)" }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      zIndex: 1,
                      boxShadow:
                        "inset 0 1.5px 1px rgba(255,236,214,0.55), inset 0 0 0 1px rgba(255,230,205,0.14), inset 0 -3px 7px -2px rgba(74,22,10,0.55)",
                    }}
                  />
                </>
              }
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="relative">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </OriginButton>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
