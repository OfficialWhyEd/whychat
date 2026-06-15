// Divide il testo di un messaggio in segmenti: testo normale e artifact (canvas vivi).
// Gestisce anche il caso streaming, dove il blocco ```whyart è ancora aperto.

export type Segment =
  | { type: "text"; text: string }
  | { type: "artifact"; title: string; html: string; building: boolean };

const FENCE = "```whyart";

export function parseSegments(src: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;

  while (i < src.length) {
    const start = src.indexOf(FENCE, i);
    if (start === -1) {
      const text = src.slice(i);
      if (text) out.push({ type: "text", text });
      break;
    }

    // testo prima dell'artifact
    const before = src.slice(i, start);
    if (before) out.push({ type: "text", text: before });

    // riga di apertura: ```whyart [titolo]
    const lineEnd = src.indexOf("\n", start);
    const fenceLine = src.slice(start + FENCE.length, lineEnd === -1 ? undefined : lineEnd);
    const title = fenceLine.trim() || "artifact";
    const bodyStart = lineEnd === -1 ? src.length : lineEnd + 1;

    // chiusura
    const close = src.indexOf("```", bodyStart);
    if (close === -1) {
      // ancora in costruzione (streaming)
      out.push({ type: "artifact", title, html: src.slice(bodyStart), building: true });
      break;
    }
    out.push({ type: "artifact", title, html: src.slice(bodyStart, close).trim(), building: false });
    i = close + 3;
  }

  return out;
}
