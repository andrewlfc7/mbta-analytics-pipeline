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
} from "recharts";

interface Props {
  params: Record<string, string | number | undefined>;
}

interface ConditionRecord {
  condition?: string;
  weather_condition?: string;
  avg_delay_minutes?: number;
  avg_delay?: number;
  trip_count?: number;
  total_trips?: number;
}

interface ChartDatum {
  condition: string;
  delay: number;
  multiplier: number;
  pctChange: number;
  trips: number;
  color: string;
}

const CONDITION_COLORS: Record<string, string> = {
  Clear: "#3B82F6",
  clear: "#3B82F6",
  Cloudy: "#8B5CF6",
  cloudy: "#8B5CF6",
  Clouds: "#8B5CF6",
  Rain: "#F59E0B",
  rain: "#F59E0B",
  Snow: "#EF4444",
  snow: "#EF4444",
  Fog: "#6B7280",
  fog: "#6B7280",
  Drizzle: "#A3E635",
  drizzle: "#A3E635",
};

export function WeatherOverviewBars({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/weather/overview",
    params
  );

  if (loading) return <Loading text="Loading weather impact data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const conditions =
    data?.data?.conditions || data?.conditions || data?.data || [];
  const conditionList: ConditionRecord[] = Array.isArray(conditions)
    ? conditions
    : [];

  const baseline = conditionList.find(
    (c) => (c.condition || c.weather_condition || "").toLowerCase() === "clear"
  );

  const baselineDelay =
    baseline?.avg_delay_minutes ?? baseline?.avg_delay ?? 0;

  const chartData: ChartDatum[] = conditionList
    .map((c) => {
      const condition = c.condition || c.weather_condition || "Unknown";
      const delay = c.avg_delay_minutes ?? c.avg_delay ?? 0;
      const multiplier = baselineDelay > 0 ? delay / baselineDelay : 1;
      const pctChange =
        baselineDelay > 0
          ? ((delay - baselineDelay) / baselineDelay) * 100
          : 0;

      return {
        condition,
        delay,
        multiplier,
        pctChange,
        trips: c.trip_count ?? c.total_trips ?? 0,
        color:
          CONDITION_COLORS[condition] ||
          CONDITION_COLORS[condition.toLowerCase()] ||
          "#6B7280",
      };
    })
    .sort((a, b) => a.delay - b.delay);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        Delay by Weather Condition
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Average delay with multiplier vs clear baseline
      </p>

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 80, left: 0, bottom: 0 }}
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
              dataKey="condition"
              tick={{ fill: "#F8FAFC", fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ChartDatum;

                return (
                  <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                    <p className="text-sm font-medium text-content-primary">
                      {d.condition}
                    </p>
                    <p className="text-sm text-content-muted">
                      Avg Delay: {formatMinutes(d.delay)}
                    </p>
                    <p className="text-sm text-content-muted">
                      Multiplier: {d.multiplier.toFixed(1)}x
                    </p>
                    {d.pctChange !== 0 && (
                      <p className="text-xs text-content-faint">
                        {d.pctChange > 0 ? "+" : ""}
                        {d.pctChange.toFixed(0)}% vs clear
                      </p>
                    )}
                    <p className="text-xs text-content-faint">
                      {d.trips.toLocaleString()} trips
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="delay"
              radius={[0, 6, 6, 0]}
              maxBarSize={28}
              label={(props: any) => {
                const x = Number(props?.x ?? 0);
                const y = Number(props?.y ?? 0);
                const width = Number(props?.width ?? 0);
                const index = Number(props?.index ?? 0);
                const multiplier = chartData[index]?.multiplier ?? 0;

                return (
                  <text
                    x={x + width + 8}
                    y={y + 16}
                    fill="#94A3B8"
                    fontSize={12}
                  >
                    {multiplier.toFixed(1)}x
                  </text>
                );
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}