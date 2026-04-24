"use client";

import { useState, useCallback } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { cn } from "@/lib/utils";
import { Zap, Play, Clock, CheckCircle2, XCircle, Copy, ChevronDown, ChevronRight } from "lucide-react";

interface Endpoint {
  method: string;
  path: string;
  tag: string;
  description: string;
  params?: { name: string; type: string; required: boolean; default?: string }[];
}

const ENDPOINTS: Endpoint[] = [
  // Overview
  { method: "GET", path: "/overview/system", tag: "Overview", description: "System-wide KPIs and summary stats", params: [{ name: "mode", type: "string", required: false }] },
  { method: "GET", path: "/overview/route-ranking", tag: "Overview", description: "Route performance ranking", params: [{ name: "mode", type: "string", required: false }, { name: "limit", type: "number", required: false, default: "10" }] },
  { method: "GET", path: "/overview/trips-by-mode", tag: "Overview", description: "Trip counts grouped by transit mode" },
  { method: "GET", path: "/overview/performance-trends", tag: "Overview", description: "Historical performance trends", params: [{ name: "day_type", type: "string", required: false }] },
  { method: "GET", path: "/overview/reliability-trend", tag: "Overview", description: "Reliability trend over time", params: [{ name: "period", type: "string", required: false }, { name: "granularity", type: "string", required: false }] },
  // Alerts
  { method: "GET", path: "/alerts/active", tag: "Alerts", description: "Currently active service alerts", params: [{ name: "severity", type: "string", required: false }, { name: "limit", type: "number", required: false, default: "20" }] },
  { method: "GET", path: "/alerts/summary", tag: "Alerts", description: "Alert count summary by severity" },
  { method: "GET", path: "/alerts/by-mode", tag: "Alerts", description: "Alert counts grouped by transit mode" },
  // Routes
  { method: "GET", path: "/routes/reliability", tag: "Routes", description: "Route reliability scores", params: [{ name: "period_days", type: "number", required: false, default: "30" }] },
  // Delays
  { method: "GET", path: "/delays/heatmap", tag: "Delays", description: "Delay heatmap data (hour × day)", params: [{ name: "route_id", type: "string", required: false }, { name: "period_days", type: "number", required: false, default: "30" }] },
  { method: "GET", path: "/delays/temporal/day-of-week", tag: "Delays", description: "Delay patterns by day of week", params: [{ name: "route_id", type: "string", required: false }] },
  { method: "GET", path: "/delays/temporal/hourly", tag: "Delays", description: "Hourly delay patterns", params: [{ name: "route_id", type: "string", required: false }] },
  { method: "GET", path: "/delays/temporal/rush-hour-comparison", tag: "Delays", description: "Rush hour vs off-peak comparison", params: [{ name: "route_id", type: "string", required: false }] },
  { method: "GET", path: "/delays/temporal/delay-probability", tag: "Delays", description: "Delay probability distribution", params: [{ name: "route_id", type: "string", required: false }] },
  // Stations
  { method: "GET", path: "/stations/performance", tag: "Stations", description: "Station performance rankings", params: [{ name: "sort_by", type: "string", required: false, default: "delay_hotspot_score" }, { name: "limit", type: "number", required: false, default: "50" }] },
  { method: "GET", path: "/stations/map", tag: "Stations", description: "Station data for map visualization" },
  { method: "GET", path: "/stations/map/system", tag: "Stations", description: "Full system map with route lines and stations" },
  { method: "GET", path: "/stations/delay-hotspots", tag: "Stations", description: "Top delay hotspot stations", params: [{ name: "limit", type: "number", required: false, default: "5" }] },
  // Weather
  { method: "GET", path: "/weather/current", tag: "Weather", description: "Current weather conditions" },
  { method: "GET", path: "/weather/overview", tag: "Weather", description: "Weather condition impact overview" },
  { method: "GET", path: "/weather/delay-impact", tag: "Weather", description: "Delay impact by weather category" },
  { method: "GET", path: "/weather/scatter/temperature", tag: "Weather", description: "Temperature vs delay scatter data" },
  { method: "GET", path: "/weather/scatter/wind", tag: "Weather", description: "Wind speed vs delay scatter data" },
  { method: "GET", path: "/weather/route-vulnerability", tag: "Weather", description: "Routes most sensitive to weather" },
  // Schedules
  { method: "GET", path: "/schedules/routes", tag: "Schedules", description: "Schedule summary by route" },
  { method: "GET", path: "/schedules/timetable", tag: "Schedules", description: "Route timetable", params: [{ name: "route_id", type: "string", required: true }, { name: "direction_id", type: "number", required: false, default: "0" }] },
  { method: "GET", path: "/schedules/stop", tag: "Schedules", description: "Departures from a stop", params: [{ name: "stop_id", type: "string", required: true }] },
  // Quality
  { method: "GET", path: "/quality/overview", tag: "Quality", description: "Data pipeline health overview" },
  { method: "GET", path: "/quality/alerts", tag: "Quality", description: "Data quality alerts" },
];

