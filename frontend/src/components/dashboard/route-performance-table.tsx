"use client";

import { useEffect, useState } from "react";
import { TransitMode } from "@/components/ui/mode-filter-tabs";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bus, TrainFront, Train, Ship } from "lucide-react";

interface RouteRow {
  rank: number;
  route_id: string;
  route_name: string;
  route_type_desc: string;
  on_time_pct: number;
  avg_delay_minutes: number;
  reliability_score: number;
}

const modeIcon: Record<string, React.ElementType> = {
  bus: Bus,
  "light rail": TrainFront,
  "heavy rail": TrainFront,
  "commuter rail": Train,
  ferry: Ship,
};

const modeColor: Record<string, string> = {
  bus: "text-blue-400",
  "light rail": "text-green-400",
  "heavy rail": "text-orange-400",
  "commuter rail": "text-purple-400",
  ferry: "text-teal-400",
};

function mapRouteRows(rows: any[]): RouteRow[] {
  return rows.map((r: any, idx: number) => ({
    rank: idx + 1,
    route_id: r.route_id,
    route_name: r.route_name || r.route_id,
    route_type_desc: (r.route_type_desc || "").toLowerCase(),
    on_time_pct: r.on_time_pct ?? 0,
    avg_delay_minutes: r.avg_delay_minutes ?? 0,
    reliability_score: r.reliability_score ?? 0,
  }));
}

export function RoutePerformanceTable({
  mode,
  initialRows,
  deferFetch = false,
}: {
  mode: TransitMode;
  initialRows?: any[];
  deferFetch?: boolean;
}) {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(Boolean(initialRows) ? false : deferFetch);

  useEffect(() => {
    if (initialRows && mode === "all") {
      setRoutes(mapRouteRows(initialRows));
      setLoading(false);
      return;
    }

    if (deferFetch) {
      setLoading(true);
      return;
    }

    async function fetchRoutes() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 5 };
        if (mode !== "all") params.mode = mode;

        const json = await clientFetch<{ data: any[] }>(
          "/overview/route-ranking",
          params
        );

        setRoutes(mapRouteRows(json.data || []));
      } catch (err) {
        console.error("Route ranking fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoutes();
  }, [deferFetch, initialRows, mode]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#0F172A] rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <p className="text-[13px] text-slate-500 text-center py-8">
        No route data available for this mode
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-[28px_1fr_32px_68px_68px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        <span>#</span>
        <span>Route / Line</span>
        <span>Mode</span>
        <span className="text-right">On-Time</span>
        <span className="text-right">Avg Delay</span>
      </div>

      {routes.map((route) => {
        const Icon = modeIcon[route.route_type_desc] || TrainFront;
        const color = modeColor[route.route_type_desc] || "text-slate-400";

        return (
          <div
            key={route.route_id}
            className="grid grid-cols-[28px_1fr_32px_68px_68px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-[#0F172A]/50 transition-colors cursor-pointer"
          >
            <span className="text-[13px] font-bold text-slate-500">
              {route.rank}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white truncate">
                {route.route_name}
              </p>
            </div>
            <Icon className={cn("h-4 w-4", color)} />
            <div className="text-right">
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  route.on_time_pct >= 85
                    ? "text-emerald-400"
                    : route.on_time_pct >= 70
                      ? "text-amber-400"
                      : "text-red-400"
                )}
              >
                {route.on_time_pct.toFixed(0)}%
              </span>
            </div>
            <span className="text-[13px] text-slate-400 text-right">
              {route.avg_delay_minutes.toFixed(1)} min
            </span>
          </div>
        );
      })}

      <a
        href="/analytics"
        className="block text-center text-[12px] text-blue-400 hover:text-blue-300 pt-3"
      >
        View all routes →
      </a>
    </div>
  );
}
