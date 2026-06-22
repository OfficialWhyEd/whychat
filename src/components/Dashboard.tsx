import { useMemo, useState } from "react";
import { WORKER_URL } from "../lib/api";
import WhyMark from "./WhyMark";
import { Counter } from "./effects/AnimatedCounter";
import { GlowCard } from "./GlowCard";

// ── Dashboard di tracciamento (solo Edoardo) ─────────────────────────────────
// Non una lista piatta come /vault, ma una vista AGGREGATA: ogni utente, quante
// richieste, in che modalità, da dove, cosa ha chiesto. Più le statistiche
// globali. Si accende con la memoria KV (oggi spenta finché Edo non crea il
// namespace); senza KV mostra lo stato "memoria non attiva".

interface Entry {
  ts: string;
  visitorId: string;
  name: string | null;
  ipHash: string;
  country: string;
  mode?: string;
  user: string;
  whychat: string;
}

interface Visitor {
  id: string;
  name: string | null;
  count: number;
  modes: Record<string, number>;
  countries: Set<string>;
  first: number;
  last: number;
  samples: Entry[];
}

const MODE_LABEL: Record<string, string> = {
  chat: "Chat",
  deep: "Deep",
  reason: "Ragiona",
  sheet: "OnlyType",
  group: "Gruppo",
  earth: "Earth",
  entropy: "Entropy",
  music: "Music",
  ecosystem: "Ecosystem",
  learn: "Impara",
  canvas: "Canvas",
};

const MODE_COLOR: Record<string, string> = {
  chat: "#c94b25",
  deep: "#7c5cff",
  reason: "#2dd4bf",
  sheet: "#f0a36a",
  group: "#e0673f",
  earth: "#38bdf8",
  entropy: "#d946ef",
  music: "#f43f5e",
  ecosystem: "#84cc16",
  learn: "#facc15",
  canvas: "#fb923c",
};

