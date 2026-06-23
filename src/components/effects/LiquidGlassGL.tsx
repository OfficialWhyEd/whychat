import { useEffect, useRef } from "react";

/**
 * LiquidGlassGL — Liquid Glass Apple AUTENTICO in WebGL.
 *
 * Tecnica fisica (da rxing365/html-liquid-glass-effect-webgl + maxgeris):
 * il vetro è una SUPERFICIE con un height-field — piatta al centro, che curva
 * giù sui bordi (smusso, sigmoide sull'SDF). Si calcola la NORMALE di quella
 * curva e si RIFRANGE lo sfondo con la legge di Snell (refract() + IOR). Risultato:
 * centro LIMPIDO (vedi attraverso), bordi che PIEGANO e magnificano lo sfondo.
 * Niente riflessi finti — solo rifrazione vera, aberrazione cromatica sui bordi,
 * frost. Gira anche su iPhone (WebGL).
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBg;
uniform vec2 uTexOff;     // origine barra in uv dello sfondo
uniform vec2 uTexScale;   // dimensione barra in uv dello sfondo
uniform vec2 uSize;       // dimensione barra in px
uniform vec2 uBgPx;       // dimensione sfondo in px
uniform float uRadius;    // raggio angoli px
uniform float uBevel;     // larghezza smusso del bordo px
uniform float uIor;       // indice di rifrazione (~1.5)
uniform float uThick;     // "spessore" del vetro → quanto piega
uniform float uAberr;     // aberrazione cromatica
uniform float uBlur;      // raggio frost px

float sdf(vec2 p, vec2 b, float r){
  vec2 q = abs(p)-b+r;
  return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
}

// altezza del vetro: ~1 al centro (piatto), scende a 0 sul bordo (smusso) via sigmoide
float hgt(vec2 p, vec2 b, float r, float tw){
  float d = sdf(p,b,r);
  float n = d / tw;          // 0 al bordo, negativo dentro
  return clamp(1.0 - 1.0/(1.0+exp(-n*6.0)), 0.0, 1.0);
}

void main(){
  vec2 b = uSize*0.5;
  vec2 p = vUv*uSize - b;
  float d = sdf(p,b,uRadius);

  // normale della superficie curva (gradiente dell'height-field)
  float e = 1.5;
  float hx = hgt(p+vec2(e,0.0),b,uRadius,uBevel) - hgt(p-vec2(e,0.0),b,uRadius,uBevel);
  float hy = hgt(p+vec2(0.0,e),b,uRadius,uBevel) - hgt(p-vec2(0.0,e),b,uRadius,uBevel);
  vec3 N = normalize(vec3(-hx, -hy, e*2.0/uThick));

  // rifrazione di Snell: dentro il vetro e fuori → offset di campionamento
  vec3 incident = vec3(0.0,0.0,-1.0);
  vec3 r1 = refract(incident, N, 1.0/uIor);
  vec3 r2 = refract(r1, -N, uIor);
  vec2 offPx = r2.xy * uThick;                 // spostamento in px (forte sul bordo, ~0 al centro)
  vec2 baseUv = uTexOff + vUv*uTexScale;
  vec2 offUv = offPx / uBgPx;
  // aberrazione: canali con spostamento leggermente diverso (solo dove c'è offset = bordi)
  vec2 abUv = offUv * uAberr;

  // frost: blur gaussiano 5x5 sul campione rifratto
  vec2 bl = vec2(uBlur) / uBgPx;
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int i=-2;i<=2;i++){
    for (int j=-2;j<=2;j++){
      vec2 fo = vec2(float(i),float(j));
      float w = exp(-dot(fo,fo)*0.35);
      vec2 o = fo*bl;
      col.r += texture2D(uBg, baseUv+offUv+abUv+o).r * w;
      col.g += texture2D(uBg, baseUv+offUv+o).g * w;
      col.b += texture2D(uBg, baseUv+offUv-abUv+o).b * w;
      wsum += w;
    }
  }
  col /= wsum;

  // velo di vetro minimo (caldo, scuro) — NIENTE riflessi
  float h = hgt(p,b,uRadius,uBevel);
  vec3 glass = col * 1.35 + vec3(0.05,0.041,0.034);
  // tint sottilissimo sulla superficie piatta (centro), come Apple — non sui bordi
  glass = mix(glass, glass + vec3(0.06,0.06,0.07), h*0.12);

  float alpha = 1.0 - smoothstep(-1.0, 0.6, d);
  gl_FragColor = vec4(glass, alpha*0.95);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("LiquidGlassGL shader:", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

export function liquidGLSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export default function LiquidGlassGL({
  radius = 26,
  bevel = 22,
  ior = 1.45,
  thick = 34,
  aberration = 0.18,
  blur = 2.2,
  className = "",
}: {
  radius?: number;
  bevel?: number;
  ior?: number;
  thick?: number;
  aberration?: number;
  blur?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true }) ||
      canvas.getContext("experimental-webgl", { alpha: true })) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const U = {
      uBg: gl.getUniformLocation(prog, "uBg"),
      uTexOff: gl.getUniformLocation(prog, "uTexOff"),
      uTexScale: gl.getUniformLocation(prog, "uTexScale"),
      uSize: gl.getUniformLocation(prog, "uSize"),
      uBgPx: gl.getUniformLocation(prog, "uBgPx"),
      uRadius: gl.getUniformLocation(prog, "uRadius"),
      uBevel: gl.getUniformLocation(prog, "uBevel"),
      uIor: gl.getUniformLocation(prog, "uIor"),
      uThick: gl.getUniformLocation(prog, "uThick"),
      uAberr: gl.getUniformLocation(prog, "uAberr"),
      uBlur: gl.getUniformLocation(prog, "uBlur"),
    };

    let raf = 0;
    let alive = true;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

    const frame = () => {
      if (!alive) return;
      const bg = document.querySelector("[data-bg-particles]") as HTMLCanvasElement | null;
      const rect = canvas.getBoundingClientRect();
      if (bg && rect.width > 0 && rect.height > 0) {
        const dp = dpr();
        const w = Math.round(rect.width * dp);
        const h = Math.round(rect.height * dp);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        const bgRect = bg.getBoundingClientRect();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);
        } catch {
          /* canvas non pronto */
        }
        const offX = (rect.left - bgRect.left) / bgRect.width;
        const offYtop = (rect.top - bgRect.top) / bgRect.height;
        const sx = rect.width / bgRect.width;
        const sy = rect.height / bgRect.height;
        const offY = 1.0 - offYtop - sy; // FLIP_Y attivo
        gl.useProgram(prog);
        gl.uniform1i(U.uBg, 0);
        gl.uniform2f(U.uTexOff, offX, offY);
        gl.uniform2f(U.uTexScale, sx, sy);
        gl.uniform2f(U.uSize, rect.width, rect.height);
        gl.uniform2f(U.uBgPx, bgRect.width, bgRect.height);
        gl.uniform1f(U.uRadius, radius);
        gl.uniform1f(U.uBevel, bevel);
        gl.uniform1f(U.uIor, ior);
        gl.uniform1f(U.uThick, thick);
        gl.uniform1f(U.uAberr, aberration);
        gl.uniform1f(U.uBlur, blur);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [radius, bevel, ior, thick, aberration, blur]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full rounded-[26px] ${className}`}
    />
  );
}
