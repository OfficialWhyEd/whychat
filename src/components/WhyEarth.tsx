import { useEffect, useRef, useState, useCallback } from "react";
import createGlobe from "cobe";
import { motion, AnimatePresence } from "framer-motion";
import { WORKER_URL } from "../lib/api";

/**
 * WhyEarth — il mondo al centro, interattivo. Globo a puntini (cobe/WebGL) nei
 * colori del brand: ruota da solo, lo trascini, CERCHI un luogo (geocoding
 * keyless) e ACCENDI/SPEGNI livelli reali: terremoti (USGS, 24h) e voli in tempo
 * reale (adsb.lol via worker). Niente chat fantasma: questa modalità ha i suoi
 * comandi, si esce con ESCI.
 */

type CMarker = { location: [number, number]; size: number; color: [number, number, number] };
type Place = { name: string; country: string; lat: number; lng: number };

const C_PLACE: [number, number, number] = [1, 0.84, 0.58]; // bianco-oro
const C_QUAKE: [number, number, number] = [0.85, 0.28, 0.14]; // cremisi
const C_FLIGHT: [number, number, number] = [0.96, 0.66, 0.32]; // ambra

export default function WhyEarth({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef<CMarker[]>([]);

  const [place, setPlace] = useState<Place | null>(null);
  const [quakes, setQuakes] = useState<CMarker[]>([]);
  const [flights, setFlights] = useState<CMarker[]>([]);
  const [quakesOn, setQuakesOn] = useState(false);
  const [flightsOn, setFlightsOn] = useState(false);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [recent, setRecent] = useState<Place[]>([]);

  // rotazione
  const phi = useRef(0);
  const theta = useRef(0.2);
  const targetPhi = useRef<number | null>(null);
  const targetTheta = useRef<number | null>(null);
  const hold = useRef(false);
  const drag = useRef<{ x: number; y: number; phi: number; theta: number } | null>(null);

  // ricompone i marcatori visibili ad ogni cambio
  useEffect(() => {
    markersRef.current = [
      ...(place ? [{ location: [place.lat, place.lng] as [number, number], size: 0.085, color: C_PLACE }] : []),
      ...(quakesOn ? quakes : []),
      ...(flightsOn ? flights : []),
    ];
  }, [place, quakes, flights, quakesOn, flightsOn]);

  const focus = useCallback((lat: number, lng: number) => {
    targetPhi.current = -(lng * Math.PI) / 180 - Math.PI / 2;
    targetTheta.current = Math.max(-0.45, Math.min(0.45, (lat * Math.PI) / 180));
    hold.current = true;
  }, []);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setHint("");
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=it&format=json`,
      );
      const j = (await r.json()) as { results?: { latitude: number; longitude: number; name: string; country?: string }[] };
      const hit = j.results?.[0];
      if (!hit) {
        setHint("Nessun luogo trovato.");
        return;
      }
      const p: Place = { name: hit.name, country: hit.country ?? "", lat: hit.latitude, lng: hit.longitude };
      setPlace(p);
      setRecent((prev) => [p, ...prev.filter((x) => x.name !== p.name)].slice(0, 5));
      focus(p.lat, p.lng);
    } catch {
      setHint("Ricerca non disponibile ora.");
    } finally {
      setBusy(false);
    }
  }, [query, busy, focus]);

  // globo cobe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let raf = 0;
    const begin = () => {
      const w = canvas.offsetWidth;
      if (!w || globe) return;
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: w * 2,
        height: w * 2,
        phi: 0,
        theta: 0.2,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 5.2,
        baseColor: [0.32, 0.22, 0.16],
        markerColor: [0.85, 0.36, 0.18],
        glowColor: [0.22, 0.15, 0.11],
        opacity: 0.95,
        markers: [],
      });
      const tick = () => {
        if (!drag.current) {
          if (targetPhi.current !== null) {
            phi.current += (targetPhi.current - phi.current) * 0.08;
            theta.current += ((targetTheta.current ?? theta.current) - theta.current) * 0.08;
            if (Math.abs(targetPhi.current - phi.current) < 0.002) targetPhi.current = null;
          } else if (!hold.current) {
            phi.current += 0.0035;
          }
        }
        globe!.update({
          phi: phi.current,
          theta: theta.current,
          markers: markersRef.current.map((m) => ({ location: m.location, size: m.size, color: m.color })),
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      requestAnimationFrame(() => (canvas.style.opacity = "1"));
    };
    if (canvas.offsetWidth > 0) begin();
    else {
      const ro = new ResizeObserver((e) => {
        if (e[0]?.contentRect.width > 0) {
          ro.disconnect();
          begin();
        }
      });
      ro.observe(canvas);
    }
    return () => {
      cancelAnimationFrame(raf);
      globe?.destroy();
    };
  }, []);

  // drag
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const down = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, phi: phi.current, theta: theta.current };
      targetPhi.current = null;
      hold.current = false;
      canvas.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      phi.current = drag.current.phi + (e.clientX - drag.current.x) / 200;
      theta.current = Math.max(-0.7, Math.min(0.7, drag.current.theta + (e.clientY - drag.current.y) / 200));
    };
    const up = () => {
      drag.current = null;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  // terremoti (USGS) — caricati sempre, mostrati se accesi
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
        if (!r.ok) return;
        const j = (await r.json()) as { features?: { geometry: { coordinates: number[] }; properties: { mag: number | null } }[] };
        setQuakes(
          (j.features ?? []).slice(0, 240).map((f) => ({
            location: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
            size: Math.max(0.012, ((f.properties.mag ?? 1) + 1) * 0.008),
            color: C_QUAKE,
          })),
        );
      } catch {
        /* il globo resta */
      }
    };
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, []);

  // voli reali — caricati solo quando il livello è acceso (refresh ogni 25s)
  useEffect(() => {
    if (!flightsOn) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${WORKER_URL}/api/flights`);
        if (!r.ok) return;
        const j = (await r.json()) as { flights?: [number, number][] };
        if (!alive) return;
        setFlights(
          (j.flights ?? []).slice(0, 700).map(([lon, lat]) => ({
            location: [lat, lon] as [number, number],
            size: 0.01,
            color: C_FLIGHT,
          })),
        );
      } catch {
        /* nessun volo: il livello resta vuoto */
      }
    };
    load();
    const t = setInterval(load, 25000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [flightsOn]);

  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden">
      <div
        className="pointer-events-none absolute h-[78vmin] w-[78vmin] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(201,75,37,0.12), transparent 62%)" }}
      />
      <canvas
        ref={canvasRef}
        className="aspect-square w-[min(78vmin,640px)] cursor-grab touch-none select-none"
        style={{ opacity: 0, transition: "opacity 1s ease", maxWidth: "100%" }}
      />

      {/* esci */}
      {onExit && (
        <button
          onClick={onExit}
          className="mono absolute left-5 top-5 rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.55)] px-2.5 py-1.5 text-[0.5rem] text-faint backdrop-blur transition hover:border-signal/50 hover:text-paper"
        >
          ESCI ✕
        </button>
      )}

      {/* ricerca */}
      <div className="absolute left-1/2 top-5 w-[min(86%,420px)] -translate-x-1/2">
        <div className="glass glass-sheen flex items-center gap-2 rounded-full px-2 py-1.5 pl-4">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-faint">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Cerca un luogo nel mondo…"
            className="min-w-0 flex-1 bg-transparent text-[0.9rem] text-paper placeholder:text-faint focus:outline-none"
          />
          <motion.button
            onClick={search}
            disabled={busy || !query.trim()}
            whileTap={{ scale: 0.92 }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full disabled:opacity-35"
            style={{ background: "linear-gradient(180deg,#e0673f,#c94b25)" }}
            title="Cerca"
          >
            {busy ? (
              <motion.span
                className="block h-3.5 w-3.5 rounded-full border-2 border-[#0a0908] border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
              />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#0a0908" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </motion.button>
        </div>
        {hint && <p className="mono mt-2 text-center text-[0.55rem] text-signal-soft">{hint}</p>}
      </div>

      {/* scheda luogo */}
      <AnimatePresence>
        {place && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass absolute right-5 top-20 w-[min(58%,220px)] rounded-2xl px-4 py-3"
          >
            <div className="mono text-[0.5rem] tracking-[0.18em] text-ember">LUOGO</div>
            <div className="mt-0.5 text-[1rem] text-paper">{place.name}</div>
            {place.country && <div className="text-[0.7rem] text-faint">{place.country}</div>}
            <div className="mono mt-2 text-[0.5rem] text-dim">
              {place.lat.toFixed(2)}°, {place.lng.toFixed(2)}°
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* livelli on/off */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <LayerToggle on={quakesOn} onClick={() => setQuakesOn((v) => !v)} dot="#c94b25" label="Terremoti" count={quakes.length} />
        <LayerToggle
          on={flightsOn}
          onClick={() => setFlightsOn((v) => !v)}
          dot="#f0a36a"
          label="Voli live"
          count={flights.length}
          loading={flightsOn && flights.length === 0}
        />
      </div>

      {/* ricerche recenti */}
      {recent.length > 0 && (
        <div className="absolute bottom-4 right-4 flex max-w-[55%] flex-wrap justify-end gap-1.5">
          {recent.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setPlace(p);
                focus(p.lat, p.lng);
              }}
              className="mono rounded-full border border-[var(--color-line2)] px-2.5 py-1 text-[0.5rem] text-faint transition hover:border-signal/50 hover:text-paper"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
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
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.6rem] transition ${
        on
          ? "border-signal/45 bg-[rgba(201,75,37,0.14)] text-paper"
          : "border-[var(--color-line2)] bg-[rgba(16,13,11,0.5)] text-faint hover:text-paper"
      }`}
    >
      <span
        className="h-2 w-2 rounded-full transition-opacity"
        style={{ background: dot, opacity: on ? 1 : 0.35, boxShadow: on ? `0 0 8px ${dot}` : "none" }}
      />
      <span className="mono">{label}</span>
      {on && (
        <span className="mono text-[0.5rem] text-faint">{loading ? "…" : count.toLocaleString("it-IT")}</span>
      )}
    </motion.button>
  );
}
