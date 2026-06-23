import { useEffect, useState, useCallback } from "react";
import { WORKER_URL } from "../lib/api";

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
interface AdminData {
  visitors: Visitor[];
  recent: Activity[];
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

  useEffect(() => {
    if (pass) load(pass);
  }, [pass, load]);

  // auto-refresh ogni 20s (vedi chi entra in tempo reale)
  useEffect(() => {
    if (!pass) return;
    const t = setInterval(() => load(pass), 20000);
    return () => clearInterval(t);
  }, [pass, load]);

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

  // ── dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#0d0a08] px-4 py-5 text-paper sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <a href="#" className="mono text-[0.6rem] text-faint hover:text-paper">← WhyChat</a>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(pass)}
              className="mono rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.6rem] text-dim transition hover:text-paper"
            >
              {loading ? "…" : "AGGIORNA"}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(PASS_KEY);
                setPass("");
                setData(null);
              }}
              className="mono rounded-full border border-[var(--color-line2)] px-3 py-1.5 text-[0.6rem] text-faint transition hover:text-signal-soft"
            >
              ESCI
            </button>
          </div>
        </header>

        {/* stats */}
        <div className="mb-3 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)] p-4">
            <div className="text-3xl font-semibold tabular-nums">{data.stats.visitors}</div>
            <div className="mono text-[0.55rem] uppercase tracking-wider text-faint">Persone</div>
            {data.stats.named != null && (
              <div className="mono mt-0.5 text-[0.5rem] text-ember/80">{data.stats.named} con nome</div>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)] p-4">
            <div className="text-3xl font-semibold tabular-nums">{data.stats.messages ?? data.stats.logs}</div>
            <div className="mono text-[0.55rem] uppercase tracking-wider text-faint">Messaggi</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)] p-4">
            <div className="text-3xl font-semibold tabular-nums">{Object.keys(data.stats.byCountry ?? {}).length || "—"}</div>
            <div className="mono text-[0.55rem] uppercase tracking-wider text-faint">Paesi</div>
          </div>
        </div>
        {/* ripartizione per modalità */}
        {data.stats.byMode && Object.keys(data.stats.byMode).length > 0 && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            {Object.entries(data.stats.byMode)
              .sort((a, b) => b[1] - a[1])
              .map(([m, n]) => (
                <span key={m} className="mono rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.55rem] text-dim">
                  {m} <span className="text-faint">·</span> <span className="text-ember">{n}</span>
                </span>
              ))}
          </div>
        )}

        {/* visitatori */}
        <h2 className="mono mb-2 text-[0.6rem] uppercase tracking-wider text-faint">Utenti</h2>
        <div className="mb-7 flex flex-col gap-2">
          {data.visitors.length === 0 && <p className="text-[0.85rem] text-faint">Ancora nessun utente.</p>}
          {data.visitors.map((v) => (
            <div key={v.id} className="rounded-2xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)]">
              <button
                onClick={() => toggle(v.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold ${
                    v.named ? "bg-[rgba(201,75,37,0.18)] text-ember" : "bg-[rgba(242,239,233,0.06)] text-dim"
                  }`}
                >
                  {(v.name ?? "·").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.92rem] text-paper">
                    {v.name ?? <span className="text-dim">Anonimo</span>}
                    {!v.named && <span className="mono ml-2 text-[0.5rem] text-faint">{v.id.replace(/^v:/, "")}</span>}
                  </span>
                  <span className="mono text-[0.55rem] text-faint">
                    {v.count} messaggi · {rel(v.lastSeen)} · {v.notes.length} note
                  </span>
                </span>
                <span className="mono shrink-0 text-[0.6rem] text-faint">{open === v.id ? "−" : "+"}</span>
              </button>
              {open === v.id && (
                <div className="border-t border-[var(--color-line)] px-4 py-3">
                  {/* PROFILO AI: l'AI deduce chi è dalle frasi */}
                  <div className="mb-3 rounded-xl border border-signal/25 bg-[rgba(201,75,37,0.06)] p-3">
                    <div className="mono mb-1 text-[0.5rem] uppercase tracking-wider text-ember/80">Analisi AI</div>
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
                              <span key={i} className="mono rounded-full bg-[rgba(242,239,233,0.06)] px-2 py-0.5 text-[0.5rem] text-dim">
                                {t}
                              </span>
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
                          <span className="text-faint">·</span> {n}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* attività recente */}
        <h2 className="mono mb-2 text-[0.6rem] uppercase tracking-wider text-faint">Attività recente</h2>
        <div className="flex flex-col divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line2)] bg-[rgba(242,239,233,0.02)]">
          {data.recent.length === 0 && <p className="px-4 py-3 text-[0.85rem] text-faint">Nessuna attività.</p>}
          {data.recent.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mono w-12 shrink-0 pt-0.5 text-[0.5rem] text-faint">{rel(a.ts)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.82rem] text-dim">{a.user || <span className="text-faint">—</span>}</span>
                <span className="mono text-[0.5rem] text-faint">
                  {a.name ?? "anon"} · {a.country ?? "??"}
                  {fmtMode(a.mode) && ` · ${fmtMode(a.mode)}`}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