const TAG_COLORS: Record<string, string> = {
  Overview: "bg-blue-500/20 text-blue-400",
  Alerts: "bg-red-500/20 text-red-400",
  Routes: "bg-green-500/20 text-green-400",
  Delays: "bg-amber-500/20 text-amber-400",
  Stations: "bg-purple-500/20 text-purple-400",
  Weather: "bg-cyan-500/20 text-cyan-400",
  Schedules: "bg-orange-500/20 text-orange-400",
  Quality: "bg-emerald-500/20 text-emerald-400",
};

export default function APIExplorerPage() {
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(["Overview"]));
  const [copied, setCopied] = useState(false);

  const tags = Array.from(new Set(ENDPOINTS.map((e) => e.tag)));

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) { next.delete(tag); } else { next.add(tag); }
      return next;
    });
  };

  const selectEndpoint = (ep: Endpoint) => {
    setSelected(ep);
    setResponse(null);
    setStatus(null);
    setResponseTime(null);
    const defaults: Record<string, string> = {};
    ep.params?.forEach((p) => { if (p.default) defaults[p.name] = p.default; });
    setParamValues(defaults);
  };

  const executeRequest = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setResponse(null);

    const base = "/api/proxy";
    let url = `${base}${selected.path}`;
    const params = new URLSearchParams();
    Object.entries(paramValues).forEach(([k, v]) => { if (v) params.append(k, v); });
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const start = performance.now();
    try {
      const res = await fetch(url);
      const elapsed = performance.now() - start;
      setStatus(res.status);
      setResponseTime(Math.round(elapsed));
      const json = await res.json();
      setResponse(JSON.stringify(json, null, 2));
    } catch (err) {
      setStatus(0);
      setResponseTime(Math.round(performance.now() - start));
      setResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setLoading(false);
    }
  }, [selected, paramValues]);

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight text-white">
          API Explorer
        </h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Interactive endpoint testing — {ENDPOINTS.length} endpoints available
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Endpoint list */}
        <div className="col-span-4">
          <DashboardCard variant="light" title="Endpoints">
            <div className="space-y-1 max-h-[700px] overflow-y-auto">
              {tags.map((tag) => (
                <div key={tag}>
                  <button
                    onClick={() => toggleTag(tag)}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      {expandedTags.has(tag) ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", TAG_COLORS[tag] || "bg-slate-500/20 text-slate-400")}>{tag}</span>
                      <span className="text-[11px] text-slate-400">{ENDPOINTS.filter((e) => e.tag === tag).length}</span>
                    </div>
                  </button>
                  {expandedTags.has(tag) && (
                    <div className="ml-5 space-y-0.5">
                      {ENDPOINTS.filter((e) => e.tag === tag).map((ep) => (
                        <button
                          key={ep.path}
                          onClick={() => selectEndpoint(ep)}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 text-left text-[12px] transition-colors",
                            selected?.path === ep.path ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                          )}
                        >
                          <span className="mr-1.5 font-mono text-[10px] text-emerald-600">GET</span>
                          {ep.path}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Request/Response */}
        <div className="col-span-8 space-y-4">
          {!selected ? (
            <DashboardCard variant="light" title="Request">
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Zap className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-[15px] font-medium text-slate-700">Select an endpoint to test</p>
                <p className="mt-1 text-[13px] text-slate-500">Choose from the sidebar to make a live API request</p>
              </div>
            </DashboardCard>
          ) : (
            <>
              <DashboardCard variant="light" title="Request" action={
                <button
                  onClick={executeRequest}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Play className="h-3 w-3" />
                  {loading ? "Sending..." : "Send"}
                </button>
              }>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[13px]">
                    <span className="font-semibold text-emerald-600">GET</span>
                    <span className="text-slate-900">/api/v1{selected.path}</span>
                  </div>
                  <p className="text-[12px] text-slate-400">{selected.description}</p>

                  {selected.params && selected.params.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Parameters</p>
                      {selected.params.map((p) => (
                        <div key={p.name} className="flex items-center gap-3">
                          <div className="w-32">
                            <span className="font-mono text-[12px] text-slate-900">{p.name}</span>
                            {p.required && <span className="text-red-400 text-[10px] ml-1">*</span>}
                            <span className="ml-1 text-[10px] text-slate-400">{p.type}</span>
                          </div>
                          <input
                            type="text"
                            value={paramValues[p.name] || ""}
                            onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                            placeholder={p.default || ""}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DashboardCard>

              <DashboardCard
                variant="light"
                title="Response"
                action={
                  <div className="flex items-center gap-3">
                    {status !== null && (
                      <>
                        <div className="flex items-center gap-1">
                          {status >= 200 && status < 300 ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-400" />
                          )}
                          <span className={cn("text-[12px] font-mono font-bold", status >= 200 && status < 300 ? "text-emerald-400" : "text-red-400")}>
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span className="text-[11px]">{responseTime}ms</span>
                        </div>
                      </>
                    )}
                    {response && (
                      <button onClick={copyResponse} className="flex items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-slate-900">
                        <Copy className="h-3 w-3" />
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                }
              >
                {response ? (
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] text-slate-700">
                    {response}
                  </pre>
                ) : (
                  <p className="text-[13px] text-slate-500 text-center py-8">
                    Click Send to execute the request
                  </p>
                )}
              </DashboardCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
