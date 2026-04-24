"use client";

import { useCallback, useEffect, useState } from "react";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { KPICard } from "@/components/ui/kpi-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock3, HeartPulse } from "lucide-react";

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

  const modeGroups: ModeGroup[] = (() => {
    const groupMap = new Map<string, RouteHealth[]>();
    for (const route of routes) {
      const modeName = route.route_type_desc || "Unknown";
      if (!groupMap.has(modeName)) groupMap.set(modeName, []);
      groupMap.get(modeName)!.push(route);
    }

    return Array.from(groupMap.entries()).map(([modeName, modeRoutes]) => {
      const totalTrips = modeRoutes.reduce((sum, route) => sum + route.total_predictions, 0);
      const weightedOT =
        totalTrips > 0
          ? modeRoutes.reduce((sum, route) => sum + route.on_time_pct * route.total_predictions, 0) /
            totalTrips
          : 0;
      const weightedDelay =
        totalTrips > 0
          ? modeRoutes.reduce(
              (sum, route) => sum + route.avg_delay_minutes * route.total_predictions,
              0
            ) / totalTrips
          : 0;

      return {
        mode: modeName,
        routes: modeRoutes.sort((a, b) => b.reliability_score - a.reliability_score),
        avgOnTime: Math.round(weightedOT * 10) / 10,
        avgDelay: Math.round(weightedDelay * 10) / 10,
        totalTrips,
      };
    });
  })();

  function getHealthStatus(onTimePct: number) {
    if (onTimePct >= 85) {
      return {
        label: "Good",
        text: "text-emerald-600",
        badge: "bg-emerald-50 text-emerald-600 border-emerald-200",
        dot: "bg-emerald-500",
      };
    }
    if (onTimePct >= 70) {
      return {
        label: "Fair",
        text: "text-amber-500",
        badge: "bg-amber-50 text-amber-600 border-amber-200",
        dot: "bg-amber-500",
      };
    }
    return {
      label: "Poor",
      text: "text-red-500",
      badge: "bg-red-50 text-red-600 border-red-200",
      dot: "bg-red-500",
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-white">
            Service Health
          </h1>
          <p className="mt-2 text-[18px] text-slate-400">
            System reliability and route health overview
          </p>
        </div>
        <ModeFilterTabs selected={mode} onChange={setMode} variant="light" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <KPICard
          variant="light"
          title="System On-Time"
          value={loading ? "..." : `${system?.on_time_pct ?? "--"}%`}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
        />
        <KPICard
          variant="light"
          title="Avg Delay"
          value={loading ? "..." : `${system?.avg_delay_minutes ?? "--"} min`}
          icon={Clock3}
          iconColor="text-amber-500"
        />
        <KPICard
          variant="light"
          title="Active Alerts"
          value={loading ? "..." : system?.active_alerts ?? "--"}
          icon={AlertTriangle}
          iconColor="text-red-500"
        />
        <KPICard
          variant="light"
          title="Total Trips"
          value={loading ? "..." : system?.total_trips?.toLocaleString() ?? "--"}
          icon={HeartPulse}
          iconColor="text-blue-500"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[360px] rounded-[24px] bg-white animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {modeGroups.map((group) => {
            const health = getHealthStatus(group.avgOnTime);
            return (
              <DashboardCard
                key={group.mode}
                variant="light"
                title={formatModeLabel(group.mode)}
                action={
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      health.badge
                    )}
                  >
                    {health.label}
                  </span>
                }
              >
                <div className="mb-5 grid grid-cols-3 gap-4 border-b border-slate-200 pb-5">
                  <Metric label="On-Time" value={`${group.avgOnTime}%`} valueClass={health.text} />
                  <Metric label="Avg Delay" value={`${group.avgDelay} min`} />
                  <Metric label="Trips" value={group.totalTrips.toLocaleString()} />
                </div>

                <div className="space-y-2">
                  {group.routes.slice(0, 6).map((route) => {
                    const routeHealth = getHealthStatus(route.on_time_pct);
                    return (
                      <div
                        key={route.route_id}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", routeHealth.dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-slate-900">
                            {route.route_name}
                          </p>
                          <p className="text-[12px] text-slate-500">{route.route_type_desc}</p>
                        </div>
                        <span className={cn("text-[15px] font-semibold", routeHealth.text)}>
                          {route.on_time_pct.toFixed(0)}%
                        </span>
                        <span className="w-16 text-right text-[13px] text-slate-500">
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

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className={cn("mt-2 text-[18px] font-semibold text-slate-900", valueClass)}>{value}</p>
    </div>
  );
}

function formatModeLabel(mode: string) {
  if (mode === "Heavy Rail") return "Subway";
  if (mode === "Light Rail") return "Green Line";
  return mode;
}
