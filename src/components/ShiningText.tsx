import { motion } from "framer-motion";

/**
 * Testo "shimmer" tipo Claude/ChatGPT mentre pensa: una luce calda scorre sul
 * testo. Adattato a WhyChat (colori brand, framer-motion già in uso, niente cn).
 */
export function ShiningText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <motion.span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: "linear-gradient(110deg, #8a8378 35%, #f0a36a 50%, #8a8378 65%)",
        backgroundSize: "200% 100%",
      }}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
    >
      {text}
    </motion.span>
  );
}
