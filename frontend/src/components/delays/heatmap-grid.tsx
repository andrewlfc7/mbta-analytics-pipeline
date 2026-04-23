"use client";

import { useState } from "react";
import { formatMinutes, formatNumber } from "@/lib/utils";

interface Props {
  data: any;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayToIndex(day: any): number {
  if (typeof day === "number") return day;
  if (typeof day === "string") {
    const idx = DAYS.findIndex((d) => d.toLowerCase() === day.toLowerCase());
    return idx >= 0 ? idx : -1;
  }
  return -1;
}

function getHeatColor(value: number, min: number, max: number): string {
  // Green → Yellow → Orange → Red scale
  const colors = [
    { stop: 0, r: 34, g: 197, b: 94 },    // green
    { stop: 0.25, r: 132, g: 204, b: 22 }, // lime
    { stop: 0.4, r: 234, g: 179, b: 8 },   // yellow
    { stop: 0.6, r: 249, g: 115, b: 22 },  // orange
    { stop: 0.8, r: 239, g: 68, b: 68 },   // red
    { stop: 1, r: 127, g: 29, b: 29 },     // dark red
  ];

  const range = max - min || 1;
  const t = Math.max(0, Math.min(1, (value - min) / range));

  let lower = colors[0];
  let upper = colors[colors.length - 1];
  for (let i = 0; i < colors.length - 1; i++) {
    if (t >= colors[i].stop && t <= colors[i + 1].stop) {
      lower = colors[i];
      upper = colors[i + 1];
      break;
    }
  }

  const localT = (t - lower.stop) / (upper.stop - lower.stop || 1);
  const r = Math.round(lower.r + (upper.r - lower.r) * localT);
  const g = Math.round(lower.g + (upper.g - lower.g) * localT);
  const b = Math.round(lower.b + (upper.b - lower.b) * localT);

  return `rgb(${r}, ${g}, ${b})`;
}

function getTextColor(value: number, min: number, max: number): string {
  const range = max - min || 1;
  const t = (value - min) / range;
  return t > 0.5 ? "#FFFFFF" : "#0F172A";
}

export function HeatmapGrid({ data }: Props) {
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);

  const heatmapData = data?.data?.heatmap || data?.heatmap || data?.data || [];
  const metadata = data?.data?.metadata || data?.metadata || {};
  const cells = Array.isArray(heatmapData) ? heatmapData : [];

  // Build lookup
  const grid: Record<number, Record<number, any>> = {};
  let minDelay = Infinity;
  let maxDelay = -Infinity;

  cells.forEach((cell: any) => {
    const day = dayToIndex(cell.day_of_week ?? cell.day ?? 0);
    const hour = cell.hour ?? cell.hour_of_day ?? 0;
    const delay = cell.avg_delay_minutes ?? cell.avg_delay ?? 0;

    if (day < 0) return;
    if (!grid[day]) grid[day] = {};
    grid[day][hour] = cell;

    if (delay < minDelay) minDelay = delay;
    if (delay > maxDelay) maxDelay = delay;
  });

  // Clamp min to 0 for color scale if all values are positive
  const colorMin = Math.min(minDelay, 0);
  const colorMax = Math.max(maxDelay, 1);

  const allHours = cells.map((c: any) => c.hour ?? c.hour_of_day ?? 0);
  const minHour = allHours.length > 0 ? Math.min(...allHours) : 5;
  const maxHour = allHours.length > 0 ? Math.max(...allHours) : 23;
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  const selectedCellData =
    selectedCell && grid[selectedCell.day]?.[selectedCell.hour]
      ? grid[selectedCell.day][selectedCell.hour]
      : null;

