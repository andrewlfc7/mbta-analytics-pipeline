"use client";

import { useEffect, useState } from "react";
import { TransitMode } from "@/components/ui/mode-filter-tabs";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bus, Train, TrainFront, Ship } from "lucide-react";

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
  bus: "text-blue-500",
  "light rail": "text-green-600",
  "heavy rail": "text-orange-500",
  "commuter rail": "text-violet-500",
  ferry: "text-cyan-500",
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
          <div key={i} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-slate-500">
        No route data available for this mode
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[32px_1fr_44px_82px_88px] gap-3 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Rank</span>
        <span>Route / Line</span>
        <span>Mode</span>
        <span className="text-right">On-Time</span>
        <span className="text-right">Avg Delay</span>
      </div>

      {routes.map((route) => {
        const Icon = modeIcon[route.route_type_desc] || TrainFront;
        const color = modeColor[route.route_type_desc] || "text-slate-500";

        return (
          <div
            key={route.route_id}
            className="grid grid-cols-[32px_1fr_44px_82px_88px] items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="text-[24px] font-light text-slate-500">
              {route.rank}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-slate-900">
                {route.route_name}
              </p>
              <p className="truncate text-[12px] text-slate-500">
                {route.route_id}
              </p>
            </div>
            <Icon className={cn("h-5 w-5", color)} />
            <div className="text-right">
              <span
                className={cn(
                  "text-[15px] font-semibold",
                  route.on_time_pct >= 85
                    ? "text-emerald-600"
                    : route.on_time_pct >= 70
                      ? "text-amber-500"
                      : "text-red-500"
                )}
              >
                {route.on_time_pct.toFixed(0)}%
              </span>
            </div>
            <span
              className={cn(
                "text-right text-[15px] font-medium",
                route.avg_delay_minutes > 5 ? "text-orange-500" : "text-slate-700"
              )}
            >
              {route.avg_delay_minutes.toFixed(1)} min
            </span>
          </div>
        );
      })}

      <a
        href="/analytics"
        className="block pt-4 text-center text-[13px] font-medium text-blue-600 hover:text-blue-700"
      >
        View all routes →
      </a>
    </div>
  );
}
