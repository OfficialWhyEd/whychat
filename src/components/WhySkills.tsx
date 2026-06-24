import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchSkills,
  saveSkill,
  toggleSkill,
  deleteSkill,
  SKILL_MAX,
  SKILL_INSTR_MAX,
  type WhySkill,
} from "../lib/api";
import WhyMark from "./WhyMark";

/**
 * WhySkills — le istruzioni personalizzate che ogni persona dà a WhyChat.
 * Vivono nel KV per-utente: quelle ATTIVE entrano nel system prompt a ogni
 * richiesta, su qualunque dispositivo. Niente account: ti riconosce comunque.
 */
export default function WhySkills() {
  const [skills, setSkills] = useState<WhySkill[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // editor: id === "" → nuova skill; altrimenti modifica
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instruction, setInstruction] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  const openNew = () => {
    setEditId("");
    setName("");
    setInstruction("");
    setErr("");
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const openEdit = (s: WhySkill) => {
    setEditId(s.id);
    setName(s.name);
    setInstruction(s.instruction);
    setErr("");
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const close = () => setEditId(null);

  const submit = async () => {
    if (!name.trim() || !instruction.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const next = await saveSkill({
        id: editId || undefined,
        name: name.trim(),
        instruction: instruction.trim(),
      });
      setSkills(next);
      setEditId(null);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (id: string) => {
    // ottimistico: gira subito, poi conferma dal server
    setSkills((prev) => prev?.map((s) => (s.id === id ? { ...s, active: !s.active } : s)) ?? prev);
    try {
      setSkills(await toggleSkill(id));
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  const onDelete = async (id: string) => {
    setBusy(true);
    try {
      setSkills(await deleteSkill(id));
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const activeCount = skills?.filter((s) => s.active).length ?? 0;
  const full = (skills?.length ?? 0) >= SKILL_MAX;

  return (
    <div className="scroll-thin relative mx-auto h-[100dvh] max-w-2xl overflow-y-auto px-5 py-12">
      <a href="#" className="mono mb-10 inline-block text-[0.55rem] text-faint hover:text-dim">
        ← TORNA A WHYCHAT
      </a>

      <div className="mb-10 flex flex-col items-center text-center">
        <WhyMark size={52} />
        <h1 className="mt-6 text-[1.8rem] tracking-tight text-paper">
          Le tue <span className="serif-i text-signal">skill</span>
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-faint">
          Istruzioni che dai a WhyChat una volta sola. Quelle accese le rispetta
          in ogni conversazione, su ogni tuo dispositivo. Tipo: <span className="text-dim">«parlami sempre in modo diretto»</span> o
          <span className="text-dim"> «firmati come WhyBot alla fine»</span>.
        </p>
        {skills && (
          <div className="mono mt-4 text-[0.5rem] text-faint">
            {activeCount} ATTIVE · {skills.length}/{SKILL_MAX}
          </div>
        )}
      </div>

      {err && (
        <div className="mb-6 rounded-lg border border-signal/30 bg-signal/5 px-4 py-2.5 text-center text-[0.78rem] text-signal-soft">
          {err}
        </div>
      )}

      {/* nuova skill */}
      {editId === null && (
        <button
          onClick={openNew}
          disabled={full}
          className="mono group mb-8 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-line2)] py-3.5 text-[0.55rem] text-faint transition hover:border-signal/40 hover:text-ember disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition group-hover:rotate-90">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {full ? `MASSIMO ${SKILL_MAX} SKILL` : "NUOVA SKILL"}
        </button>
      )}

      {/* editor */}
      <AnimatePresence>
        {editId !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 overflow-hidden"
          >
            <div className="glass rounded-2xl p-5">
              <div className="mono mb-3 text-[0.5rem] text-signal">
                {editId ? "MODIFICA SKILL" : "NUOVA SKILL"}
              </div>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="Nome breve — es. «Tono diretto»"
                className="w-full rounded-lg border border-[var(--color-line2)] bg-void/40 px-3.5 py-2.5 text-[0.92rem] text-paper outline-none transition placeholder:text-faint focus:border-signal/50"
              />
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value.slice(0, SKILL_INSTR_MAX))}
                placeholder="Cosa deve fare WhyChat? Scrivilo come lo diresti a una persona."
                rows={4}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
                }}
                className="scroll-thin mt-2.5 w-full resize-none rounded-lg border border-[var(--color-line2)] bg-void/40 px-3.5 py-2.5 text-[0.92rem] leading-relaxed text-paper outline-none transition placeholder:text-faint focus:border-signal/50"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="mono text-[0.46rem] text-faint">
                  ⌘↵ PER SALVARE
                </span>
                <span className="mono text-[0.46rem] text-faint">
                  {instruction.length}/{SKILL_INSTR_MAX}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={submit}
                  disabled={!name.trim() || !instruction.trim() || busy}
                  className="mono flex-1 rounded-lg bg-signal py-2.5 text-[0.55rem] text-paper transition hover:bg-signal-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "SALVO…" : "SALVA"}
                </button>
                <button
                  onClick={close}
                  className="mono rounded-lg border border-[var(--color-line2)] px-4 py-2.5 text-[0.55rem] text-faint transition hover:text-dim"
                >
                  ANNULLA
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* lista */}
      {skills && skills.length === 0 && editId === null && (
        <p className="serif-i mt-4 text-center text-faint">
          Ancora nessuna skill. La prima cambia tutto.
        </p>
      )}

      <div className="flex flex-col gap-3 pb-24">
        <AnimatePresence initial={false}>
          {skills?.map((s) => (
            <motion.article
              key={s.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`group rounded-2xl border px-4 py-3.5 transition ${
                s.active
                  ? "border-signal/25 bg-signal/[0.04]"
                  : "border-[var(--color-line)] bg-transparent"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* toggle */}
                <button
                  onClick={() => onToggle(s.id)}
                  title={s.active ? "Attiva — clic per spegnere" : "Spenta — clic per accendere"}
                  className={`mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition ${
                    s.active ? "bg-signal" : "bg-[var(--color-line2)]"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className={`block h-[14px] w-[14px] rounded-full bg-paper ${s.active ? "ml-auto" : ""}`}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`truncate text-[0.95rem] ${s.active ? "text-paper" : "text-dim"}`}>
                      {s.name}
                    </h3>
                    {!s.active && <span className="mono text-[0.42rem] text-faint">SPENTA</span>}
                  </div>
                  <p className={`mt-1 whitespace-pre-wrap text-[0.82rem] leading-relaxed ${s.active ? "text-dim" : "text-faint"}`}>
                    {s.instruction}
                  </p>
                </div>

                {/* azioni */}
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(s)}
                    title="Modifica"
                    className="rounded-md p-1.5 text-faint transition hover:bg-[var(--color-line)] hover:text-ember"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    title="Elimina"
                    className="rounded-md p-1.5 text-faint transition hover:bg-signal/10 hover:text-signal"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
