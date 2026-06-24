// office.ts — estrae il TESTO da .docx e .xlsx senza dipendenze nuove.
// docx e xlsx sono archivi ZIP (OOXML): li apriamo con jszip (già nel progetto,
// lazy) e ne ricaviamo il testo, così WhyChat può LEGGERLI davvero invece di
// ricevere solo il nome del file. Gemini non li legge nativamente → conversione
// a testo lato client, coerente con la pipeline "legge tutto".

const MAX = 60000; // tetto di sicurezza sul testo estratto

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

// .docx → testo dei paragrafi (word/document.xml)
export async function docxToText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  // ogni <w:p> = paragrafo (a capo); ogni <w:t> = run di testo; <w:tab/> = tab
  const paras: string[] = [];
  for (const p of xml.split(/<w:p[ >]/).slice(1)) {
    const runs = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1]));
    let line = runs.join("");
    line = line.replace(/<w:tab\/>/g, "\t");
    paras.push(line);
  }
  return paras.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX);
}

// .xlsx → testo tabellare (sharedStrings + ogni foglio) in formato CSV-ish
export async function xlsxToText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);

  // tabella delle stringhe condivise (le celle testuali puntano qui per indice)
  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared: string[] = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => {
    const parts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXmlEntities(t[1]));
    return parts.join("");
  });

  const colOf = (ref: string) => {
    const letters = ref.replace(/[0-9]/g, "");
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1; // 0-based
  };

  const sheetFiles = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();

  const out: string[] = [];
  for (const sf of sheetFiles) {
    const xml = (await zip.file(sf)?.async("string")) ?? "";
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)];
    if (sheetFiles.length > 1) out.push(`# ${sf.replace("xl/worksheets/", "").replace(".xml", "")}`);
    for (const r of rows) {
      const cells: string[] = [];
      for (const c of r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = c[1];
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
        const isStr = /t="s"/.test(attrs);
        const isInline = /t="(inlineStr|str)"/.test(attrs);
        let val = "";
        if (isInline) {
          val = [...c[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXmlEntities(t[1])).join("");
        } else {
          const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(c[2])?.[1] ?? "";
          val = isStr ? shared[Number(v)] ?? "" : decodeXmlEntities(v);
        }
        const idx = ref ? colOf(ref) : cells.length;
        while (cells.length <= idx) cells.push("");
        cells[idx] = val;
      }
      out.push(cells.join("\t"));
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX);
}

export function isDocx(name: string, mime: string): boolean {
  return /\.docx$/i.test(name) || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
export function isXlsx(name: string, mime: string): boolean {
  return /\.xlsx$/i.test(name) || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
