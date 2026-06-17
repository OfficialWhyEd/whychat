import { useEffect, useRef } from "react";

/**
 * ParticleText — particelle che si compongono in frasi di benvenuto e ciclano.
 * Adattato dal componente 21st.dev (KAINXU), ma reso WhyChat: colori crimson/ember
 * (niente random), fusione mix-blend screen (solo le particelle luminose, nessun box),
 * rispetto di reduced-motion e cleanup pulito. È l'anima che prende forma in pensiero.
 */

interface V2 {
  x: number;
  y: number;
}

const PALETTE: [number, number, number][] = [
  [201, 75, 37], // crimson
  [240, 163, 106], // ember
  [224, 103, 63], // signal-soft
];

class Particle {
  pos: V2 = { x: 0, y: 0 };
  vel: V2 = { x: 0, y: 0 };
  acc: V2 = { x: 0, y: 0 };
  target: V2 = { x: 0, y: 0 };
  closeEnough = 90;
  maxSpeed = 5;
  maxForce = 0.5;
  size = 2.4;
  isKilled = false;
  start = { r: 0, g: 0, b: 0 };
  goal = { r: 0, g: 0, b: 0 };
  w = 0;
  blend = 0.02;

  move() {
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const prox = dist < this.closeEnough ? dist / this.closeEnough : 1;
    let tx = dx,
      ty = dy;
    const m = Math.hypot(tx, ty);
    if (m > 0) {
      tx = (tx / m) * this.maxSpeed * prox;
      ty = (ty / m) * this.maxSpeed * prox;
    }
    let sx = tx - this.vel.x,
      sy = ty - this.vel.y;
    const sm = Math.hypot(sx, sy);
    if (sm > 0) {
      sx = (sx / sm) * this.maxForce;
      sy = (sy / sm) * this.maxForce;
    }
    this.acc.x += sx;
    this.acc.y += sy;
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.acc.x = 0;
    this.acc.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.w < 1) this.w = Math.min(this.w + this.blend, 1);
    const r = Math.round(this.start.r + (this.goal.r - this.start.r) * this.w);
    const g = Math.round(this.start.g + (this.goal.g - this.start.g) * this.w);
    const b = Math.round(this.start.b + (this.goal.b - this.start.b) * this.w);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(this.pos.x, this.pos.y, this.size, this.size);
  }

  kill(w: number, h: number) {
    if (this.isKilled) return;
    const a = Math.random() * Math.PI * 2;
    const mag = (w + h) / 2;
    this.target.x = w / 2 + Math.cos(a) * mag;
    this.target.y = h / 2 + Math.sin(a) * mag;
    this.start = {
      r: this.start.r + (this.goal.r - this.start.r) * this.w,
      g: this.start.g + (this.goal.g - this.start.g) * this.w,
      b: this.start.b + (this.goal.b - this.start.b) * this.w,
    };
    this.goal = { r: 0, g: 0, b: 0 };
    this.w = 0;
    this.isKilled = true;
  }
}

export default function ParticleText({
  words = ["SONO WHYCHAT", "L'ANIMA DI WHYED", "PARLAMI", "PENSA CON ME"],
  width = 880,
  height = 240,
}: {
  words?: string[];
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = width;
    canvas.height = height;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = [];
    const pixelSteps = 6;
    let wordIndex = 0;
    let frame = 0;
    let raf = 0;
    let colorIdx = 0;

    const randPos = (): V2 => {
      const a = Math.random() * Math.PI * 2;
      const mag = (width + height) / 2;
      return { x: width / 2 + Math.cos(a) * mag, y: height / 2 + Math.sin(a) * mag };
    };

    const nextWord = (word: string) => {
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const octx = off.getContext("2d")!;
      const fontSize = Math.min(96, (width / Math.max(word.length, 6)) * 1.5);
      octx.fillStyle = "white";
      octx.font = `700 ${fontSize}px Outfit, system-ui, sans-serif`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(word, width / 2, height / 2);
      const pixels = octx.getImageData(0, 0, width, height).data;

      const c = PALETTE[colorIdx % PALETTE.length];
      colorIdx++;
      const goal = { r: c[0], g: c[1], b: c[2] };

      const idxs: number[] = [];
      for (let i = 0; i < pixels.length; i += pixelSteps * 4) idxs.push(i);
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }

      let pi = 0;
      for (const idx of idxs) {
        if (pixels[idx + 3] > 0) {
          const x = (idx / 4) % width;
          const y = Math.floor(idx / 4 / width);
          let p: Particle;
          if (pi < particles.length) {
            p = particles[pi];
            p.isKilled = false;
          } else {
            p = new Particle();
            const rp = randPos();
            p.pos.x = rp.x;
            p.pos.y = rp.y;
            p.maxSpeed = Math.random() * 4 + 4;
            p.maxForce = p.maxSpeed * 0.1;
            p.size = Math.random() * 1.4 + 1.8;
            p.blend = Math.random() * 0.02 + 0.01;
            particles.push(p);
          }
          p.start = {
            r: p.start.r + (p.goal.r - p.start.r) * p.w,
            g: p.start.g + (p.goal.g - p.start.g) * p.w,
            b: p.start.b + (p.goal.b - p.start.b) * p.w,
          };
          p.goal = goal;
          p.w = 0;
          p.target.x = x;
          p.target.y = y;
          pi++;
        }
      }
      for (let i = pi; i < particles.length; i++) particles[i].kill(width, height);
    };

    const tick = () => {
      // trail nero: sotto mix-blend screen sparisce, restano solo le particelle che brillano
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.move();
        p.draw(ctx);
        if (p.isKilled && (p.pos.x < -50 || p.pos.x > width + 50 || p.pos.y < -50 || p.pos.y > height + 50))
          particles.splice(i, 1);
      }
      frame++;
      if (frame % 260 === 0) {
        wordIndex = (wordIndex + 1) % words.length;
        nextWord(words[wordIndex]);
      }
      raf = requestAnimationFrame(tick);
    };

    nextWord(words[0]);
    if (reduce) {
      // statico: porta subito le particelle a destinazione
      for (let i = 0; i < 200; i++) particles.forEach((p) => p.move());
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => p.draw(ctx));
    } else {
      tick();
    }

    return () => cancelAnimationFrame(raf);
  }, [words, width, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="max-w-full"
      style={{ width, height, maxWidth: "100%", mixBlendMode: "screen" }}
    />
  );
}
