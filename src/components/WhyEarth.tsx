import { useEffect, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule, geoBounds } from "d3-geo";
import { timer } from "d3-timer";

/**
 * WhyEarth — globo terrestre a puntini, dark e nei colori del brand. Ruota da
 * solo, trascini per girarlo, scroll per zoom. (Adattato da un componente d3.)
 * Base per la modalità WhyEarth: il mondo al centro, interattivo.
 */
export default function WhyEarth({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quakeCount, setQuakeCount] = useState(0);

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
    let quakes: [number, number, number][] = []; // terremoti reali [lng, lat, mag]
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
      // terremoti reali (USGS, ultime 24h) — grandezza per magnitudo
      for (const [lng, lat, mag] of quakes) {
        const p = projection([lng, lat]);
        if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) {
          const r = Math.max(1.3, (mag + 1) * 1.05) * s;
          context.beginPath();
          context.arc(p[0], p[1], r, 0, 2 * Math.PI);
          context.fillStyle = mag >= 4 ? "#c94b25" : "#f0a36a";
          context.globalAlpha = 0.85;
          context.fill();
          context.globalAlpha = 1;
        }
      }
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

    const onDown = (e: MouseEvent) => {
      auto = false;
      const sx = e.clientX;
      const sy = e.clientY;
      const sr: [number, number] = [rotation[0], rotation[1]];
      const move = (m: MouseEvent) => {
        rotation[0] = sr[0] + (m.clientX - sx) * 0.4;
        rotation[1] = Math.max(-90, Math.min(90, sr[1] - (m.clientY - sy) * 0.4));
        projection.rotate(rotation);
        render();
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        setTimeout(() => (auto = true), 1200);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 0.92 : 1.08;
      projection.scale(Math.max(radius * 0.6, Math.min(radius * 3, projection.scale() * f)));
      render();
    };
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    load();

    // terremoti reali live (USGS, ultime 24h) — keyless, CORS, browser-direct
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
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className={`relative grid h-full w-full place-items-center ${className}`}>
      <canvas ref={canvasRef} className="cursor-grab active:cursor-grabbing" />
      {loading && !error && <div className="mono absolute text-[0.6rem] text-faint">CARICO IL MONDO…</div>}
      {error && <div className="mono absolute text-[0.6rem] text-signal-soft">{error}</div>}
      <div className="mono pointer-events-none absolute bottom-4 left-4 text-[0.5rem] text-faint">
        TRASCINA · ZOOM
        {quakeCount > 0 && (
          <span className="text-ember"> · ◉ {quakeCount.toLocaleString("it-IT")} TERREMOTI 24h</span>
        )}
      </div>
    </div>
  );
}
