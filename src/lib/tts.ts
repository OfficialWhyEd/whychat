/**
 * TTS leggero per WhyChat — voce italiana via Web Speech API (la più veloce e
 * leggera possibile: zero rete, istantanea, offline). Preferisce le voci neural
 * "Edge"/"Natural" quando il browser le espone (Chromium/Edge), così la qualità
 * è quella Edge richiesta da Edoardo, mantenendo leggerezza ovunque.
 *
 * Espone anche `voice`: uno store dell'attività vocale (livello 0..1 + speaking)
 * che SoulParticles legge per far reagire le particelle e lo sfondo all'audio —
 * scorrimento più veloce + effetto metallico — in modo vivo ma non disturbante.
 */

// ── Store attività vocale (condiviso, fuori da React per il loop canvas) ──────
let _level = 0; // ampiezza smussata 0..1
let _speaking = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const voice = {
  get level() {
    return _level;
  },
  get speaking() {
    return _speaking;
  },
  /** sottoscrizione a cambi di `speaking` (non per il livello: quello si legge nel raf) */
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

// ── Selezione voce italiana (preferendo neural Edge/Online) ───────────────────
let cached: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const it = vs.filter((v) => /^it(\b|-|_)/i.test(v.lang));
  const pool = it.length ? it : vs;
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|online|neural/.test(n)) s += 6; // voci neural Edge esposte al Web Speech API
    if (/elsa|isabella|diego|giuseppe|fabiola|imelda|calimero/.test(n)) s += 3;
    if (/^it/i.test(v.lang)) s += 2;
    if (v.localService) s += 1;
    return s;
  };
  cached = [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
  return cached;
}

if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", () => {
    cached = null;
    pickVoice();
  });
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ── Pulizia testo: via markdown, code-fence, artifact, link grezzi ────────────
function clean(text: string): string {
  return text
    .replace(/```whyart[\s\S]*?```/gi, " (anteprima visiva) ")
    .replace(/```[\s\S]*?```/g, " blocco di codice ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>~]/g, "")
    .replace(/\[\[LUOGO:[^\]]*\]\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4096); // come maxLength della config openclaw
}

// ── Envelope sintetico dell'ampiezza mentre parla ────────────────────────────
let raf = 0;
let target = 0.2;
function loop() {
  // decadimento verso un baseline basso; i `boundary` (parole) danno gli impulsi
  target = Math.max(0.12, target - 0.05);
  _level += (target - _level) * 0.25;
  if (_speaking) raf = requestAnimationFrame(loop);
  else {
    _level += (0 - _level) * 0.2;
    if (_level > 0.01) raf = requestAnimationFrame(loop);
    else _level = 0;
  }
}

let current: SpeechSynthesisUtterance | null = null;

export function speak(text: string, onState?: (speaking: boolean) => void): boolean {
  if (!ttsSupported()) return false;
  const body = clean(text);
  if (!body) return false;
  stop();
  const u = new SpeechSynthesisUtterance(body);
  const v = cached ?? pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang || "it-IT";
  u.rate = 1.06;
  u.pitch = 1;
  u.volume = 1;
  u.onstart = () => {
    _speaking = true;
    emit();
    onState?.(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };
  u.onboundary = () => {
    target = 1; // impulso a ogni parola → particelle pulsano
  };
  const finish = () => {
    _speaking = false;
    current = null;
    emit();
    onState?.(false);
  };
  u.onend = finish;
  u.onerror = finish;
  current = u;
  // Chrome a volte "dorme": resume difensivo
  speechSynthesis.resume();
  speechSynthesis.speak(u);
  return true;
}

export function stop() {
  if (!ttsSupported()) return;
  if (current || speechSynthesis.speaking || speechSynthesis.pending) {
    current = null;
    speechSynthesis.cancel();
  }
  if (_speaking) {
    _speaking = false;
    emit();
  }
}

export function isSpeaking(): boolean {
  return _speaking;
}

// ── Preferenza auto-TTS (legge/scrive localStorage, con store osservabile) ────
const AUTO_KEY = "whychat_tts_auto";
const autoSubs = new Set<() => void>();
export function getTtsAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}
export function setTtsAuto(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* ignora */
  }
  autoSubs.forEach((f) => f());
}
export function subscribeTtsAuto(fn: () => void) {
  autoSubs.add(fn);
  return () => autoSubs.delete(fn);
}
