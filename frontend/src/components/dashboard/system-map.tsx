"use client";

import { useEffect, useRef, useState } from "react";
import { clientFetch } from "@/lib/api";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// MBTA route type colors
const _ROUTE_TYPE_COLORS: Record<number, string> = {
  0: "#00843D", // Light Rail (Green Line)
  1: "#DA291C", // Heavy Rail (Red/Orange/Blue)
  2: "#8B5CF6", // Commuter Rail
  4: "#06B6D4", // Ferry
};

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

    // Initialize map
    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-71.0589, 42.3601], // Boston
      zoom: 11.5,
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
        const data = await clientFetch<SystemMapData>(
          "/stations/map/system"
        );

        // Add route lines
        if (data.routes?.features?.length > 0) {
          mapInstance.addSource("route-lines", {
            type: "geojson",
            data: data.routes,
          });

          // Add a line layer for each route type for proper coloring
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
                0, 3,    // Light Rail
                1, 3,    // Heavy Rail
                2, 2,    // Commuter Rail
                4, 2,    // Ferry
                1.5,     // Default
              ],
              "line-opacity": 0.8,
            },
          });
        }

        // Add station points
        if (data.stations?.features?.length > 0) {
          mapInstance.addSource("stations", {
            type: "geojson",
            data: data.stations,
          });

          // Alert stations — larger, red
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
                1, 8,
                5, 14,
              ],
              "circle-color": "#EF4444",
              "circle-opacity": 0.6,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#EF4444",
              "circle-stroke-opacity": 0.3,
            },
          });

          // Alert count labels
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

          // Regular stations — sized by delay
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
                0, 3,
                20, 5,
                50, 8,
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
              "circle-opacity": 0.8,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#0F172A",
            },
          });

          // Station hover popup
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
                  <div style="font-family: Inter, sans-serif; font-size: 12px; max-width: 200px;">
                    <div style="font-weight: 600; color: #F8FAFC; margin-bottom: 4px;">
                      ${props.stop_name}
                    </div>
                    <div style="color: #94A3B8; font-size: 11px;">
                      Avg delay: <span style="color: ${getDelayColor(props.avg_delay_minutes)}; font-weight: 600;">
                        ${Number(props.avg_delay_minutes).toFixed(1)} min
                      </span>
                    </div>
                    <div style="color: #94A3B8; font-size: 11px;">
                      Routes: ${props.routes_served}
                    </div>
                    ${
                      Number(props.alert_count) > 0
                        ? `<div style="color: #EF4444; font-size: 11px; margin-top: 2px;">
                            ⚠ ${props.alert_count} active alert${Number(props.alert_count) > 1 ? "s" : ""}
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
      <div className="h-[300px] rounded-lg bg-[#0F172A] border border-[#2D3B4F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[13px] text-red-400">{error}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Check NEXT_PUBLIC_MAPBOX_TOKEN in .env
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0F172A] rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-slate-400">Loading map...</span>
          </div>
        </div>
      )}
      <div
        ref={mapContainer}
        className="h-[300px] rounded-lg overflow-hidden"
      />
      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 bg-[#0F172A]/90 backdrop-blur-sm border border-[#2D3B4F] rounded-lg px-3 py-2">
        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Modes
        </p>
        <div className="space-y-1">
          {[
            { label: "Bus", color: "#3B82F6" },
            { label: "Subway", color: "#DA291C" },
            { label: "Commuter Rail", color: "#8B5CF6" },
            { label: "Ferry", color: "#06B6D4" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5">
              <div
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="text-[10px] text-slate-400">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDelayColor(minutes: number): string {
  if (minutes <= 2) return "#22C55E";
  if (minutes <= 5) return "#EAB308";
  if (minutes <= 8) return "#F97316";
  return "#EF4444";
}