import { useEffect, useRef } from "react";
import { voice } from "../lib/tts";

/**
 * SoulParticles — UN SOLO sistema. Le particelle fluttuano sul void come una
 * corrente (campo di flusso Perlin) e periodicamente si RACCOLGONO a comporre
 * le parole di benvenuto, poi si sciolgono di nuovo nella corrente.
 * Le molecole dello sfondo sono letteralmente le stesse che formano la scritta.
 * Unisce FluidBackground + ParticleText in un'unica anima. crimson/ember.
 */

function perlin() {
  const perm = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
    142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
    203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
    74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
    220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76,
    132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186,
    3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59,
    227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70,
    221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178,
    185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81,
    51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115,
    121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195,
    78, 66, 215, 61, 156, 180,
  ];
  const p = new Array(512);
  for (let i = 0; i < 256; i++) p[256 + i] = p[i] = perm[i];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number) => {
    const u = (h & 1) === 0 ? x : -x;
    const v = (h & 2) === 0 ? y : -y;
    return u + v;
  };
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x),
      v = fade(y);
    const A = p[X] + Y,
      B = p[X + 1] + Y;
    return lerp(v, lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)), lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1)));
  };
}

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number; // target (in fase testo)
  ty: number;
  forming: boolean;
  hue: number;
  size: number;
  life: number;
  maxLife: number;
}

const WORDS = ["SONO WHYCHAT", "L'ANIMA DI WHYED", "PARLAMI", "PENSA CON ME"];
// Densità alta: il testo dev'essere pieno e leggibile. Solo mobile leggermente
// ridotto per il fill-rate (schermi piccoli), desktop ricco.
const COUNT = (() => {
  if (typeof window === "undefined") return 1900;
  const w = window.innerWidth;
  if (w < 640) return 1300;
  if (w < 1024) return 1800;
  return 2200;
})();

