"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes } from "@/lib/utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

interface Props {
  params: Record<string, string | number | undefined>;
}

export function TempScatter({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/weather/scatter/temperature",
    params
  );

  if (loading) return <Loading text="Loading temperature data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const points = data?.data?.points || data?.points || data?.data || [];
  const pointList = Array.isArray(points) ? points : [];

  const chartData = pointList.map((p: any) => ({
    temp: p.temperature_f ?? p.temperature ?? p.temp ?? 0,
    delay: p.avg_delay_minutes ?? p.avg_delay ?? 0,
    trips: p.trip_count ?? p.total_trips ?? 10,
  }));

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        Temperature vs Delay
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        How temperature affects average delay
      </p>

      {chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-content-muted">
          No temperature data available
        </p>
      ) : (
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="temp"
                name="Temperature"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Temperature (F)",
                  position: "insideBottom",
                  offset: -5,
                  fill: "#64748B",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="delay"
                name="Delay"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}m`}
              />
              <ZAxis
                type="number"
                dataKey="trips"
                range={[20, 200]}
                name="Trips"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                      <p className="text-sm text-content-muted">
                        Temp: {d.temp.toFixed(0)}F
                      </p>
                      <p className="text-sm text-content-muted">
                        Delay: {formatMinutes(d.delay)}
                      </p>
                      <p className="text-xs text-content-faint">
                        {d.trips.toLocaleString()} trips
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter data={chartData} fill="#3B82F6" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}