function flag(cc: string): string {
  if (!cc || cc.length !== 2 || cc === "??") return "🌐";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function Dashboard() {
  const [token, setToken] = useState(sessionStorage.getItem("whychat:admin") ?? "");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr("");
    setNote("");
    try {
      const res = await fetch(`${WORKER_URL}/api/vault?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status === 401 ? "passphrase errata" : `errore ${res.status}`);
      const data = (await res.json()) as { entries: Entry[]; note?: string };
      sessionStorage.setItem("whychat:admin", token);
      setEntries(data.entries ?? []);
      if (data.note) setNote(data.note);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const agg = useMemo(() => {
    const list = entries ?? [];
    const byVisitor = new Map<string, Visitor>();
    const modeCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const dayAgo = Date.now() - 86400_000;
    let last24 = 0;
    for (const e of list) {
      const t = Date.parse(e.ts);
      if (t >= dayAgo) last24++;
      const mode = e.mode || "chat";
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;
      countryCounts[e.country] = (countryCounts[e.country] || 0) + 1;
      let v = byVisitor.get(e.visitorId);
      if (!v) {
        v = { id: e.visitorId, name: e.name, count: 0, modes: {}, countries: new Set(), first: t, last: t, samples: [] };
        byVisitor.set(e.visitorId, v);
      }
      v.count++;
      v.modes[mode] = (v.modes[mode] || 0) + 1;
      v.countries.add(e.country);
      v.first = Math.min(v.first, t);
      v.last = Math.max(v.last, t);
      if (e.name && !v.name) v.name = e.name;
      if (v.samples.length < 6) v.samples.push(e);
    }
    const visitors = [...byVisitor.values()].sort((a, b) => b.last - a.last);
    const topModes = Object.entries(modeCounts).sort((a, b) => b[1] - a[1]);
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { visitors, topModes, topCountries, total: list.length, last24 };
  }, [entries]);

  const maxMode = agg.topModes[0]?.[1] || 1;

  return (
    <div className="scroll-thin mx-auto h-full max-w-5xl overflow-y-auto px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <WhyMark size={36} />
        <div>
          <div className="mono text-[0.55rem] text-signal">/// DASHBOARD — TRACCIAMENTO</div>
          <div className="text-lg text-paper">Ogni persona che entra, e cosa cerca</div>
        </div>
        <a href="#vault" className="mono ml-auto text-[0.5rem] text-faint hover:text-ember">VAULT →</a>
      </div>

      {/* gate passphrase */}
      <div className="glass mb-8 flex gap-2 rounded-2xl p-2 pl-4">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="passphrase admin"
          className="flex-1 bg-transparent py-2 text-paper placeholder:text-faint focus:outline-none"
        />
        <button
          onClick={load}
          disabled={loading || !token}
          className="rounded-xl px-5 py-2 text-sm text-void disabled:opacity-40"
          style={{ background: "linear-gradient(180deg,#e0673f,#c94b25)" }}
        >
          {loading ? "…" : "Apri"}
        </button>
      </div>

      {err && <div className="mb-4 text-sm text-signal-soft">{err}</div>}
      {note && (
        <div className="mb-6 rounded-xl border border-[var(--color-line2)] bg-[rgba(240,163,106,0.06)] p-4 text-[0.8rem] text-ember">
          {note} — la dashboard si accende appena la memoria KV è attiva.
        </div>
      )}

      {entries && (
        <>
          {/* statistiche globali */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Visitatori" value={agg.visitors.length} />
            <Stat label="Richieste totali" value={agg.total} />
            <Stat label="Ultime 24h" value={agg.last24} />
            <Stat label="Paesi" value={agg.topCountries.length} />
          </div>

          {/* distribuzione modalità */}
          <GlowCard glowColor="orange" className="mb-6 p-5">
            <div className="mono mb-3 text-[0.5rem] uppercase tracking-wider text-faint">Modalità usate</div>
            <div className="flex flex-col gap-2">
              {agg.topModes.map(([m, n]) => (
                <div key={m} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[0.72rem] text-dim">{MODE_LABEL[m] ?? m}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(242,239,233,0.06)]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(n / maxMode) * 100}%`, background: MODE_COLOR[m] ?? "#c94b25" }}
                    />
                  </div>
                  <span className="mono w-8 shrink-0 text-right text-[0.6rem] text-faint">{n}</span>
                </div>
              ))}
              {agg.topModes.length === 0 && <div className="text-[0.8rem] text-faint">Ancora nessun dato.</div>}
            </div>
          </GlowCard>

          {/* per-utente */}
          <div className="mono mb-3 text-[0.5rem] uppercase tracking-wider text-faint">
            {agg.visitors.length} visitatori — clicca per espandere
          </div>
          <div className="flex flex-col gap-3 pb-24">
            {agg.visitors.map((v) => {
              const open = openId === v.id;
              const topMode = Object.entries(v.modes).sort((a, b) => b[1] - a[1]);
              return (
                <div key={v.id} className="rounded-2xl border border-[var(--color-line)] bg-[rgba(242,239,233,0.02)]">
                  <button
                    onClick={() => setOpenId(open ? null : v.id)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <span className="text-lg">{flag([...v.countries][0] ?? "??")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.92rem] text-paper">
                        {v.name || <span className="text-faint">anonimo</span>}
                        <span className="mono ml-2 text-[0.5rem] text-faint">{v.id}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {topMode.map(([m, n]) => (
                          <span
                            key={m}
                            className="mono rounded-full px-1.5 py-0.5 text-[0.45rem] uppercase tracking-wide"
                            style={{ background: `${MODE_COLOR[m] ?? "#c94b25"}22`, color: MODE_COLOR[m] ?? "#c94b25" }}
                          >
                            {MODE_LABEL[m] ?? m} {n}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="mono text-[0.6rem] text-ember">{v.count} msg</div>
                      <div className="mono text-[0.45rem] text-faint">{new Date(v.last).toLocaleDateString("it-IT")}</div>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-[var(--color-line)] px-4 pb-4 pt-3">
                      <div className="flex flex-col gap-2.5">
                        {v.samples.map((e, i) => (
                          <div key={i} className="border-l-2 border-[var(--color-line2)] pl-3">
                            <div className="mono mb-0.5 flex gap-2 text-[0.45rem] text-faint">
                              <span>{new Date(e.ts).toLocaleString("it-IT")}</span>
                              <span style={{ color: MODE_COLOR[e.mode || "chat"] }}>{MODE_LABEL[e.mode || "chat"]}</span>
                            </div>
                            <div className="text-[0.82rem] text-dim">{e.user}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[rgba(242,239,233,0.02)] p-4">
      <Counter to={value} className="text-ember" fontSize={30} />
      <div className="mono mt-1 text-[0.5rem] uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}
