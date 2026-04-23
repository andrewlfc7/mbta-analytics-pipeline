"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Route, Search, MapPin, ArrowRight, Clock, Shield, AlertTriangle,
  Cloud, Thermometer, ChevronDown, Bus, TrainFront, Train, Ship, Repeat2, Zap, CheckCircle2, X
} from "lucide-react";

interface StopResult {
  stop_id: string;
  stop_name: string;
  municipality: string;
  location_type_desc: string;
}

interface TripLeg {
  route_id: string;
  route_name: string;
  route_type: number;
  route_type_desc: string;
  route_color: string;
}

interface TripOption {
  connection_type: string;
  transfers: number;
  legs: TripLeg[];
  transfer_stop?: { stop_id: string; stop_name: string };
  reliability: {
    on_time_pct: number;
    avg_delay_minutes: number;
    delay_risk_pct: number;
    label: string;
  };
  active_alerts: number;
  alert_summaries: string[];
}

interface TripResult {
  origin: string;
  destination: string;
  options: TripOption[];
  weather: any;
  total_options: number;
}

const MODE_ICON: Record<string, React.ElementType> = {
  "Bus": Bus,
  "Light Rail": TrainFront,
  "Heavy Rail": TrainFront,
  "Commuter Rail": Train,
  "Ferry": Ship,
};

const RELIABILITY_COLOR: Record<string, string> = {
  "High": "text-emerald-400",
  "Good": "text-blue-400",
  "Fair": "text-amber-400",
  "Poor": "text-red-400",
};

const RELIABILITY_BG: Record<string, string> = {
  "High": "bg-emerald-500/20",
  "Good": "bg-blue-500/20",
  "Fair": "bg-amber-500/20",
  "Poor": "bg-red-500/20",
};

