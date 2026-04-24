"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MetricTab = "on_time" | "avg_delay" | "trips";

interface TrendPoint {
  hour: number;
  label: string;
  [mode: string]: number | string;
}

const modeLineColors: Record<string, string> = {
  all: "#2563EB",
  light_rail: "#16A34A",
  heavy_rail: "#EF4444",
  commuter_rail: "#7C3AED",
  ferry: "#0EA5A5",
  bus: "#60A5FA",
};

const modeLineLabels: Record<string, string> = {
  all: "All Modes",
  light_rail: "Light Rail",
  heavy_rail: "Subway",
  commuter_rail: "Commuter Rail",
  ferry: "Ferry",
  bus: "Bus",
};

function mapTrendRows(rows: any[]): { points: TrendPoint[]; modes: string[] } {
  const hourMap = new Map<number, TrendPoint>();
  const modeSet = new Set<string>();
  const hourAllMap = new Map<
    number,
    { totalTrips: number; weightedOT: number; weightedDelay: number }
  >();

  for (const row of rows) {
    const hour = row.hour_of_day;
    const modeKey = (row.mode || "").toLowerCase().replace(/ /g, "_");
    modeSet.add(modeKey);

    if (!hourAllMap.has(hour)) {
      hourAllMap.set(hour, { totalTrips: 0, weightedOT: 0, weightedDelay: 0 });
    }
    const agg = hourAllMap.get(hour)!;
    const trips = row.trips || 0;
    agg.totalTrips += trips;
    agg.weightedOT += (row.on_time_pct || 0) * trips;
    agg.weightedDelay += (row.avg_delay_minutes || 0) * trips;
  }

  for (const row of rows) {
    const hour = row.hour_of_day;
    const modeKey = (row.mode || "").toLowerCase().replace(/ /g, "_");

    if (!hourMap.has(hour)) {
      const allAgg = hourAllMap.get(hour);
      const allOT =
        allAgg && allAgg.totalTrips > 0
          ? Math.round((allAgg.weightedOT / allAgg.totalTrips) * 10) / 10
          : 0;
      const allDelay =
        allAgg && allAgg.totalTrips > 0
          ? Math.round((allAgg.weightedDelay / allAgg.totalTrips) * 10) / 10
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

  return {
    points: Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour),
    modes: Array.from(modeSet),
  };
}

export function PerformanceTrendsChart({
  initialRows,
  deferFetch = false,
}: {
  initialRows?: any[];
  deferFetch?: boolean;
}) {
  const [metric, setMetric] = useState<MetricTab>("on_time");
  const [data, setData] = useState<TrendPoint[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(initialRows) ? false : deferFetch);

  useEffect(() => {
    if (initialRows) {
      const mapped = mapTrendRows(initialRows);
      setData(mapped.points);
      setModes(mapped.modes);
      setLoading(false);
      return;
    }

    if (deferFetch) {
      setLoading(true);
      return;
    }

    async function fetchTrends() {
      setLoading(true);
      try {
        const json = await clientFetch<{ data: any[] }>(
          "/overview/performance-trends",
          { day_type: "weekday" }
        );

        const mapped = mapTrendRows(json.data || []);
        setData(mapped.points);
        setModes(mapped.modes);
      } catch (err) {
        console.error("Performance trends fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTrends();
  }, [deferFetch, initialRows]);

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

  const lineKeys = ["all", ...modes];

  if (loading) {
    return (
      <div>
        <div className="mb-4 flex gap-2">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className="h-9 w-32 rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMetric(tab.key)}
            className={cn(
              "rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors",
              metric === tab.key
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <p className="text-[13px] text-slate-500">No trend data available</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-slate-500">
            {lineKeys.map((modeKey) => (
              <div key={modeKey} className="flex items-center gap-2">
                <span
                  className="h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: modeLineColors[modeKey] || "#64748B" }}
                />
                {modeLineLabels[modeKey] || modeKey}
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748B" }}
                axisLine={{ stroke: "#E2E8F0" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                width={40}
                unit={metric === "on_time" ? "%" : ""}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "14px",
                  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#64748B" }}
                itemStyle={{ color: "#0F172A" }}
              />
              {lineKeys.map((modeKey) => (
                <Line
                  key={modeKey}
                  type="monotone"
                  dataKey={`${modeKey}${metricSuffix[metric]}`}
                  stroke={modeLineColors[modeKey] || "#64748B"}
                  strokeWidth={modeKey === "all" ? 2.75 : 1.8}
                  dot={false}
                  name={modeLineLabels[modeKey] || modeKey}
                  opacity={modeKey === "all" ? 1 : 0.8}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}
