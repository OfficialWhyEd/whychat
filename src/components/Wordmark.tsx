import { motion } from "framer-motion";
import wordmark from "../assets/wordmark.png";

/**
 * Logo WhyChat — wordmark "WHYCHAT" condensato e pieno (il logo ufficiale).
 * Il PNG (glifi neri su trasparente) viene usato come MASCHERA e ricolorato nei
 * toni paper del brand: resta nitido a qualunque colore e non dipende dallo sfondo.
 * "Vivo" ma sobrio: respira appena (scala/opacità), niente effetto scrittura.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  const mask = {
    WebkitMaskImage: `url(${wordmark})`,
    maskImage: `url(${wordmark})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "left center",
    maskPosition: "left center",
  } as const;

  return (
    <motion.div
      role="img"
      aria-label="WhyChat"
      className={className}
      style={{
        ...mask,
        aspectRatio: "166 / 65",
        background: "linear-gradient(177deg, #f7f4ee 0%, #ded8cd 100%)",
        transformOrigin: "left center",
      }}
      animate={{ scale: [1, 1.018, 1], opacity: [0.94, 1, 0.94] }}
      transition={{ duration: 5.4, ease: "easeInOut", repeat: Infinity }}
    />
  );
}
