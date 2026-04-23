"use client";

import { getRouteDisplayName } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  routes: any[];
}

const DELAY_CATEGORIES = [
  { key: "early_count", label: "Early", color: "#22C55E" },
  { key: "on_time_strict_count", label: "On Time", color: "#3B82F6" },
  { key: "slightly_late_count", label: "Slightly Late", color: "#EAB308" },
  { key: "late_count", label: "Late", color: "#F97316" },
  { key: "very_late_count", label: "Very Late", color: "#EF4444" },
];

export function DelayDistributionStacked({ routes }: Props) {
  const chartData = routes.map((r: any) => {
    const routeId = r.route_id || r.route;
    const total = r.total_trips ?? r.total_predictions ?? 1;
    const result: any = {
      name: getRouteDisplayName(routeId),
      route: routeId,
    };
    DELAY_CATEGORIES.forEach((cat) => {
      const count = r[cat.key] ?? r.delay_distribution?.[cat.key] ?? 0;
      result[cat.key] = ((count / total) * 100).toFixed(1);
    });
    return result;
  });

  const hasDistributionData = chartData.some((d: any) =>
    DELAY_CATEGORIES.some((cat) => parseFloat(d[cat.key]) > 0)
  );

  if (!hasDistributionData) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
        <h3 className="text-lg font-semibold text-content-primary">
          Delay Distribution
        </h3>
        <p className="mt-4 text-sm text-content-muted text-center py-8">
          Distribution data not available for the current dataset
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        Delay Distribution by Route
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Percentage breakdown of delay categories
      </p>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#F8FAFC", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                    <p className="text-sm font-medium text-content-primary mb-1">{label}</p>
                    {payload.map((p: any) => (
                      <p key={p.name} className="text-xs text-content-muted">
                        <span style={{ color: p.color }}>{p.name}</span>: {p.value}%
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#94A3B8" }}
              iconType="square"
              iconSize={10}
            />
            {DELAY_CATEGORIES.map((cat) => (
              <Bar
                key={cat.key}
                dataKey={cat.key}
                name={cat.label}
                stackId="distribution"
                fill={cat.color}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}