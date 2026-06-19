import { renderMarkdown } from "../lib/markdown";
import { parseSegments } from "../lib/artifacts";
import Artifact from "./Artifact";
import WhyMark from "./WhyMark";
import { ShiningText } from "./ShiningText";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  thoughts?: string; // ragionamento (modalità pensiero profondo)
}

export default function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

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
          <ShiningText text="Sto ragionando…" className="text-[0.95rem]" />
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
      </div>
    </div>
  );
}
