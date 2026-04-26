"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
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
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
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

export interface DashboardSnapshot {
  system: SystemData;
  route_ranking: any[];
  alerts: any[];
  performance_trends: any[];
  delay_hotspots: any[];
  trips_by_mode: any[];
}

export function DashboardShell({
  initialSnapshot,
}: {
  initialSnapshot?: DashboardSnapshot | null;
}) {
  const [mode, setMode] = useState<TransitMode>("all");
  const [data, setData] = useState<SystemData | null>(
    initialSnapshot?.system ?? null
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(
    initialSnapshot ?? null
  );
  const [loading, setLoading] = useState(!initialSnapshot);
  const [todayLabel, setTodayLabel] = useState("Today");
  const [usedInitialSnapshot, setUsedInitialSnapshot] = useState(
    Boolean(initialSnapshot)
  );
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
    if (mode === "all" && usedInitialSnapshot) {
      setUsedInitialSnapshot(false);
      return;
    }
    fetchData();
  }, [fetchData, mode, usedInitialSnapshot]);

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
      })
    );
  }, []);

  const formatChange = (val: number | undefined, suffix = "") => {
    if (val === undefined || val === null) return undefined;
    const sign = val > 0 ? "+" : "";
    return `${sign}${val}${suffix} vs yesterday`;
  };

  const getDelayChangeColor = (val: number | undefined) => {
    if (!val) return "default" as const;
    return val <= 0 ? ("green" as const) : ("red" as const);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-white">
            Operations Dashboard
          </h1>
          <p className="mt-2 text-[18px] text-slate-400">
            Monitor system performance across all modes in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ModeFilterTabs
            selected={mode}
            onChange={(nextMode) => {
              startTransition(() => {
                setMode(nextMode);
              });
            }}
            variant="light"
          />
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-600 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            {todayLabel === "Today" ? "Today" : `Today, ${todayLabel}`}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <KPICard
          variant="light"
          title="Total Trips Today"
          value={loading ? "..." : data?.total_trips?.toLocaleString() ?? "--"}
          subtitle={formatChange(data?.trips_change_pct, "%")}
          subtitleColor={(data?.trips_change_pct ?? 0) >= 0 ? "green" : "red"}
          icon={BarChart3}
          iconColor="text-blue-500"
        />
        <KPICard
          variant="light"
          title="On-Time Performance"
          value={loading ? "..." : `${data?.on_time_pct ?? "--"}%`}
          subtitle={formatChange(data?.on_time_pct_change, " pp")}
          subtitleColor={(data?.on_time_pct_change ?? 0) >= 0 ? "green" : "red"}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
        />
        <KPICard
          variant="light"
          title="Avg Delay (All Modes)"
          value={loading ? "..." : `${data?.avg_delay_minutes ?? "--"} min`}
          subtitle={formatChange(data?.avg_delay_change, " min")}
          subtitleColor={getDelayChangeColor(data?.avg_delay_change)}
          icon={Clock3}
          iconColor="text-amber-500"
        />
        <KPICard
          variant="light"
          title="Active Alerts"
          value={loading ? "..." : data?.active_alerts ?? "--"}
          subtitle={`${data?.critical_alerts ?? 0} critical · ${data?.minor_alerts ?? 0} minor`}
          subtitleColor="default"
          icon={AlertTriangle}
          iconColor="text-red-500"
        />
        <KPICard
          variant="light"
          title="Data Freshness"
          value={loading ? "--" : formatFreshness(data?.last_updated)}
          subtitle="All systems operational"
          subtitleColor="green"
          icon={Database}
          iconColor="text-violet-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <DashboardCard
            variant="light"
            title="Route Performance"
            action={
              <button className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500">
                Sort by:
                <span className="text-slate-700">On-Time Performance</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            }
          >
            <RoutePerformanceTable
              mode={mode}
              initialRows={mode === "all" ? snapshot?.route_ranking : undefined}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>

        <div className="xl:col-span-6">
          <DashboardCard variant="light" title="System Map">
            <LazySystemMap />
          </DashboardCard>
        </div>

        <div className="xl:col-span-3">
          <DashboardCard
            variant="light"
            title="Active Alerts"
            action={
              <a
                href="/alerts"
                className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
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

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DashboardCard
            variant="light"
            title="Performance Trends"
            action={
              <a
                href="/analytics"
                className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
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

        <div className="xl:col-span-3">
          <DashboardCard
            variant="light"
            title="Top Delay Hotspots"
            action={
              <span className="text-[12px] font-medium text-slate-500">
                Today
              </span>
            }
          >
            <DelayHotspotsTable
              initialRows={snapshot?.delay_hotspots}
              deferFetch={waitingForSnapshot}
            />
          </DashboardCard>
        </div>

        <div className="xl:col-span-4">
          <DashboardCard
            variant="light"
            title="Trips by Mode"
            action={
              <a
                href="/analytics"
                className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
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
