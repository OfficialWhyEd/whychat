import { motion } from "framer-motion";

/**
 * Logo "WhyChat" come FIRMA: una linea centrale (non il contorno) che scrive la
 * parola tratto dopo tratto, in ordine, poi si ritira e ricomincia — in loop,
 * a ritmo naturale. Tecnica = path-draw con pathLength, come l'effetto Apple "hello".
 *
 * Ogni voce dell'array è un tratto (una lettera). Tutti condividono UN solo
 * orologio (stesse `duration`/`repeat`): la sequenza è data dalle `times`, così
 * resta sincronizzata a ogni ripetizione (niente desync da `delay`).
 */
const STROKES = [
  // W (maiuscola)
  "M13,22 C17,40 21,56 25,66 C30,54 34,44 38,38 C42,46 47,58 51,66 C55,56 59,40 63,22",
  // h
  "M70,16 C69,36 70,52 70,66 M70,49 C73,41 87,38 91,47 C93,53 92,60 92,66",
  // y
  "M101,37 C103,49 107,60 114,66 M125,37 C123,51 118,63 112,77 C108,85 102,86 97,83",
  // C (maiuscola)
  "M164,42 C157,31 136,29 129,45 C124,57 131,69 144,70 C154,70 161,65 164,59",
  // h
  "M172,16 C171,36 172,52 172,66 M172,49 C175,41 189,38 193,47 C195,53 194,60 194,66",
  // a
  "M224,45 C217,38 205,40 203,51 C201,61 210,67 218,62 C222,59 224,53 224,46 C223,54 224,62 227,66",
  // t
  "M238,24 C237,40 238,56 238,64 C238,69 243,70 249,67 M230,40 L248,40",
];

export default function SignatureMark({ className = "" }: { className?: string }) {
  const N = STROKES.length;
  // Un LOGO deve restare leggibile: si scrive in fretta, resta COMPLETO per la gran
  // parte del ciclo, e solo alla fine si ritira un attimo e ricomincia.
  const drawPhase = 0.22; // scrittura rapida nel primo 22% del ciclo
  const holdEnd = 0.9; // resta completo fino al 90% (≈ leggibile quasi sempre)
  const eraseEnd = 0.98; // ritiro breve, poi ricomincia

  return (
    <svg viewBox="0 0 262 92" className={className} fill="none" role="img" aria-label="WhyChat">
      {STROKES.map((d, i) => {
        const s = (i / N) * drawPhase + 0.001; // inizio scrittura di questo tratto
        const e = s + drawPhase / N + 0.05; // fine scrittura (con leggera sovrapposizione)
        return (
          <motion.path
            key={i}
            d={d}
            stroke="currentColor"
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 0, 1, 1, 0] }}
            transition={{
              duration: 7,
              times: [0, s, Math.min(e, holdEnd - 0.01), holdEnd, eraseEnd],
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
          />
        );
      })}
    </svg>
  );
}
