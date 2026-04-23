"use client";

import { useState, useEffect, useCallback } from "react";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { KPICard } from "@/components/ui/kpi-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  AlertOctagon,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";

interface AlertItem {
  alert_id: string;
  severity: number;
  severity_category: string;
  header: string;
  effect: string;
  cause: string;
  service_effect: string;
  affected_routes: string;
  affected_route_count: number;
  affected_stop_count: number;
  impact_score: number;
  duration_hours: number;
  active_start: string;
  active_end: string;
  updated_at: string;
}

interface AlertSummary {
  active_alerts: number;
  critical: number;
  major: number;
  minor: number;
  info: number;
}

interface AlertsByMode {
  mode: string;
  alert_count: number;
}

const severityConfig: Record<
  string,
  { icon: React.ElementType; color: string; badge: string; label: string }
> = {
  critical: {
    icon: AlertOctagon,
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

export function AlertsShell() {
  const [mode, setMode] = useState<TransitMode>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [byMode, setByMode] = useState<AlertsByMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, summaryRes, byModeRes] = await Promise.all([
        clientFetch<{ data: any[] }>("/alerts/active", {
          severity: severityFilter,
          limit: 50,
        }),
        clientFetch<AlertSummary>("/alerts/summary"),
        clientFetch<{ data: any[] }>("/alerts/by-mode"),
      ]);
      setAlerts(
        (alertsRes.data || []).map((a: any) => ({
          alert_id: a.alert_id || "",
          severity: a.severity ?? 0,
          severity_category: a.severity_category || "info",
          header: a.header || "Alert",
          effect: a.effect || "",
          cause: a.cause || "",
          service_effect: a.service_effect || "",
          affected_routes: a.affected_routes
            ? String(a.affected_routes)
            : "",
          affected_route_count: a.affected_route_count ?? 0,
          affected_stop_count: a.affected_stop_count ?? 0,
          impact_score: a.impact_score ?? 0,
          duration_hours: a.duration_hours ?? 0,
          active_start: a.active_start || "",
          active_end: a.active_end || "",
          updated_at: a.updated_at || "",
        }))
      );
      setSummary(summaryRes);
      setByMode(byModeRes.data || []);
    } catch (err) {
      console.error("Alerts fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAlerts = alerts.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !a.header.toLowerCase().includes(q) &&
        !a.service_effect.toLowerCase().includes(q) &&
        !a.affected_routes.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const severityFilters = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "major", label: "Major" },
    { key: "minor", label: "Minor" },
    { key: "info", label: "Info" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Active service alerts across the MBTA network
          </p>
        </div>
        <ModeFilterTabs selected={mode} onChange={setMode} />
      </div>

      {/* Severity KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Critical"
          value={loading ? "..." : summary?.critical ?? 0}
          icon={AlertOctagon}
          iconColor="text-red-400"
          subtitle="Severe disruptions"
          subtitleColor="red"
        />
        <KPICard
          title="Major"
          value={loading ? "..." : summary?.major ?? 0}
          icon={AlertCircle}
          iconColor="text-orange-400"
          subtitle="Significant impact"
          subtitleColor="yellow"
        />
        <KPICard
          title="Minor"
          value={loading ? "..." : summary?.minor ?? 0}
          icon={AlertTriangle}
          iconColor="text-amber-400"
          subtitle="Low impact"
          subtitleColor="default"
        />
        <KPICard
          title="Info"
          value={loading ? "..." : summary?.info ?? 0}
          icon={Info}
          iconColor="text-blue-400"
          subtitle="Informational"
          subtitleColor="default"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-4">
        {/* Alert List */}
        <div className="col-span-8">
          <DashboardCard
            title={`Active Alerts (${filteredAlerts.length})`}
            action={
              <div className="flex items-center gap-2">
                {severityFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setSeverityFilter(f.key)}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-md transition-colors",
                      severityFilter === f.key
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          >
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#2D3B4F] rounded-lg pl-9 pr-4 py-2 text-[13px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-[#0F172A] rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[13px] text-slate-500">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredAlerts.map((alert) => {
                  const cat = alert.severity_category.toLowerCase();
                  const config = severityConfig[cat] || severityConfig.info;
                  const Icon = config.icon;
                  const isExpanded = expandedAlert === alert.alert_id;

                  return (
                    <div
                      key={alert.alert_id}
                      className="rounded-lg border border-[#2D3B4F] hover:border-[#3D4B5F] transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedAlert(
                          isExpanded ? null : alert.alert_id
                        )
                      }
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <Icon
                            className={cn(
                              "h-5 w-5 mt-0.5 shrink-0",
                              config.color
                            )}
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
                              <span className="text-[11px] text-slate-500 uppercase">
                                {alert.effect.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-[14px] font-medium text-white mt-1.5 leading-snug">
                              {alert.header}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                              {alert.affected_route_count > 0 && (
                                <span>
                                  {alert.affected_route_count} route
                                  {alert.affected_route_count > 1 ? "s" : ""}
                                </span>
                              )}
                              {alert.affected_stop_count > 0 && (
                                <span>
                                  {alert.affected_stop_count} stop
                                  {alert.affected_stop_count > 1 ? "s" : ""}
                                </span>
                              )}
                              {alert.duration_hours > 0 && (
                                <span>
                                  {alert.duration_hours.toFixed(0)}h duration
                                </span>
                              )}
                              <span>
                                Impact: {alert.impact_score.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 text-slate-600 shrink-0 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-[#2D3B4F] mt-0">
                          <div className="grid grid-cols-2 gap-4 pt-3 text-[12px]">
                            <div>
                              <span className="text-slate-500">Cause</span>
                              <p className="text-slate-300 mt-0.5">
                                {alert.cause.replace(/_/g, " ") || "Unknown"}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500">
                                Service Effect
                              </span>
                              <p className="text-slate-300 mt-0.5">
                                {alert.service_effect || "--"}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500">
                                Active Period
                              </span>
                              <p className="text-slate-300 mt-0.5">
                                {formatDateTime(alert.active_start)}
                                {alert.active_end &&
                                  ` - ${formatDateTime(alert.active_end)}`}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500">
                                Affected Routes
                              </span>
                              <p className="text-slate-300 mt-0.5">
                                {alert.affected_routes || "System-wide"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Sidebar */}
        <div className="col-span-4 space-y-4">
          {/* Alerts by Mode */}
          <DashboardCard title="Alerts by Mode">
            {byMode.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-4">
                No data
              </p>
            ) : (
              <div className="space-y-3">
                {byMode.map((m) => (
                  <div
                    key={m.mode}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[13px] text-slate-300">
                      {m.mode}
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{
                          width: `${Math.min(m.alert_count * 8, 80)}px`,
                        }}
                      />
                      <span className="text-[13px] font-semibold text-white w-6 text-right">
                        {m.alert_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Impact Distribution */}
          <DashboardCard title="Severity Distribution">
            {summary && (
              <div className="space-y-3">
                {[
                  { label: "Critical", count: summary.critical, color: "bg-red-500" },
                  { label: "Major", count: summary.major, color: "bg-orange-500" },
                  { label: "Minor", count: summary.minor, color: "bg-amber-500" },
                  { label: "Info", count: summary.info, color: "bg-blue-500" },
                ].map((s) => {
                  const total = summary.active_alerts || 1;
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="text-slate-400">{s.label}</span>
                        <span className="text-white font-medium">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#0F172A] rounded-full">
                        <div
                          className={cn("h-1.5 rounded-full", s.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(ts: string): string {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  } catch {
    return ts;
  }
}