/**
 * Count-up sui numeri "da risultato" nei messaggi del bot.
 * Edo: «quando è intelligente mostrare un numero o un risultato fai questa
 * animazione (ovviamente non TUTTI i numeri se no è un casino)».
 *
 * Strategia sicura: NON tocchiamo il markdown. Dopo il render, camminiamo i soli
 * nodi di testo (saltando link, codice, pre) e animiamo solo i numeri che
 * sembrano un risultato: interi ≥ 1000 (con o senza separatori) e percentuali.
 * Anni (1900–2099) esclusi. Una sola volta, quando entrano nel viewport, e mai
 * se l'utente preferisce meno movimento.
 */

const SKIP_TAGS = new Set(["A", "CODE", "PRE", "SCRIPT", "STYLE"]);
// interi ≥1000 (con separatori . o , o spazio) oppure percentuali (anche decimali)
const NUM_RE = /\b(\d{1,3}(?:[., \s]\d{3})+|\d{4,})(?!\s*[–-])\b|\b(\d{1,3}(?:[.,]\d+)?)\s?%/g;

function isYear(n: number): boolean {
  return Number.isInteger(n) && n >= 1900 && n <= 2099;
}

// "1.234" / "1,234" / "1 234" → 1234 ; "47,2" → 47.2
function parseNum(raw: string): number {
  const cleaned = raw.replace(/[ \s]/g, "");
  // se ha sia '.' che ',' l'ultimo è il decimale; qui i risultati interi non hanno decimali
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) return parseInt(cleaned.replace(/[.,]/g, ""), 10);
  return parseFloat(cleaned.replace(",", "."));
}

interface Target {
  el: HTMLElement;
  to: number;
  suffix: string;
  decimals: number;
  grouped: boolean;
}

function format(v: number, t: Target): string {
  const s = t.decimals
    ? v.toLocaleString("it-IT", { minimumFractionDigits: t.decimals, maximumFractionDigits: t.decimals })
    : t.grouped
      ? Math.round(v).toLocaleString("it-IT")
      : String(Math.round(v));
  return s + t.suffix;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Trova i numeri-risultato dentro `root`, li avvolge e li anima una volta sola. */
export function animateNumbersIn(root: HTMLElement | null): void {
  if (!root || root.dataset.numDone === "1") return;
  root.dataset.numDone = "1";
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p && p !== root) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NUM_RE.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  const targets: Target[] = [];
  for (const tn of textNodes) {
    const text = tn.nodeValue || "";
    NUM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let last = 0;
    const frag = document.createDocumentFragment();
    let touched = false;
    while ((m = NUM_RE.exec(text))) {
      const raw = m[1] ?? m[2];
      const isPct = m[0].includes("%");
      const val = parseNum(raw);
      if (!isFinite(val) || (!isPct && (val < 1000 || isYear(val)))) continue;
      touched = true;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = "wc-num";
      span.textContent = m[0];
      const decimals = isPct && raw.includes(",") ? (raw.split(",")[1]?.length ?? 0) : 0;
      const grouped = !isPct && val >= 1000;
      const t: Target = { el: span, to: val, suffix: isPct ? "%" : "", decimals, grouped };
      span.textContent = format(0, t);
      targets.push(t);
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (touched) {
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      tn.parentNode?.replaceChild(frag, tn);
    }
  }
  if (!targets.length) return;

  const run = () => {
    const t0 = performance.now();
    const DUR = 750;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR);
      const e = easeOut(p);
      for (const t of targets) t.el.textContent = format(t.to * e, t);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // parte quando il blocco è visibile (di solito subito, ma se la chat è lunga
  // aspetta che ci scrolli sopra)
  const io = new IntersectionObserver(
    (entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        run();
      }
    },
    { threshold: 0.2 },
  );
  io.observe(root);
}
