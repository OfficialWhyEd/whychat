/**
 * TTS per WhyChat — voce neural Microsoft/Edge (come OpenClaw), default
 * `it-IT-ElsaNeural`. L'audio MP3 arriva dal Worker (`/api/tts`) e viene riprodotto
 * nel browser; un AnalyserNode legge l'ampiezza REALE della voce per far reagire
 * le particelle e lo sfondo (scorrimento più veloce + effetto metallico).
 * Se Edge non è disponibile, fallback alla Web Speech API (offline, istantanea).
 */
import { WORKER_URL } from "./api";

// ── Store attività vocale (condiviso, fuori da React per il loop canvas) ──────
let _level = 0; // ampiezza smussata 0..1 (dalla voce reale)
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
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

export function ttsSupported(): boolean {
  return typeof window !== "undefined";
}

// ── Voce Edge selezionata (default Elsa; modificabile) ────────────────────────
const VOICE_KEY = "whychat_tts_voice";
const DEFAULT_VOICE = "it-IT-ElsaNeural";
export function getTtsVoice(): string {
  try {
    return localStorage.getItem(VOICE_KEY) || DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}
export function setTtsVoice(v: string) {
  try {
    localStorage.setItem(VOICE_KEY, v);
  } catch {
    /* ignora */
  }
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
    .slice(0, 4096);
}

// ── Riproduzione Edge MP3 + ampiezza reale via AnalyserNode ───────────────────
let ac: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freq: Uint8Array<ArrayBuffer> | null = null;
let curAudio: HTMLAudioElement | null = null;
let curUrl: string | null = null;
let meterRaf = 0;
const sourced = new WeakSet<HTMLMediaElement>();

function ensureContext(audio: HTMLAudioElement) {
  type ACtor = typeof AudioContext;
  const Ctor: ACtor | undefined =
    (window.AudioContext as ACtor | undefined) ??
    (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
  if (!Ctor) return; // niente Web Audio → si sente comunque, senza reattività
  if (!ac) {
    ac = new Ctor();
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(ac.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
  }
  if (!sourced.has(audio) && ac && analyser) {
    const src = ac.createMediaElementSource(audio);
    src.connect(analyser);
    sourced.add(audio);
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
}

function meter() {
  if (analyser && freq && curAudio && !curAudio.paused) {
    analyser.getByteFrequencyData(freq);
    let s = 0;
    for (let i = 0; i < freq.length; i++) s += freq[i];
    const avg = s / freq.length / 255;
    _level += (Math.min(1, avg * 1.7) - _level) * 0.4;
    meterRaf = requestAnimationFrame(meter);
  } else {
    _level += (0 - _level) * 0.2;
    if (_level > 0.01) meterRaf = requestAnimationFrame(meter);
    else _level = 0;
  }
}

async function playEdge(text: string, onState?: (s: boolean) => void): Promise<void> {
  const res = await fetch(`${WORKER_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: getTtsVoice() }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error("audio vuoto");
  const blob = new Blob([buf], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";
  curAudio = audio;
  curUrl = url;

  const finish = () => {
    if (curAudio === audio) {
      _speaking = false;
      emit();
      onState?.(false);
      if (curUrl) URL.revokeObjectURL(curUrl);
      curUrl = null;
      curAudio = null;
    }
  };
  audio.onended = finish;
  audio.onerror = finish;
  audio.onplay = () => {
    _speaking = true;
    emit();
    onState?.(true);
    cancelAnimationFrame(meterRaf);
    meterRaf = requestAnimationFrame(meter);
  };
  try {
    ensureContext(audio);
  } catch {
    /* niente analyser: l'audio si sente lo stesso */
  }
  await audio.play();
}

// ── Fallback Web Speech (offline) ─────────────────────────────────────────────
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
    if (/natural|online|neural/.test(n)) s += 6;
    if (/elsa|isabella|diego|giuseppe|fabiola|imelda/.test(n)) s += 3;
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

let synthUtter: SpeechSynthesisUtterance | null = null;
let synthRaf = 0;
let synthTarget = 0.2;
function synthLoop() {
  synthTarget = Math.max(0.12, synthTarget - 0.05);
  _level += (synthTarget - _level) * 0.25;
  if (_speaking) synthRaf = requestAnimationFrame(synthLoop);
  else {
    _level += (0 - _level) * 0.2;
    if (_level > 0.01) synthRaf = requestAnimationFrame(synthLoop);
    else _level = 0;
  }
}
function speakWebSpeech(body: string, onState?: (s: boolean) => void) {
  if (typeof speechSynthesis === "undefined") {
    onState?.(false);
    return;
  }
  const u = new SpeechSynthesisUtterance(body);
  const v = cached ?? pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang || "it-IT";
  u.rate = 1.06;
  u.onstart = () => {
    _speaking = true;
    emit();
    onState?.(true);
    cancelAnimationFrame(synthRaf);
    synthRaf = requestAnimationFrame(synthLoop);
  };
  u.onboundary = () => {
    synthTarget = 1;
  };
  const finish = () => {
    _speaking = false;
    synthUtter = null;
    emit();
    onState?.(false);
  };
  u.onend = finish;
  u.onerror = finish;
  synthUtter = u;
  speechSynthesis.resume();
  speechSynthesis.speak(u);
}

// ── API pubblica ──────────────────────────────────────────────────────────────
export function speak(text: string, onState?: (speaking: boolean) => void): boolean {
  if (!ttsSupported()) return false;
  const body = clean(text);
  if (!body) return false;
  stop();
  // prova la voce Edge (bella); se fallisce, ripiega su Web Speech
  playEdge(body, onState).catch(() => speakWebSpeech(body, onState));
  return true;
}

export function stop() {
  if (curAudio) {
    try {
      curAudio.pause();
    } catch {
      /* ignora */
    }
    curAudio.onended = null;
    curAudio.onerror = null;
    curAudio = null;
  }
  if (curUrl) {
    URL.revokeObjectURL(curUrl);
    curUrl = null;
  }
  cancelAnimationFrame(meterRaf);
  if (typeof speechSynthesis !== "undefined" && (synthUtter || speechSynthesis.speaking || speechSynthesis.pending)) {
    synthUtter = null;
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

// ── Preferenza auto-TTS (localStorage + store osservabile) ────────────────────
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
