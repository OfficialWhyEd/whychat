// Divide il testo di un messaggio in segmenti: testo normale e artifact (canvas vivi).
// Robusto: riconosce ```whyart MA ANCHE ```html, ```svg e blocchi ``` che
// contengono HTML/SVG (i modelli — specie i reasoning — non usano sempre whyart).
// Gestisce anche lo streaming (blocco ancora aperto).

export type Segment =
  | { type: "text"; text: string }
  | { type: "artifact"; title: string; html: string; building: boolean };

// apertura di un blocco di codice: cattura la "info string" (es. "whyart titolo", "html", "svg", "")
const FENCE_OPEN = /```([^\n`]*)\n/g;

// il corpo "sembra" HTML/SVG autosufficiente?
const LOOKS_MARKUP = /^\s*<(!doctype|html|svg|body|div|main|section|canvas|style|script|svg)/i;

// avvolge un SVG nudo in un mini-documento centrato su sfondo scuro (estetica WhyEd)
function wrapSvg(svg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#0a0908}svg{max-width:100%;max-height:100%;height:auto}</style></head><body>${svg}</body></html>`;
}

export function parseSegments(src: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;

  while (i < src.length) {
    FENCE_OPEN.lastIndex = i;
    const m = FENCE_OPEN.exec(src);
    if (!m) {
      const text = src.slice(i);
      if (text) out.push({ type: "text", text });
      break;
    }

    const start = m.index;
    const before = src.slice(i, start);
    if (before) out.push({ type: "text", text: before });

    const info = m[1].trim();
    const lang = info.split(/\s+/)[0].toLowerCase();
    const bodyStart = m.index + m[0].length;

    const close = src.indexOf("```", bodyStart);
    const building = close === -1;
    const body = building ? src.slice(bodyStart) : src.slice(bodyStart, close);

    const isSvg = lang === "svg" || /^\s*<svg/i.test(body);
    const isArtifact =
      lang === "whyart" || lang === "html" || isSvg || (lang === "" && LOOKS_MARKUP.test(body));

    if (isArtifact) {
      const title =
        lang === "whyart" ? info.slice(7).trim() || "artifact" : isSvg ? "svg" : "artifact";
      const raw = building ? body : body.trim();
      out.push({ type: "artifact", title, html: isSvg ? wrapSvg(raw) : raw, building });
    } else {
      // blocco di codice normale (non un artifact): lascialo come testo → la chat
      // lo mostra come codice, niente rendering.
      const text = building ? src.slice(start) : src.slice(start, close + 3);
      out.push({ type: "text", text });
    }

    if (building) break;
    i = close + 3;
  }

  return out;
}
