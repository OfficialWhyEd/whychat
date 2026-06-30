import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WORKER_URL } from "../lib/api";

// rampa calda per i dati multi-categoria (mai viola/teal/blu — vedi DESIGN.md)
const WARM = ["#c94b25", "#d65f2e", "#e0673f", "#e98a4c", "#f0a36a", "#d9b07a"];
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * AdminDashboard — la dashboard privata di WhyEd (#admin). Con la password vede
 * gli UTENTI (memorie, note, ultimo accesso) e l'ATTIVITÀ recente. Legge il KV
 * via l'endpoint protetto /api/admin. Apri: officialwhyed.github.io/whychat/#admin
 */

interface Visitor {
  id: string;
  named: boolean;
  name: string | null;
  notes: string[];
  count: number;
  lastSeen: string | null;
}
interface Activity {
  ts: string | null;
  visitor: string | null;
  name: string | null;
  country: string | null;
  mode: string | null;
  user: string;
}
interface DayStat {
  date: string;
  msgs: number;
  modes: Record<string, number>;
  countries: Record<string, number>;
  visitors: number;
}
interface AdminData {
  visitors: Visitor[];
  recent: Activity[];
  daily?: DayStat[];
  stats: {
    visitors: number;
    named?: number;
    logs: number;
    messages?: number;
    byMode?: Record<string, number>;
    byCountry?: Record<string, number>;
  };
}
interface Profile {
  name: string | null;
  summary: string;
  tags: string[];
}

const PASS_KEY = "whychat_admin_pass";

// Dati finti SOLO per l'anteprima localhost (#admin?demo). Mai usati in produzione.
const DEMO_DATA: AdminData = {
  stats: { visitors: 47, named: 19, logs: 312, messages: 1284, byMode: { chat: 540, deep: 188, onlytype: 96, whyearth: 74, whyinsta: 61, group: 33 }, byCountry: { IT: 210, US: 64, DE: 28, FR: 19, ES: 12 } },
  daily: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    const wave = Math.round(18 + 22 * Math.sin(i / 3.1) + (i / 29) * 30 + (i % 5 === 0 ? 16 : 0));
    return { date: d, msgs: Math.max(4, wave), modes: {}, countries: {}, visitors: Math.max(2, Math.round(wave / 4)) };
  }),
  visitors: [
    { id: "n:luca", named: true, name: "Luca", notes: ["sto costruendo un'app di meditazione", "come gestisci l'ansia da prestazione?", "consigliami un font per un brand spirituale"], count: 41, lastSeen: new Date(Date.now() - 120000).toISOString() },
    { id: "n:sara", named: true, name: "Sara", notes: ["mi parli di sincronicità?", "scrivi una poesia sul rame"], count: 23, lastSeen: new Date(Date.now() - 1500000).toISOString() },
    { id: "a:9f2c", named: false, name: null, notes: ["chi sei davvero?", "che modello usi sotto?"], count: 7, lastSeen: new Date(Date.now() - 5400000).toISOString() },
    { id: "n:marco", named: true, name: "Marco", notes: ["fammi una landing per il mio podcast"], count: 12, lastSeen: new Date(Date.now() - 88000000).toISOString() },
    { id: "a:1ab7", named: false, name: null, notes: ["ciao"], count: 2, lastSeen: new Date(Date.now() - 172000000).toISOString() },
  ],
  recent: [
    { ts: new Date(Date.now() - 120000).toISOString(), visitor: "n:luca", name: "Luca", country: "IT", mode: "deep", user: "come gestisci l'ansia da prestazione?" },
    { ts: new Date(Date.now() - 600000).toISOString(), visitor: "a:9f2c", name: null, country: "US", mode: "chat", user: "che modello usi sotto?" },
    { ts: new Date(Date.now() - 1500000).toISOString(), visitor: "n:sara", name: "Sara", country: "IT", mode: "onlytype", user: "scrivi una poesia sul rame" },
    { ts: new Date(Date.now() - 2400000).toISOString(), visitor: "a:77b1", name: null, country: "DE", mode: "whyearth", user: "mostrami Tokyo" },
    { ts: new Date(Date.now() - 5400000).toISOString(), visitor: "n:marco", name: "Marco", country: "IT", mode: "whyinsta", user: "guarda questo reel" },
  ],
};

