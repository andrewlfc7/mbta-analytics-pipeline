"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
} from "recharts";

interface Props {
  params: Record<string, string | number | undefined>;
}

export function HourlyPatternSection({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/delays/temporal/hourly",
    params
  );

  if (loading) return <Loading text="Loading hourly patterns..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const hourly = data?.data?.hours || data?.hours || data?.data || [];
  const hourlyList = Array.isArray(hourly) ? hourly : [];

  // Try to separate weekday vs weekend if data has day_type field
  const hasWeekdayWeekend = hourlyList.some(
    (h: any) => h.day_type !== undefined || h.is_weekend !== undefined
  );

  let chartData: any[];

  if (hasWeekdayWeekend) {
    const grouped: Record<number, any> = {};
    hourlyList.forEach((h: any) => {
      const hour = h.hour ?? h.hour_of_day ?? 0;
      if (!grouped[hour]) {
        grouped[hour] = { hour, label: `${hour}:00` };
      }
      const isWeekend = h.is_weekend || h.day_type === "weekend";
      if (isWeekend) {
        grouped[hour].weekend = h.avg_delay_minutes ?? h.avg_delay ?? 0;
      } else {
        grouped[hour].weekday = h.avg_delay_minutes ?? h.avg_delay ?? 0;
      }
    });
    chartData = Object.values(grouped).sort((a, b) => a.hour - b.hour);
  } else {
    chartData = hourlyList
      .map((h: any) => ({
        hour: h.hour ?? h.hour_of_day ?? 0,
        label: `${h.hour ?? h.hour_of_day ?? 0}:00`,
        delay: h.avg_delay_minutes ?? h.avg_delay ?? 0,
        trips: h.trip_count ?? h.total_trips ?? 0,
      }))
      .sort((a: any, b: any) => a.hour - b.hour);
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        Hourly Delay Pattern
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Average delay by hour of day
        {hasWeekdayWeekend && ", split by weekday and weekend"}
      </p>

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <ReferenceArea x1={6} x2={9} fill="#3B82F6" fillOpacity={0.04} />
            <ReferenceArea x1={16} x2={19} fill="#F59E0B" fillOpacity={0.04} />
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
                    <p className="text-sm font-medium text-content-primary">{d.label}</p>
                    {hasWeekdayWeekend ? (
                      <>
                        {d.weekday !== undefined && (
                          <p className="text-sm text-blue-400">Weekday: {formatMinutes(d.weekday)}</p>
                        )}
                        {d.weekend !== undefined && (
                          <p className="text-sm text-purple-400">Weekend: {formatMinutes(d.weekend)}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-content-muted">Delay: {formatMinutes(d.delay)}</p>
                        <p className="text-xs text-content-faint">{d.trips?.toLocaleString()} trips</p>
                      </>
                    )}
                  </div>
                );
              }}
            />
            {hasWeekdayWeekend ? (
              <>
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#94A3B8" }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="weekday"
                  name="Weekday"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#3B82F6", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="weekend"
                  name="Weekend"
                  stroke="#A855F7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#A855F7", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="delay"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#3B82F6", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#3B82F6", strokeWidth: 2, stroke: "#0F172A" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

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