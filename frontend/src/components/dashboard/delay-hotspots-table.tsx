"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";

interface Hotspot {
  rank: number;
  stop_id: string;
  stop_name: string;
  municipality: string;
  avg_delay_minutes: number;
  routes_served: number;
}

function mapHotspots(rows: any[]): Hotspot[] {
  return rows.map((s: any, idx: number) => ({
    rank: idx + 1,
    stop_id: s.stop_id || "",
    stop_name: s.stop_name || "Unknown",
    municipality: s.municipality || "",
    avg_delay_minutes: s.avg_delay_minutes ?? 0,
    routes_served: s.routes_served ?? 0,
  }));
}

export function DelayHotspotsTable({
  initialRows,
  deferFetch = false,
}: {
  initialRows?: any[];
  deferFetch?: boolean;
}) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(Boolean(initialRows) ? false : deferFetch);

  useEffect(() => {
    if (initialRows) {
      setHotspots(mapHotspots(initialRows));
      setLoading(false);
      return;
    }

    if (deferFetch) {
      setLoading(true);
      return;
    }

    async function fetchHotspots() {
      setLoading(true);
      try {
        const json = await clientFetch<{ data: any[] }>(
          "/stations/delay-hotspots",
          { limit: 5 }
        );
        setHotspots(mapHotspots(json.data || []));
      } catch (err) {
        console.error("Delay hotspots fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchHotspots();
  }, [deferFetch, initialRows]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (hotspots.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-slate-500">
        No delay data available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hotspots.map((h) => (
        <div
          key={h.stop_id}
          className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
            {h.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900">
              {h.stop_name}
            </p>
            <p className="text-[12px] text-slate-500">
              {h.municipality}
              {h.routes_served > 0 && ` · ${h.routes_served} routes`}
            </p>
          </div>
          <span className="shrink-0 text-[15px] font-semibold text-orange-500">
            +{h.avg_delay_minutes.toFixed(1)} min
          </span>
        </div>
      ))}
    </div>
  );
}
