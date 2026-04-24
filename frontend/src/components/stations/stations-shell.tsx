"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MapPin, Search, AlertTriangle } from "lucide-react";

interface Station {
  stop_id: string;
  stop_name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  total_predictions: number;
  routes_served: number;
  avg_delay_minutes: number;
  on_time_pct: number;
  late_pct: number;
  delay_hotspot_score: number;
}

interface StationDetail {
  stop_id: string;
  stop_name: string;
  municipality: string;
  avg_delay_minutes: number;
  on_time_pct: number;
  p90_delay_minutes: number;
  total_predictions: number;
  routes_served: number;
  delay_hotspot_score: number;
  avg_occupancy_pct: number;
  routes: Array<{
    route_id: string;
    route_name: string;
    route_type_desc: string;
    route_color: string;
  }>;
  active_alerts: Array<{
    alert_id: string;
    header: string;
    severity_category: string;
  }>;
}

type SortField = "delay_hotspot_score" | "avg_delay_seconds" | "late_pct";

export function StationsShell() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("delay_hotspot_score");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const json = await clientFetch<{ data: any[] }>(
        "/stations/performance",
        { sort_by: sortBy, limit: 100 }
      );
      setStations(
        (json.data || []).map((s: any) => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name || "Unknown",
          municipality: s.municipality || "",
          latitude: s.latitude,
          longitude: s.longitude,
          total_predictions: s.total_predictions ?? 0,
          routes_served: s.routes_served ?? 0,
          avg_delay_minutes: s.avg_delay_minutes ?? 0,
          on_time_pct: s.on_time_pct ?? 0,
          late_pct: s.late_pct ?? 0,
          delay_hotspot_score: s.delay_hotspot_score ?? 0,
        }))
      );
    } catch (err) {
      console.error("Stations fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const fetchDetail = async (stopId: string) => {
    setDetailLoading(true);
    try {
      const json = await clientFetch<{ data: any }>(`/stations/${stopId}/details`);
      const d = json.data || {};
      setSelectedStation({
        stop_id: d.stop_id || stopId,
        stop_name: d.stop_name || "Unknown",
        municipality: d.municipality || "",
        avg_delay_minutes: d.avg_delay_minutes ?? 0,
        on_time_pct: d.on_time_pct ?? 0,
        p90_delay_minutes: d.p90_delay_minutes ?? 0,
        total_predictions: d.total_predictions ?? 0,
        routes_served: d.routes_served ?? 0,
        delay_hotspot_score: d.delay_hotspot_score ?? 0,
        avg_occupancy_pct: d.avg_occupancy_pct ?? 0,
        routes: Array.isArray(d.routes) ? d.routes : [],
        active_alerts: Array.isArray(d.active_alerts) ? d.active_alerts : [],
      });
    } catch (err) {
      console.error("Station detail error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredStations = stations.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.stop_name.toLowerCase().includes(q) ||
      s.municipality.toLowerCase().includes(q)
    );
  });

  const sortOptions: { key: SortField; label: string }[] = [
    { key: "delay_hotspot_score", label: "Hotspot Score" },
    { key: "avg_delay_seconds", label: "Avg Delay" },
    { key: "late_pct", label: "Late %" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight text-white">Stations</h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Station performance, delay hotspots, and route connections
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Station List */}
        <div className="xl:col-span-7">
          <DashboardCard
            variant="light"
            title={`Stations (${filteredStations.length})`}
            action={
              <div className="flex gap-1">
                {sortOptions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key)}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-md transition-colors",
                      sortBy === s.key
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {s.label}
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
                placeholder="Search stations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Station</span>
              <span className="text-right">On-Time</span>
              <span className="text-right">Avg Delay</span>
              <span className="text-right">Late %</span>
              <span className="text-right">Score</span>
            </div>

            {loading ? (
              <div className="space-y-2 mt-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="max-h-[550px] overflow-y-auto">
                {filteredStations.map((station) => (
                  <div
                    key={station.stop_id}
                    className={cn(
                      "grid grid-cols-[1fr_80px_80px_80px_60px] cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2.5 transition-colors",
                      selectedStation?.stop_id === station.stop_id
                        ? "bg-blue-50"
                        : "hover:bg-slate-50"
                    )}
                    onClick={() => fetchDetail(station.stop_id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-900">
                        {station.stop_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {station.municipality}
                        {station.routes_served > 0 && ` -- ${station.routes_served} routes`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[13px] font-semibold text-right",
                        station.on_time_pct >= 85
                          ? "text-emerald-600"
                          : station.on_time_pct >= 70
                            ? "text-amber-500"
                            : "text-red-500"
                      )}
                    >
                      {station.on_time_pct.toFixed(0)}%
                    </span>
                    <span className="text-right text-[13px] text-slate-500">
                      {station.avg_delay_minutes.toFixed(1)}m
                    </span>
                    <span className="text-right text-[13px] text-slate-500">
                      {station.late_pct.toFixed(0)}%
                    </span>
                    <span className="text-right text-[12px] font-semibold text-slate-900">
                      {station.delay_hotspot_score.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Station Detail Panel */}
        <div className="xl:col-span-5">
          {selectedStation ? (
            <DashboardCard variant="light" title={selectedStation.stop_name}>
              {detailLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "On-Time %", value: `${selectedStation.on_time_pct.toFixed(1)}%`, color: selectedStation.on_time_pct >= 85 ? "text-emerald-600" : selectedStation.on_time_pct >= 70 ? "text-amber-500" : "text-red-500" },
                      { label: "Avg Delay", value: `${selectedStation.avg_delay_minutes.toFixed(1)} min`, color: "text-slate-900" },
                      { label: "P90 Delay", value: `${selectedStation.p90_delay_minutes.toFixed(1)} min`, color: "text-slate-900" },
                      { label: "Hotspot Score", value: selectedStation.delay_hotspot_score.toFixed(0), color: "text-slate-900" },
                      { label: "Total Trips", value: selectedStation.total_predictions.toLocaleString(), color: "text-slate-900" },
                      { label: "Routes Served", value: String(selectedStation.routes_served), color: "text-slate-900" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-500">{m.label}</p>
                        <p className={cn("text-[16px] font-bold mt-0.5", m.color)}>
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Routes at this station */}
                  {selectedStation.routes.length > 0 && (
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Routes
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedStation.routes.map((r) => (
                          <span
                            key={r.route_id}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700"
                            style={{
                              borderLeftColor: r.route_color
                                ? `#${r.route_color}`
                                : undefined,
                              borderLeftWidth: r.route_color ? "3px" : undefined,
                            }}
                          >
                            {r.route_name || r.route_id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active alerts at this station */}
                  {selectedStation.active_alerts.length > 0 && (
                    <div>
                      <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Active Alerts
                      </p>
                      <div className="space-y-2">
                        {selectedStation.active_alerts.map((a) => (
                          <div
                            key={a.alert_id}
                            className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <p className="text-[12px] leading-snug text-slate-700">
                              {a.header}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DashboardCard>
          ) : (
            <DashboardCard variant="light" title="Station Details">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MapPin className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-[13px] text-slate-500">
                  Click a station to view details
                </p>
              </div>
            </DashboardCard>
          )}
        </div>
      </div>
    </div>
  );
}
