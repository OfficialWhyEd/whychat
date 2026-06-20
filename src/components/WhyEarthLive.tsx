import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * WhyEarthLive — la "mappa viva" di WhyEarth (il sogno): un globo MapLibre vero.
 * NON sostituisce il globo a puntini d3 — è una vista in più. Quando la chat
 * nomina un luogo, qui il globo ci vola sopra e pianta il pin crimson.
 * Caricata in lazy: maplibre-gl entra nel bundle solo quando apri questa vista.
 */

export interface MapPin {
  lng: number;
  lat: number;
  name: string;
}

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function WhyEarthLive({ focus, onExit }: { focus: MapPin | null; onExit?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // init una volta
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: [12.5, 41.9], // Italia, come casa
      zoom: 1.5,
      attributionControl: { compact: true },
      renderWorldCopies: false,
    });
    mapRef.current = map;
    map.on("style.load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* proiezione globe non supportata: resta piatta, funziona comunque */
      }
      map.resize();
    });
    // resize di sicurezza: a volte il container ha dimensione 0 al primo frame
    const t1 = window.setTimeout(() => map.resize(), 150);
    const t2 = window.setTimeout(() => map.resize(), 600);
    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // vola sul luogo + pianta/sposta il pin crimson
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const place = () => {
      map.flyTo({ center: [focus.lng, focus.lat], zoom: 4.3, duration: 2600, essential: true });
      if (!markerRef.current) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:15px;height:15px;border-radius:9999px;background:#c94b25;border:1.5px solid #f2efe9;box-shadow:0 0 0 3px rgba(201,75,37,.28),0 0 16px rgba(201,75,37,.85)";
        markerRef.current = new maplibregl.Marker({ element: el });
      }
      markerRef.current.setLngLat([focus.lng, focus.lat]).addTo(map);
    };
    if (map.isStyleLoaded()) place();
    else map.once("load", place);
  }, [focus]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      <div ref={ref} className="absolute inset-0" />
      {focus && (
        <div className="mono pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.72)] px-3 py-1 text-[0.55rem] text-paper backdrop-blur">
          📍 {focus.name}
        </div>
      )}
      {onExit && (
        <button
          onClick={onExit}
          className="mono absolute left-4 top-4 z-10 rounded-full border border-[var(--color-line2)] bg-[rgba(16,13,11,0.6)] px-2.5 py-1.5 text-[0.5rem] text-faint backdrop-blur transition hover:border-signal/50 hover:text-paper"
        >
          ESCI ✕
        </button>
      )}
    </div>
  );
}
