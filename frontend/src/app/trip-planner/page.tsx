"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { LazySystemMap } from "@/components/dashboard/system-map-lazy";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CloudSun,
  Repeat2,
  Route,
  Search,
  Shield,
  Ship,
  Thermometer,
  Train,
  TrainFront,
  Wind,
  X,
  Zap,
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
  Bus: Bus,
  "Light Rail": TrainFront,
  "Heavy Rail": TrainFront,
  "Commuter Rail": Train,
  Ferry: Ship,
};

const RELIABILITY_COLOR: Record<string, string> = {
  High: "text-emerald-600",
  Good: "text-blue-600",
  Fair: "text-amber-500",
  Poor: "text-red-500",
};

const RELIABILITY_BG: Record<string, string> = {
  High: "bg-emerald-50 border-emerald-200",
  Good: "bg-blue-50 border-blue-200",
  Fair: "bg-amber-50 border-amber-200",
  Poor: "bg-red-50 border-red-200",
};

function StopSearch({
  label,
  value,
  onSelect,
  icon,
}: {
  label: string;
  value: StopResult | null;
  onSelect: (stop: StopResult | null) => void;
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
    if (q.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await clientFetch<{ data: StopResult[] }>("/trip/search-stops", { q });
        setResults(res.data || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>
      {value ? (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          {icon}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-slate-900">
              {value.stop_name}
            </p>
            <p className="text-[11px] text-slate-500">
              {value.municipality} · {value.location_type_desc}
            </p>
          </div>
          <button
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-slate-400 transition-colors hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative mt-2">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search stations..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
          {searching && (
            <div className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          )}
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          {results.map((stop) => (
            <button
              key={stop.stop_id}
              onClick={() => {
                onSelect(stop);
                setQuery("");
                setOpen(false);
              }}
              className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50"
            >
              <p className="text-[13px] font-medium text-slate-900">{stop.stop_name}</p>
              <p className="text-[11px] text-slate-500">
                {stop.municipality} · {stop.location_type_desc}
              </p>
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
  const [expandedOption, setExpandedOption] = useState<number | null>(0);
  const [preference, setPreference] = useState<"fastest" | "reliable" | "fewest">("reliable");
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
  const [departureTime, setDepartureTime] = useState("09:20");
  const [travelMode, setTravelMode] = useState<"all" | "bus" | "subway" | "commuter_rail" | "ferry">("all");

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
      setExpandedOption(0);
    } catch (err) {
      console.error("Trip planner error:", err);
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  const sortedOptions = result?.options
    ? [...result.options].sort((a, b) => {
        if (preference === "reliable") {
          return b.reliability.on_time_pct - a.reliability.on_time_pct;
        }
        if (preference === "fewest") {
          return a.transfers - b.transfers;
        }
        return a.reliability.avg_delay_minutes - b.reliability.avg_delay_minutes;
      })
    : [];

  const bestOption = sortedOptions[0];

  const swapStops = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight text-white">
          Trip Planner
        </h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Find the best route with live reliability, alert, and weather context.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DashboardCard
            variant="light"
            title="Plan Your Trip"
            action={
              <span className="text-[12px] font-medium text-slate-500">
                Real-time recommendations
              </span>
            }
          >
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <StopSearch
                  label="Origin"
                  value={origin}
                  onSelect={setOrigin}
                  icon={<div className="h-3 w-3 rounded-full bg-blue-500" />}
                />
                <button
                  onClick={swapStops}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-500 hover:text-blue-600"
                >
                  <Repeat2 className="h-4 w-4" />
                </button>
                <StopSearch
                  label="Destination"
                  value={destination}
                  onSelect={setDestination}
                  icon={<div className="h-3 w-3 rounded-full bg-red-500" />}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Departure Date
                  </label>
                  <div className="relative mt-2">
                    <CalendarDays className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Departure Time
                  </label>
                  <div className="relative mt-2">
                    <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Preferred Mode
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All Modes" },
                    { key: "bus", label: "Bus" },
                    { key: "subway", label: "Subway" },
                    { key: "commuter_rail", label: "Commuter Rail" },
                    { key: "ferry", label: "Ferry" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setTravelMode(item.key as typeof travelMode)}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-[13px] font-medium transition-colors",
                        travelMode === item.key
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Optimization Preference
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  {([
                    { key: "fastest", icon: Zap, label: "Fastest", desc: "Minimize delay minutes" },
                    { key: "reliable", icon: Shield, label: "Most Reliable", desc: "Maximize on-time performance" },
                    { key: "fewest", icon: Repeat2, label: "Fewest Transfers", desc: "Prefer direct journeys" },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setPreference(item.key)}
                      className={cn(
                        "rounded-[20px] border p-4 text-left transition-colors",
                        preference === item.key
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4",
                          preference === item.key ? "text-blue-600" : "text-slate-400"
                        )}
                      />
                      <p className="mt-3 text-[14px] font-semibold text-slate-900">
                        {item.label}
                      </p>
                      <p className="mt-1 text-[12px] text-slate-500">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={findTrips}
                disabled={!origin || !destination || loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Route className="h-4 w-4" />
                )}
                {loading ? "Finding routes..." : "Find Recommended Routes"}
              </button>
            </div>
          </DashboardCard>
        </div>

        <div className="xl:col-span-7">
          <DashboardCard
            variant="light"
            title="Live Network Context"
            action={
              <span className="text-[12px] font-medium text-slate-500">
                System-wide conditions
              </span>
            }
          >
            <LazySystemMap />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Current Strategy
                </p>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">
                  {preference === "reliable"
                    ? "Favor high-confidence service"
                    : preference === "fewest"
                      ? "Minimize transfers"
                      : "Optimize for the shortest delay profile"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Selected Window
                </p>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">
                  {departureDate} at {departureTime}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Target Mode
                </p>
                <p className="mt-2 text-[15px] font-semibold capitalize text-slate-900">
                  {travelMode.replace("_", " ")}
                </p>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {!result && !loading ? (
            <DashboardCard
              variant="light"
              title="Route Recommendations"
              action={<span className="text-[12px] text-slate-500">Waiting for search</span>}
            >
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Route className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-[18px] font-semibold text-slate-900">
                  Search for a trip to see recommendations
                </p>
                <p className="mt-2 text-[14px] text-slate-500">
                  We&apos;ll rank options with delay risk, alerts, and reliability in mind.
                </p>
              </div>
            </DashboardCard>
          ) : loading ? (
            <DashboardCard variant="light" title="Finding Routes...">
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard
              variant="light"
              title="Route Recommendations"
              action={
                <span className="text-[12px] font-medium text-slate-500">
                  {result?.total_options || 0} options found
                </span>
              }
            >
              {sortedOptions.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[18px] font-semibold text-slate-900">No routes found</p>
                  <p className="mt-2 text-[14px] text-slate-500">
                    Try different stations or check if service is available.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedOptions.map((option, idx) => {
                    const relColor = RELIABILITY_COLOR[option.reliability.label] || "text-slate-500";
                    const relBg = RELIABILITY_BG[option.reliability.label] || "bg-slate-50 border-slate-200";
                    const expanded = expandedOption === idx;

                    return (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-[22px] border border-slate-200 bg-white"
                      >
                        <button
                          onClick={() => setExpandedOption(expanded ? null : idx)}
                          className="w-full px-5 py-5 text-left transition-colors hover:bg-slate-50"
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border text-[15px] font-semibold", relBg, relColor)}>
                              {idx + 1}
                            </div>

                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {option.legs.map((leg, li) => {
                                  const LegIcon = MODE_ICON[leg.route_type_desc] || TrainFront;
                                  const color = leg.route_color?.startsWith("#")
                                    ? leg.route_color
                                    : `#${leg.route_color}`;
                                  return (
                                    <div key={li} className="flex items-center gap-2">
                                      {li > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-400" />}
                                      <div
                                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                                        style={{
                                          backgroundColor: `${color}14`,
                                          borderColor: `${color}33`,
                                        }}
                                      >
                                        <LegIcon className="h-3.5 w-3.5" style={{ color }} />
                                        <span className="text-[13px] font-medium text-slate-900">
                                          {leg.route_name || leg.route_id}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="mt-3 text-[13px] text-slate-500">
                                {option.connection_type === "direct"
                                  ? "Direct journey"
                                  : option.transfer_stop
                                    ? `Transfer at ${option.transfer_stop.stop_name}`
                                    : "Transfer journey"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                              <StatBlock label="Reliability" value={`${option.reliability.on_time_pct}%`} valueClass={relColor} />
                              <StatBlock label="Delay Risk" value={`${option.reliability.delay_risk_pct}%`} />
                              <StatBlock label="Avg Delay" value={`${option.reliability.avg_delay_minutes.toFixed(1)} min`} />
                              <StatBlock label="Transfers" value={String(option.transfers)} />
                            </div>
                          </div>
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  Confidence
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                  <CheckCircle2 className={cn("h-4 w-4", relColor)} />
                                  <span className={cn("text-[16px] font-semibold", relColor)}>
                                    {option.reliability.label}
                                  </span>
                                </div>
                                <p className="mt-1 text-[12px] text-slate-500">
                                  {option.reliability.on_time_pct}% on-time performance
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  Delay Profile
                                </p>
                                <p className="mt-2 text-[16px] font-semibold text-slate-900">
                                  {option.reliability.avg_delay_minutes.toFixed(1)} min average
                                </p>
                                <p className="mt-1 text-[12px] text-slate-500">
                                  {option.reliability.delay_risk_pct}% chance of delays above 5 minutes
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  Alerts
                                </p>
                                <p className="mt-2 text-[16px] font-semibold text-slate-900">
                                  {option.active_alerts} active alert{option.active_alerts === 1 ? "" : "s"}
                                </p>
                                <div className="mt-2 space-y-1">
                                  {option.alert_summaries.length > 0 ? (
                                    option.alert_summaries.map((alert, i) => (
                                      <p key={i} className="text-[12px] text-slate-500">
                                        • {alert}
                                      </p>
                                    ))
                                  ) : (
                                    <p className="text-[12px] text-slate-500">No active service issues on this option.</p>
                                  )}
                                </div>
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
          )}
        </div>

        <div className="space-y-4 xl:col-span-4">
          <DashboardCard variant="light" title="Current Conditions">
            {result?.weather ? (
              <div className="grid grid-cols-3 gap-3">
                <ConditionMetric
                  icon={<Thermometer className="h-4 w-4 text-orange-500" />}
                  value={`${Math.round(result.weather.temp_f || 0)}°F`}
                  label={result.weather.condition || "Conditions"}
                />
                <ConditionMetric
                  icon={<Wind className="h-4 w-4 text-sky-500" />}
                  value={`${Math.round(result.weather.wind_mph || 0)} mph`}
                  label="Wind"
                />
                <ConditionMetric
                  icon={<CloudSun className="h-4 w-4 text-cyan-500" />}
                  value={`${(result.weather.precip_in || 0).toFixed(1)} in`}
                  label="Precipitation"
                />
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13px] text-slate-500">
                  Search for a trip to load current conditions
                </p>
              </div>
            )}
          </DashboardCard>

          <DashboardCard variant="light" title="ETA Confidence">
            {bestOption ? (
              <div className="space-y-4">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Best Option
                  </p>
                  <p className="mt-2 text-[18px] font-semibold text-slate-900">
                    {origin?.stop_name || result?.origin} → {destination?.stop_name || result?.destination}
                  </p>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {bestOption.connection_type === "direct" ? "Direct route" : "One transfer"} · {bestOption.transfers} transfer{bestOption.transfers === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Reliability
                    </p>
                    <p className={cn("mt-2 text-[20px] font-semibold", RELIABILITY_COLOR[bestOption.reliability.label] || "text-slate-900")}>
                      {bestOption.reliability.label}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {bestOption.reliability.on_time_pct}% on-time
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Alert Risk
                    </p>
                    <p className="mt-2 text-[20px] font-semibold text-slate-900">
                      {bestOption.active_alerts}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      Active service alerts on this option
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13px] text-slate-500">
                  ETA guidance will appear after a route search
                </p>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="text-left xl:text-center">
      <p className={cn("text-[15px] font-semibold text-slate-900", valueClass)}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function ConditionMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
        {icon}
      </div>
      <p className="mt-3 text-[18px] font-semibold text-slate-900">{value}</p>
      <p className="text-[12px] text-slate-500">{label}</p>
    </div>
  );
}
