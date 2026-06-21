"use client";

import { useCallback, useState } from "react";

/**
 * HoverPreviewLink — link che, al passaggio del mouse, mostra una card flottante
 * con immagine/titolo/sottotitolo (anteprima delle fonti dalle ricerche).
 * Brandizzato WhyChat, segue il cursore e resta dentro al viewport.
 */
export interface HoverPreviewLinkProps {
  href: string;
  title?: string;
  subtitle?: string;
  image?: string;
  children: React.ReactNode;
}

export function HoverPreviewLink({ href, title, subtitle, image, children }: HoverPreviewLinkProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  const update = useCallback((e: React.MouseEvent) => {
    const cardW = 280;
    const cardH = 210;
    let x = e.clientX - cardW / 2;
    let y = e.clientY - cardH - 18;
    if (x + cardW > window.innerWidth - 16) x = window.innerWidth - cardW - 16;
    if (x < 16) x = 16;
    if (y < 16) y = e.clientY + 22;
    setPos({ x, y });
  }, []);

  const host = (() => {
    try {
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  return (
    <span className="relative">
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="wc-link"
        onMouseEnter={(e) => {
          setVisible(true);
          update(e);
        }}
        onMouseMove={(e) => visible && update(e)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </a>
      {(image || title) && (
        <span
          className="pointer-events-none fixed z-[1000] block w-[280px] origin-bottom transition-[opacity,transform] duration-200"
          style={{
            left: pos.x,
            top: pos.y,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
          }}
        >
          <span className="block overflow-hidden rounded-2xl border border-[var(--color-line2)] bg-[var(--color-void2)] p-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
            {image && (
              <img
                src={image}
                alt={title || ""}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                className="block h-[150px] w-full rounded-xl object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {title && <span className="mt-1.5 block px-1 text-[0.78rem] font-medium text-paper">{title}</span>}
            <span className="mono block px-1 pb-0.5 pt-0.5 text-[0.5rem] text-faint">{subtitle || host}</span>
          </span>
        </span>
      )}
    </span>
  );
}

export default HoverPreviewLink;