function rel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return `${Math.floor(s / 86400)} g fa`;
}

export default function AdminDashboard() {
  const [pass, setPass] = useState(() => localStorage.getItem(PASS_KEY) ?? "");
  const [input, setInput] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile | "loading">>({});

  const loadProfile = useCallback(
    async (id: string, p: string) => {
      setProfiles((m) => ({ ...m, [id]: "loading" }));
      try {
        const res = await fetch(`${WORKER_URL}/api/admin/profile?pass=${encodeURIComponent(p)}&id=${encodeURIComponent(id)}`);
        const j = (await res.json()) as Profile;
        setProfiles((m) => ({ ...m, [id]: j }));
      } catch {
        setProfiles((m) => ({ ...m, [id]: { name: null, summary: "(analisi non disponibile)", tags: [] } }));
      }
    },
    [],
  );

  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next && !profiles[next]) loadProfile(next, pass);
  };

  const load = useCallback(async (p: string) => {
    if (!p) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${WORKER_URL}/api/admin?pass=${encodeURIComponent(p)}`);
      if (res.status === 401) {
        setErr("Password sbagliata.");
        setData(null);
        localStorage.removeItem(PASS_KEY);
        setPass("");
        return;
      }
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const j = (await res.json()) as AdminData;
      setData(j);
      localStorage.setItem(PASS_KEY, p);
    } catch (e) {
      setErr((e as Error).message || "Errore di rete");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── azioni admin: libera spazio (prune) + diritto all'oblio (forget) ──────
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const prune = useCallback(async () => {
    if (!confirm("Libero spazio nel KV: cancella i log grezzi più vecchi (tiene gli ultimi 500). Statistiche e memoria utenti restano intatte. Procedo?")) return;
    setBusy("prune");
    setNotice("");
    try {
      const res = await fetch(`${WORKER_URL}/api/admin/prune?pass=${encodeURIComponent(pass)}`, { method: "POST" });
      const j = (await res.json()) as { deleted?: number; kept?: number; error?: string };
      setNotice(j.error ? `Errore: ${j.error}` : `Spazio liberato: ${j.deleted ?? 0} log cancellati, ${j.kept ?? 0} tenuti.`);
      load(pass);
    } catch {
      setNotice("Errore di rete nel prune.");
    } finally {
      setBusy("");
    }
  }, [pass, load]);

  const forget = useCallback(
    async (id: string, label: string) => {
      if (!confirm(`Diritto all'oblio (GDPR): cancello TUTTI i dati di "${label}" (memoria, skill, profilo). Irreversibile. Procedo?`)) return;
      setBusy(id);
      setNotice("");
      try {
        const res = await fetch(`${WORKER_URL}/api/admin/forget?pass=${encodeURIComponent(pass)}&id=${encodeURIComponent(id)}`, { method: "POST" });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        setNotice(j.error ? `Errore: ${j.error}` : `Dati di "${label}" cancellati.`);
        load(pass);
      } catch {
        setNotice("Errore di rete nella cancellazione.");
      } finally {
        setBusy("");
      }
    },
    [pass, load],
  );

  // anteprima visiva SENZA password: solo su localhost con #admin?demo (o &demo).
  // In produzione è inerte (controllo hostname) → nessun buco di sicurezza.
  const demo =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
    (window.location.search.includes("demo") || window.location.hash.includes("demo"));

  useEffect(() => {
    if (demo) setData(DEMO_DATA);
  }, [demo]);

  useEffect(() => {
    if (demo || !pass) return;
    load(pass);
  }, [pass, load, demo]);

  // auto-refresh ogni 20s (vedi chi entra in tempo reale)
  useEffect(() => {
    if (demo || !pass) return;
    const t = setInterval(() => load(pass), 20000);
    return () => clearInterval(t);
  }, [pass, load, demo]);

  // ── schermata password ──────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0d0a08] px-5 text-paper">
        <div className="w-full max-w-sm">
          <a href="#" className="mono mb-6 inline-block text-[0.6rem] text-faint hover:text-paper">← WhyChat</a>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mb-6 text-[0.85rem] text-dim">Controllo utenti e attività di WhyChat.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPass(input.trim());
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              placeholder="Password"
              className="w-full rounded-xl border border-[var(--color-line2)] bg-[rgba(0,0,0,0.35)] px-4 py-3 text-paper outline-none ring-signal/40 focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-signal px-4 py-3 font-medium text-void transition hover:bg-signal-soft disabled:opacity-40"
            >
              {loading ? "Entro…" : "Entra"}
            </button>
            {err && <p className="text-[0.8rem] text-signal-soft">{err}</p>}
          </form>
        </div>
      </div>
    );
  }

  const fmtMode = (m: string | null) => (m && m !== "chat" ? m : "");

  // ── Mission Control ───────────────────────────────────────────────────────
  const daily = data.daily ?? [];
  const maxDay = Math.max(1, ...daily.map((d) => d.msgs));
  const peakIdx = daily.reduce((bi, d, i) => (d.msgs > daily[bi].msgs ? i : bi), 0);
  const todayMsgs = daily.length ? daily[daily.length - 1].msgs : 0;
  const avgDay = daily.length ? Math.round(daily.reduce((s, d) => s + d.msgs, 0) / daily.length) : 0;
  const messages = data.stats.messages ?? data.stats.logs;
  const countries = Object.keys(data.stats.byCountry ?? {}).length;
  const modeRamp = Object.entries(data.stats.byMode ?? {}).sort((a, b) => b[1] - a[1]);
  const modeTot = modeRamp.reduce((s, [, n]) => s + n, 0) || 1;

  return (
    <div className="scroll-thin h-[100dvh] overflow-y-auto bg-void text-paper">
      {/* alone caldo in alto, sottile (non glassmorphism: solo profondità) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(120%_100%_at_50%_-20%,rgba(201,75,37,0.14),transparent_70%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-9">
        {/* ── intestazione ── */}
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <a href="#" className="mono text-[0.58rem] uppercase tracking-[0.2em] text-faint transition hover:text-ember">← WhyChat</a>
            <h1 className="mt-1.5 font-[var(--font-display)] text-[2.1rem] leading-none tracking-tight sm:text-[2.6rem]">
              Mission <span className="text-ember">Control</span>
            </h1>
            <div className="mono mt-2 flex items-center gap-2 text-[0.56rem] uppercase tracking-[0.18em] text-faint">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-soft" />
              </span>
              {demo ? "anteprima · dati finti" : "in ascolto · l'anima di WhyEd"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(pass)}
              disabled={demo}
              className="mono rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.56rem] uppercase tracking-wider text-dim transition hover:border-signal/40 hover:text-paper disabled:opacity-30"
            >
              {loading ? "…" : "Aggiorna"}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(PASS_KEY);
                setPass("");
                setData(null);
              }}
              className="mono rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.56rem] uppercase tracking-wider text-faint transition hover:text-signal-soft"
            >
              Esci
            </button>
          </div>
        </header>

        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-signal/30 bg-[rgba(201,75,37,0.08)] px-4 py-2.5 text-[0.8rem] text-paper"
          >
            {notice}
          </motion.div>
        )}

        {/* ── CONSOLE: trend grande + colonna di cifre (asimmetrico, niente 3 card uguali) ── */}
        <section className="mb-7 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line2)] bg-[var(--color-line)] lg:grid-cols-[1.7fr_1fr]">
          {/* trend = protagonista */}
          <div className="bg-[#100c0a] p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="mono text-[0.56rem] uppercase tracking-[0.18em] text-faint">Attività · {daily.length} giorni</span>
              {daily.length > 0 && (
                <span className="mono text-[0.56rem] text-ember/80">picco {daily[peakIdx].msgs} · {daily[peakIdx].date.slice(5)}</span>
              )}
            </div>
            <div className="flex items-baseline gap-2.5">
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="font-[var(--font-mono)] text-[2.75rem] leading-none tabular-nums text-paper"
              >
                {messages.toLocaleString("it-IT")}
              </motion.span>
              <span className="mono text-[0.6rem] uppercase tracking-wider text-faint">messaggi totali</span>
            </div>
            {daily.length > 0 ? (
              <>
                <div className="mt-5 flex h-28 items-end gap-[2px]">
                  {daily.map((d, i) => {
                    const isPeak = i === peakIdx;
                    const isToday = i === daily.length - 1;
                    return (
                      <motion.div
                        key={d.date}
                        className="group relative flex-1 rounded-[2px]"
                        style={{ transformOrigin: "bottom", background: isToday ? "var(--color-signal-soft)" : isPeak ? "var(--color-ember)" : "rgba(201,75,37,0.42)", height: `${Math.max(4, (d.msgs / maxDay) * 100)}%` }}
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        transition={{ delay: i * 0.014, duration: 0.55, ease: EASE }}
                        whileHover={{ filter: "brightness(1.3)" }}
                      >
                        <span className="mono pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-void px-1.5 py-0.5 text-[0.5rem] text-paper opacity-0 ring-1 ring-[var(--color-line2)] transition group-hover:opacity-100">
                          {d.msgs} · {d.date.slice(5)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mono mt-2 flex justify-between text-[0.5rem] text-faint">
                  <span>{daily[0].date.slice(5)}</span>
                  <span>oggi · {todayMsgs}</span>
                </div>
              </>
            ) : (
              <p className="mt-6 text-[0.82rem] text-faint">Lo storico si popola man mano che la gente parla con WhyChat.</p>
            )}
          </div>
          {/* colonna cifre: righe tipografiche separate da hairline, non card */}
          <div className="grid grid-cols-2 bg-[#100c0a] lg:grid-cols-1">
            {[
              { n: data.stats.visitors, l: "persone", sub: data.stats.named != null ? `${data.stats.named} con nome` : "" },
              { n: todayMsgs, l: "oggi", sub: `media ${avgDay}/giorno` },
              { n: countries || "—", l: "paesi", sub: Object.entries(data.stats.byCountry ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" },
              { n: data.stats.logs, l: "log attivi", sub: "≤ 30 giorni" },
            ].map((s, i) => (
              <div key={s.l} className={`flex flex-col justify-center px-5 py-4 ${i % 2 === 0 ? "border-r border-[var(--color-line)] lg:border-r-0" : ""} ${i < 2 ? "border-b border-[var(--color-line)]" : ""} lg:border-b lg:last:border-b-0`}>
                <span className="font-[var(--font-mono)] text-2xl tabular-nums text-paper">{s.n}</span>
                <span className="mono text-[0.52rem] uppercase tracking-wider text-faint">{s.l}</span>
                {s.sub && <span className="mono mt-0.5 text-[0.5rem] text-ember/70">{s.sub}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ── ripartizione modalità: barra proporzionale a rampa calda + legenda ── */}
        {modeRamp.length > 0 && (
          <section className="mb-8">
            <h2 className="mono mb-2.5 text-[0.56rem] uppercase tracking-[0.18em] text-faint">Modalità usate</h2>
            <div className="flex h-2.5 overflow-hidden rounded-full ring-1 ring-[var(--color-line)]">
              {modeRamp.map(([m, n], i) => (
                <motion.div
                  key={m}
                  title={`${m} · ${n}`}
                  style={{ background: WARM[i % WARM.length] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(n / modeTot) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: EASE }}
                />
              ))}
            </div>
            <div className="mono mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.56rem] text-dim">
              {modeRamp.map(([m, n], i) => (
                <span key={m} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: WARM[i % WARM.length] }} />
                  {m} <span className="text-faint">{n}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── utenti: lista editoriale (hairline, non card) ── */}
        <div className="mb-9">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="mono text-[0.56rem] uppercase tracking-[0.18em] text-faint">Persone</h2>
            <span className="mono text-[0.52rem] text-faint">{data.visitors.length}</span>
          </div>
          <div className="border-t border-[var(--color-line)]">
            {data.visitors.length === 0 && <p className="py-4 text-[0.85rem] text-faint">Ancora nessuno.</p>}
            {data.visitors.map((v) => (
              <div key={v.id} className="border-b border-[var(--color-line)]">
                <button onClick={() => toggle(v.id)} className="group flex w-full items-center gap-3.5 py-3.5 text-left">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-[var(--font-display)] text-[0.95rem] transition ${
                      v.named ? "bg-[rgba(201,75,37,0.16)] text-ember ring-1 ring-signal/30" : "bg-[rgba(242,239,233,0.05)] text-faint"
                    }`}
                  >
                    {(v.name ?? "·").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] text-paper group-hover:text-ember">
                      {v.name ?? <span className="text-dim">Anonimo</span>}
                      {!v.named && <span className="mono ml-2 text-[0.5rem] text-faint">{v.id.replace(/^[av]:/, "")}</span>}
                    </span>
                    <span className="mono text-[0.54rem] text-faint">
                      {v.count} messaggi · {rel(v.lastSeen)} · {v.notes.length} note
                    </span>
                  </span>
                  <span className="mono shrink-0 text-[0.7rem] text-faint transition group-hover:text-ember">{open === v.id ? "−" : "+"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open === v.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="overflow-hidden pb-4 pl-[3.25rem]"
                    >
                      <div className="mb-3 rounded-xl border border-signal/20 bg-[rgba(201,75,37,0.05)] p-3.5">
                        <div className="mono mb-1.5 text-[0.5rem] uppercase tracking-[0.18em] text-ember/80">Analisi AI</div>
                        {profiles[v.id] === "loading" || !profiles[v.id] ? (
                          <p className="text-[0.8rem] text-faint">Analizzo le conversazioni…</p>
                        ) : (
                          <>
                            {(profiles[v.id] as Profile).name && !v.name && (
                              <p className="mb-1 text-[0.85rem] text-paper">
                                Probabile nome: <span className="font-semibold text-ember">{(profiles[v.id] as Profile).name}</span>
                              </p>
                            )}
                            <p className="text-[0.84rem] leading-snug text-dim">{(profiles[v.id] as Profile).summary}</p>
                            {(profiles[v.id] as Profile).tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(profiles[v.id] as Profile).tags.map((t, i) => (
                                  <span key={i} className="mono rounded-full bg-[rgba(242,239,233,0.06)] px-2 py-0.5 text-[0.5rem] text-dim">{t}</span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {v.notes.length === 0 ? (
                        <p className="text-[0.8rem] text-faint">Nessuna nota.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {v.notes.map((n, i) => (
                            <li key={i} className="text-[0.82rem] leading-snug text-dim">
                              <span className="text-ember/50">›</span> {n}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => forget(v.id, v.name ?? "Anonimo")}
                        disabled={busy === v.id}
                        className="mono mt-3 text-[0.52rem] uppercase tracking-[0.16em] text-faint transition hover:text-signal-soft disabled:opacity-40"
                      >
                        {busy === v.id ? "Cancello…" : "↳ dimentica (GDPR)"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* ── attività recente: feed dal vivo ── */}
        <div className="mb-9">
          <h2 className="mono mb-2.5 text-[0.56rem] uppercase tracking-[0.18em] text-faint">In diretta</h2>
          <div className="border-t border-[var(--color-line)]">
            {data.recent.length === 0 && <p className="py-4 text-[0.85rem] text-faint">Nessuna attività.</p>}
            {data.recent.map((a, i) => (
              <div key={i} className="flex items-start gap-3.5 border-b border-[var(--color-line)] py-3">
                <span className="mono w-14 shrink-0 pt-0.5 text-[0.5rem] text-faint">{rel(a.ts)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.84rem] text-dim">{a.user || <span className="text-faint">—</span>}</span>
                  <span className="mono mt-0.5 flex items-center gap-2 text-[0.5rem] text-faint">
                    <span className="text-ember/80">{a.name ?? "anon"}</span> · {a.country ?? "??"}
                    {fmtMode(a.mode) && <span className="rounded-full bg-[rgba(201,75,37,0.12)] px-1.5 py-px text-ember/90">{fmtMode(a.mode)}</span>}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── spazio & conformità: banda finale, distinta ── */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line2)] bg-[rgba(201,75,37,0.04)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <h2 className="mono mb-1.5 text-[0.56rem] uppercase tracking-[0.18em] text-ember/80">Spazio & conformità</h2>
            <p className="text-[0.78rem] leading-relaxed text-dim">
              Log grezzi cancellati dopo <span className="text-paper">30 giorni</span>, statistiche compatte senza testo personale, IP solo in hash. A norma e leggero.
            </p>
          </div>
          <button
            onClick={prune}
            disabled={busy === "prune" || demo}
            className="mono shrink-0 self-start rounded-full bg-signal px-4 py-2 text-[0.58rem] uppercase tracking-[0.16em] text-void transition hover:bg-signal-soft disabled:opacity-40 sm:self-auto"
          >
            {busy === "prune" ? "Libero…" : "Libera spazio"}
          </button>
        </section>
      </div>
    </div>
  );
}
