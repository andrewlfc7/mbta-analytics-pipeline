"use client";

import { useEffect, useRef, useState } from "react";
import { getDelayColor, formatMinutes } from "@/lib/utils";

interface Props {
  data: any;
  onSelectStation: (stopId: string) => void;
  selectedStation: string | null;
}

export function StationMap({ data, onSelectStation, selectedStation }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const onSelectStationRef = useRef(onSelectStation);
  onSelectStationRef.current = onSelectStation;

  const stations = data?.data?.stations || data?.stations || data?.data || [];
  const stationList = Array.isArray(stations) ? stations : [];

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const useMapbox = mapboxToken && mapboxToken !== "your_mapbox_token_here" && !mapError;

  const stableStations = useRef(stationList);
  stableStations.current = stationList;

  const stableToken = useRef(mapboxToken);
  stableToken.current = mapboxToken;

  useEffect(() => {
    if (!useMapbox || !mapContainer.current || stableStations.current.length === 0) return;

    let map: any;

    const initMap = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;

        (mapboxgl as any).accessToken = stableToken.current!;
        (mapboxgl as any).setTelemetryEnabled?.(false);

        map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [-71.06, 42.355],
          zoom: 12,
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        map.on("load", () => {
          stableStations.current.forEach((station: any) => {
            const lat = station.latitude ?? station.lat;
            const lng = station.longitude ?? station.lng ?? station.lon;
            if (!lat || !lng) return;

            const delay = station.avg_delay_minutes ?? station.avg_delay ?? 0;
            const color = getDelayColor(delay);
            const size = Math.max(8, Math.min(20, (station.total_predictions ?? 100) / 50));

            const el = document.createElement("div");
            el.className = "station-marker";
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.backgroundColor = color;
            el.style.borderRadius = "50%";
            el.style.border = "2px solid rgba(15, 23, 42, 0.8)";
            el.style.cursor = "pointer";
            el.style.transition = "transform 0.15s";

            el.addEventListener("mouseenter", () => {
              el.style.transform = "scale(1.4)";
            });
            el.addEventListener("mouseleave", () => {
              el.style.transform = "scale(1)";
            });
            el.addEventListener("click", () => {
              onSelectStationRef.current(station.stop_id || station.id);
            });

            const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setHTML(`
              <div style="font-family: Inter, sans-serif; font-size: 13px;">
                <strong>${station.stop_name || station.name}</strong><br/>
                Avg Delay: ${formatMinutes(delay)}<br/>
                ${station.municipality ? `Location: ${station.municipality}` : ""}
              </div>
            `);

            new mapboxgl.Marker(el)
              .setLngLat([lng, lat])
              .setPopup(popup)
              .addTo(map);
          });
        });
      } catch (err) {
        console.error("Mapbox init error:", err);
        setMapError(true);
      }
    };

    initMap();

    return () => {
      if (map) map.remove();
    };
  }, [useMapbox]);

  if (!useMapbox) {
    const sorted = [...stationList]
      .sort(
        (a: any, b: any) =>
          (b.avg_delay_minutes ?? b.avg_delay ?? 0) -
          (a.avg_delay_minutes ?? a.avg_delay ?? 0)
      )
      .slice(0, 30);

    return (
      <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
        <h3 className="text-lg font-semibold text-content-primary mb-2">
          Station Map
        </h3>
        <p className="text-sm text-content-muted mb-4">
          Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local for interactive map. Showing top 30 stations by delay.
        </p>

        <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-2">
          {sorted.map((station: any) => {
            const stopId = station.stop_id || station.id || "";
            const delay = station.avg_delay_minutes ?? station.avg_delay ?? 0;
            const color = getDelayColor(delay);
            const isSelected = selectedStation === stopId;

            return (
              <button
                key={stopId}
                onClick={() => onSelectStation(stopId)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "bg-brand-accent/10 border border-brand-accent/30"
                    : "bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/30"
                }`}
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary truncate">
                    {station.stop_name || station.name}
                  </p>
                  {station.municipality && (
                    <p className="text-xs text-content-faint">{station.municipality}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-content-muted">
                  {formatMinutes(delay)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-content-faint">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-success" />
            <span>&lt;2m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-warning" />
            <span>2-5m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-danger" />
            <span>&gt;5m</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card overflow-hidden">
      <div ref={mapContainer} className="h-[500px] w-full" />
      <div className="px-6 py-3 flex items-center gap-4 text-xs text-content-faint border-t border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-status-success" />
          <span>&lt;2m</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#EAB308" }} />
          <span>2-3m</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#F97316" }} />
          <span>3-5m</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-status-danger" />
          <span>&gt;5m</span>
        </div>
        <span className="ml-auto text-content-faint">
          {stationList.length} stations
        </span>
      </div>
    </div>
  );
}
