import { useEffect, useRef, useState } from "react";
import { analyzeMusic } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import { Counter } from "./effects/AnimatedCounter";
import { ShiningText } from "./ShiningText";
import { WLoader } from "./WLoader";

/**
 * WhyMusic — analizza una traccia nel browser fin nel dettaglio (Web Audio +
 * FFT): durata, BPM, tonalità stimata, dinamica, bilanciamento spettrale,
 * loudness. Disegna la waveform e lo spettro live, poi WhyChat (worker /api/music)
 * dà un'analisi/produzione profonda. Tutto locale: nessun upload del file audio.
 */

interface Features {
  durationSec: number;
  sampleRate: number;
  channels: number;
  bpm: number;
  keyGuess: string;
  peakDb: number;
  rmsDb: number;
  crestDb: number; // dinamica (peak - rms)
  centroidHz: number;
  brightness: string;
}

const NOTES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

// FFT iterativa (Cooley-Tukey, in-place). re/im lunghezza potenza di 2.
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wre = Math.cos(ang);
    const wim = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cre = 1;
      let cim = 0;
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k;
        const b = a + (len >> 1);
        const tre = re[b] * cre - im[b] * cim;
        const tim = re[b] * cim + im[b] * cre;
        re[b] = re[a] - tre;
        im[b] = im[a] - tim;
        re[a] += tre;
        im[a] += tim;
        const ncre = cre * wre - cim * wim;
        cim = cre * wim + cim * wre;
        cre = ncre;
      }
    }
  }
}

function analyze(buf: AudioBuffer): Features {
  const sr = buf.sampleRate;
  const ch = buf.numberOfChannels;
  const len = buf.length;
  // mono = media canali
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
  }

  // peak / rms
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) peak = a;
    sumSq += mono[i] * mono[i];
  }
  const rms = Math.sqrt(sumSq / len);
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);
  const peakDb = db(peak);
  const rmsDb = db(rms);

  // envelope per BPM (energia per hop)
  const hop = 512;
  const env: number[] = [];
  for (let i = 0; i + hop < len; i += hop) {
    let s = 0;
    for (let j = 0; j < hop; j++) s += mono[i + j] * mono[i + j];
    env.push(Math.sqrt(s / hop));
  }
  // onset = differenza positiva
  const onset = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);
  const fps = sr / hop;
  let bestBpm = 0;
  let bestScore = -1;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = Math.round((60 / bpm) * fps);
    if (lag < 1 || lag >= onset.length) continue;
    let sc = 0;
    for (let i = 0; i + lag < onset.length; i++) sc += onset[i] * onset[i + lag];
    if (sc > bestScore) {
      bestScore = sc;
      bestBpm = bpm;
    }
  }

  // spettro su una finestra rappresentativa (la più energica)
  const N = 8192;
  let start = 0;
  if (len > N) {
    let maxE = -1;
    for (let i = 0; i + N < len; i += N) {
      let e = 0;
      for (let j = 0; j < N; j += 16) e += mono[i + j] * mono[i + j];
      if (e > maxE) {
        maxE = e;
        start = i;
      }
    }
  }
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); // Hann
    re[i] = (mono[start + i] || 0) * w;
  }
  fft(re, im);
  const half = N >> 1;
  const mag = new Float32Array(half);
  let cenNum = 0;
  let cenDen = 0;
  const chroma = new Float32Array(12);
  for (let k = 1; k < half; k++) {
    const m = Math.hypot(re[k], im[k]);
    mag[k] = m;
    const f = (k * sr) / N;
    cenNum += f * m;
    cenDen += m;
    if (f > 27 && f < 5000) {
      const pc = ((Math.round(12 * Math.log2(f / 440)) % 12) + 12) % 12;
      chroma[pc] += m;
    }
  }
  const centroidHz = cenDen > 0 ? cenNum / cenDen : 0;
  let keyIdx = 0;
  for (let i = 1; i < 12; i++) if (chroma[i] > chroma[keyIdx]) keyIdx = i;
  // mappa pitch-class FFT (0=A) → nome (NOTES parte da Do=C): pc 0 = La
  const noteName = NOTES[(keyIdx * 7 + 9) % 12]; // riallinea A-based a C-based circle approx
  const brightness = centroidHz < 1200 ? "scura/calda" : centroidHz < 2600 ? "bilanciata" : "brillante/aperta";

  return {
    durationSec: buf.duration,
    sampleRate: sr,
    channels: ch,
    bpm: bestBpm,
    keyGuess: noteName,
    peakDb: Math.round(peakDb * 10) / 10,
    rmsDb: Math.round(rmsDb * 10) / 10,
    crestDb: Math.round((peakDb - rmsDb) * 10) / 10,
    centroidHz: Math.round(centroidHz),
    brightness,
  };
}

