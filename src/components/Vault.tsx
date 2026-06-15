import { useState } from "react";
import { WORKER_URL } from "../lib/api";
import WhyMark from "./WhyMark";

interface Entry {
  ts: string;
  visitorId: string;
  name: string | null;
  ipHash: string;
  country: string;
  user: string;
  whychat: string;
}

/** Report privato: tutto ciò che la gente ha detto a WhyChat. Solo per Edoardo. */
export default function Vault() {
  const [token, setToken] = useState(sessionStorage.getItem("whychat:admin") ?? "");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${WORKER_URL}/api/vault?limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status === 401 ? "passphrase errata" : `errore ${res.status}`);
      const data = (await res.json()) as { entries: Entry[] };
      sessionStorage.setItem("whychat:admin", token);
      setEntries(data.entries);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scroll-thin mx-auto h-full max-w-3xl overflow-y-auto px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <WhyMark size={36} />
        <div>
          <div className="mono text-[0.55rem] text-signal">/// VAULT — MEMORIA DI WHYCHAT</div>
          <div className="text-lg text-paper">Cosa ti ha detto la gente</div>
        </div>
      </div>

      <div className="glass mb-8 flex gap-2 rounded-2xl p-2 pl-4">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="passphrase"
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

      {entries && (
        <div className="mb-4 mono text-[0.55rem] text-faint">{entries.length} VOCI</div>
      )}

      <div className="flex flex-col gap-3 pb-20">
        {entries?.map((e, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-line)] bg-[rgba(242,239,233,0.02)] p-4">
            <div className="mono mb-2 flex flex-wrap gap-x-3 text-[0.5rem] text-faint">
              <span>{new Date(e.ts).toLocaleString("it-IT")}</span>
              <span className="text-signal">{e.name || e.visitorId}</span>
              <span>{e.country}</span>
              <span>#{e.ipHash}</span>
            </div>
            <div className="mb-2 text-[0.92rem] text-paper">{e.user}</div>
            <div className="border-l-2 border-[var(--color-line2)] pl-3 text-[0.85rem] leading-relaxed text-faint">
              {e.whychat}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
