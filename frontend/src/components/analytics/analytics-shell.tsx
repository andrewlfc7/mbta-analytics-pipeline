"use client";

import { useState, useEffect, useCallback } from "react";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bus, TrainFront, Train, Ship } from "lucide-react";

interface RouteRow {
  route_id: string;
  route_name: string;
  route_type_desc: string;
  on_time_pct: number;
  avg_delay_minutes: number;
  reliability_score: number;
  total_predictions: number;
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

export function AnalyticsShell() {
  const [mode, setMode] = useState<TransitMode>("all");
  const [sortBy, setSortBy] = useState<"on_time" | "delay" | "trips">(
    "on_time"
  );
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 50 };
      if (mode !== "all") params.mode = mode;

      const json = await clientFetch<{ data: any[] }>(
        "/overview/route-ranking",
        params
      );

      setRoutes(
        (json.data || []).map((r: any) => ({
          route_id: r.route_id,
          route_name: r.route_name || r.route_id,
          route_type_desc: (r.route_type_desc || "").toLowerCase(),
          on_time_pct: r.on_time_pct ?? 0,
          avg_delay_minutes: r.avg_delay_minutes ?? 0,
          reliability_score: r.reliability_score ?? 0,
          total_predictions: r.total_predictions ?? 0,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const sortedRoutes = [...routes].sort((a, b) => {
    if (sortBy === "on_time") return b.on_time_pct - a.on_time_pct;
    if (sortBy === "delay") return b.avg_delay_minutes - a.avg_delay_minutes;
    return b.total_predictions - a.total_predictions;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Route performance and delay analysis across all modes
          </p>
        </div>
        <ModeFilterTabs selected={mode} onChange={setMode} />
      </div>

      <DashboardCard
        title="All Routes"
        action={
          <div className="flex gap-1">
            {(
              [
                { key: "on_time", label: "On-Time %" },
                { key: "delay", label: "Avg Delay" },
                { key: "trips", label: "Trip Count" },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-md transition-colors",
                  sortBy === s.key
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-[#0F172A] rounded animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_120px_100px_100px_100px_80px] gap-3 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
              <span>#</span>
              <span>Route</span>
              <span>Mode</span>
              <span className="text-right">On-Time %</span>
              <span className="text-right">Avg Delay</span>
              <span className="text-right">Trips</span>
              <span className="text-right">Score</span>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {sortedRoutes.map((route, idx) => {
                const Icon =
                  modeIcon[route.route_type_desc] || TrainFront;
                const color =
                  modeColor[route.route_type_desc] || "text-slate-400";

                return (
                  <div
                    key={route.route_id}
                    className="grid grid-cols-[40px_1fr_120px_100px_100px_100px_80px] gap-3 items-center px-3 py-2.5 hover:bg-[#0F172A]/50 transition-colors border-b border-[#2D3B4F]/30"
                  >
                    <span className="text-[13px] font-bold text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">
                        {route.route_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5", color)} />
                      <span className="text-[12px] text-slate-400 capitalize">
                        {route.route_type_desc}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[13px] font-semibold text-right",
                        route.on_time_pct >= 85
                          ? "text-emerald-400"
                          : route.on_time_pct >= 70
                            ? "text-amber-400"
                            : "text-red-400"
                      )}
                    >
                      {route.on_time_pct.toFixed(1)}%
                    </span>
                    <span className="text-[13px] text-slate-400 text-right">
                      {route.avg_delay_minutes.toFixed(1)} min
                    </span>
                    <span className="text-[13px] text-slate-400 text-right">
                      {route.total_predictions.toLocaleString()}
                    </span>
                    <span className="text-[13px] font-semibold text-white text-right">
                      {route.reliability_score.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DashboardCard>
    </div>
  );
}