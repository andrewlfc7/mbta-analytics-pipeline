"use client";

import { useState, useEffect } from "react";
import { KPICard } from "@/components/ui/kpi-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Cloud,
  Thermometer,
  Wind,
  Droplets,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CurrentWeather {
  temp_f: number;
  humidity: number;
  wind_mph: number;
  precip_in: number;
  condition: string;
}

interface WeatherImpact {
  weather_condition: string;
  observation_count: number;
  avg_delay_minutes: number;
  avg_temp: number;
  avg_wind: number;
  avg_precip: number;
}

interface RouteVuln {
  route_id: string;
  route_name: string;
  route_type_desc: string;
  weather_sensitivity: number;
  avg_delay_clear: number;
  avg_delay_adverse: number;
}

interface ScatterPoint {
  x: number;
  y: number;
  route_id: string;
}

const formatTooltipValue = (
  value: number | string | undefined,
  suffix: string
): string => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(numericValue)
    ? `${numericValue.toFixed(1)}${suffix}`
    : "--";
};

export function WeatherShell() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [impacts, setImpacts] = useState<WeatherImpact[]>([]);
  const [vulnRoutes, setVulnRoutes] = useState<RouteVuln[]>([]);
  const [tempScatter, setTempScatter] = useState<ScatterPoint[]>([]);
  const [windScatter, setWindScatter] = useState<ScatterPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [currentRes, impactRes, vulnRes, tempRes, windRes] =
          await Promise.all([
            clientFetch<{ data: any }>("/weather/current").catch(() => ({
              data: null,
            })),
            clientFetch<{ data: any[] }>("/weather/delay-impact").catch(
              () => ({ data: [] })
            ),
            clientFetch<{ data: any[] }>(
              "/weather/route-vulnerability"
            ).catch(() => ({ data: [] })),
            clientFetch<{ data: any[] }>(
              "/weather/scatter/temperature"
            ).catch(() => ({ data: [] })),
            clientFetch<{ data: any[] }>("/weather/scatter/wind").catch(
              () => ({ data: [] })
            ),
          ]);

        if (currentRes.data) {
          setCurrent({
            temp_f: currentRes.data.temp_f ?? 0,
            humidity: currentRes.data.humidity ?? 0,
            wind_mph: currentRes.data.wind_mph ?? 0,
            precip_in: currentRes.data.precip_in ?? 0,
            condition: currentRes.data.condition || "Unknown",
          });
        }

        setImpacts(impactRes.data || []);

        setVulnRoutes(
          (vulnRes.data || []).slice(0, 10).map((r: any) => ({
            route_id: r.route_id || "",
            route_name: r.route_name || r.route_id || "",
            route_type_desc: r.route_type_desc || "",
            weather_sensitivity:
              r.weather_sensitivity ?? r.delay_increase_pct ?? 0,
            avg_delay_clear: r.avg_delay_clear ?? r.fair_weather_delay ?? 0,
            avg_delay_adverse:
              r.avg_delay_adverse ?? r.adverse_weather_delay ?? 0,
          }))
        );

        setTempScatter(
          (tempRes.data || []).slice(0, 200).map((p: any) => ({
            x: p.temperature_2m ?? p.temp ?? 0,
            y: (p.avg_delay_seconds ?? p.delay ?? 0) / 60,
            route_id: p.route_id || "",
          }))
        );

        setWindScatter(
          (windRes.data || []).slice(0, 200).map((p: any) => ({
            x: p.wind_speed_10m ?? p.wind ?? 0,
            y: (p.avg_delay_seconds ?? p.delay ?? 0) / 60,
            route_id: p.route_id || "",
          }))
        );
      } catch (err) {
        console.error("Weather fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Weather Impact</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          How weather conditions affect transit performance
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Temperature"
          value={
            loading
              ? "..."
              : current
                ? `${Math.round(current.temp_f)}F`
                : "--"
          }
          subtitle={current?.condition || ""}
          icon={Thermometer}
          iconColor="text-orange-400"
        />
        <KPICard
          title="Wind Speed"
          value={
            loading
              ? "..."
              : current
                ? `${Math.round(current.wind_mph)} mph`
                : "--"
          }
          icon={Wind}
          iconColor="text-blue-400"
        />
        <KPICard
          title="Humidity"
          value={
            loading
              ? "..."
              : current
                ? `${Math.round(current.humidity)}%`
                : "--"
          }
          icon={Droplets}
          iconColor="text-cyan-400"
        />
        <KPICard
          title="Precipitation"
          value={
            loading
              ? "..."
              : current
                ? `${current.precip_in.toFixed(2)} in`
                : "--"
          }
          icon={Cloud}
          iconColor="text-slate-400"
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5">
          <DashboardCard title="Weather Condition Impact">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-[#0F172A] rounded animate-pulse"
                  />
                ))}
              </div>
            ) : impacts.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-8">
                No weather impact data available
              </p>
            ) : (
              <div className="space-y-3">
                {impacts.map((impact) => (
                  <div
                    key={impact.weather_condition}
                    className="flex items-center justify-between py-2 border-b border-[#2D3B4F]/30"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-white">
                        {impact.weather_condition}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {impact.observation_count} observations
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-[14px] font-bold",
                          impact.avg_delay_minutes > 3
                            ? "text-red-400"
                            : impact.avg_delay_minutes > 1.5
                              ? "text-amber-400"
                              : "text-emerald-400"
                        )}
                      >
                        {impact.avg_delay_minutes.toFixed(1)} min
                      </p>
                      <p className="text-[11px] text-slate-500">
                        avg delay
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        <div className="col-span-7">
          <DashboardCard title="Most Weather-Sensitive Routes">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-[#0F172A] rounded animate-pulse"
                  />
                ))}
              </div>
            ) : vulnRoutes.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-8">
                No vulnerability data available
              </p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-[#2D3B4F]">
                  <span>Route</span>
                  <span className="text-right">Clear Delay</span>
                  <span className="text-right">Bad Wx Delay</span>
                  <span className="text-right">Impact</span>
                </div>
                <div className="space-y-0">
                  {vulnRoutes.map((r) => {
                    const increase =
                      r.avg_delay_adverse - r.avg_delay_clear;
                    return (
                      <div
                        key={r.route_id}
                        className="grid grid-cols-[1fr_100px_100px_80px] gap-2 items-center px-2 py-2 hover:bg-[#0F172A]/50 transition-colors border-b border-[#2D3B4F]/30"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] text-white truncate">
                            {r.route_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {r.route_type_desc}
                          </p>
                        </div>
                        <span className="text-[13px] text-emerald-400 text-right">
                          {r.avg_delay_clear.toFixed(1)}m
                        </span>
                        <span className="text-[13px] text-red-400 text-right">
                          {r.avg_delay_adverse.toFixed(1)}m
                        </span>
                        <span
                          className={cn(
                            "text-[13px] font-semibold text-right",
                            increase > 2
                              ? "text-red-400"
                              : "text-amber-400"
                          )}
                        >
                          +{increase.toFixed(1)}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DashboardCard title="Temperature vs Delay">
          {tempScatter.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[13px] text-slate-500">No data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1E293B"
                />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Temp"
                  unit="F"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  axisLine={{ stroke: "#1E293B" }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Delay"
                  unit="m"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    border: "1px solid #2D3B4F",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [
                    formatTooltipValue(
                      value as number | string | undefined,
                      name === "Delay" ? " min" : "F"
                    ),
                    String(name),
                  ]}
                />
                <Scatter
                  data={tempScatter}
                  fill="#3B82F6"
                  fillOpacity={0.5}
                  r={3}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </DashboardCard>

        <DashboardCard title="Wind Speed vs Delay">
          {windScatter.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[13px] text-slate-500">No data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1E293B"
                />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Wind"
                  unit="mph"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  axisLine={{ stroke: "#1E293B" }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Delay"
                  unit="m"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    border: "1px solid #2D3B4F",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [
                    formatTooltipValue(
                      value as number | string | undefined,
                      name === "Delay" ? " min" : " mph"
                    ),
                    String(name),
                  ]}
                />
                <Scatter
                  data={windScatter}
                  fill="#06B6D4"
                  fillOpacity={0.5}
                  r={3}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}