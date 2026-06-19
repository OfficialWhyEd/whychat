import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Mostra un link YouTube direttamente in chat in modo ottimizzato e veloce:
 * carica solo la thumbnail (niente iframe finché non clicchi), poi apre il video
 * in un modale. Adattato a WhyChat (niente lucide/next, solo framer-motion).
 */
export function YouTubeEmbed({ id, title = "Video YouTube" }: { id: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return (
    <div className="my-3">
      <button
        onClick={() => setOpen(true)}
        className="group relative block w-full max-w-md overflow-hidden rounded-xl border border-[var(--color-line2)]"
        title={title}
      >
        <img src={thumb} alt={title} loading="lazy" className="w-full transition duration-200 group-hover:brightness-75" />
        <span className="absolute inset-0 grid place-items-center">
          <motion.span
            whileHover={{ scale: 1.12 }}
            transition={{ type: "spring", stiffness: 380, damping: 16 }}
            className="grid h-14 w-14 place-items-center rounded-full shadow-lg"
            style={{ background: "rgba(201,75,37,0.92)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#0a0908">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative aspect-video w-full max-w-3xl"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute -top-11 right-0 grid h-9 w-9 place-items-center rounded-full bg-[rgba(242,239,233,0.12)] text-paper transition hover:bg-[rgba(242,239,233,0.22)]"
                aria-label="Chiudi"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
                title={title}
                className="h-full w-full rounded-xl border border-[var(--color-line2)]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Estrae gli ID dei video YouTube da un testo (watch, youtu.be, embed, shorts). */
export function extractYouTubeIds(text: string): string[] {
  const re = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}
