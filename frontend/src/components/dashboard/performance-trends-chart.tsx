"use client";

import { useState, useEffect } from "react";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,

} from "recharts";

type MetricTab = "on_time" | "avg_delay" | "trips";

interface TrendPoint {
  hour: number;
  label: string;
  [mode: string]: number | string;
}

const modeLineColors: Record<string, string> = {
  all: "#3B82F6",
  light_rail: "#00843D",
  heavy_rail: "#F97316",
  commuter_rail: "#8B5CF6",
  ferry: "#06B6D4",
  bus: "#60A5FA",
};

const modeLineLabels: Record<string, string> = {
  all: "All Modes",
  light_rail: "Light Rail",
  heavy_rail: "Heavy Rail",
  commuter_rail: "Commuter Rail",
  ferry: "Ferry",
  bus: "Bus",
};

export function PerformanceTrendsChart() {
  const [metric, setMetric] = useState<MetricTab>("on_time");
  const [data, setData] = useState<TrendPoint[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrends() {
      setLoading(true);
      try {
        const json = await clientFetch<{ data: any[] }>(
          "/overview/performance-trends",
          { day_type: "weekday" }
        );

        const rows = json.data || [];

        // Pivot: group by hour, create columns per mode
        const hourMap = new Map<number, TrendPoint>();
        const modeSet = new Set<string>();

        // First pass: compute "all modes" averages
        const hourAllMap = new Map<
          number,
          { totalTrips: number; weightedOT: number; weightedDelay: number }
        >();

        for (const row of rows) {
          const hour = row.hour_of_day;
          const modeKey = (row.mode || "")
            .toLowerCase()
            .replace(/ /g, "_");
          modeSet.add(modeKey);

          if (!hourAllMap.has(hour)) {
            hourAllMap.set(hour, {
              totalTrips: 0,
              weightedOT: 0,
              weightedDelay: 0,
            });
          }
          const agg = hourAllMap.get(hour)!;
          const trips = row.trips || 0;
          agg.totalTrips += trips;
          agg.weightedOT += (row.on_time_pct || 0) * trips;
          agg.weightedDelay += (row.avg_delay_minutes || 0) * trips;
        }

        // Build chart data
        for (const row of rows) {
          const hour = row.hour_of_day;
          const modeKey = (row.mode || "")
            .toLowerCase()
            .replace(/ /g, "_");

          if (!hourMap.has(hour)) {
            const allAgg = hourAllMap.get(hour);
            const allOT =
              allAgg && allAgg.totalTrips > 0
                ? Math.round(allAgg.weightedOT / allAgg.totalTrips * 10) / 10
                : 0;
            const allDelay =
              allAgg && allAgg.totalTrips > 0
                ? Math.round(allAgg.weightedDelay / allAgg.totalTrips * 10) / 10
                : 0;

            hourMap.set(hour, {
              hour,
              label: formatHour(hour),
              all_on_time: allOT,
              all_avg_delay: allDelay,
              all_trips: allAgg?.totalTrips || 0,
            });
          }

          const point = hourMap.get(hour)!;
          point[`${modeKey}_on_time`] = row.on_time_pct || 0;
          point[`${modeKey}_avg_delay`] = row.avg_delay_minutes || 0;
          point[`${modeKey}_trips`] = row.trips || 0;
        }

        const sorted = Array.from(hourMap.values()).sort(
          (a, b) => a.hour - b.hour
        );
        setData(sorted);
        setModes(Array.from(modeSet));
      } catch (err) {
        console.error("Performance trends fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, []);

  const tabs: { key: MetricTab; label: string }[] = [
    { key: "on_time", label: "On-Time Performance" },
    { key: "avg_delay", label: "Avg Delay" },
    { key: "trips", label: "Completed Trips" },
  ];

  const metricSuffix: Record<MetricTab, string> = {
    on_time: "_on_time",
    avg_delay: "_avg_delay",
    trips: "_trips",
  };

  const _yAxisLabel: Record<MetricTab, string> = {
    on_time: "%",
    avg_delay: "min",
    trips: "trips",
  };

  // Lines to render: "all" + each mode
  const lineKeys = ["all", ...modes];

  if (loading) {
    return (
      <div>
        <div className="flex gap-1 mb-4">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className="h-7 w-32 bg-[#0F172A] rounded animate-pulse"
            />
          ))}
        </div>
        <div className="h-48 bg-[#0F172A] rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      {/* Metric Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMetric(tab.key)}
            className={cn(
              "text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors",
              metric === tab.key
                ? "bg-blue-600/20 text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="h-48 rounded-lg bg-[#0F172A] border border-[#2D3B4F] flex items-center justify-center">
          <p className="text-[13px] text-slate-500">
            No trend data available
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1E293B"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={{ stroke: "#1E293B" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              width={36}
              unit={metric === "on_time" ? "%" : ""}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1E293B",
                border: "1px solid #2D3B4F",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#94A3B8" }}
              itemStyle={{ color: "#F8FAFC" }}
            />
            {lineKeys.map((modeKey) => (
              <Line
                key={modeKey}
                type="monotone"
                dataKey={`${modeKey}${metricSuffix[metric]}`}
                stroke={modeLineColors[modeKey] || "#64748B"}
                strokeWidth={modeKey === "all" ? 2.5 : 1.5}
                dot={false}
                name={modeLineLabels[modeKey] || modeKey}
                strokeDasharray={modeKey === "all" ? "" : ""}
                opacity={modeKey === "all" ? 1 : 0.7}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-3 justify-center flex-wrap">
        {lineKeys.map((modeKey) => (
          <div key={modeKey} className="flex items-center gap-1.5">
            <div
              className="h-0.5 w-4 rounded-full"
              style={{
                backgroundColor:
                  modeLineColors[modeKey] || "#64748B",
              }}
            />
            <span className="text-[10px] text-slate-500">
              {modeLineLabels[modeKey] || modeKey}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}