"use client";

import { useState, useEffect, useCallback } from "react";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { KPICard } from "@/components/ui/kpi-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { RoutePerformanceTable } from "@/components/dashboard/route-performance-table";
import { ActiveAlertsList } from "@/components/dashboard/active-alerts-list";
import { DelayHotspotsTable } from "@/components/dashboard/delay-hotspots-table";
import { TripsByModeDonut } from "@/components/dashboard/trips-by-mode-donut";
import { LazyPerformanceTrendsChart } from "@/components/dashboard/performance-trends-chart-lazy";
import { LazySystemMap } from "@/components/dashboard/system-map-lazy";
import { clientFetch } from "@/lib/api";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Database,
  Calendar,
} from "lucide-react";

interface SystemData {
  total_trips: number;
  on_time_pct: number;
  avg_delay_minutes: number;
  active_alerts: number;
  critical_alerts: number;
  major_alerts: number;
  minor_alerts: number;
  info_alerts: number;
  on_time_pct_change: number;
  avg_delay_change: number;
  total_trips_change: number;
  trips_change_pct: number;
  active_alerts_change: number;
  trips_by_mode: Record<string, number>;
  last_updated: string;
}

interface DashboardSnapshot {
  system: SystemData;
  route_ranking: any[];
  alerts: any[];
  performance_trends: any[];
  delay_hotspots: any[];
  trips_by_mode: any[];
}

export function DashboardShell() {
  const [mode, setMode] = useState<TransitMode>("all");
  const [data, setData] = useState<SystemData | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const waitingForSnapshot = mode === "all" && loading && !snapshot;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "all") {
        const json = await clientFetch<DashboardSnapshot>(
          "/overview/dashboard-snapshot"
        );
        setSnapshot(json);
        setData(json.system);
        return;
      }

      const json = await clientFetch<SystemData>("/overview/system", { mode });
      setData(json);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const formatChange = (val: number | undefined, suffix: string = "") => {
    if (val === undefined || val === null) return undefined;
    const sign = val > 0 ? "+" : "";
    return `${sign}${val}${suffix} vs last week`;
  };

  const getDelayChangeColor = (val: number | undefined) => {
    if (!val) return "default" as const;
    return val <= 0 ? ("green" as const) : ("red" as const);
  };

  return (
    <div className="space-y-6">
      {/* Page Header Row */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Operations Dashboard
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Monitor system performance across all modes in real time.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <ModeFilterTabs selected={mode} onChange={setMode} />
          <div className="flex items-center gap-2 rounded-lg bg-[#1E293B] border border-[#2D3B4F] px-3 py-1.5 text-[13px] text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {today}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          title="Total Trips Today"
          value={
            loading
              ? "..."
              : data?.total_trips?.toLocaleString() ?? "--"
          }
          subtitle={formatChange(data?.trips_change_pct, "%")}
          subtitleColor={
            (data?.trips_change_pct ?? 0) >= 0 ? "green" : "red"
          }
          icon={BarChart3}
          iconColor="text-blue-400"
        />
        <KPICard
          title="On-Time Performance"
          value={loading ? "..." : `${data?.on_time_pct ?? "--"}%`}
          subtitle={formatChange(data?.on_time_pct_change, " pp")}
          subtitleColor={
            (data?.on_time_pct_change ?? 0) >= 0 ? "green" : "red"
          }
          icon={CheckCircle2}
          iconColor="text-emerald-400"
        />
        <KPICard
          title="Avg Delay (All Modes)"
          value={loading ? "..." : `${data?.avg_delay_minutes ?? "--"} min`}
          subtitle={formatChange(data?.avg_delay_change, " min")}
          subtitleColor={getDelayChangeColor(data?.avg_delay_change)}
          icon={Clock}
          iconColor="text-amber-400"
        />
        <KPICard
          title="Active Alerts"
          value={loading ? "..." : data?.active_alerts ?? "--"}
          subtitle={`${data?.critical_alerts ?? 0} critical · ${data?.minor_alerts ?? 0} minor`}
          subtitleColor="default"
          icon={AlertTriangle}
          iconColor="text-red-400"
        />
        <KPICard
          title="Data Freshness"
          value={formatFreshness(data?.last_updated)}
          subtitle="✓ All systems operational"
          subtitleColor="green"
          icon={Database}
          iconColor="text-emerald-400"
        />
      </div>

      {/* Middle Row — 3 columns */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <DashboardCard
            title="Route Performance"
            action={
              <span className="text-[11px] text-slate-500">
                By On-Time %
              </span>
            }
          >
            <RoutePerformanceTable
              mode={mode}
              initialRows={mode === "all" ? snapshot?.route_ranking : undefined}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>

        <div className="col-span-4">
          <DashboardCard title="System Map">
            <LazySystemMap />
          </DashboardCard>
        </div>

        <div className="col-span-4">
          <DashboardCard
            title="Active Alerts"
            action={
              <a
                href="/alerts"
                className="text-[11px] text-blue-400 hover:text-blue-300"
              >
                View all alerts
              </a>
            }
          >
            <ActiveAlertsList
              initialRows={snapshot?.alerts}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>
      </div>

      {/* Bottom Row — 3 columns */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5">
          <DashboardCard
            title="Performance Trends"
            action={
              <a
                href="/analytics"
                className="text-[11px] text-blue-400 hover:text-blue-300"
              >
                View full analytics
              </a>
            }
          >
            <LazyPerformanceTrendsChart
              initialRows={snapshot?.performance_trends}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>

        <div className="col-span-3">
          <DashboardCard title="Top Delay Hotspots">
            <DelayHotspotsTable
              initialRows={snapshot?.delay_hotspots}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>

        <div className="col-span-4">
          <DashboardCard
            title="Trips by Mode"
            action={
              <a
                href="/analytics"
                className="text-[11px] text-blue-400 hover:text-blue-300"
              >
                View trip breakdown
              </a>
            }
          >
            <TripsByModeDonut
              initialRows={snapshot?.trips_by_mode}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

function formatFreshness(ts: string | undefined): string {
  if (!ts) return "--";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs} hr ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  } catch {
    return "--";
  }
}
