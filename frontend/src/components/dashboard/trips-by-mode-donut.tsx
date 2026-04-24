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
  bus: "#2563EB",
  light_rail: "#16A34A",
  heavy_rail: "#EF4444",
  commuter_rail: "#7C3AED",
  ferry: "#0EA5A5",
};

const modeLabels: Record<string, string> = {
  bus: "Bus",
  light_rail: "Light Rail",
  heavy_rail: "Subway",
  commuter_rail: "Commuter Rail",
  ferry: "Ferry",
};

function mapModeData(rows: any[]): { totalTrips: number; modes: ModeData[] } {
  const totalTrips = rows.reduce((sum: number, r: any) => sum + (r.trips || 0), 0);

  return {
    totalTrips,
    modes: rows.map((r: any) => {
      const modeKey = (r.mode || "").toLowerCase().replace(/ /g, "_");
      return {
        mode: modeKey,
        label: modeLabels[modeKey] || r.mode || "Unknown",
        trips: r.trips || 0,
        percentage: totalTrips > 0 ? Math.round((r.trips / totalTrips) * 100) : 0,
        color: modeColors[modeKey] || "#64748B",
      };
    }),
  };
}

export function TripsByModeDonut({
  initialRows,
  deferFetch = false,
}: {
  initialRows?: any[];
  deferFetch?: boolean;
}) {
  const [data, setData] = useState<ModeData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(initialRows) ? false : deferFetch);

  useEffect(() => {
    if (initialRows) {
      const mapped = mapModeData(initialRows);
      setTotal(mapped.totalTrips);
      setData(mapped.modes);
      setLoading(false);
      return;
    }

    if (deferFetch) {
      setLoading(true);
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const json = await clientFetch<{ data: any[] }>("/overview/trips-by-mode");
        const mapped = mapModeData(json.data || []);
        setTotal(mapped.totalTrips);
        setData(mapped.modes);
      } catch (err) {
        console.error("Trips by mode fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [deferFetch, initialRows]);

  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <div className="h-40 w-40 rounded-full bg-slate-100 animate-pulse shrink-0" />
        <div className="flex-1 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-slate-500">
        No trip data available
      </p>
    );
  }

  return (
    <div className="flex items-center gap-8">
      <div className="relative shrink-0">
        <svg width="220" height="220" viewBox="0 0 220 220">
          {renderDonutSlices(data)}
          <circle cx="110" cy="110" r="60" fill="white" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-semibold leading-none text-slate-900 ${
              total.toLocaleString().length > 5 ? "text-[32px]" : "text-[40px]"
            }`}
          >
            {total.toLocaleString()}
          </span>
          <span className="mt-2 text-[12px] text-slate-500">Total Trips</span>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {data.map((d) => (
          <div key={d.mode} className="flex items-center gap-3">
            <div
              className="h-4 w-4 rounded-md shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="flex-1 truncate text-[14px] text-slate-700">
              {d.label}
            </span>
            <span className="text-[14px] font-semibold text-slate-900">
              {d.trips.toLocaleString()}
            </span>
            <span className="w-12 text-right text-[12px] text-slate-500">
              ({d.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderDonutSlices(data: ModeData[]) {
  const radius = 84;
  const cx = 110;
  const cy = 110;
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
        stroke="#ffffff"
        strokeWidth="2"
      />
    );
  });

  return slices;
}
