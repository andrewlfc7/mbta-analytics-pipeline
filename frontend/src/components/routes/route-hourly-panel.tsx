"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { getRouteColor, getRouteDisplayName, formatMinutes } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

interface Props {
  routeId: string;
}

export function RouteHourlyPanel({ routeId }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    `/routes/${routeId}/hourly`
  );

  if (loading) return <Loading text={`Loading hourly data for ${getRouteDisplayName(routeId)}...`} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const hourly = data?.data?.hourly || data?.hourly || data?.data || [];
  const hourlyList = Array.isArray(hourly) ? hourly : [];

  const chartData = hourlyList
    .map((h: any) => ({
      hour: h.hour ?? h.hour_of_day ?? 0,
      label: `${h.hour ?? h.hour_of_day ?? 0}:00`,
      delay: h.avg_delay_minutes ?? h.avg_delay ?? 0,
      trips: h.trip_count ?? h.total_trips ?? 0,
      period: h.time_period ?? h.period ?? "",
    }))
    .sort((a: any, b: any) => a.hour - b.hour);

  const color = getRouteColor(routeId);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        {getRouteDisplayName(routeId)} — Hourly Delay Pattern
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Average delay by hour of day
      </p>

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-content-muted">
          No hourly data available
        </p>
      ) : (
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              {/* AM Rush band */}
              <ReferenceArea x1={6} x2={9} fill="#3B82F6" fillOpacity={0.05} />
              {/* PM Rush band */}
              <ReferenceArea x1={16} x2={19} fill="#F59E0B" fillOpacity={0.05} />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}:00`}
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}m`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                      <p className="text-sm font-medium text-content-primary">
                        {d.label}
                      </p>
                      <p className="text-sm text-content-muted">
                        Delay: {formatMinutes(d.delay)}
                      </p>
                      <p className="text-xs text-content-faint">
                        {d.trips.toLocaleString()} trips
                      </p>
                      {d.period && (
                        <p className="text-xs text-content-faint capitalize">
                          {d.period.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="delay"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "#0F172A" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 flex items-center gap-6 text-xs text-content-faint">
        <div className="flex items-center gap-2">
          <div className="h-3 w-6 rounded bg-blue-500/10 border border-blue-500/20" />
          <span>AM Rush (6-9)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-6 rounded bg-amber-500/10 border border-amber-500/20" />
          <span>PM Rush (4-7)</span>
        </div>
      </div>
    </div>
  );
}