  // Find worst and best
  let worstCell: any = null;
  let bestCell: any = null;
  cells.forEach((cell: any) => {
    const delay = cell.avg_delay_minutes ?? cell.avg_delay ?? 0;
    if (!worstCell || delay > (worstCell.avg_delay_minutes ?? worstCell.avg_delay ?? 0)) worstCell = cell;
    if (!bestCell || delay < (bestCell.avg_delay_minutes ?? bestCell.avg_delay ?? 0)) bestCell = cell;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
        <h3 className="text-lg font-semibold text-content-primary">
          Average Delay by Day and Hour
        </h3>
        <p className="mt-1 text-sm text-content-muted">
          Click a cell for details · Values in minutes
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th className="w-20 p-0" />
                {hours.map((hour) => (
                  <th
                    key={hour}
                    className="text-center text-[11px] font-medium text-content-faint pb-2 px-0"
                  >
                    {hour}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                <tr key={dayIndex}>
                  <td className="pr-3 py-0 text-right">
                    <span className="text-sm font-medium text-content-muted">
                      {DAY_SHORT[dayIndex]}
                    </span>
                  </td>
                  {hours.map((hour) => {
                    const cell = grid[dayIndex]?.[hour];
                    const delay = cell ? (cell.avg_delay_minutes ?? cell.avg_delay ?? 0) : null;
                    const isSelected = selectedCell?.day === dayIndex && selectedCell?.hour === hour;
                    const isAnomaly = cell?.is_anomaly ?? false;
                    const hasData = delay !== null;

                    return (
                      <td key={hour} className="p-[2px]">
                        <button
                          onClick={() => setSelectedCell({ day: dayIndex, hour })}
                          className={`
                            w-full aspect-[1.4] rounded-[4px] flex items-center justify-center
                            text-[12px] font-semibold leading-none transition-all
                            ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110 z-10 relative" : "hover:scale-105"}
                            ${isAnomaly ? "ring-1 ring-dashed ring-white/30" : ""}
                          `}
                          style={{
                            backgroundColor: hasData ? getHeatColor(delay!, colorMin, colorMax) : "#1E293B",
                            color: hasData ? getTextColor(delay!, colorMin, colorMax) : "#334155",
                          }}
                        >
                          {hasData ? delay!.toFixed(1) : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Color scale */}
        <div className="mt-5 flex items-center gap-3">
          <span className="text-[11px] font-medium text-content-faint">Early</span>
          <div className="flex h-4 flex-1 rounded-md overflow-hidden">
            {Array.from({ length: 20 }, (_, i) => {
              const v = colorMin + ((colorMax - colorMin) * i) / 19;
              return (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: getHeatColor(v, colorMin, colorMax) }}
                />
              );
            })}
          </div>
          <span className="text-[11px] font-medium text-content-faint">
            {colorMax.toFixed(0)}+ min
          </span>
        </div>
      </div>

      {/* Summary cards */}
      {(worstCell || bestCell || metadata.total_trips_analyzed || metadata.total_trips) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(metadata.total_trips_analyzed || metadata.total_trips) && (
            <div className="rounded-xl border border-slate-700/50 bg-surface-card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-content-faint">Total Trips</p>
              <p className="mt-1 text-2xl font-bold text-content-primary">
                {formatNumber(metadata.total_trips_analyzed ?? metadata.total_trips)}
              </p>
            </div>
          )}
          {worstCell && (
            <div className="rounded-xl border border-slate-700/50 bg-surface-card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-content-faint">Worst Period</p>
              <p className="mt-1 text-lg font-bold text-status-danger">
                {DAYS[dayToIndex(worstCell.day_of_week ?? worstCell.day ?? 0)]}{" "}
                {worstCell.hour ?? worstCell.hour_of_day}:00
              </p>
              <p className="text-sm text-content-muted">
                {formatMinutes(worstCell.avg_delay_minutes ?? worstCell.avg_delay ?? 0)} avg delay
              </p>
            </div>
          )}
          {bestCell && (
            <div className="rounded-xl border border-slate-700/50 bg-surface-card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-content-faint">Best Period</p>
              <p className="mt-1 text-lg font-bold text-status-success">
                {DAYS[dayToIndex(bestCell.day_of_week ?? bestCell.day ?? 0)]}{" "}
                {bestCell.hour ?? bestCell.hour_of_day}:00
              </p>
              <p className="text-sm text-content-muted">
                {formatMinutes(bestCell.avg_delay_minutes ?? bestCell.avg_delay ?? 0)} avg delay
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cell detail panel */}
      {selectedCellData && (
        <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
          <div className="flex items-center gap-3">
            <div
              className="h-4 w-4 rounded"
              style={{
                backgroundColor: getHeatColor(
                  selectedCellData.avg_delay_minutes ?? selectedCellData.avg_delay ?? 0,
                  colorMin,
                  colorMax
                ),
              }}
            />
            <h4 className="text-lg font-semibold text-content-primary">
              {DAYS[selectedCell!.day]} at {selectedCell!.hour}:00
            </h4>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-content-faint uppercase tracking-wider">Avg Delay</p>
              <p className="mt-1 text-xl font-bold text-content-primary">
                {formatMinutes(selectedCellData.avg_delay_minutes ?? selectedCellData.avg_delay ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-content-faint uppercase tracking-wider">Median</p>
              <p className="mt-1 text-xl font-bold text-content-primary">
                {formatMinutes(selectedCellData.median_delay_minutes ?? selectedCellData.median_delay ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-content-faint uppercase tracking-wider">Trips</p>
              <p className="mt-1 text-xl font-bold text-content-primary">
                {formatNumber(selectedCellData.trip_count ?? selectedCellData.total_trips ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-content-faint uppercase tracking-wider">Late %</p>
              <p className="mt-1 text-xl font-bold text-content-primary">
                {(selectedCellData.pct_late ?? selectedCellData.late_percentage ?? selectedCellData.late_pct ?? 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
