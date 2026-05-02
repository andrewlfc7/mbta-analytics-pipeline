"use client";

import { useEffect, useRef, useState } from "react";
import { clientFetch } from "@/lib/api";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
(mapboxgl as any).setTelemetryEnabled?.(false);

interface SystemMapData {
  routes: GeoJSON.FeatureCollection;
  stations: GeoJSON.FeatureCollection;
}

export function SystemMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!mapboxgl.accessToken) {
      setError("Mapbox token not configured");
      setLoading(false);
      return;
    }

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-71.0589, 42.3601],
      zoom: 11.2,
      attributionControl: false,
      interactive: true,
    });

    map.current = mapInstance;

    mapInstance.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    mapInstance.on("load", async () => {
      try {
        const data = await clientFetch<SystemMapData>("/stations/map/system");

        if (data.routes?.features?.length > 0) {
          mapInstance.addSource("route-lines", {
            type: "geojson",
            data: data.routes,
          });

          mapInstance.addLayer({
            id: "route-lines-layer",
            type: "line",
            source: "route-lines",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": ["get", "color"],
              "line-width": [
                "match",
                ["get", "route_type"],
                0, 3,
                1, 3,
                2, 2,
                4, 2,
                1.5,
              ],
              "line-opacity": 0.85,
            },
          });
        }

        if (data.stations?.features?.length > 0) {
          mapInstance.addSource("stations", {
            type: "geojson",
            data: data.stations,
          });

          mapInstance.addLayer({
            id: "stations-alerts",
            type: "circle",
            source: "stations",
            filter: [">", ["get", "alert_count"], 0],
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "alert_count"],
                1, 10,
                5, 16,
              ],
              "circle-color": "#EF4444",
              "circle-opacity": 0.78,
              "circle-stroke-width": 4,
              "circle-stroke-color": "#FEE2E2",
            },
          });

          mapInstance.addLayer({
            id: "stations-alert-labels",
            type: "symbol",
            source: "stations",
            filter: [">", ["get", "alert_count"], 0],
            layout: {
              "text-field": ["to-string", ["get", "alert_count"]],
              "text-size": 10,
              "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": "#FFFFFF",
            },
          });

          mapInstance.addLayer({
            id: "stations-layer",
            type: "circle",
            source: "stations",
            filter: ["==", ["get", "alert_count"], 0],
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "delay_hotspot_score"],
                0, 4,
                20, 6,
                50, 9,
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "avg_delay_minutes"],
                0, "#22C55E",
                3, "#EAB308",
                6, "#F97316",
                10, "#EF4444",
              ],
              "circle-opacity": 0.82,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
            },
          });

          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: "mbta-popup",
          });

          for (const layerId of ["stations-layer", "stations-alerts"]) {
            mapInstance.on("mouseenter", layerId, (e) => {
              mapInstance.getCanvas().style.cursor = "pointer";

              if (e.features && e.features.length > 0) {
                const f = e.features[0];
                const props = f.properties!;
                const coords = (f.geometry as any).coordinates.slice();

                const html = `
                  <div style="font-family: var(--font-sans), sans-serif; font-size: 12px; max-width: 210px;">
                    <div style="font-weight: 700; color: #0F172A; margin-bottom: 4px;">
                      ${props.stop_name}
                    </div>
                    <div style="color: #64748B; font-size: 11px;">
                      Avg delay:
                      <span style="color: ${getDelayColor(props.avg_delay_minutes)}; font-weight: 700;">
                        ${Number(props.avg_delay_minutes).toFixed(1)} min
                      </span>
                    </div>
                    <div style="color: #64748B; font-size: 11px;">
                      Routes: ${props.routes_served}
                    </div>
                    ${
                      Number(props.alert_count) > 0
                        ? `<div style="color: #DC2626; font-size: 11px; margin-top: 4px;">
                            ${props.alert_count} active alert${Number(props.alert_count) > 1 ? "s" : ""}
                          </div>`
                        : ""
                    }
                  </div>
                `;

                popup.setLngLat(coords).setHTML(html).addTo(mapInstance);
              }
            });

            mapInstance.on("mouseleave", layerId, () => {
              mapInstance.getCanvas().style.cursor = "";
              popup.remove();
            });
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("System map data error:", err);
        setError("Failed to load map data");
        setLoading(false);
      }
    });

    return () => {
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-[320px] sm:h-[420px] xl:h-[520px] items-center justify-center rounded-[22px] border border-slate-200 bg-slate-50">
        <div className="text-center">
          <p className="text-[13px] text-red-500">{error}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Check NEXT_PUBLIC_MAPBOX_TOKEN in .env
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-slate-50">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="text-[11px] text-slate-500">Loading map...</span>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="h-[320px] sm:h-[420px] xl:h-[520px] overflow-hidden rounded-[22px]" />
      <div className="absolute bottom-4 left-4 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Modes
        </p>
        <div className="space-y-1.5">
          {[
            { label: "Bus", color: "#2563EB" },
            { label: "Subway", color: "#EF4444" },
            { label: "Commuter Rail", color: "#7C3AED" },
            { label: "Ferry", color: "#0EA5A5" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              <div
                className="h-1 w-4 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="text-[11px] text-slate-600">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDelayColor(minutes: number): string {
  if (minutes <= 2) return "#16A34A";
  if (minutes <= 5) return "#EAB308";
  if (minutes <= 8) return "#F97316";
  return "#EF4444";
}
