"use client";

import { useState, useEffect, useCallback } from "react";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { KPICard } from "@/components/ui/kpi-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Clock,



} from "lucide-react";

interface RouteHealth {
  route_id: string;
  route_name: string;
  route_type_desc: string;
  on_time_pct: number;
  avg_delay_minutes: number;
  reliability_score: number;
  total_predictions: number;
}

interface SystemData {
  on_time_pct: number;
  avg_delay_minutes: number;
  active_alerts: number;
  total_trips: number;
}

type ModeGroup = {
  mode: string;
  routes: RouteHealth[];
  avgOnTime: number;
  avgDelay: number;
  totalTrips: number;
};

export function ServiceHealthShell() {
  const [mode, setMode] = useState<TransitMode>("all");
  const [routes, setRoutes] = useState<RouteHealth[]>([]);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [routesRes, systemRes] = await Promise.all([
        clientFetch<{ data: any[] }>("/overview/route-ranking", {
          mode: mode === "all" ? undefined : mode,
          limit: 50,
        }),
        clientFetch<any>("/overview/system", {
          mode: mode === "all" ? undefined : mode,
        }),
      ]);

      setRoutes(
        (routesRes.data || []).map((r: any) => ({
          route_id: r.route_id,
          route_name: r.route_name || r.route_id,
          route_type_desc: r.route_type_desc || "",
          on_time_pct: r.on_time_pct ?? 0,
          avg_delay_minutes: r.avg_delay_minutes ?? 0,
          reliability_score: r.reliability_score ?? 0,
          total_predictions: r.total_predictions ?? 0,
        }))
      );
      setSystem(systemRes);
    } catch (err) {
      console.error("Service health fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group routes by mode
  const modeGroups: ModeGroup[] = (() => {
    const groupMap = new Map<string, RouteHealth[]>();
    for (const r of routes) {
      const m = r.route_type_desc || "Unknown";
      if (!groupMap.has(m)) groupMap.set(m, []);
      groupMap.get(m)!.push(r);
    }

    return Array.from(groupMap.entries()).map(([modeName, modeRoutes]) => {
      const totalTrips = modeRoutes.reduce(
        (s, r) => s + r.total_predictions,
        0
      );
      const weightedOT =
        totalTrips > 0
          ? modeRoutes.reduce(
              (s, r) => s + r.on_time_pct * r.total_predictions,
              0
            ) / totalTrips
          : 0;
      const weightedDelay =
        totalTrips > 0
          ? modeRoutes.reduce(
              (s, r) => s + r.avg_delay_minutes * r.total_predictions,
              0
            ) / totalTrips
          : 0;

      return {
        mode: modeName,
        routes: modeRoutes.sort(
          (a, b) => b.reliability_score - a.reliability_score
        ),
        avgOnTime: Math.round(weightedOT * 10) / 10,
        avgDelay: Math.round(weightedDelay * 10) / 10,
        totalTrips,
      };
    });
  })();

  function getHealthStatus(onTimePct: number) {
    if (onTimePct >= 85)
      return { label: "Good", color: "text-emerald-400", bg: "bg-emerald-500" };
    if (onTimePct >= 70)
      return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500" };
    return { label: "Poor", color: "text-red-400", bg: "bg-red-500" };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Service Health</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            System reliability and route health overview
          </p>
        </div>
        <ModeFilterTabs selected={mode} onChange={setMode} />
      </div>

      {/* System KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="System On-Time"
          value={loading ? "..." : `${system?.on_time_pct ?? "--"}%`}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
        />
        <KPICard
          title="Avg Delay"
          value={
            loading ? "..." : `${system?.avg_delay_minutes ?? "--"} min`
          }
          icon={Clock}
          iconColor="text-amber-400"
        />
        <KPICard
          title="Active Alerts"
          value={loading ? "..." : system?.active_alerts ?? "--"}
          icon={AlertTriangle}
          iconColor="text-red-400"
        />
        <KPICard
          title="Total Trips"
          value={
            loading
              ? "..."
              : system?.total_trips?.toLocaleString() ?? "--"
          }
          icon={HeartPulse}
          iconColor="text-blue-400"
        />
      </div>

      {/* Mode Groups */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-[#1E293B] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {modeGroups.map((group) => {
            const health = getHealthStatus(group.avgOnTime);
            return (
              <DashboardCard
                key={group.mode}
                title={group.mode}
                action={
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      health.color,
                      health.bg + "/20"
                    )}
                  >
                    {health.label}
                  </span>
                }
              >
                {/* Mode summary */}
                <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-[#2D3B4F]">
                  <div>
                    <p className="text-[11px] text-slate-500">On-Time</p>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        health.color
                      )}
                    >
                      {group.avgOnTime}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Avg Delay</p>
                    <p className="text-lg font-bold text-white">
                      {group.avgDelay} min
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Trips</p>
                    <p className="text-lg font-bold text-white">
                      {group.totalTrips.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Routes in this mode */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {group.routes.map((route) => {
                    const rHealth = getHealthStatus(route.on_time_pct);
                    return (
                      <div
                        key={route.route_id}
                        className="flex items-center gap-3 py-1.5"
                      >
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            rHealth.bg
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white truncate">
                            {route.route_name}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-[13px] font-semibold",
                            rHealth.color
                          )}
                        >
                          {route.on_time_pct.toFixed(0)}%
                        </span>
                        <span className="text-[11px] text-slate-500 w-14 text-right">
                          {route.avg_delay_minutes.toFixed(1)}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </DashboardCard>
            );
          })}
        </div>
      )}
    </div>
  );
}