function StopSearch({ label, value, onSelect, icon }: {
  label: string;
  value: StopResult | null;
  onSelect: (stop: StopResult) => void;
  icon: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StopResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await clientFetch<{ data: StopResult[] }>("/trip/search-stops", { q });
        setResults(res.data || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {value ? (
        <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-[#0F172A] border border-[#2D3B4F] rounded-lg">
          {icon}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white truncate">{value.stop_name}</p>
            <p className="text-[10px] text-slate-500">{value.municipality}</p>
          </div>
          <button onClick={() => { onSelect(null as any); setQuery(""); }} className="text-slate-500 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search stations..."
            className="w-full pl-9 pr-3 py-2 bg-[#0F172A] border border-[#2D3B4F] rounded-lg text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
          {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1E293B] border border-[#2D3B4F] rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map((stop) => (
            <button
              key={stop.stop_id}
              onClick={() => { onSelect(stop); setQuery(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-[#0F172A]/50 transition-colors border-b border-[#2D3B4F]/30 last:border-0"
            >
              <p className="text-[12px] text-white">{stop.stop_name}</p>
              <p className="text-[10px] text-slate-500">{stop.municipality} · {stop.location_type_desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TripPlannerPage() {
  const [origin, setOrigin] = useState<StopResult | null>(null);
  const [destination, setDestination] = useState<StopResult | null>(null);
  const [result, setResult] = useState<TripResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedOption, setExpandedOption] = useState<number | null>(null);
  const [preference, setPreference] = useState<"fastest" | "reliable" | "fewest">("reliable");

  const findTrips = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await clientFetch<TripResult>("/trip/find-routes", {
        origin: origin.stop_id,
        destination: destination.stop_id,
      });
      setResult(res);
    } catch (err) {
      console.error("Trip planner error:", err);
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  const sortedOptions = result?.options ? [...result.options].sort((a, b) => {
    if (preference === "reliable") return b.reliability.on_time_pct - a.reliability.on_time_pct;
    if (preference === "fewest") return a.transfers - b.transfers;
    return a.transfers - b.transfers; // fastest = fewer transfers
  }) : [];

  const swapStops = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trip Planner</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Find the most reliable way to get there
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Search Panel */}
        <div className="col-span-5 space-y-4">
          <DashboardCard title="Plan Your Trip">
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <StopSearch label="Origin" value={origin} onSelect={setOrigin} icon={<div className="h-2.5 w-2.5 rounded-full bg-blue-400" />} />
                </div>
                <button onClick={swapStops} className="p-2 mb-0.5 rounded-lg bg-[#0F172A] border border-[#2D3B4F] hover:border-blue-500 transition-colors">
                  <Repeat2 className="h-4 w-4 text-slate-400" />
                </button>
                <div className="flex-1">
                  <StopSearch label="Destination" value={destination} onSelect={setDestination} icon={<div className="h-2.5 w-2.5 rounded-full bg-red-400" />} />
                </div>
              </div>

              {/* Preferences */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Preferences</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "fastest", icon: Zap, label: "Fastest", desc: "Fewest stops" },
                    { key: "reliable", icon: Shield, label: "Most Reliable", desc: "Best on-time" },
                    { key: "fewest", icon: Repeat2, label: "Fewest Transfers", desc: "Direct routes" },
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPreference(p.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors text-center",
                        preference === p.key
                          ? "border-blue-500 bg-blue-600/10"
                          : "border-[#2D3B4F] hover:border-slate-500"
                      )}
                    >
                      <p.icon className={cn("h-4 w-4", preference === p.key ? "text-blue-400" : "text-slate-500")} />
                      <span className={cn("text-[11px] font-semibold", preference === p.key ? "text-blue-400" : "text-slate-400")}>{p.label}</span>
                      <span className="text-[9px] text-slate-600">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={findTrips}
                disabled={!origin || !destination || loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[13px] font-semibold rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Route className="h-4 w-4" />
                )}
                {loading ? "Finding routes..." : "Find Routes"}
              </button>
            </div>
          </DashboardCard>

          {/* Current Conditions */}
          {result?.weather && (
            <DashboardCard title="Current Conditions">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <Thermometer className="h-4 w-4 text-orange-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{Math.round(result.weather.temp_f || 0)}°F</p>
                  <p className="text-[10px] text-slate-500">{result.weather.condition || ""}</p>
                </div>
                <div className="text-center">
                  <Cloud className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{Math.round(result.weather.wind_mph || 0)}</p>
                  <p className="text-[10px] text-slate-500">mph wind</p>
                </div>
                <div className="text-center">
                  <Cloud className="h-4 w-4 text-cyan-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{(result.weather.precip_in || 0).toFixed(1)}"</p>
                  <p className="text-[10px] text-slate-500">precip</p>
                </div>
              </div>
            </DashboardCard>
          )}
        </div>

        {/* Results */}
        <div className="col-span-7">
          {!result && !loading ? (
            <DashboardCard title="Route Recommendations">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Route className="h-12 w-12 text-slate-600 mb-4" />
                <p className="text-[15px] font-medium text-slate-300">
                  Search for a trip to see recommendations
                </p>
                <p className="text-[13px] text-slate-500 mt-1">
                  We&apos;ll show you the most reliable routes with real-time delay data
                </p>
              </div>
            </DashboardCard>
          ) : loading ? (
            <DashboardCard title="Finding Routes...">
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-[#0F172A] rounded-lg animate-pulse" />)}
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard
              title="Route Recommendations"
              action={<span className="text-[11px] text-slate-500">{result?.total_options || 0} options found</span>}
            >
              {sortedOptions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[15px] text-slate-300 font-medium">No routes found</p>
                  <p className="text-[13px] text-slate-500 mt-1">Try different stations or check if service is available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedOptions.map((option, idx) => {
                    const Icon1 = MODE_ICON[option.legs[0]?.route_type_desc] || TrainFront;
                    const relColor = RELIABILITY_COLOR[option.reliability.label] || "text-slate-400";
                    const relBg = RELIABILITY_BG[option.reliability.label] || "bg-slate-500/20";
                    const expanded = expandedOption === idx;

                    return (
                      <div
                        key={idx}
                        className="border border-[#2D3B4F] rounded-lg overflow-hidden hover:border-[#3D4B5F] transition-colors"
                      >
                        <button
                          onClick={() => setExpandedOption(expanded ? null : idx)}
                          className="w-full text-left px-4 py-3"
                        >
                          <div className="flex items-center gap-4">
                            {/* Rank */}
                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold", relBg, relColor)}>
                              {idx + 1}
                            </div>

                            {/* Route legs */}
                            <div className="flex items-center gap-2 flex-1">
                              {option.legs.map((leg, li) => {
                                const LegIcon = MODE_ICON[leg.route_type_desc] || TrainFront;
                                const color = leg.route_color?.startsWith("#") ? leg.route_color : `#${leg.route_color}`;
                                return (
                                  <div key={li} className="flex items-center gap-1.5">
                                    {li > 0 && <ArrowRight className="h-3 w-3 text-slate-600" />}
                                    <div className="flex items-center gap-1 px-2 py-1 rounded" style={{ backgroundColor: `${color}20`, borderColor: `${color}40`, borderWidth: 1 }}>
                                      <LegIcon className="h-3 w-3" style={{ color }} />
                                      <span className="text-[11px] font-semibold text-white truncate max-w-[120px]">
                                        {leg.route_name || leg.route_id}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className={cn("text-[13px] font-bold", relColor)}>{option.reliability.on_time_pct}%</p>
                                <p className="text-[9px] text-slate-500">Reliability</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[13px] font-bold text-white">{option.reliability.delay_risk_pct}%</p>
                                <p className="text-[9px] text-slate-500">Delay Risk</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[13px] font-bold text-white">{option.transfers}</p>
                                <p className="text-[9px] text-slate-500">Transfers</p>
                              </div>
                              {option.active_alerts > 0 && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 rounded">
                                  <AlertTriangle className="h-3 w-3 text-red-400" />
                                  <span className="text-[10px] text-red-400 font-semibold">{option.active_alerts}</span>
                                </div>
                              )}
                              <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", expanded && "rotate-180")} />
                            </div>
                          </div>
                        </button>

                        {/* Expanded details */}
                        {expanded && (
                          <div className="px-4 pb-3 pt-1 border-t border-[#2D3B4F] bg-[#0F172A]/30">
                            <div className="grid grid-cols-3 gap-4 mb-3">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase">Reliability</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <CheckCircle2 className={cn("h-4 w-4", relColor)} />
                                  <span className={cn("text-[14px] font-bold", relColor)}>{option.reliability.label}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">{option.reliability.on_time_pct}% on-time</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase">Avg Delay</p>
                                <p className="text-[14px] font-bold text-white mt-1">{option.reliability.avg_delay_minutes} min</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{option.reliability.delay_risk_pct}% chance of &gt;5 min delay</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase">Route Type</p>
                                <p className="text-[14px] font-bold text-white mt-1">{option.connection_type === "direct" ? "Direct" : "Transfer"}</p>
                                {option.transfer_stop && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">Transfer at {option.transfer_stop.stop_name}</p>
                                )}
                              </div>
                            </div>
                            {option.alert_summaries.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-red-400 font-semibold uppercase">Active Alerts</p>
                                {option.alert_summaries.map((a, i) => (
                                  <p key={i} className="text-[11px] text-slate-400">⚠ {a}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardCard>
          )}
        </div>
      </div>
    </div>
  );
}
