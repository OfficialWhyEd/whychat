import { describe, it, expect } from "vitest";
import { parseSegments } from "./artifacts";

describe("parseSegments — il risultato si vede SEMPRE, comunque sia recintato", () => {
  it("riconosce ```whyart", () => {
    const segs = parseSegments("ecco:\n```whyart Mappa\n<!doctype html><body>ok</body>\n```\nfatto");
    const art = segs.find((s) => s.type === "artifact");
    expect(art).toBeTruthy();
    expect(art && art.type === "artifact" && art.title).toBe("Mappa");
    expect(art && art.type === "artifact" && art.building).toBe(false);
  });

  it("riconosce ```html (i reasoning models usano spesso questo)", () => {
    const segs = parseSegments("```html\n<div>ciao</div>\n```");
    expect(segs.some((s) => s.type === "artifact")).toBe(true);
  });

  it("riconosce ```svg e lo avvolge in un documento", () => {
    const segs = parseSegments("```svg\n<svg><circle r='5'/></svg>\n```");
    const art = segs.find((s) => s.type === "artifact");
    expect(art && art.type === "artifact" && art.html.includes("<svg")).toBe(true);
    expect(art && art.type === "artifact" && art.html.startsWith("<!doctype")).toBe(true);
  });

  it("riconosce un blocco nudo ``` che contiene HTML", () => {
    const segs = parseSegments("```\n<!doctype html><html><body>x</body></html>\n```");
    expect(segs.some((s) => s.type === "artifact")).toBe(true);
  });

  it("NON renderizza un normale blocco di codice (resta testo)", () => {
    const segs = parseSegments("```python\nprint('ciao')\n```");
    expect(segs.every((s) => s.type === "text")).toBe(true);
  });

  it("gestisce lo streaming: blocco ancora aperto = building", () => {
    const segs = parseSegments("```whyart Gioco\n<!doctype html><body>in cor");
    const art = segs.find((s) => s.type === "artifact");
    expect(art && art.type === "artifact" && art.building).toBe(true);
  });

  it("testo semplice resta testo", () => {
    const segs = parseSegments("solo una frase");
    expect(segs).toEqual([{ type: "text", text: "solo una frase" }]);
  });
});
