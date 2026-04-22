"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes, formatPercent } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dayToIndex(day: any): number {
  if (typeof day === "number") return day;
  if (typeof day === "string") {
    const idx = DAY_FULL.findIndex((d) => d.toLowerCase() === day.toLowerCase());
    return idx >= 0 ? idx : -1;
  }
  return -1;
}

interface Props {
  params: Record<string, string | number | undefined>;
}

export function DayOfWeekSection({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/delays/temporal/day-of-week",
    params
  );

  if (loading) return <Loading text="Loading day-of-week data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const days = data?.data?.days || data?.days || data?.data || [];
  const dayList = Array.isArray(days) ? days : [];

  const chartData = dayList.map((d: any) => {
    const dayIdx = dayToIndex(d.day_of_week ?? d.day ?? 0);
    return {
      day: dayIdx,
      name: DAY_NAMES[dayIdx] || `Day ${d.day_of_week}`,
      fullName: DAY_FULL[dayIdx] || String(d.day_of_week),
      delay: d.avg_delay_minutes ?? d.avg_delay ?? 0,
      median: d.median_delay_minutes ?? d.median_delay ?? 0,
      latePercent: d.pct_late ?? d.late_percentage ?? d.late_pct ?? 0,
      trips: d.trip_count ?? d.total_trips ?? 0,
    };
  }).sort((a, b) => a.day - b.day);

  const systemAvg =
    chartData.length > 0
      ? chartData.reduce((s: number, d: any) => s + d.delay, 0) / chartData.length
      : 0;

  const worstDay = chartData.reduce(
    (max: any, d: any) => (d.delay > (max?.delay || 0) ? d : max),
    null
  );
  const pctAbove = worstDay && systemAvg > 0
    ? ((worstDay.delay - systemAvg) / systemAvg) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
        <h3 className="text-lg font-semibold text-content-primary">
          Day of Week Patterns
        </h3>
        <p className="mt-1 text-sm text-content-muted">
          Average delay by day of week
        </p>

        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#F8FAFC", fontSize: 13 }}
                tickLine={false}
                axisLine={false}
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
                      <p className="text-sm font-medium text-content-primary">{d.fullName}</p>
                      <p className="text-sm text-content-muted">Avg: {formatMinutes(d.delay)}</p>
                      <p className="text-sm text-content-muted">Median: {formatMinutes(d.median)}</p>
                      <p className="text-xs text-content-faint">Late: {formatPercent(d.latePercent)}</p>
                      <p className="text-xs text-content-faint">{d.trips.toLocaleString()} trips</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                y={systemAvg}
                stroke="#64748B"
                strokeDasharray="4 4"
                label={{
                  value: `avg ${systemAvg.toFixed(1)}m`,
                  position: "right",
                  fill: "#64748B",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="delay" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.delay > systemAvg ? "#F59E0B" : "#3B82F6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {worstDay && pctAbove > 0 && (
          <p className="mt-4 text-sm text-content-muted">
            {worstDay.fullName} has{" "}
            <span className="font-medium text-status-warning">
              {pctAbove.toFixed(0)}% higher delays
            </span>{" "}
            than average
          </p>
        )}
      </div>

      {/* Stats table */}
      <div className="rounded-xl border border-slate-700/50 bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted">Day</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">Avg Delay</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">Median</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">Late %</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">Trips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {chartData.map((d: any) => (
                <tr key={d.day} className="hover:bg-slate-700/10 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-content-primary">{d.fullName}</td>
                  <td className="px-6 py-3 text-right text-sm text-content-primary">{formatMinutes(d.delay)}</td>
                  <td className="px-6 py-3 text-right text-sm text-content-primary">{formatMinutes(d.median)}</td>
                  <td className="px-6 py-3 text-right text-sm text-content-primary">{formatPercent(d.latePercent)}</td>
                  <td className="px-6 py-3 text-right text-sm text-content-muted">{d.trips.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
