import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { groupTurn, groupPredict, type GroupAgentMeta, type GroupMsg, type DeepResult } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import { Spinner } from "./Spinner";

/**
 * Group Prediction (beta) — la simulazione stile MiroFish in chat:
 * dai uno scenario, tanti agenti discutono/simulano fra loro (ognuno con la sua
 * voce e colore), con "sta scrivendo…" e ritardi realistici, finché il cerchio
 * si chiude e arriva la PREDIZIONE. Puoi intervenire quando tocca a te.
 */
type Item = { who: GroupAgentMeta | null; content: string }; // who null = utente
type Phase = "intro" | "running" | "waiting" | "predicting" | "done";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const toMsgs = (items: Item[]): GroupMsg[] => items.map((i) => ({ agent: i.who ? i.who.id : "user", content: i.content }));

export default function GroupChat({ onExit }: { onExit: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [typing, setTyping] = useState<GroupAgentMeta | null>(null);
  const [prediction, setPrediction] = useState<DeepResult | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const topicRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, typing, phase]);

  const predict = async (current: Item[]) => {
    setPhase("predicting");
    try {
      const p = await groupPredict(toMsgs(current), topicRef.current);
      if (!aliveRef.current) return;
      setPrediction(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (aliveRef.current) setPhase("done");
    }
  };

  // fa parlare gli agenti finché tocca all'utente o il cerchio si chiude
  const runLoop = async (start: Item[]) => {
    let current = start;
    setPhase("running");
    for (let i = 0; i < 12; i++) {
      if (!aliveRef.current) return;
      setTyping(null);
      let turn;
      try {
        turn = await groupTurn(toMsgs(current));
      } catch (e) {
        setError((e as Error).message);
        setPhase("waiting");
        return;
      }
      if (!aliveRef.current) return;
      setTyping(turn.agent); // "sta scrivendo…" con l'agente scelto
      await sleep(650 + Math.min(turn.content.length * 11, 1500));
      if (!aliveRef.current) return;
      current = [...current, { who: turn.agent, content: turn.content }];
      setItems(current);
      setTyping(null);
      if (turn.next === "user") {
        setPhase("waiting");
        return;
      }
      if (turn.next === "done") {
        await predict(current);
        return;
      }
      await sleep(450);
    }
    setPhase("waiting"); // tetto di sicurezza
  };

  const submit = () => {
    const t = value.trim();
    if (!t || phase === "running" || phase === "predicting") return;
    setError("");
    if (phase === "intro") topicRef.current = t;
    const next = [...items, { who: null, content: t }];
    setItems(next);
    setValue("");
    runLoop(next);
  };

  const busy = phase === "running" || phase === "predicting";

  return (
    <div className="flex h-full flex-col">
      {/* barra modalità con uscita */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2">
        <div className="mono flex items-center gap-2 text-[0.55rem] text-ember">
          <span className="text-signal">✦</span> GROUP PREDICTION · BETA
        </div>
        <button onClick={onExit} className="mono rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:text-paper">
          ESCI ✕
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {phase === "intro" && items.length === 0 ? (
            <div className="rise mt-6 flex flex-col items-center text-center">
              <div className="mono mb-2 text-[0.55rem] text-ember">GROUP PREDICTION · BETA</div>
              <h2 className="serif-i mb-2 text-[1.5rem] text-paper">Una stanza di menti che prevede.</h2>
              <p className="max-w-md text-balance text-[0.95rem] font-light leading-relaxed text-dim">
                Dai uno scenario o una domanda sul futuro. Più agenti — scettico, tecnico, visionario… — la
                simulano insieme, discutono, e alla fine emerge una <span className="text-ember">predizione</span>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((it, i) => (
                <Bubble key={i} item={it} />
              ))}
              <AnimatePresence>{typing && <Typing agent={typing} />}</AnimatePresence>
              {phase === "predicting" && (
                <div className="flex items-center gap-2 px-1 text-ember">
                  <Spinner variant="infinite" size={22} />
                  <span className="mono text-[0.6rem]">IL CERCHIO SI CHIUDE · STO PREDICENDO…</span>
                </div>
              )}
              {prediction && <PredictionCard p={prediction} />}
            </div>
          )}
          {error && <p className="mt-3 text-center text-xs text-signal-soft">⚠ {error}</p>}
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* input proprio della modalità gruppo */}
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <div className="glass glass-sheen flex flex-1 items-end rounded-[22px] p-2 pl-4">
            <textarea
              value={value}
              rows={1}
              disabled={busy}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                phase === "intro" ? "Scrivi uno scenario o una domanda sul futuro…" : busy ? "Gli agenti stanno discutendo…" : "Intervieni nella discussione…"
              }
              className="max-h-[140px] flex-1 resize-none bg-transparent py-2 text-[0.98rem] leading-relaxed text-paper placeholder:text-faint focus:outline-none"
            />
            <motion.button
              onClick={submit}
              disabled={busy || !value.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-35"
              style={{ background: "linear-gradient(180deg,#e0673f,#c94b25)" }}
              title="Invia"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="#0a0908" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ item }: { item: Item }) {
  if (!item.who) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="flex justify-end"
      >
        <div className="max-w-[78%] rounded-2xl rounded-br-md border border-[var(--color-line2)] bg-[rgba(242,239,233,0.06)] px-4 py-2.5 text-[0.95rem] leading-relaxed text-paper">
          {item.content}
        </div>
      </motion.div>
    );
  }
  const c = item.who.color;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className="flex items-start gap-2.5"
    >
      <div
        className="mono mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold"
        style={{ background: `${c}22`, color: c, border: `1px solid ${c}66` }}
        title={item.who.name}
      >
        {item.who.initial}
      </div>
      <div className="min-w-0">
        <div className="mb-0.5 text-[0.6rem]" style={{ color: c }}>
          {item.who.name}
        </div>
        <div className="inline-block rounded-2xl rounded-tl-md border border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)] px-3.5 py-2 text-[0.92rem] leading-relaxed text-dim">
          {item.content}
        </div>
      </div>
    </motion.div>
  );
}

function Typing({ agent }: { agent: GroupAgentMeta }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5"
    >
      <div
        className="mono grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold"
        style={{ background: `${agent.color}22`, color: agent.color, border: `1px solid ${agent.color}66` }}
      >
        {agent.initial}
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)] px-3 py-2.5">
        {[0, 0.15, 0.3].map((d) => (
          <motion.span
            key={d}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: agent.color }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: d }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function PredictionCard({ p }: { p: DeepResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass-sheen mt-2 overflow-hidden rounded-2xl border border-signal/40 bg-[rgba(201,75,37,0.06)]"
    >
      <div className="mono flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5 text-[0.55rem] text-ember">
        <span className="text-signal">✦</span> PREDIZIONE DEL GRUPPO
      </div>
      <div
        className="wc-prose px-4 py-3 text-[0.95rem] leading-[1.7] text-dim"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(p.text) }}
      />
      {p.thoughts && (
        <details className="border-t border-[var(--color-line)]">
          <summary className="mono cursor-pointer list-none px-4 py-2 text-[0.5rem] text-faint hover:text-dim [&::-webkit-details-marker]:hidden">
            ↳ COME CI SONO ARRIVATI
          </summary>
          <div
            className="wc-prose px-4 py-2 text-[0.8rem] leading-[1.6] text-faint"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(p.thoughts) }}
          />
        </details>
      )}
    </motion.div>
  );
}
