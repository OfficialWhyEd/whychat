import { useMemo } from "react";

/**
 * Liquid Glass (texture stile Apple, WWDC25) — adattato dalla tecnica di
 * kube.io / nikdelvin/liquid-glass / rdev/liquid-glass-react.
 *
 * Idea chiave (perché NON fa la cucitura): la mappa di spostamento NON è rumore
 * (feTurbulence crea seam ovunque) ma un LENTE — neutra al centro (lo sfondo
 * passa pulito) e con rifrazione concentrata SUI BORDI. Così le particelle che
 * passano dietro si piegano sul bordo come vero vetro, senza striature al centro.
 *
 * La mappa codifica un campo vettoriale: canale R = spostamento orizzontale,
 * canale G = verticale (128 = neutro). feDisplacementMap piega lo sfondo sfocato.
 */

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// genera la mappa-lente come dataURL PNG (campo liscio → niente seam)
function makeLensMap(w: number, h: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // posizione normalizzata -1..1 (segue la forma del rettangolo)
      const vx = (x - cx) / cx;
      const vy = (y - cy) / cy;
      // distanza dal centro in norma-max: 0 al centro, 1 a metà bordo
      const edge = Math.max(Math.abs(vx), Math.abs(vy));
      // peso: piatto (neutro) fino al 38%, poi sale verso il bordo → curva del vetro
      const weight = smoothstep(0.38, 1.0, edge);
      const r = 128 + Math.max(-1, Math.min(1, vx * weight)) * 127;
      const g = 128 + Math.max(-1, Math.min(1, vy * weight)) * 127;
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// Chromium supporta gli SVG filter in backdrop-filter; Safari/iOS no → fallback.
let _supported: boolean | null = null;
export function svgBackdropSupported(): boolean {
  if (_supported !== null) return _supported;
  if (typeof document === "undefined") return false;
  const el = document.createElement("div");
  el.style.backdropFilter = "url(#__t)";
  let ok = el.style.backdropFilter !== "";
  if (!ok) {
    el.style.setProperty("-webkit-backdrop-filter", "url(#__t)");
    ok = el.style.getPropertyValue("-webkit-backdrop-filter") !== "";
  }
  _supported = ok;
  return ok;
}

export function LiquidGlassFilter({
  id,
  width,
  height,
  scale = 14,
}: {
  id: string;
  width: number;
  height: number;
  scale?: number;
}) {
  // mappa rigenerata solo quando cambia la dimensione (cap a 360px: il campo è
  // liscio, feImage la riscala senza artefatti → meno lavoro per la CPU)
  const href = useMemo(() => {
    if (!width || !height) return "";
    const mw = Math.min(Math.round(width), 360);
    const mh = Math.min(Math.round(height), 200);
    return makeLensMap(mw, mh);
  }, [width, height]);

  if (!href) return null;
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
      <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feImage href={href} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
