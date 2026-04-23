"use client";

import { useState, useEffect } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Download, TrendingUp, AlertTriangle, Clock, BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const [system, setSystem] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [weather, setWeather] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [sysRes, routeRes, weatherRes] = await Promise.allSettled([
          clientFetch<any>("/overview/system"),
          clientFetch<any>("/overview/route-ranking", { limit: 100 }),
          clientFetch<any>("/weather/delay-impact"),
        ]);

        if (sysRes.status === "fulfilled") setSystem(sysRes.value);
        if (routeRes.status === "fulfilled") setRoutes(routeRes.value?.data || []);
        if (weatherRes.status === "fulfilled") setWeather(weatherRes.value?.data || []);
      } catch (err) {
        console.error("Reports fetch error:", err);
        
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const worstRoutes = [...routes]
    .filter((r) => r.avg_delay_minutes != null)
    .sort((a, b) => (b.avg_delay_minutes || 0) - (a.avg_delay_minutes || 0))
    .slice(0, 10);

  const bestRoutes = [...routes]
    .filter((r) => r.on_time_pct != null)
    .sort((a, b) => (b.on_time_pct || 0) - (a.on_time_pct || 0))
    .slice(0, 10);

  const exportCSV = () => {
    const headers = ["Route ID", "Route Name", "Mode", "On-Time %", "Avg Delay (min)", "Trips"];
    const rows = routes.map((r) => [
      r.route_id, r.route_name || r.route_id, r.route_type_desc || "",
      (r.on_time_pct || 0).toFixed(1), (r.avg_delay_minutes || 0).toFixed(1),
      r.total_predictions || 0
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mbta-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportText = () => {
    const lines = [
      "MBTA Transit Performance Report",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "=== SYSTEM OVERVIEW ===",
      `Total Trips: ${system?.total_trips?.toLocaleString() || "N/A"}`,
      `On-Time Performance: ${system?.on_time_pct || "N/A"}%`,
      `Average Delay: ${system?.avg_delay_minutes || "N/A"} min`,
      `Active Alerts: ${system?.active_alerts || "N/A"} (${system?.critical_alerts || 0} critical)`,
      "",
      "=== TRIPS BY MODE ===",
      ...Object.entries(system?.trips_by_mode || {}).map(([m, c]) => `  ${m}: ${(c as number).toLocaleString()}`),
      "",
      "=== TOP 10 HIGHEST DELAYS ===",
      ...worstRoutes.map((r, i) => `  ${i + 1}. ${r.route_name || r.route_id} — ${(r.avg_delay_minutes || 0).toFixed(1)} min, ${(r.on_time_pct || 0).toFixed(1)}% on-time`),
      "",
      "=== TOP 10 BEST ON-TIME ===",
      ...bestRoutes.map((r, i) => `  ${i + 1}. ${r.route_name || r.route_id} — ${(r.on_time_pct || 0).toFixed(1)}% on-time`),
      "",
      "=== WEATHER IMPACT ===",
      ...weather.map((w) => `  ${w.condition_category}: ${w.avg_delay_minutes} min avg delay (${w.observation_count} obs)`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mbta-report-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-[#1E293B] rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[#1E293B] rounded-xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-[#1E293B] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Performance summary — {routes.length} routes analyzed
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-medium rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={exportText} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" /> Report
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: BarChart3, color: "bg-blue-500/20", iconColor: "text-blue-400", label: "Total Trips", value: system?.total_trips?.toLocaleString() || "--" },
          { icon: TrendingUp, color: "bg-emerald-500/20", iconColor: "text-emerald-400", label: "On-Time", value: system?.on_time_pct ? `${system.on_time_pct}%` : "--" },
          { icon: Clock, color: "bg-amber-500/20", iconColor: "text-amber-400", label: "Avg Delay", value: system?.avg_delay_minutes != null ? `${system.avg_delay_minutes} min` : "--" },
          { icon: AlertTriangle, color: "bg-red-500/20", iconColor: "text-red-400", label: "Active Alerts", value: system?.active_alerts ?? "--" },
        ].map((kpi, i) => (
          <DashboardCard key={i} title="">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", kpi.color)}><kpi.icon className={cn("h-5 w-5", kpi.iconColor)} /></div>
              <div>
                <p className="text-[11px] text-slate-500">{kpi.label}</p>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
              </div>
            </div>
          </DashboardCard>
        ))}
      </div>

      {/* Trips by Mode */}
      {system?.trips_by_mode && Object.keys(system.trips_by_mode).length > 0 && (
        <DashboardCard title="Trips by Mode">
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(system.trips_by_mode).map(([mode, count]) => (
              <div key={mode} className="text-center py-3">
                <p className="text-[11px] text-slate-500 capitalize">{mode.replace("_", " ")}</p>
                <p className="text-2xl font-bold text-white">{(count as number).toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">
                  {((count as number) / system.total_trips * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      <div className="grid grid-cols-2 gap-4">
        <DashboardCard title="Highest Delays" action={<span className="text-[11px] text-slate-500">Top 10</span>}>
          {worstRoutes.length === 0 ? (
            <p className="text-[13px] text-slate-500 text-center py-8">No delay data</p>
          ) : (
            <div>
              <div className="grid grid-cols-[30px_1fr_80px_80px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
                <span>#</span><span>Route</span><span className="text-right">Delay</span><span className="text-right">On-Time</span>
              </div>
              {worstRoutes.map((r, i) => (
                <div key={r.route_id} className="grid grid-cols-[30px_1fr_80px_80px] gap-2 items-center px-2 py-2 border-b border-[#2D3B4F]/30">
                  <span className="text-[12px] text-slate-500 font-bold">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-white truncate">{r.route_name || r.route_id}</p>
                    <p className="text-[10px] text-slate-500">{r.route_type_desc}</p>
                  </div>
                  <span className={cn("text-[13px] font-semibold text-right", (r.avg_delay_minutes || 0) > 2 ? "text-red-400" : "text-amber-400")}>
                    {(r.avg_delay_minutes || 0).toFixed(1)}m
                  </span>
                  <span className="text-[13px] text-slate-400 text-right">{(r.on_time_pct || 0).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Best On-Time" action={<span className="text-[11px] text-slate-500">Top 10</span>}>
          {bestRoutes.length === 0 ? (
            <p className="text-[13px] text-slate-500 text-center py-8">No data</p>
          ) : (
            <div>
              <div className="grid grid-cols-[30px_1fr_80px_80px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
                <span>#</span><span>Route</span><span className="text-right">On-Time</span><span className="text-right">Delay</span>
              </div>
              {bestRoutes.map((r, i) => (
                <div key={r.route_id} className="grid grid-cols-[30px_1fr_80px_80px] gap-2 items-center px-2 py-2 border-b border-[#2D3B4F]/30">
                  <span className="text-[12px] text-slate-500 font-bold">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-white truncate">{r.route_name || r.route_id}</p>
                    <p className="text-[10px] text-slate-500">{r.route_type_desc}</p>
                  </div>
                  <span className="text-[13px] text-emerald-400 font-semibold text-right">{(r.on_time_pct || 0).toFixed(0)}%</span>
                  <span className="text-[13px] text-slate-400 text-right">{(r.avg_delay_minutes || 0).toFixed(1)}m</span>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Weather */}
      {weather.length > 0 && (
        <DashboardCard title="Weather Impact Summary">
          <div className="grid grid-cols-[1fr_100px_120px_80px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
            <span>Condition</span><span className="text-right">Avg Delay</span><span className="text-right">Observations</span><span className="text-right">Routes</span>
          </div>
          {weather.map((w) => (
            <div key={w.condition_category} className="grid grid-cols-[1fr_100px_120px_80px] gap-2 items-center px-2 py-2 border-b border-[#2D3B4F]/30">
              <span className="text-[13px] text-white font-medium">{w.condition_category}</span>
              <span className={cn("text-[13px] font-semibold text-right", (w.avg_delay_minutes || 0) > 2 ? "text-red-400" : (w.avg_delay_minutes || 0) > 1 ? "text-amber-400" : "text-emerald-400")}>
                {w.avg_delay_minutes} min
              </span>
              <span className="text-[13px] text-slate-400 text-right">{w.observation_count?.toLocaleString()}</span>
              <span className="text-[13px] text-slate-400 text-right">{w.routes_affected}</span>
            </div>
          ))}
        </DashboardCard>
      )}
    </div>
  );
}
