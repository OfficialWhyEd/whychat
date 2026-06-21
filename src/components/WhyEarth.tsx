import { useEffect, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule, geoBounds } from "d3-geo";
import { timer } from "d3-timer";
import { WORKER_URL, streamChat, geocodePlace, type ChatMessage as ApiMsg } from "../lib/api";

interface Pin {
  lng: number;
  lat: number;
  name: string;
}
const LUOGO_RE = /\[\[LUOGO:\s*([^\]]+)\]\]/gi;

/**
 * WhyEarth — globo terrestre a puntini, dark e nei colori del brand (design
 * originale d3). Ruota da solo, lo trascini (mouse e dito), zoom con la rotella.
 * AGGIUNTE non distruttive: livelli on/off (Terremoti USGS, Voli live adsb.lol)
 * e uscita. Il design del globo è quello di prima, intatto.
 */
export default function WhyEarth({ className = "", onExit }: { className?: string; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quakeCount, setQuakeCount] = useState(0);
  const [flightCount, setFlightCount] = useState(0);
  const [quakesOn, setQuakesOn] = useState(false);
  const [flightsOn, setFlightsOn] = useState(false);

  // i livelli sono letti dentro render() (closure) tramite ref
  const quakesOnRef = useRef(false);
  const flightsOnRef = useRef(false);
  const flightsRef = useRef<[number, number][]>([]); // [lng, lat]
  const renderRef = useRef<() => void>(() => {});
  const pinsRef = useRef<Pin[]>([]);
  const focusRef = useRef<(lng: number, lat: number) => void>(() => {});
  const [pins, setPins] = useState<Pin[]>([]);

  // chat connessa al planetario
  const [chatOpen, setChatOpen] = useState(true);
  const [emsgs, setEmsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [einput, setEinput] = useState("");
  const [ebusy, setEbusy] = useState(false);
  const eAbort = useRef<AbortController | null>(null);

  const addPinsFrom = async (text: string) => {
    const found = [...text.matchAll(LUOGO_RE)].map((m) => m[1].trim()).slice(0, 6);
    if (!found.length) return;
    const geos = await Promise.all(found.map((q) => geocodePlace(q)));
    const fresh = geos.filter((g): g is NonNullable<typeof g> => !!g).map((g) => ({ lng: g.lng, lat: g.lat, name: g.name }));
    if (!fresh.length) return;
    pinsRef.current = [...pinsRef.current, ...fresh].slice(-12);
    setPins(pinsRef.current);
    renderRef.current();
    focusRef.current(fresh[0].lng, fresh[0].lat);
  };

  const askEarth = async () => {
    const t = einput.trim();
    if (!t || ebusy) return;
    setEinput("");
    const hist = [...emsgs, { role: "user" as const, content: t }];
    setEmsgs([...hist, { role: "assistant", content: "" }]);
    setEbusy(true);
    const ctrl = new AbortController();
    eAbort.current = ctrl;
    let acc = "";
    const setLast = (content: string) =>
      setEmsgs((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content };
        return c;
      });
    try {
      await streamChat(
        hist as ApiMsg[],
        (d) => {
          acc += d;
          setLast(acc);
        },
        ctrl.signal,
        "earth",
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setLast(acc || `⚠ ${(e as Error).message}`);
    } finally {
      setEbusy(false);
      eAbort.current = null;
    }
    void addPinsFrom(acc);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const parent = canvas.parentElement;
    const W = Math.min(parent?.clientWidth ?? 800, window.innerWidth);
    const H = Math.min(parent?.clientHeight ?? 600, window.innerHeight);
    const radius = Math.min(W, H) / 2.4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    context.scale(dpr, dpr);

    const projection = geoOrthographic().scale(radius).translate([W / 2, H / 2]).clipAngle(90);
    const path = geoPath(projection, context);

    type Dot = { lng: number; lat: number };
    const dots: Dot[] = [];
    let quakes: [number, number, number][] = []; // [lng, lat, mag]
    let land: { features: unknown[] } | null = null;

    const pointInPolygon = (pt: [number, number], poly: number[][]) => {
      const [x, y] = pt;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const inFeature = (pt: [number, number], f: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }) => {
      const g = f.geometry;
      if (g.type === "Polygon") {
        const c = g.coordinates as number[][][];
        if (!pointInPolygon(pt, c[0])) return false;
        for (let i = 1; i < c.length; i++) if (pointInPolygon(pt, c[i])) return false;
        return true;
      }
      if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates as number[][][][]) {
          if (pointInPolygon(pt, poly[0])) {
            let hole = false;
            for (let i = 1; i < poly.length; i++) if (pointInPolygon(pt, poly[i])) hole = true;
            if (!hole) return true;
          }
        }
      }
      return false;
    };

    const rotation: [number, number] = [0, -15];
    let auto = true;

    const render = () => {
      context.clearRect(0, 0, W, H);
      const s = projection.scale() / radius;
      // oceano
      context.beginPath();
      context.arc(W / 2, H / 2, projection.scale(), 0, 2 * Math.PI);
      context.fillStyle = "#0a0908";
      context.fill();
      context.strokeStyle = "rgba(242,239,233,0.45)";
      context.lineWidth = 1.5 * s;
      context.stroke();
      if (!land) return;
      // graticule
      context.beginPath();
      path(geoGraticule()());
      context.strokeStyle = "rgba(242,239,233,0.16)";
      context.lineWidth = 0.6 * s;
      context.stroke();
      // terre
      context.beginPath();
      for (const f of land.features) path(f as Parameters<typeof path>[0]);
      context.strokeStyle = "rgba(242,239,233,0.4)";
      context.lineWidth = 0.8 * s;
      context.stroke();
      // puntini delle terre
      for (const d of dots) {
        const p = projection([d.lng, d.lat]);
        if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) {
          context.beginPath();
          context.arc(p[0], p[1], 1.1 * s, 0, 2 * Math.PI);
          context.fillStyle = "#7a5238";
          context.fill();
        }
      }
      // pin dei luoghi citati dalla chat — cremisi con alone + etichetta
      for (const pin of pinsRef.current) {
        const p = projection([pin.lng, pin.lat]);
        if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) {
          context.beginPath();
          context.arc(p[0], p[1], 5 * s, 0, 2 * Math.PI);
          context.fillStyle = "rgba(201,75,37,0.25)";
          context.fill();
          context.beginPath();
          context.arc(p[0], p[1], 2.4 * s, 0, 2 * Math.PI);
          context.fillStyle = "#c94b25";
          context.fill();
          context.font = `600 ${Math.round(11 * s)}px "Outfit", system-ui, sans-serif`;
          context.fillStyle = "rgba(242,239,233,0.92)";
          context.textAlign = "left";
          context.fillText(pin.name, p[0] + 8 * s, p[1] + 3 * s);
        }
      }
      // voli live (se accesi) — ambra, piccoli
      if (flightsOnRef.current) {
        context.fillStyle = "#f0a36a";
        context.globalAlpha = 0.9;
        for (const [lng, lat] of flightsRef.current) {
          const p = projection([lng, lat]);
          if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) {
            context.beginPath();
            context.arc(p[0], p[1], 0.9 * s, 0, 2 * Math.PI);
            context.fill();
          }
        }
        context.globalAlpha = 1;
      }
      // terremoti reali (se accesi) — grandezza per magnitudo
      if (quakesOnRef.current) {
        for (const [lng, lat, mag] of quakes) {
          const p = projection([lng, lat]);
          if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) {
            const r = Math.max(1.1, (mag + 1) * 0.85) * s;
            context.beginPath();
            context.arc(p[0], p[1], r, 0, 2 * Math.PI);
            context.fillStyle = mag >= 4 ? "#c94b25" : "#f0a36a";
            context.globalAlpha = 0.85;
            context.fill();
            context.globalAlpha = 1;
          }
        }
      }
    };
    renderRef.current = render;

    // porta il globo a centrare un luogo (chiamato dalla chat sui pin)
    focusRef.current = (lng: number, lat: number) => {
      auto = false;
      rotation[0] = -lng;
      rotation[1] = -lat;
      projection.rotate(rotation);
      render();
      window.setTimeout(() => {
        auto = true;
      }, 6000);
    };

    const load = async () => {
      try {
        const res = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        );
        if (!res.ok) throw new Error("land");
        land = await res.json();
        for (const f of land!.features as { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[]) {
          const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(f as Parameters<typeof geoBounds>[0]);
          const step = 1.3;
          for (let lng = minLng; lng <= maxLng; lng += step)
            for (let lat = minLat; lat <= maxLat; lat += step)
              if (inFeature([lng, lat], f)) dots.push({ lng, lat });
        }
        render();
        setLoading(false);
      } catch {
        setError("Mappa del mondo non disponibile.");
        setLoading(false);
      }
    };

    const t = timer(() => {
      if (auto) {
        rotation[0] += 0.22;
        projection.rotate(rotation);
        render();
      }
    });

    // trascinamento: Pointer Events → funziona con mouse E dito (mobile)
    const onDown = (e: PointerEvent) => {
      auto = false;
      const sx = e.clientX;
      const sy = e.clientY;
      const sr: [number, number] = [rotation[0], rotation[1]];
      canvas.setPointerCapture?.(e.pointerId);
      const move = (m: PointerEvent) => {
        rotation[0] = sr[0] + (m.clientX - sx) * 0.4;
        rotation[1] = Math.max(-90, Math.min(90, sr[1] - (m.clientY - sy) * 0.4));
        projection.rotate(rotation);
        render();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setTimeout(() => (auto = true), 1500);
      };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerup", up);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 0.92 : 1.08;
      projection.scale(Math.max(radius * 0.6, Math.min(radius * 3, projection.scale() * f)));
      render();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    load();

    // terremoti reali live (USGS, ultime 24h) — caricati sempre, mostrati se accesi
    const loadQuakes = async () => {
      try {
        const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
        if (!r.ok) return;
        const j = (await r.json()) as { features?: { geometry: { coordinates: number[] }; properties: { mag: number | null } }[] };
        quakes = (j.features ?? []).map(
          (f) => [f.geometry.coordinates[0], f.geometry.coordinates[1], f.properties.mag ?? 1] as [number, number, number],
        );
        setQuakeCount(quakes.length);
        render();
      } catch {
        /* ignora: il globo resta comunque */
      }
    };
    loadQuakes();
    const quakeTimer = setInterval(loadQuakes, 120000);

    return () => {
      t.stop();
      clearInterval(quakeTimer);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // voli reali — caricati solo quando il livello è acceso (refresh 25s)
  useEffect(() => {
    if (!flightsOn) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${WORKER_URL}/api/flights`);
        if (!r.ok) return;
        const j = (await r.json()) as { flights?: [number, number][] };
        if (!alive) return;
        flightsRef.current = (j.flights ?? []).slice(0, 1800);
        setFlightCount(flightsRef.current.length);
        renderRef.current();
      } catch {
        /* nessun volo */
      }
    };
    load();
    const t = setInterval(load, 25000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [flightsOn]);

  const toggleQuakes = () => {
    const v = !quakesOnRef.current;
    quakesOnRef.current = v;
    setQuakesOn(v);
    renderRef.current();
  };
  const toggleFlights = () => {
    const v = !flightsOnRef.current;
    flightsOnRef.current = v;
    setFlightsOn(v);
    if (!v) renderRef.current();
  };

  return (
    <div className={`relative grid h-full w-full place-items-center ${className}`}>
      <canvas ref={canvasRef} className="cursor-grab touch-none select-none active:cursor-grabbing" />
      {loading && !error && <div className="mono absolute text-[0.6rem] text-faint">CARICO IL MONDO…</div>}
      {error && <div className="mono absolute text-[0.6rem] text-signal-soft">{error}</div>}

      {/* esci */}
      {onExit && (
        <button
          onClick={onExit}
          className="mono absolute left-4 top-4 rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.55)] px-2.5 py-1.5 text-[0.5rem] text-faint backdrop-blur transition hover:border-signal/50 hover:text-paper"
        >
          ESCI ✕
        </button>
      )}

      {/* livelli on/off */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <LayerToggle on={quakesOn} onClick={toggleQuakes} dot="#c94b25" label="Terremoti" count={quakeCount} />
        <LayerToggle on={flightsOn} onClick={toggleFlights} dot="#f0a36a" label="Voli live" count={flightCount} loading={flightsOn && flightCount === 0} />
      </div>

      <div className="mono pointer-events-none absolute bottom-4 left-4 text-[0.5rem] text-faint">TRASCINA · ZOOM</div>

      {/* Chat connessa al planetario: risponde a domande geografiche e pinna i luoghi */}
      <div className="absolute bottom-3 left-1/2 z-10 w-[min(92vw,440px)] -translate-x-1/2">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-line2)] bg-[rgba(16,13,11,0.82)] backdrop-blur-xl">
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <span className="h-2 w-2 rounded-full bg-signal" style={{ boxShadow: "0 0 8px #c94b25" }} />
            <span className="mono text-[0.55rem] text-dim">PLANETARIO · CHAT</span>
            {pins.length > 0 && <span className="mono text-[0.5rem] text-faint">{pins.length} pin</span>}
            <span className="flex-1" />
            {pins.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  pinsRef.current = [];
                  setPins([]);
                  renderRef.current();
                }}
                className="mono cursor-pointer text-[0.5rem] text-faint transition hover:text-signal-soft"
              >
                pulisci
              </span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`text-faint transition-transform ${chatOpen ? "" : "rotate-180"}`}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className={`grid transition-all duration-300 ${chatOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              {emsgs.length > 0 && (
                <div className="scroll-thin max-h-[34vh] overflow-y-auto border-t border-[var(--color-line)] px-3 py-2">
                  {emsgs.map((m, i) => (
                    <div key={i} className={`mb-2 text-[0.82rem] leading-relaxed ${m.role === "user" ? "text-paper" : "text-dim"}`}>
                      <span className="mono mr-1.5 text-[0.5rem] text-faint">{m.role === "user" ? "TU" : "WHY"}</span>
                      {m.content.replace(LUOGO_RE, "").trim() || (m.role === "assistant" && ebusy ? "…" : "")}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-[var(--color-line)] p-2">
                <input
                  value={einput}
                  onChange={(e) => setEinput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      askEarth();
                    }
                  }}
                  disabled={ebusy}
                  placeholder="Dov'è il Kilimangiaro? Capitale del Perù?"
                  className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[0.86rem] text-paper placeholder:text-faint focus:outline-none"
                />
                <button
                  onClick={askEarth}
                  disabled={ebusy || !einput.trim()}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[radial-gradient(125%_120%_at_50%_6%,#ffd2a4,#f0a36a_24%,#d4582c_56%,#8a2f17_100%)] text-[#0a0908] transition disabled:opacity-35"
                  title="Chiedi"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerToggle({
  on,
  onClick,
  dot,
  label,
  count,
  loading,
}: {
  on: boolean;
  onClick: () => void;
  dot: string;
  label: string;
  count: number;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.6rem] transition ${
        on
          ? "border-signal/45 bg-[rgba(201,75,37,0.14)] text-paper"
          : "border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)] text-faint hover:text-paper"
      }`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: dot, opacity: on ? 1 : 0.35, boxShadow: on ? `0 0 8px ${dot}` : "none" }}
      />
      <span className="mono">{label}</span>
      {on && <span className="mono text-[0.5rem] text-faint">{loading ? "…" : count.toLocaleString("it-IT")}</span>}
    </button>
  );
}
