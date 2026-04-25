"use client";

import { useEffect, useState } from "react";
import { KPICard } from "@/components/ui/kpi-card";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Cloud, Droplets, Thermometer, Wind } from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CurrentWeather {
  temp_f: number;
  humidity: number;
  wind_mph: number;
  precip_in: number;
  condition: string;
}

interface WeatherImpact {
  condition_category: string;
  observation_count: number;
  avg_delay_minutes: number;
  routes_affected: number;
}

interface RouteVuln {
  route_id: string;
  clear_avg: number;
  snow_avg: number;
  precip_avg: number;
  wind_avg: number;
  total_trips: number;
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
        const [currentRes, impactRes, vulnRes, tempRes, windRes] = await Promise.all([
          clientFetch<{ data: any }>("/weather/current").catch(() => ({ data: null })),
          clientFetch<{ data: any[] }>("/weather/delay-impact").catch(() => ({ data: [] })),
          clientFetch<{ data: any[] }>("/weather/route-vulnerability").catch(() => ({ data: [] })),
          clientFetch<{ data: any[] }>("/weather/scatter/temperature").catch(() => ({ data: [] })),
          clientFetch<{ data: any[] }>("/weather/scatter/wind").catch(() => ({ data: [] })),
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
          (vulnRes.data || [])
            .map((row: any) => ({
              route_id: row.route_id || "",
              clear_avg: row.clear_avg ?? 0,
              snow_avg: row.snow_avg ?? 0,
              precip_avg: row.precip_avg ?? 0,
              wind_avg: row.wind_avg ?? 0,
              total_trips: row.total_trips ?? 0,
            }))
            .sort((a: RouteVuln, b: RouteVuln) => {
              const aAdverse = Math.max(a.snow_avg, a.precip_avg, a.wind_avg);
              const bAdverse = Math.max(b.snow_avg, b.precip_avg, b.wind_avg);
              return bAdverse - b.clear_avg - (aAdverse - a.clear_avg);
            })
            .slice(0, 8)
        );
        setTempScatter(
          (tempRes.data || []).slice(0, 220).map((row: any) => ({
            x: row.temperature_f ?? 0,
            y: row.avg_delay_minutes ?? 0,
            route_id: row.route_id || "",
          }))
        );
        setWindScatter(
          (windRes.data || []).slice(0, 220).map((row: any) => ({
            x: row.wind_speed_mph ?? 0,
            y: row.avg_delay_minutes ?? 0,
            route_id: row.route_id || "",
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
        <h1 className="text-5xl font-semibold tracking-tight text-white">
          Weather Impact
        </h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Use weather conditions, vulnerability rankings, and scatter plots to understand delay pressure.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <KPICard
          variant="light"
          title="Temperature"
          value={loading ? "..." : current ? `${Math.round(current.temp_f)}°F` : "--"}
          subtitle={current?.condition || ""}
          icon={Thermometer}
          iconColor="text-orange-500"
        />
        <KPICard
          variant="light"
          title="Wind Speed"
          value={loading ? "..." : current ? `${Math.round(current.wind_mph)} mph` : "--"}
          icon={Wind}
          iconColor="text-blue-500"
        />
        <KPICard
          variant="light"
          title="Humidity"
          value={loading ? "..." : current ? `${Math.round(current.humidity)}%` : "--"}
          icon={Droplets}
          iconColor="text-cyan-500"
        />
        <KPICard
          variant="light"
          title="Precipitation"
          value={loading ? "..." : current ? `${current.precip_in.toFixed(2)} in` : "--"}
          icon={Cloud}
          iconColor="text-slate-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <DashboardCard variant="light" title="Weather Condition Impact">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : impacts.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-slate-500">
                No weather impact data available
              </p>
            ) : (
              <div className="space-y-3">
                {impacts.map((impact) => (
                  <div
                    key={impact.condition_category}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-slate-900">
                        {impact.condition_category}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {impact.observation_count} observations · {impact.routes_affected} routes
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-[16px] font-semibold",
                          impact.avg_delay_minutes > 3
                            ? "text-red-500"
                            : impact.avg_delay_minutes > 1.5
                              ? "text-amber-500"
                              : "text-emerald-600"
                        )}
                      >
                        {impact.avg_delay_minutes.toFixed(1)} min
                      </p>
                      <p className="text-[11px] text-slate-500">avg delay</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        <div className="xl:col-span-8">
          <DashboardCard variant="light" title="Most Weather-Sensitive Routes">
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : vulnRoutes.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-slate-500">
                No vulnerability data available
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_110px_130px_90px] gap-3 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <span>Route</span>
                  <span className="text-right">Clear Delay</span>
                  <span className="text-right">Adverse Delay</span>
                  <span className="text-right">Impact</span>
                </div>
                {vulnRoutes.map((route) => {
                  const adverseDelay = Math.max(
                    route.snow_avg,
                    route.precip_avg,
                    route.wind_avg
                  );
                  const increase = adverseDelay - route.clear_avg;
                  return (
                    <div
                      key={route.route_id}
                      className="grid grid-cols-[1fr_110px_130px_90px] items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-slate-900">
                          {route.route_id}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {route.total_trips.toLocaleString()} observations
                        </p>
                      </div>
                      <span className="text-right text-[14px] text-emerald-600">
                        {route.clear_avg.toFixed(1)}m
                      </span>
                      <span className="text-right text-[14px] text-red-500">
                        {adverseDelay.toFixed(1)}m
                      </span>
                      <span
                        className={cn(
                          "text-right text-[14px] font-semibold",
                          increase > 2
                            ? "text-red-500"
                            : increase > 0.75
                              ? "text-amber-500"
                              : "text-emerald-600"
                        )}
                      >
                        {increase >= 0 ? "+" : ""}
                        {increase.toFixed(1)}m
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardCard variant="light" title="Temperature vs Delay">
          {tempScatter.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-[13px] text-slate-500">No data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Temperature"
                  unit="F"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Delay"
                  unit="m"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
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
                <Scatter data={tempScatter} fill="#2563EB" fillOpacity={0.45} r={3.5} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </DashboardCard>

        <DashboardCard variant="light" title="Wind Speed vs Delay">
          {windScatter.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-[13px] text-slate-500">No data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Wind"
                  unit="mph"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Delay"
                  unit="m"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
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
                <Scatter data={windScatter} fill="#0EA5A5" fillOpacity={0.45} r={3.5} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
