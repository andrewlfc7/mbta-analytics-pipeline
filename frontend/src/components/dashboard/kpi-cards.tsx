import {
  getSystemOverview,
  getQualityAlerts,
} from "@/lib/api";
import { formatNumber, formatMinutes, formatPercent } from "@/lib/utils";
import { Clock, TrendingUp, Train, AlertTriangle } from "lucide-react";

export async function DashboardKPIs() {
  const [overview, alerts] = await Promise.all([
    getSystemOverview(),
    getQualityAlerts({ limit: 1 }),
  ]);

  const data = overview.data || overview;
  const alertCount = data.active_alerts ?? alerts?.total_alerts ?? alerts?.data?.length ?? 0;

  const lastUpdated = data.last_updated
    ? new Date(data.last_updated).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  const kpis = [
    {
      label: "On-Time Performance",
      value: formatPercent(
        data.on_time_pct ?? data.on_time_percentage ?? data.ontime_percentage ?? 0
      ),
      icon: Clock,
      color: getPerformanceColor(
        data.on_time_pct ?? data.on_time_percentage ?? data.ontime_percentage ?? 0
      ),
      subtext: "System average",
      change: data.on_time_pct_change,
      progressValue: data.on_time_pct ?? data.on_time_percentage ?? data.ontime_percentage ?? 0,
    },
    {
      label: "Average Delay",
      value: formatMinutes(
        data.avg_delay_minutes ?? data.average_delay ?? 0
      ),
      icon: TrendingUp,
      color:
        (data.avg_delay_minutes ?? 0) <= 2
          ? "text-status-success"
          : (data.avg_delay_minutes ?? 0) <= 5
          ? "text-status-warning"
          : "text-status-danger",
      subtext: "Per trip",
      change: data.avg_delay_change,
    },
    {
      label: "Total Trips",
      value: formatNumber(
        data.total_trips ?? data.total_predictions ?? 0
      ),
      icon: Train,
      color: "text-brand-accent",
      subtext: "Analyzed",
      change: data.total_trips_change,
    },
    {
      label: "Active Alerts",
      value: String(alertCount),
      icon: AlertTriangle,
      color:
        alertCount > 50
          ? "text-status-danger"
          : alertCount > 20
          ? "text-status-warning"
          : "text-status-success",
      subtext: "Current",
      change: data.active_alerts_change,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-700/50 bg-surface-card p-6 transition-colors hover:border-slate-600/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-content-muted">
                  {kpi.label}
                </span>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <div className={`mt-3 text-3xl font-bold ${kpi.color}`}>
                {kpi.value}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs text-content-faint">{kpi.subtext}</p>
                {kpi.change !== undefined && kpi.change !== null && kpi.change !== 0 && (
                  <span
                    className={`text-xs font-medium ${
                      kpi.label === "Average Delay" || kpi.label === "Active Alerts"
                        ? kpi.change > 0
                          ? "text-status-danger"
                          : "text-status-success"
                        : kpi.change > 0
                        ? "text-status-success"
                        : "text-status-danger"
                    }`}
                  >
                    {kpi.change > 0 ? "+" : ""}
                    {typeof kpi.change === "number" && Math.abs(kpi.change) < 100
                      ? kpi.change.toFixed(1)
                      : kpi.change}
                  </span>
                )}
              </div>
              {kpi.progressValue !== undefined && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-700">
                  <div
                    className="h-1.5 rounded-full bg-brand-accent transition-all"
                    style={{
                      width: `${Math.min(kpi.progressValue, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lastUpdated && (
        <p className="text-xs text-content-faint text-right">
          Last updated: {lastUpdated} ET
        </p>
      )}
    </div>
  );
}

function getPerformanceColor(pct: number): string {
  if (pct >= 70) return "text-status-success";
  if (pct >= 50) return "text-status-warning";
  return "text-status-danger";
}

