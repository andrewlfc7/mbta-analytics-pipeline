"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";

interface Hotspot {
  rank: number;
  stop_id: string;
  stop_name: string;
  municipality: string;
  avg_delay_minutes: number;
  delay_hotspot_score: number;
  routes_served: number;
}

export function DelayHotspotsTable() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHotspots() {
      try {
        const json = await clientFetch<{ data: any[] }>(
          "/stations/delay-hotspots",
          { limit: 5 }
        );

        setHotspots(
          (json.data || []).map((s: any, idx: number) => ({
            rank: idx + 1,
            stop_id: s.stop_id || "",
            stop_name: s.stop_name || "Unknown",
            municipality: s.municipality || "",
            avg_delay_minutes: s.avg_delay_minutes ?? 0,
            delay_hotspot_score: s.delay_hotspot_score ?? 0,
            routes_served: s.routes_served ?? 0,
          }))
        );
      } catch (err) {
        console.error("Delay hotspots fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHotspots();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#0F172A] rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (hotspots.length === 0) {
    return (
      <p className="text-[13px] text-slate-500 text-center py-8">
        No delay data available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hotspots.map((h) => (
        <div key={h.stop_id} className="flex items-center gap-3 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F172A] text-[11px] font-bold text-slate-400 shrink-0">
            {h.rank}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate">
              {h.stop_name}
            </p>
            <p className="text-[11px] text-slate-500">
              {h.municipality}
              {h.routes_served > 0 && ` · ${h.routes_served} routes`}
            </p>
          </div>
          <span className="text-[13px] font-semibold text-red-400 shrink-0">
            +{h.avg_delay_minutes.toFixed(1)} min
          </span>
        </div>
      ))}
    </div>
  );
}