function drawWaveform(canvas: HTMLCanvasElement, buf: AudioBuffer) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const data = buf.getChannelData(0);
  const step = Math.floor(data.length / W) || 1;
  const mid = H / 2;
  ctx.strokeStyle = "#c94b25";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    let min = 1;
    let max = -1;
    for (let i = 0; i < step; i++) {
      const v = data[x * step + i] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.moveTo(x + 0.5, mid + min * mid * 0.95);
    ctx.lineTo(x + 0.5, mid + max * mid * 0.95);
  }
  ctx.stroke();
}

export default function WhyMusic({ onExit }: { onExit?: () => void }) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);

  const [fileName, setFileName] = useState("");
  const [features, setFeatures] = useState<Features | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");

  const loadFile = async (file: File) => {
    setErr("");
    setAnalysis("");
    setLoading(true);
    setFileName(file.name);
    try {
      const arr = await file.arrayBuffer();
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const buf = await ac.decodeAudioData(arr.slice(0));
      setBuffer(buf);
      setFeatures(analyze(buf));
      setUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return URL.createObjectURL(file);
      });
      await ac.close();
    } catch (e) {
      setErr(`Non riesco a leggere questo file audio. ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (buffer && waveRef.current) drawWaveform(waveRef.current, buffer);
  }, [buffer]);

  // spettro live durante la riproduzione
  const setupLiveSpectrum = () => {
    const audio = audioRef.current;
    if (!audio || acRef.current) return;
    const ac = new AudioContext();
    const src = ac.createMediaElementSource(audio);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyser.connect(ac.destination);
    acRef.current = ac;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const canvas = specRef.current;
    const ctx = canvas?.getContext("2d");
    const loop = () => {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== W * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, W, H);
      const bars = 64;
      const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length)] / 255;
        const h = v * H;
        ctx.fillStyle = `rgb(${201 + v * 39},${75 + v * 88},${37 + v * 69})`;
        ctx.fillRect(i * bw, H - h, bw - 1, h);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      acRef.current?.close().catch(() => {});
      if (url) URL.revokeObjectURL(url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runAnalysis = async () => {
    if (!features || busy) return;
    setBusy(true);
    setAnalysis("");
    try {
      const text = await analyzeMusic(features as unknown as Record<string, unknown>, ask.trim() || undefined);
      setAnalysis(text);
    } catch (e) {
      setErr(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

  return (
    <div className="scroll-thin mx-auto flex h-full max-w-3xl flex-col gap-3 overflow-y-auto px-4 py-2">
      <div className="flex items-center gap-2">
        {onExit && (
          <button
            onClick={onExit}
            className="mono rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:border-signal/50 hover:text-paper"
          >
            ESCI ✕
          </button>
        )}
        <span className="mono text-[0.55rem] text-faint">WHYMUSIC · ANALISI TRACCIA</span>
      </div>

      {!buffer && (
        <label className="glass flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-[var(--color-line2)] text-center transition hover:border-signal/40">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ember">
            <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[0.9rem] text-dim">Carica una traccia audio</span>
          <span className="mono text-[0.5rem] text-faint">MP3 · WAV · M4A · OGG — resta sul tuo dispositivo</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
            }}
          />
        </label>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-ember">
          <WLoader size={20} />
          <ShiningText text="Analizzo la traccia…" className="text-[0.92rem]" />
        </div>
      )}
      {err && <p className="text-[0.85rem] text-signal-soft">{err}</p>}

      {buffer && features && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[0.85rem] text-paper">{fileName}</span>
            <button
              onClick={() => {
                setBuffer(null);
                setFeatures(null);
                setAnalysis("");
                cancelAnimationFrame(rafRef.current);
                acRef.current?.close().catch(() => {});
                acRef.current = null;
              }}
              className="mono shrink-0 text-[0.5rem] text-faint transition hover:text-signal-soft"
            >
              CAMBIA
            </button>
          </div>

          <canvas ref={waveRef} className="h-20 w-full rounded-xl border border-[var(--color-line)] bg-[rgba(16,13,11,0.4)]" />
          <canvas ref={specRef} className="h-16 w-full rounded-xl border border-[var(--color-line)] bg-[rgba(16,13,11,0.4)]" />

          {url && (
            <audio
              ref={audioRef}
              src={url}
              controls
              onPlay={setupLiveSpectrum}
              className="w-full"
              style={{ filter: "invert(0.86) hue-rotate(180deg)", borderRadius: 12 }}
            />
          )}

          {/* metriche — numeri animati (Counter) dove ha senso */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <Stat label="BPM">
              <Counter to={features.bpm} fontSize={22} />
            </Stat>
            <Stat label="Tonalità">
              <span className="text-[1.35rem] font-medium text-ember">{features.keyGuess}</span>
            </Stat>
            <Stat label="Durata">
              <span className="text-[1.35rem] font-medium text-ember tabular-nums">{fmtDur(features.durationSec)}</span>
            </Stat>
            <Stat label="Dinamica">
              <span className="text-[1.35rem] font-medium text-ember tabular-nums">{features.crestDb} dB</span>
            </Stat>
            <Stat label="Picco">
              <span className="text-[1.05rem] font-medium text-dim tabular-nums">{features.peakDb} dBFS</span>
            </Stat>
            <Stat label="RMS">
              <span className="text-[1.05rem] font-medium text-dim tabular-nums">{features.rmsDb} dBFS</span>
            </Stat>
            <Stat label="Centro spettro">
              <span className="text-[1.05rem] font-medium text-dim tabular-nums">{features.centroidHz} Hz</span>
            </Stat>
            <Stat label="Timbro">
              <span className="text-[0.95rem] font-medium text-dim">{features.brightness}</span>
            </Stat>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
              placeholder="Cosa vuoi sapere? (es. 'come la mixo meglio?')"
              className="glass min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-[0.88rem] text-paper placeholder:text-faint focus:outline-none"
            />
            <button
              onClick={runAnalysis}
              disabled={busy}
              className="mono shrink-0 rounded-full bg-[radial-gradient(125%_120%_at_50%_6%,#ffd2a4,#f0a36a_24%,#d4582c_56%,#8a2f17_100%)] px-4 py-2.5 text-[0.6rem] text-[#0a0908] transition disabled:opacity-35"
            >
              ANALIZZA
            </button>
          </div>

          {(busy || analysis) && (
            <div className="rounded-2xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)] p-4">
              {busy && !analysis ? (
                <div className="flex items-center gap-2 text-ember">
                  <WLoader size={20} />
                  <ShiningText text="Ascolto e ragiono…" className="text-[0.92rem]" />
                </div>
              ) : (
                <div
                  className="wc-prose text-[0.92rem] leading-[1.7] text-dim"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--color-line)] bg-[rgba(242,239,233,0.02)] px-3 py-2">
      <span className="mono text-[0.46rem] text-faint">{label}</span>
      <span className="leading-none">{children}</span>
    </div>
  );
}
