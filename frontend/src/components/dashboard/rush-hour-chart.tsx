"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

const PERIOD_COLORS: Record<string, string> = {
  am_rush: "#3B82F6",
  morning_rush: "#3B82F6",
  midday: "#8B5CF6",
  pm_rush: "#F59E0B",
  evening_rush: "#F59E0B",
  evening: "#22C55E",
  off_peak: "#6B7280",
};

const PERIOD_LABELS: Record<string, string> = {
  am_rush: "AM Rush",
  morning_rush: "AM Rush",
  midday: "Midday",
  pm_rush: "PM Rush",
  evening_rush: "PM Rush",
  evening: "Evening",
  off_peak: "Off-Peak",
};

export function RushHourChart() {
  const { data, loading, error, refetch } = useApi<any>(
    "/delays/temporal/rush-hour-comparison"
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const periods = data?.data?.periods || data?.periods || data?.data || [];
  const chartData = Array.isArray(periods)
    ? periods.map((p: any) => ({
        name:
          PERIOD_LABELS[p.period] ||
          PERIOD_LABELS[p.time_period] ||
          p.period ||
          p.time_period,
        delay: p.avg_delay_minutes ?? p.avg_delay ?? 0,
        period: p.period || p.time_period,
        trips: p.total_trips ?? p.trip_count ?? 0,
        onTimePct: p.on_time_pct ?? p.on_time_percentage ?? null,
      }))
    : [];

  const baseline =
    chartData.length > 0
      ? chartData.reduce((sum: number, d: any) => sum + d.delay, 0) /
        chartData.length
      : 0;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        Rush Hour Comparison
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Average delay by time period
      </p>
      <div className="mt-6" style={{ width: "100%", minHeight: 256, height: 256 }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}m`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#F8FAFC", fontSize: 13 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                      <p className="text-sm font-medium text-content-primary">
                        {d.name}
                      </p>
                      <p className="text-sm text-content-muted">
                        Avg Delay: {formatMinutes(d.delay)}
                      </p>
                      {d.onTimePct !== null && (
                        <p className="text-sm text-content-muted">
                          On-Time: {d.onTimePct.toFixed(1)}%
                        </p>
                      )}
                      <p className="text-xs text-content-faint">
                        {d.trips.toLocaleString()} trips
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x={baseline}
                stroke="#64748B"
                strokeDasharray="4 4"
                label={{
                  value: "avg",
                  position: "top",
                  fill: "#64748B",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="delay" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {chartData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PERIOD_COLORS[entry.period] || "#6B7280"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-content-muted">No rush hour data available</p>
          </div>
        )}
      </div>
      {chartData.length > 0 &&
        (() => {
          const pmRush = chartData.find(
            (d: any) =>
              d.period === "pm_rush" || d.period === "evening_rush"
          );
          if (pmRush && baseline > 0) {
            const pctAbove =
              ((pmRush.delay - baseline) / baseline) * 100;
            if (pctAbove > 0) {
              return (
                <p className="mt-4 text-sm text-content-muted">
                  PM Rush is{" "}
                  <span className="font-medium text-status-warning">
                    {pctAbove.toFixed(0)}% above baseline
                  </span>
                </p>
              );
            }
          }
          return null;
        })()}
    </div>
  );
}