import { useEffect, useRef, useState, useCallback } from "react";
import createGlobe from "cobe";
import { motion, AnimatePresence } from "framer-motion";

/**
 * WhyEarth — il mondo al centro, interattivo. Globo a puntini (cobe/WebGL) nei
 * colori del brand: ruota da solo, lo trascini, e CERCHI un luogo: geocoding
 * keyless (open-meteo) → un marcatore cade e il globo ci gira sopra. In più i
 * terremoti reali delle ultime 24h (USGS) come marcatori vivi.
 */

type Marker = { id: string; location: [number, number]; size: number; kind: "place" | "quake" };
type Place = { name: string; country: string; lat: number; lng: number };

export default function WhyEarth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef<Marker[]>([]);
  const [quakeCount, setQuakeCount] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [hint, setHint] = useState("");
  const [recent, setRecent] = useState<Place[]>([]);

  // controllo rotazione (radianti)
  const phi = useRef(0);
  const theta = useRef(0.2);
  const targetPhi = useRef<number | null>(null);
  const targetTheta = useRef<number | null>(null);
  const hold = useRef(false); // resta fermo sul luogo cercato finché non interagisci
  const drag = useRef<{ x: number; y: number; phi: number; theta: number } | null>(null);

  // porta una posizione [lat,lng] davanti e ci resta
  const focus = useCallback((lat: number, lng: number) => {
    targetPhi.current = -(lng * Math.PI) / 180 - Math.PI / 2;
    targetTheta.current = Math.max(-0.45, Math.min(0.45, (lat * Math.PI) / 180));
    hold.current = true;
  }, []);

  const dropPlace = useCallback(
    (p: Place) => {
      setPlace(p);
      markersRef.current = [
        { id: "place", location: [p.lat, p.lng], size: 0.09, kind: "place" },
        ...markersRef.current.filter((m) => m.kind === "quake"),
      ];
      focus(p.lat, p.lng);
    },
    [focus],
  );

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
      setRecent((prev) => [p, ...prev.filter((x) => x.name !== p.name)].slice(0, 5));
      dropPlace(p);
    } catch {
      setHint("Ricerca non disponibile ora.");
    } finally {
      setBusy(false);
    }
  }, [query, busy, dropPlace]);

  // globo cobe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let raf = 0;

    const start = () => {
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
        baseColor: [0.32, 0.22, 0.16], // terra calda scura
        markerColor: [0.85, 0.36, 0.18], // cremisi/ambra
        glowColor: [0.22, 0.15, 0.11], // alone caldo discreto
        opacity: 0.95,
        markers: [],
      });
      // cobe v2: il loop di rendering lo guidiamo noi con update()
      const tick = () => {
        if (!drag.current) {
          if (targetPhi.current !== null) {
            phi.current += (targetPhi.current - phi.current) * 0.08;
            theta.current += ((targetTheta.current ?? theta.current) - theta.current) * 0.08;
            if (Math.abs(targetPhi.current - phi.current) < 0.002) targetPhi.current = null;
          } else if (!hold.current) {
            phi.current += 0.0035; // auto-rotazione (a meno che tieni un luogo)
          }
        }
        globe!.update({
          phi: phi.current,
          theta: theta.current,
          markers: markersRef.current.map((m) => ({ location: m.location, size: m.size })),
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      requestAnimationFrame(() => (canvas.style.opacity = "1"));
    };

    if (canvas.offsetWidth > 0) start();
    else {
      const ro = new ResizeObserver((e) => {
        if (e[0]?.contentRect.width > 0) {
          ro.disconnect();
          start();
        }
      });
      ro.observe(canvas);
    }
    return () => {
      cancelAnimationFrame(raf);
      globe?.destroy();
    };
  }, []);

  // drag per ruotare a mano
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const down = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, phi: phi.current, theta: theta.current };
      targetPhi.current = null;
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

  // terremoti reali (USGS, 24h) come marcatori vivi
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
        if (!r.ok) return;
        const j = (await r.json()) as { features?: { geometry: { coordinates: number[] }; properties: { mag: number | null } }[] };
        const qs: Marker[] = (j.features ?? []).slice(0, 220).map((f, i) => ({
          id: "q" + i,
          location: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
          size: Math.max(0.02, ((f.properties.mag ?? 1) + 1) * 0.012),
          kind: "quake",
        }));
        markersRef.current = [...markersRef.current.filter((m) => m.kind === "place"), ...qs];
        setQuakeCount(qs.length);
      } catch {
        /* il globo resta comunque */
      }
    };
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, []);

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

      {/* ricerca */}
      <div className="absolute left-1/2 top-5 w-[min(90%,420px)] -translate-x-1/2">
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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#0a0908] disabled:opacity-35"
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
            className="glass absolute right-5 top-20 w-[min(60%,230px)] rounded-2xl px-4 py-3"
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

      {/* HUD */}
      <div className="mono pointer-events-none absolute bottom-4 left-4 flex flex-col gap-1 text-[0.5rem] text-faint">
        <span>TRASCINA · CERCA UN LUOGO</span>
        {quakeCount > 0 && <span className="text-ember">◉ {quakeCount.toLocaleString("it-IT")} TERREMOTI 24h</span>}
      </div>
      {recent.length > 0 && (
        <div className="absolute bottom-4 right-4 flex max-w-[55%] flex-wrap justify-end gap-1.5">
          {recent.map((p) => (
            <button
              key={p.name}
              onClick={() => dropPlace(p)}
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
