"use client";

import { useState, useEffect } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FileText, Download, TrendingUp, AlertTriangle, Clock, BarChart3 } from "lucide-react";

interface SystemData {
  total_trips: number;
  on_time_pct: number;
  avg_delay_minutes: number;
  active_alerts: number;
  critical_alerts: number;
  trips_by_mode: Record<string, number>;
}

interface RouteData {
  route_id: string;
  route_name: string;
  route_type_desc: string;
  on_time_pct: number;
  avg_delay_minutes: number;
  total_predictions: number;
}

export default function ReportsPage() {
  const [system, setSystem] = useState<SystemData | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [weather, setWeather] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [sysRes, routeRes, weatherRes] = await Promise.all([
          clientFetch<any>("/overview/system"),
          clientFetch<{ data: any[] }>("/overview/route-ranking", { limit: 100 }),
          clientFetch<{ data: any[] }>("/weather/delay-impact"),
        ]);
        setSystem(sysRes);
        setRoutes(routeRes.data || []);
        setWeather(weatherRes.data || []);
      } catch (err) {
        console.error("Reports fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const worstRoutes = [...routes]
    .sort((a, b) => (b.avg_delay_minutes || 0) - (a.avg_delay_minutes || 0))
    .slice(0, 10);

  const bestRoutes = [...routes]
    .sort((a, b) => (b.on_time_pct || 0) - (a.on_time_pct || 0))
    .slice(0, 10);

  const exportReport = () => {
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
      "=== TOP 10 WORST DELAYS ===",
      ...worstRoutes.map((r, i) => `  ${i + 1}. ${r.route_name || r.route_id} — ${(r.avg_delay_minutes || 0).toFixed(1)} min avg delay, ${(r.on_time_pct || 0).toFixed(1)}% on-time`),
      "",
      "=== TOP 10 BEST ON-TIME ===",
      ...bestRoutes.map((r, i) => `  ${i + 1}. ${r.route_name || r.route_id} — ${(r.on_time_pct || 0).toFixed(1)}% on-time, ${(r.avg_delay_minutes || 0).toFixed(1)} min avg delay`),
      "",
      "=== WEATHER IMPACT ===",
      ...weather.map((w) => `  ${w.condition_category}: ${w.avg_delay_minutes} min avg delay (${w.observation_count} observations)`),
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
          <p className="text-[13px] text-slate-400 mt-0.5">Performance summary and exportable reports</p>
        </div>
        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <DashboardCard title="">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20"><BarChart3 className="h-5 w-5 text-blue-400" /></div>
            <div>
              <p className="text-[11px] text-slate-500">Total Trips</p>
              <p className="text-xl font-bold text-white">{system?.total_trips?.toLocaleString()}</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard title="">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20"><TrendingUp className="h-5 w-5 text-emerald-400" /></div>
            <div>
              <p className="text-[11px] text-slate-500">On-Time</p>
              <p className="text-xl font-bold text-emerald-400">{system?.on_time_pct}%</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard title="">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20"><Clock className="h-5 w-5 text-amber-400" /></div>
            <div>
              <p className="text-[11px] text-slate-500">Avg Delay</p>
              <p className="text-xl font-bold text-white">{system?.avg_delay_minutes} min</p>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard title="">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20"><AlertTriangle className="h-5 w-5 text-red-400" /></div>
            <div>
              <p className="text-[11px] text-slate-500">Active Alerts</p>
              <p className="text-xl font-bold text-white">{system?.active_alerts}</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Worst delays */}
        <DashboardCard title="Highest Delays" action={<span className="text-[11px] text-slate-500">Top 10</span>}>
          <div className="space-y-0">
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
                <span className="text-[13px] text-red-400 font-semibold text-right">{(r.avg_delay_minutes || 0).toFixed(1)}m</span>
                <span className="text-[13px] text-slate-400 text-right">{(r.on_time_pct || 0).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Best on-time */}
        <DashboardCard title="Best On-Time Performance" action={<span className="text-[11px] text-slate-500">Top 10</span>}>
          <div className="space-y-0">
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
        </DashboardCard>
      </div>

      {/* Weather Impact */}
      {weather.length > 0 && (
        <DashboardCard title="Weather Impact Summary">
          <div className="grid grid-cols-[1fr_120px_120px_120px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
            <span>Condition</span><span className="text-right">Avg Delay</span><span className="text-right">Observations</span><span className="text-right">Routes</span>
          </div>
          {weather.map((w) => (
            <div key={w.condition_category} className="grid grid-cols-[1fr_120px_120px_120px] gap-2 items-center px-2 py-2 border-b border-[#2D3B4F]/30">
              <span className="text-[13px] text-white font-medium">{w.condition_category}</span>
              <span className={cn("text-[13px] font-semibold text-right", w.avg_delay_minutes > 2 ? "text-red-400" : w.avg_delay_minutes > 1 ? "text-amber-400" : "text-emerald-400")}>
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
