import { renderMarkdown } from "../lib/markdown";
import { parseSegments } from "../lib/artifacts";
import Artifact from "./Artifact";
import WhyMark from "./WhyMark";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
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
        {parseSegments(msg.content || "").map((seg, i) =>
          seg.type === "artifact" ? (
            <Artifact key={i} title={seg.title} html={seg.html} building={seg.building} />
          ) : (
            <div
              key={i}
              className={`wc-prose text-[0.95rem] leading-[1.7] text-dim ${
                msg.streaming && i === 0 ? "" : ""
              }`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
            />
          ),
        )}
        {msg.streaming && <span className="caret" />}
      </div>
    </div>
  );
}
