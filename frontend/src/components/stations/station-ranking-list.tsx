"use client";

import { useState } from "react";
import { formatMinutes, formatPercent, getDelayColor } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface Props {
  data: any;
  onSelectStation: (stopId: string) => void;
  selectedStation: string | null;
}

export function StationRankingList({ data, onSelectStation, selectedStation }: Props) {
  const [showAll, setShowAll] = useState(false);

  const stations = data?.data?.stations || data?.stations || data?.data || [];
  const stationList = Array.isArray(stations) ? stations : [];

  const display = showAll ? stationList : stationList.slice(0, 15);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h3 className="text-lg font-semibold text-content-primary">
          Station Rankings
        </h3>
        <p className="text-sm text-content-muted">
          {stationList.length} stations ranked
        </p>
      </div>

      <div className="max-h-[460px] overflow-y-auto">
        <div className="divide-y divide-slate-700/20">
          {display.map((station: any, index: number) => {
            const stopId = station.stop_id || station.id || "";
            const delay = station.avg_delay_minutes ?? station.avg_delay ?? 0;
            const color = getDelayColor(delay);
            const isSelected = selectedStation === stopId;
            const score = station.delay_hotspot_score ?? station.hotspot_score ?? station.score ?? 0;
            const latePercent = station.late_pct ?? station.late_percentage ?? 0;

            return (
              <button
                key={stopId || index}
                onClick={() => onSelectStation(stopId)}
                className={`w-full text-left px-6 py-3 transition-colors ${
                  isSelected
                    ? "bg-brand-accent/10"
                    : "hover:bg-slate-700/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-content-faint mt-0.5 w-6 text-right shrink-0">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-sm font-medium text-content-primary truncate">
                        {station.stop_name || station.name}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-content-faint">
                      {formatMinutes(delay)} avg, {formatPercent(latePercent)} late
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-content-muted shrink-0">
                    {score.toFixed(1)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {!showAll && stationList.length > 15 && (
        <div className="border-t border-slate-700/50 px-6 py-3">
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1 text-sm text-brand-accent hover:text-blue-400 transition-colors"
          >
            Show all {stationList.length} stations
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}