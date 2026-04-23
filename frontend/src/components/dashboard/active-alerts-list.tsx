"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";

interface AlertItem {
  alert_id: string;
  severity: number;
  severity_category: string;
  header: string;
  effect: string;
  service_effect: string;
  affected_route_count: number;
  affected_routes: string;
  impact_score: number;
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
    color: "text-red-400",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    label: "Critical",
  },
  major: {
    icon: AlertCircle,
    color: "text-orange-400",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    label: "Major",
  },
  minor: {
    icon: AlertTriangle,
    color: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    label: "Minor",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
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
    affected_routes: a.affected_routes ? String(a.affected_routes) : "",
    impact_score: a.impact_score ?? 0,
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
        const json = await clientFetch<{ data: any[]; total: number }>(
          "/alerts/active",
          { limit: 5 }
        );

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
          <div
            key={i}
            className="h-16 bg-[#0F172A] rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-slate-500">No active alerts</p>
        <p className="text-[11px] text-emerald-400 mt-1">
          ✓ All systems running normally
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const cat = mapSeverityCategory(
          alert.severity,
          alert.severity_category
        );
        const config = severityConfig[cat] || severityConfig.info;
        const Icon = config.icon;

        return (
          <div
            key={alert.alert_id}
            className="rounded-lg border border-[#2D3B4F] p-3 hover:bg-[#0F172A]/50 transition-colors group cursor-pointer"
          >
            <div className="flex items-start gap-2">
              <Icon
                className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                      config.badge
                    )}
                  >
                    {config.label}
                  </span>
                  <span className="text-[13px] font-medium text-white truncate">
                    {alert.header}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                  {alert.service_effect || alert.effect}
                  {alert.affected_route_count > 0 &&
                    ` · ${alert.affected_route_count} route${alert.affected_route_count > 1 ? "s" : ""} affected`}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {formatAlertTime(alert.updated_at || alert.active_start)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-1" />
            </div>
          </div>
        );
      })}

      <a
        href="/alerts"
        className="block text-center text-[12px] text-blue-400 hover:text-blue-300 pt-2"
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
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  } catch {
    return ts;
  }
}
