"use client";

import { getRouteColor, getRouteDisplayName, formatPercent } from "@/lib/utils";
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
  routes: any[];
}

export function OnTimeComparisonBars({ routes }: Props) {
  const chartData = routes
    .map((r: any) => ({
      route: r.route_id || r.route,
      name: getRouteDisplayName(r.route_id || r.route),
      onTime: r.on_time_percentage ?? r.ontime_percentage ?? 0,
      color: getRouteColor(r.route_id || r.route),
    }))
    .sort((a, b) => b.onTime - a.onTime);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        On-Time Performance Comparison
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Percentage of trips arriving within schedule
      </p>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#F8FAFC", fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                    <p className="text-sm font-medium text-content-primary">{d.name}</p>
                    <p className="text-sm text-content-muted">
                      On-Time: {formatPercent(d.onTime)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="onTime" radius={[0, 6, 6, 0]} maxBarSize={28}>
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