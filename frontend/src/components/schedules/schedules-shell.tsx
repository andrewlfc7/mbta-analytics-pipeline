"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Calendar, ChevronRight, ArrowRightLeft } from "lucide-react";

interface ScheduleRoute {
  route_id: string;
  route_name: string;
  route_type_desc: string;
  route_color: string;
  total_trips: number;
  unique_stops: number;
  first_departure: string;
  last_departure: string;
}

interface TimetableStop {
  trip_id: string;
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
  departure_time: string;
  arrival_time: string | null;
  timepoint: boolean;
}

const MODE_MAP: Record<string, string> = {
  "Light Rail": "subway",
  "Heavy Rail": "subway",
  "Bus": "bus",
  "Commuter Rail": "commuter_rail",
  "Ferry": "ferry",
};

function formatTime(isoTime: string | null): string {
  if (!isoTime) return "--";
  try {
    const d = new Date(isoTime);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return isoTime;
  }
}

export function SchedulesShell() {
  const [mode, setMode] = useState<TransitMode>("all");
  const [routes, setRoutes] = useState<ScheduleRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [directionId, setDirectionId] = useState(0);
  const [timetable, setTimetable] = useState<TimetableStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [timetableLoading, setTimetableLoading] = useState(false);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientFetch<{ data: any[] }>("/schedules/routes");
      setRoutes(
        (res.data || []).map((r: any) => ({
          route_id: r.route_id,
          route_name: r.route_name || r.route_id,
          route_type_desc: r.route_type_desc || "",
          route_color: r.route_color?.startsWith("#") ? r.route_color : `#${r.route_color || "7F7F7F"}`,
          total_trips: r.total_trips || 0,
          unique_stops: r.unique_stops || 0,
          first_departure: r.first_departure || "",
          last_departure: r.last_departure || "",
        }))
      );
    } catch (err) {
      console.error("Schedule routes error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  const fetchTimetable = useCallback(async (routeId: string, dir: number) => {
    setTimetableLoading(true);
    try {
      const res = await clientFetch<{ data: any[] }>("/schedules/timetable", {
        route_id: routeId,
        direction_id: dir,
      });
      setTimetable(res.data || []);
    } catch (err) {
      console.error("Timetable error:", err);
      setTimetable([]);
    } finally {
      setTimetableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoute) {
      fetchTimetable(selectedRoute, directionId);
    }
  }, [selectedRoute, directionId, fetchTimetable]);

  const filteredRoutes = mode === "all"
    ? routes
    : routes.filter((r) => {
        const mapped = MODE_MAP[r.route_type_desc];
        return mapped === mode;
      });

  // Group timetable by trip
  const tripGroups = timetable.reduce<Record<string, TimetableStop[]>>((acc, stop) => {
    if (!acc[stop.trip_id]) acc[stop.trip_id] = [];
    acc[stop.trip_id].push(stop);
    return acc;
  }, {});

  const selectedRouteData = routes.find((r) => r.route_id === selectedRoute);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedules</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            View planned service schedules across {routes.length} routes
          </p>
        </div>
        <ModeFilterTabs selected={mode} onChange={setMode} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Route list */}
        <div className="col-span-4">
          <DashboardCard title={`Routes (${filteredRoutes.length})`}>
            {loading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-14 bg-[#0F172A] rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {filteredRoutes.map((route) => (
                  <button
                    key={route.route_id}
                    onClick={() => { setSelectedRoute(route.route_id); setDirectionId(0); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      selectedRoute === route.route_id
                        ? "bg-blue-600/20 border border-blue-500/30"
                        : "hover:bg-[#0F172A]/50"
                    )}
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: route.route_color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">
                        {route.route_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {route.route_type_desc} · {route.total_trips} trips · {route.unique_stops} stops
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Timetable panel */}
        <div className="col-span-8">
          {!selectedRoute ? (
            <DashboardCard title="Timetable">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Calendar className="h-12 w-12 text-slate-600 mb-4" />
                <p className="text-[15px] font-medium text-slate-300">
                  Select a route to view its timetable
                </p>
                <p className="text-[13px] text-slate-500 mt-1">
                  Browse departure times and stop sequences
                </p>
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard
              title={selectedRouteData?.route_name || selectedRoute}
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDirectionId(directionId === 0 ? 1 : 0)}
                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-[#0F172A] text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                    Direction {directionId === 0 ? "Outbound" : "Inbound"}
                  </button>
                  <span className="text-[11px] text-slate-500">
                    {Object.keys(tripGroups).length} trips
                  </span>
                </div>
              }
            >
              {timetableLoading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-10 bg-[#0F172A] rounded animate-pulse" />
                  ))}
                </div>
              ) : Object.keys(tripGroups).length === 0 ? (
                <p className="text-[13px] text-slate-500 text-center py-8">
                  No schedule data for this direction
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
                    <span>Stop</span>
                    <span className="text-right">Arrives</span>
                    <span className="text-right">Departs</span>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {Object.entries(tripGroups).slice(0, 20).map(([tripId, stops]) => (
                      <div key={tripId} className="border-b border-[#2D3B4F]/50">
                        <div className="px-3 py-1.5 bg-[#0F172A]/30">
                          <span className="text-[10px] font-semibold text-slate-500">
                            Trip: {tripId.slice(-8)}
                          </span>
                          <span className="text-[10px] text-slate-600 ml-2">
                            {formatTime(stops[0]?.departure_time)} → {formatTime(stops[stops.length - 1]?.departure_time)}
                          </span>
                        </div>
                        {stops.map((stop, i) => (
                          <div
                            key={`${tripId}-${stop.stop_sequence}`}
                            className="grid grid-cols-[1fr_100px_100px] gap-2 items-center px-3 py-1.5 hover:bg-[#0F172A]/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  stop.timepoint ? "bg-blue-400" : "bg-slate-600"
                                )} />
                                {i < stops.length - 1 && (
                                  <div className="w-px h-4 bg-[#2D3B4F]" />
                                )}
                              </div>
                              <p className={cn(
                                "text-[12px] truncate",
                                stop.timepoint ? "text-white font-medium" : "text-slate-400"
                              )}>
                                {stop.stop_name}
                              </p>
                            </div>
                            <span className="text-[12px] text-slate-400 text-right">
                              {formatTime(stop.arrival_time)}
                            </span>
                            <span className="text-[12px] text-white text-right">
                              {formatTime(stop.departure_time)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </DashboardCard>
          )}
        </div>
      </div>
    </div>
  );
}
