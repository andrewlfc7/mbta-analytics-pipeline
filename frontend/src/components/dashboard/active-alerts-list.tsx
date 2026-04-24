"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, ChevronRight, Info } from "lucide-react";

interface AlertItem {
  alert_id: string;
  severity: number;
  severity_category: string;
  header: string;
  effect: string;
  service_effect: string;
  affected_route_count: number;
  active_start: string;
  updated_at: string;
}

const severityConfig: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    badge: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    badge: "bg-red-50 text-red-500 border-red-200",
    label: "Critical",
  },
  major: {
    icon: AlertCircle,
    color: "text-orange-500",
    badge: "bg-orange-50 text-orange-500 border-orange-200",
    label: "Major",
  },
  minor: {
    icon: AlertTriangle,
    color: "text-amber-500",
    badge: "bg-amber-50 text-amber-500 border-amber-200",
    label: "Minor",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    badge: "bg-blue-50 text-blue-500 border-blue-200",
    label: "Info",
  },
};

function mapSeverityCategory(severity: number, category: string): string {
  if (category) return category.toLowerCase();
  if (severity >= 7) return "critical";
  if (severity >= 4) return "major";
  if (severity >= 1) return "minor";
  return "info";
}

function mapAlerts(rows: any[]): AlertItem[] {
  return rows.map((a: any) => ({
    alert_id: a.alert_id || "",
    severity: a.severity ?? 0,
    severity_category: a.severity_category || "",
    header: a.header || "Alert",
    effect: a.effect || "",
    service_effect: a.service_effect || "",
    affected_route_count: a.affected_route_count ?? 0,
    active_start: a.active_start || "",
    updated_at: a.updated_at || "",
  }));
}

export function ActiveAlertsList({
  initialRows,
  deferFetch = false,
}: {
  initialRows?: any[];
  deferFetch?: boolean;
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(Boolean(initialRows) ? false : deferFetch);

  useEffect(() => {
    if (initialRows) {
      setAlerts(mapAlerts(initialRows));
      setLoading(false);
      return;
    }

    if (deferFetch) {
      setLoading(true);
      return;
    }

    async function fetchAlerts() {
      setLoading(true);
      try {
        const json = await clientFetch<{ data: any[] }>("/alerts/active", {
          limit: 5,
        });
        setAlerts(mapAlerts(json.data || []));
      } catch (err) {
        console.error("Alerts fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [deferFetch, initialRows]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px] text-slate-500">No active alerts</p>
        <p className="mt-1 text-[12px] text-emerald-600">
          All systems running normally
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const cat = mapSeverityCategory(alert.severity, alert.severity_category);
        const config = severityConfig[cat] || severityConfig.info;
        const Icon = config.icon;

        return (
          <div
            key={alert.alert_id}
            className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-start gap-3">
              <Icon className={cn("mt-1 h-4 w-4 shrink-0", config.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      config.badge
                    )}
                  >
                    {config.label}
                  </span>
                  <span className="truncate text-[14px] font-semibold text-slate-900">
                    {alert.header}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] text-slate-500">
                  {alert.service_effect || alert.effect}
                  {alert.affected_route_count > 0 &&
                    ` · ${alert.affected_route_count} route${alert.affected_route_count > 1 ? "s" : ""} affected`}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {formatAlertTime(alert.updated_at || alert.active_start)}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
            </div>
          </div>
        );
      })}

      <a
        href="/alerts"
        className="block pt-2 text-center text-[13px] font-medium text-blue-600 hover:text-blue-700"
      >
        View all alerts →
      </a>
    </div>
  );
}

function formatAlertTime(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return `Updated ${d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    })}`;
  } catch {
    return ts;
  }
}
