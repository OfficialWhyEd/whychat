import { useState } from "react";
import { renderMarkdown } from "../lib/markdown";
import { parseSegments } from "../lib/artifacts";
import Artifact from "./Artifact";
import WhyMark from "./WhyMark";
import { ShiningText } from "./ShiningText";
import { WLoader } from "./WLoader";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  thoughts?: string; // ragionamento (modalità pensiero profondo)
}

export default function ChatMessage({ msg, onRetry }: { msg: Message; onRetry?: () => void }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard non disponibile */
    }
  };

  if (isUser) {
    return (
      <div className="rise flex justify-end px-4">
        <div className="max-w-[78%] rounded-2xl rounded-br-md bg-[rgba(242,239,233,0.06)] px-4 py-2.5 text-[0.95rem] leading-relaxed text-paper border border-[var(--color-line2)]">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="rise flex gap-3 px-4">
      <div className="mt-0.5 shrink-0">
        <WhyMark size={28} active={msg.streaming} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mono mb-1 text-[0.55rem] text-faint">WHYCHAT</div>

        {msg.thoughts && (
          <details className="group mb-3 overflow-hidden rounded-xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)]">
            <summary className="mono flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[0.55rem] text-faint transition-colors hover:text-dim [&::-webkit-details-marker]:hidden">
              <span className="text-signal">✦</span> RAGIONAMENTO
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                className="ml-auto transition-transform duration-200 group-[[open]]:rotate-180"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div
              className="wc-prose border-t border-[var(--color-line)] px-3 py-2.5 text-[0.82rem] leading-[1.6] text-faint"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.thoughts) }}
            />
          </details>
        )}

        {msg.streaming && !msg.content ? (
          <div className="flex items-center gap-2 text-ember">
            <WLoader size={20} />
            <ShiningText text="Sto ragionando…" className="text-[0.95rem]" />
          </div>
        ) : (
          <>
            {parseSegments(msg.content || "").map((seg, i) =>
              seg.type === "artifact" ? (
                <Artifact key={i} title={seg.title} html={seg.html} building={seg.building} />
              ) : (
                <div
                  key={i}
                  className="wc-prose text-[0.95rem] leading-[1.7] text-dim"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
                />
              ),
            )}
            {msg.streaming && <span className="caret" />}
          </>
        )}

        {/* azioni sotto la risposta (solo a risposta completa) */}
        {!msg.streaming && msg.content && (
          <div className="mt-2.5 flex items-center gap-0.5">
            <button
              onClick={copy}
              title={copied ? "Copiato" : "Copia"}
              className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
            </button>
            {onRetry && (
              <button
                onClick={onRetry}
                title="Rigenera"
                className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-[rgba(242,239,233,0.06)] hover:text-paper"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setVote((v) => (v === "up" ? null : "up"))}
              title="Mi piace"
              className={`grid h-7 w-7 place-items-center rounded-md transition hover:bg-[rgba(242,239,233,0.06)] ${vote === "up" ? "text-signal" : "text-faint hover:text-paper"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm0 0 4.5-7.5a1.5 1.5 0 0 1 2.7 1.2L13 9h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 19H7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => setVote((v) => (v === "down" ? null : "down"))}
              title="Non mi piace"
              className={`grid h-7 w-7 place-items-center rounded-md transition hover:bg-[rgba(242,239,233,0.06)] ${vote === "down" ? "text-signal-soft" : "text-faint hover:text-paper"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3zm0 0-4.5 7.5a1.5 1.5 0 0 1-2.7-1.2L11 15H5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.2 5H17" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
