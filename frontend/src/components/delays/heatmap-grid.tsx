"use client";

import { useState } from "react";
import { getDelayColor, formatMinutes, formatNumber } from "@/lib/utils";

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

export function HeatmapGrid({ data }: Props) {
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);

  const heatmapData = data?.data?.heatmap || data?.heatmap || data?.data || [];
  const metadata = data?.data?.metadata || data?.metadata || {};
  const cells = Array.isArray(heatmapData) ? heatmapData : [];

  // Build lookup: dayIndex (number) -> hour -> cell data
  const grid: Record<number, Record<number, any>> = {};
  let minDelay = Infinity;
  let maxDelay = -Infinity;

  cells.forEach((cell: any) => {
    const day = dayToIndex(cell.day_of_week ?? cell.day ?? 0);
    const hour = cell.hour ?? cell.hour_of_day ?? 0;
    const delay = cell.avg_delay_minutes ?? cell.avg_delay ?? 0;

    if (day < 0) return; // skip unrecognized day

    if (!grid[day]) grid[day] = {};
    grid[day][hour] = cell;

    if (delay < minDelay) minDelay = delay;
    if (delay > maxDelay) maxDelay = delay;
  });

  // Determine hour range from data
  const allHours = cells.map((c: any) => c.hour ?? c.hour_of_day ?? 0);
  const minHour = allHours.length > 0 ? Math.min(...allHours) : 5;
  const maxHour = allHours.length > 0 ? Math.max(...allHours) : 23;
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  const selectedCellData =
    selectedCell && grid[selectedCell.day]?.[selectedCell.hour]
      ? grid[selectedCell.day][selectedCell.hour]
      : null;

  // Find worst and best cells
  let worstCell: any = null;
  let bestCell: any = null;
  cells.forEach((cell: any) => {
    const delay = cell.avg_delay_minutes ?? cell.avg_delay ?? 0;
    if (!worstCell || delay > (worstCell.avg_delay_minutes ?? worstCell.avg_delay ?? 0)) {
      worstCell = cell;
    }
    if (!bestCell || delay < (bestCell.avg_delay_minutes ?? bestCell.avg_delay ?? 0)) {
      bestCell = cell;
    }
  });

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
        <h3 className="text-lg font-semibold text-content-primary">
          Average Delay by Day and Hour
        </h3>
        <p className="mt-1 text-sm text-content-muted">
          Click a cell for details. Values in minutes.
        </p>

        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Hour headers */}
            <div className="flex">
              <div className="w-16 shrink-0" />
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center text-xs text-content-faint pb-2"
                >
                  {hour}:00
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
              <div key={dayIndex} className="flex">
                <div className="w-16 shrink-0 flex items-center text-sm text-content-muted pr-2">
                  {DAY_SHORT[dayIndex]}
                </div>
                {hours.map((hour) => {
                  const cell = grid[dayIndex]?.[hour];
                  const delay = cell
                    ? (cell.avg_delay_minutes ?? cell.avg_delay ?? 0)
                    : null;
                  const isSelected =
                    selectedCell?.day === dayIndex && selectedCell?.hour === hour;
                  const isAnomaly = cell?.is_anomaly ?? false;

                  return (
                    <div
                      key={hour}
                      className={`flex-1 aspect-square m-0.5 rounded cursor-pointer flex items-center justify-center text-xs font-medium transition-all ${
                        isSelected ? "ring-2 ring-white" : ""
                      } ${isAnomaly ? "border border-dashed border-white/40" : ""}`}
                      style={{
                        backgroundColor:
                          delay !== null ? getDelayColor(delay) : "#1E293B",
                        color: delay !== null && delay > 4 ? "#FFF" : delay !== null ? "#0F172A" : "#64748B",
                      }}
                      onClick={() => setSelectedCell({ day: dayIndex, hour })}
                      title={
                        delay !== null
                          ? `${DAYS[dayIndex]} ${hour}:00 — ${delay.toFixed(1)}m`
                          : "No data"
                      }
                    >
                      {delay !== null ? delay.toFixed(1) : "-"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Color scale legend */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-content-faint">0 min</span>
          <div className="flex h-3 flex-1 rounded overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <div
                key={v}
                className="flex-1"
                style={{ backgroundColor: getDelayColor(v) }}
              />
            ))}
          </div>
          <span className="text-xs text-content-faint">10+ min</span>
        </div>
      </div>

      {/* Metadata bar */}
      {(worstCell || bestCell || metadata.total_trips_analyzed || metadata.total_trips) && (
        <div className="flex flex-wrap gap-6 rounded-xl border border-slate-700/50 bg-surface-card px-6 py-4 text-sm text-content-muted">
          {(metadata.total_trips_analyzed || metadata.total_trips) && (
            <span>Total trips: {formatNumber(metadata.total_trips_analyzed ?? metadata.total_trips)}</span>
          )}
          {worstCell && (
            <span>
              Worst:{" "}
              <span className="text-status-danger">
                {DAYS[dayToIndex(worstCell.day_of_week ?? worstCell.day ?? 0)]}{" "}
                {worstCell.hour ?? worstCell.hour_of_day}:00 (
                {formatMinutes(worstCell.avg_delay_minutes ?? worstCell.avg_delay ?? 0)})
              </span>
            </span>
          )}
          {bestCell && (
            <span>
              Best:{" "}
              <span className="text-status-success">
                {DAYS[dayToIndex(bestCell.day_of_week ?? bestCell.day ?? 0)]}{" "}
                {bestCell.hour ?? bestCell.hour_of_day}:00 (
                {formatMinutes(bestCell.avg_delay_minutes ?? bestCell.avg_delay ?? 0)})
              </span>
            </span>
          )}
        </div>
      )}

      {/* Cell detail panel */}
      {selectedCellData && (
        <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
          <h4 className="text-lg font-semibold text-content-primary">
            {DAYS[selectedCell!.day]} {selectedCell!.hour}:00
          </h4>
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

          {/* Top stations if available */}
          {selectedCellData.top_stations && selectedCellData.top_stations.length > 0 && (
            <div className="mt-6">
              <h5 className="text-sm font-medium text-content-muted mb-3">
                Top Stations by Delay
              </h5>
              <div className="space-y-2">
                {selectedCellData.top_stations.slice(0, 5).map((station: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-content-primary">
                      {i + 1}. {station.stop_name || station.station || station.name}
                    </span>
                    <span className="text-content-muted">
                      {formatMinutes(station.avg_delay_minutes ?? station.avg_delay ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}