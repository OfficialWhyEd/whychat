import { useEffect, useRef } from "react";

/**
 * LiquidGlassGL — vetro liquido VERO in WebGL (approccio di dashersw/liquid-glass-js,
 * adattato): campiona lo sfondo reale (il canvas delle particelle dietro) e lo
 * RIFRANGE in tempo reale con uno shader — lente convessa sui bordi, aberrazione
 * cromatica, riflesso specular. Funziona ovunque (WebGL va anche su iPhone Safari),
 * a differenza del filtro SVG che è solo Chromium.
 *
 * Il canvas si posiziona inset-0 dentro la barra (dietro al testo) e ricalca ogni
 * frame la posizione/dimensione per campionare la regione giusta dello sfondo.
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
uniform vec2 uTexOff;    // origine barra in uv dello sfondo
uniform vec2 uTexScale;  // dimensione barra in uv dello sfondo
uniform vec2 uSize;      // dimensione barra in px
uniform vec2 uBgPx;      // dimensione sfondo in px
uniform float uRadius;   // raggio angoli px
uniform float uDispl;    // forza rifrazione px
uniform float uAberr;    // aberrazione px
uniform float uBand;     // larghezza banda bordo px

float sdf(vec2 p, vec2 b, float r){
  vec2 q = abs(p)-b+r;
  return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
}

void main(){
  vec2 px = vUv*uSize;
  vec2 b = uSize*0.5;
  vec2 p = px-b;
  float d = sdf(p,b,uRadius);
  float e = 1.5;
  vec2 g = vec2(
    sdf(p+vec2(e,0.0),b,uRadius)-sdf(p-vec2(e,0.0),b,uRadius),
    sdf(p+vec2(0.0,e),b,uRadius)-sdf(p-vec2(0.0,e),b,uRadius)
  );
  g = length(g) > 0.0001 ? normalize(g) : vec2(0.0);
  // banda lente: 0 al centro (vetro piatto) -> 1 al bordo (curva)
  float edge = smoothstep(-uBand, 0.0, d);
  float lens = pow(edge, 1.6);
  // campiona lo sfondo spingendo verso l'interno sui bordi (magnificazione)
  vec2 baseUv = uTexOff + vUv*uTexScale;
  vec2 dUv = (-g * lens * uDispl) / uBgPx;
  vec2 abUv = (-g * lens * uAberr) / uBgPx;
  vec2 ctr = baseUv + dUv;
  // FROST: box-blur 3x3 → vetro setoso, niente puntini sgranati. Ogni canale con
  // la sua piccola aberrazione (frangia iridescente sui bordi).
  vec2 bl = vec2(2.1) / uBgPx;
  vec3 refr = vec3(0.0);
  float wsum = 0.0;
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      vec2 fo = vec2(float(i), float(j));
      float w = exp(-dot(fo, fo) * 0.35); // peso gaussiano → niente griglia
      vec2 o = fo * bl;
      refr.r += texture2D(uBg, ctr + o + abUv).r * w;
      refr.g += texture2D(uBg, ctr + o).g * w;
      refr.b += texture2D(uBg, ctr + o - abUv).b * w;
      wsum += w;
    }
  }
  refr /= wsum;
  // direzione del bordo: up=1 sul bordo ALTO, down=1 sul bordo BASSO
  // (in coord schermo y cresce in basso, quindi g.y<0 = normale verso l'alto)
  float up = clamp(g.y, 0.0, 1.0);
  float down = clamp(-g.y, 0.0, 1.0);
  // contenuto rifratto e sfocato = la luce vera dentro al vetro
  vec3 glass = refr * (1.55 + lens * 1.5);
  // velo di vetro minimo (caldo) — il vetro non è mai nero pieno
  glass += vec3(0.05, 0.042, 0.036);
  // gradiente: vetro illuminato dall'alto (sottile)
  float topGrad = px.y / uSize.y; // px.y è alto in CIMA (asse y-up dello shader)
  glass += vec3(0.09, 0.09, 0.105) * topGrad * topGrad * 0.45;
  // banda-lente luminosa: forte sul bordo ALTO, quasi nulla in basso
  glass += vec3(0.92, 0.94, 1.0) * pow(edge, 2.5) * mix(0.03, 0.22, up);
  // riflesso specular NETTO sul bordo alto (luce dall'alto)
  vec2 L = normalize(vec2(-0.30, 0.95));
  float spec = pow(max(dot(g, L), 0.0), 3.2) * edge;
  glass += vec3(1.0, 0.98, 0.95) * spec * 0.9;
  // riga di luce crisp sul contorno: forte in alto, spenta in basso
  float rim = (1.0 - smoothstep(0.0, 1.6, abs(d)));
  glass += vec3(1.0, 1.0, 1.0) * rim * mix(0.04, 0.6, up);
  // OMBRA sul bordo BASSO → profondità (niente luce indesiderata sotto)
  glass -= vec3(0.06, 0.055, 0.05) * pow(edge, 2.0) * down * 1.3;
  glass = max(glass, 0.0);
  // alpha = dentro la forma (angoli arrotondati, antialias)
  float alpha = 1.0 - smoothstep(-1.0, 0.6, d);
  gl_FragColor = vec4(glass, alpha * 0.95);
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
  displace = 34,
  aberration = 7,
  band = 26,
  className = "",
}: {
  radius?: number;
  displace?: number;
  aberration?: number;
  band?: number;
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
      uDispl: gl.getUniformLocation(prog, "uDispl"),
      uAberr: gl.getUniformLocation(prog, "uAberr"),
      uBand: gl.getUniformLocation(prog, "uBand"),
    };

    let raf = 0;
    let alive = true;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5); // cap: 25 tap/px, leggero sui telefoni

    const frame = () => {
      if (!alive) return;
      const bg = document.querySelector("[data-bg-particles]") as HTMLCanvasElement | null;
      const rect = canvas.getBoundingClientRect();
      if (bg && rect.width > 0 && rect.height > 0) {
        const d = dpr();
        const w = Math.round(rect.width * d);
        const h = Math.round(rect.height * d);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        const bgRect = bg.getBoundingClientRect();
        // upload sfondo come texture
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);
        } catch {
          /* canvas non ancora pronto */
        }
        // la barra dentro lo sfondo (uv). FLIP_Y attivo → l'origine v parte in basso
        const offX = (rect.left - bgRect.left) / bgRect.width;
        const offYtop = (rect.top - bgRect.top) / bgRect.height;
        const sx = rect.width / bgRect.width;
        const sy = rect.height / bgRect.height;
        // con FLIP_Y, v=0 è in basso: convertiamo l'offset top in offset bottom
        const offY = 1.0 - offYtop - sy;
        gl.useProgram(prog);
        gl.uniform1i(U.uBg, 0);
        gl.uniform2f(U.uTexOff, offX, offY);
        gl.uniform2f(U.uTexScale, sx, sy);
        gl.uniform2f(U.uSize, rect.width, rect.height);
        gl.uniform2f(U.uBgPx, bgRect.width, bgRect.height);
        gl.uniform1f(U.uRadius, radius);
        gl.uniform1f(U.uDispl, displace);
        gl.uniform1f(U.uAberr, aberration);
        gl.uniform1f(U.uBand, band);
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
  }, [radius, displace, aberration, band]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full rounded-[26px] ${className}`}
    />
  );
}
