import type { Mode } from "../components/CommandComposer";

export interface Opener {
  text: string;
  mode: Mode; // la modalità in cui questa domanda dà il meglio
}

// Pool ampio: la MAGGIOR PARTE legato a una modalità specifica della chat, così
// le aperture fanno scoprire cosa sa fare WhyChat. I "chat" sono i jolly generali.
export const OPENER_POOL: Opener[] = [
  { text: "Disegna il Why Ecosystem", mode: "canvas" },
  { text: "Costruisci una mini-interfaccia", mode: "canvas" },
  { text: "Visualizza un'idea", mode: "canvas" },
  { text: "Musica e codice: stessa cosa?", mode: "deep" },
  { text: "Da dove parto per un progetto?", mode: "deep" },
  { text: "Aiutami a decidere", mode: "deep" },
  { text: "Insegnami, un passo alla volta", mode: "learn" },
  { text: "Come pensi quando crei?", mode: "learn" },
  { text: "Apri un foglio bianco", mode: "sheet" },
  { text: "Schizziamo un pensiero", mode: "sheet" },
  { text: "Chi sei davvero?", mode: "chat" },
  { text: "L'anima di WhyEd, cos'è?", mode: "chat" },
  { text: "Un pensiero per Edoardo", mode: "chat" },
];

const shuffle = <T,>(a: T[]): T[] => {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
};

/**
 * Restituisce un set SIMMETRICO (pari, default 4) e SEMPRE DIVERSO di aperture:
 * la maggior parte legate alle modalità (n-1) + un jolly generale, in ordine casuale.
 */
export function pickOpeners(n = 4): Opener[] {
  const tagged = OPENER_POOL.filter((o) => o.mode !== "chat");
  const general = OPENER_POOL.filter((o) => o.mode === "chat");
  const picked = [...shuffle(tagged).slice(0, n - 1), ...shuffle(general).slice(0, 1)];
  return shuffle(picked);
}
