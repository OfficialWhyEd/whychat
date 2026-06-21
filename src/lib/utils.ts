/**
 * cn — unisce classi condizionali. Versione leggera senza dipendenze
 * (clsx/tailwind-merge): accetta stringhe, falsy, array e oggetti
 * { classe: boolean }. Sufficiente per i componenti effetto di WhyChat.
 */
type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, boolean>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") for (const k in v) if (v[k]) out.push(k);
  };
  inputs.forEach(walk);
  return out.join(" ");
}
