"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/api";

interface ModeData {
  mode: string;
  label: string;
  trips: number;
  percentage: number;
  color: string;
}

const modeColors: Record<string, string> = {
  bus: "#3B82F6",
  light_rail: "#00843D",
  heavy_rail: "#F97316",
  commuter_rail: "#8B5CF6",
  ferry: "#06B6D4",
};

const modeLabels: Record<string, string> = {
  bus: "Bus",
  light_rail: "Light Rail",
  heavy_rail: "Heavy Rail",
  commuter_rail: "Commuter Rail",
  ferry: "Ferry",
};

export function TripsByModeDonut() {
  const [data, setData] = useState<ModeData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const json = await clientFetch<{ data: any[] }>(
          "/overview/trips-by-mode"
        );

        const rows = json.data || [];
        const totalTrips = rows.reduce(
          (sum: number, r: any) => sum + (r.trips || 0),
          0
        );

        setTotal(totalTrips);
        setData(
          rows.map((r: any) => {
            const modeKey = (r.mode || "")
              .toLowerCase()
              .replace(/ /g, "_");
            return {
              mode: modeKey,
              label: modeLabels[modeKey] || r.mode || "Unknown",
              trips: r.trips || 0,
              percentage:
                totalTrips > 0
                  ? Math.round((r.trips / totalTrips) * 100)
                  : 0,
              color: modeColors[modeKey] || "#64748B",
            };
          })
        );
      } catch (err) {
        console.error("Trips by mode fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <div className="h-36 w-36 rounded-full bg-[#0F172A] animate-pulse shrink-0" />
        <div className="space-y-3 flex-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-4 bg-[#0F172A] rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-[13px] text-slate-500 text-center py-8">
        No trip data available
      </p>
    );
  }

  return (
    <div className="flex items-center gap-6">
      {/* SVG Donut */}
      <div className="relative shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          {renderDonutSlices(data)}
          <circle cx="70" cy="70" r="40" fill="#1E293B" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400">Total Trips</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2.5 flex-1">
        {data.map((d) => (
          <div key={d.mode} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-[12px] text-slate-300 flex-1 truncate">
              {d.label}
            </span>
            <span className="text-[12px] font-semibold text-white">
              {d.trips.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 w-10 text-right">
              ({d.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderDonutSlices(data: ModeData[]) {
  const radius = 55;
  const cx = 70;
  const cy = 70;
  let cumulative = 0;
  const slices: JSX.Element[] = [];

  data.forEach((d, i) => {
    const pct = d.percentage / 100;
    if (pct <= 0) return;

    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;

    slices.push(
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={d.color}
        stroke="#1E293B"
        strokeWidth="2"
      />
    );
  });

  return slices;
}