export default function SoulParticles({
  formText = true,
  modelName = "",
}: {
  formText?: boolean;
  modelName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef(formText);
  formRef.current = formText;
  // L'allineamento forma anche il nome del modello scelto.
  const wordsRef = useRef<string[]>(WORDS);
  wordsRef.current = modelName ? [modelName.toUpperCase(), ...WORDS] : WORDS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const noise = perlin();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0,
      H = 0;
    // Dimensiona sul CONTENITORE (l'area principale), non sulla finestra: così le
    // particelle vivono nello stesso spazio dell'hero e si riallineano al toggle sidebar.
    const resize = () => {
      const host = canvas.parentElement;
      W = host ? host.clientWidth : window.innerWidth;
      H = host ? host.clientHeight : window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: P[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      forming: false,
      hue: Math.random(),
      size: Math.random() * 1.4 + 0.5,
      life: Math.random() * 100,
      maxLife: 110 + Math.random() * 70,
    }));

    // Il canvas È già l'area principale → basta centrare a metà; si riallinea da solo
    // quando la sidebar cambia (ResizeObserver sotto).
    // su mobile (stretto) il nome a particelle sta più in alto e più compatto,
    // così non si sovrappone alla prosa/aperture sotto
    const wordCenter = () => ({ cx: W / 2, cy: W < 640 ? Math.max(92, H * 0.17) : Math.max(150, H * 0.28) });

    // Campiona i pixel di una parola → lista di target (coord viewport).
    const sampleWord = (word: string): { x: number; y: number }[] => {
      const { cx, cy } = wordCenter();
      const off = document.createElement("canvas");
      const ow = Math.min(900, W - 40);
      const oh = W < 640 ? 130 : 220;
      off.width = ow;
      off.height = oh;
      const o = off.getContext("2d")!;
      const fs = Math.min(108, (ow / Math.max(word.length, 7)) * 1.7);
      o.fillStyle = "#fff";
      // display espressivo: stesso carattere del wordmark
      o.font = `900 ${fs}px "Fraunces", "DM Serif Display", serif`;
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.fillText(word, ow / 2, oh / 2);
      const data = o.getImageData(0, 0, ow, oh).data;
      const pts: { x: number; y: number }[] = [];
      const step = 4; // più fitto = lettere più nitide
      for (let y = 0; y < oh; y += step) {
        for (let x = 0; x < ow; x += step) {
          if (data[(y * ow + x) * 4 + 3] > 128) {
            pts.push({ x: cx - ow / 2 + x, y: cy - oh / 2 + y });
          }
        }
      }
      // shuffle per movimento fluido
      for (let i = pts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pts[i], pts[j]] = [pts[j], pts[i]];
      }
      return pts;
    };

    let wordIndex = 0;
    let phase: "ambient" | "form" | "hold" | "release" = formText ? "form" : "ambient";
    let phaseUntil = performance.now() + 600;

    const assignWord = () => {
      const list = wordsRef.current;
      const pts = sampleWord(list[wordIndex % list.length]);
      const n = Math.min(pts.length, Math.floor(COUNT * 0.92));
      for (let i = 0; i < particles.length; i++) {
        if (i < n) {
          particles[i].forming = true;
          particles[i].tx = pts[i].x;
          particles[i].ty = pts[i].y;
        } else {
          particles[i].forming = false;
        }
      }
    };

    const release = () => {
      for (const p of particles) {
        if (p.forming) {
          p.forming = false;
          // spinta di dispersione
          p.vx += (Math.random() - 0.5) * 3;
          p.vy += (Math.random() - 0.5) * 3;
        }
      }
    };

    if (formText) assignWord();

    // Fraunces si carica async: appena pronto, ricomponi con le metriche giuste
    if (formText && (document as Document & { fonts?: FontFaceSet }).fonts) {
      document.fonts
        .load('900 80px "Fraunces"')
        .then(() => {
          if (formRef.current) assignWord();
        })
        .catch(() => {});
    }

    let raf = 0;
    const time0 = performance.now();
    const tick = (now: number) => {
      // Reattività TTS: mentre WhyChat parla, le particelle scorrono più veloci e
      // si "metallizzano"; lo sfondo lascia scie più lunghe (più vivo, non invasivo).
      const vlvl = voice.level; // 0..1
      const speaking = voice.speaking;
      ctx.fillStyle = `rgba(10,9,8,${(0.13 - vlvl * 0.05).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      const t = (now - time0) * 0.0001;
      const flow = 1.5 * (1 + vlvl * 0.6); // velocità corrente, sale con la voce

      // (rimosso il bloom centrale: la voce si legge SOLO dalle particelle e dai
      // bordi del messaggio bot, niente alone al centro dello schermo)

      // macchina a fasi (solo se stiamo formando testo)
      if (formRef.current) {
        if (now > phaseUntil) {
          if (phase === "form") {
            phase = "hold";
            phaseUntil = now + 2600;
          } else if (phase === "hold") {
            phase = "release";
            phaseUntil = now + 1400;
            release();
          } else if (phase === "release") {
            phase = "ambient";
            phaseUntil = now + 2200;
          } else {
            phase = "form";
            phaseUntil = now + 2200;
            wordIndex = (wordIndex + 1) % wordsRef.current.length;
            assignWord();
          }
        }
      } else if (phase !== "ambient") {
        phase = "ambient";
        release();
      }

      for (const p of particles) {
        if (p.forming) {
          // molla critica verso il target: la lettera si compone fluida e si
          // assesta senza scatti. hue dà un piccolo stagger → assemblaggio vivo.
          const dx = p.tx - p.x,
            dy = p.ty - p.y;
          const k = 0.016 + p.hue * 0.012; // rigidità per-particella
          p.vx = (p.vx + dx * k) * 0.8; // smorzamento
          p.vy = (p.vy + dy * k) * 0.8;
        } else {
          // corrente Perlin
          p.life += 1;
          if (p.life > p.maxLife) {
            p.life = 0;
            p.x = Math.random() * W;
            p.y = Math.random() * H;
          }
          const a = noise(p.x * 0.0022, p.y * 0.0022 + t) * Math.PI * 4;
          p.vx = Math.cos(a) * flow;
          p.vy = Math.sin(a) * flow;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (!p.forming) {
          if (p.x < 0) p.x = W;
          if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H;
          if (p.y > H) p.y = 0;
        }
        let r = Math.round(201 + (240 - 201) * p.hue);
        let g = Math.round(75 + (163 - 75) * p.hue);
        let b = Math.round(37 + (106 - 37) * p.hue);
        // effetto metallico durante il parlato: vira verso un argento brunito
        if (speaking && vlvl > 0.01) {
          const m = Math.min(0.7, vlvl * 0.7);
          r = Math.round(r + (214 - r) * m);
          g = Math.round(g + (218 - g) * m);
          b = Math.round(b + (224 - b) * m);
        }
        // le particelle che formano la parola brillano di più (mix-blend screen
        // somma il colore dove sono dense → la scritta si accende viva)
        const op = (p.forming ? 1 : Math.sin((p.life / p.maxLife) * Math.PI) * 0.4) * (1 + vlvl * 0.3);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, op)})`;
        const s = (p.forming ? p.size * 0.7 + 1.1 : p.size) * (1 + vlvl * 0.25); // shimmer sulla voce
        ctx.fillRect(p.x, p.y, s, s);
      }
      raf = requestAnimationFrame(tick);
    };

    if (reduce) {
      // statico: una passata, parola ferma
      if (formText) {
        for (let k = 0; k < 120; k++)
          for (const p of particles)
            if (p.forming) {
              p.x += (p.tx - p.x) * 0.2;
              p.y += (p.ty - p.y) * 0.2;
            }
      }
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        const op = p.forming ? 0.9 : 0.25;
        ctx.fillStyle = `rgba(201,75,37,${op})`;
        ctx.fillRect(p.x, p.y, p.size + (p.forming ? 0.6 : 0), p.size);
      }
    } else {
      raf = requestAnimationFrame(tick);
    }

    // pausa quando la tab non è visibile: niente CPU/batteria sprecata
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Riallinea su resize finestra E su cambio dimensione del contenitore
    // (apertura/chiusura sidebar): ridimensiona e ricompone la parola al centro.
    const onResize = () => {
      resize();
      if (formRef.current) assignWord();
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ width: "100%", height: "100%", zIndex: 0, mixBlendMode: "screen" }}
    />
  );
}
