"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes, formatPercent, formatNumber, getRouteColor, getRouteDisplayName } from "@/lib/utils";
import { X, MapPin } from "lucide-react";

interface Props {
  stopId: string;
  onClose: () => void;
}

export function StationDetailPanel({ stopId, onClose }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    `/stations/${stopId}/details`
  );

  const station = data?.data || data || null;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-brand-accent" />
          <div>
            {loading ? (
              <div className="h-5 w-40 rounded bg-slate-700 animate-pulse" />
            ) : (
              <h3 className="text-lg font-semibold text-content-primary">
                {station?.stop_name || station?.name || stopId}
              </h3>
            )}
            {station?.municipality && (
              <p className="text-sm text-content-muted">{station.municipality}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-content-muted hover:bg-slate-700/50 hover:text-content-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && <Loading text="Loading station details..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && station && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatBlock
              label="Avg Delay"
              value={formatMinutes(station.avg_delay_minutes ?? station.avg_delay ?? 0)}
            />
            <StatBlock
              label="Late %"
              value={formatPercent(station.late_percentage ?? station.late_pct ?? 0)}
            />
            <StatBlock
              label="Hotspot Score"
              value={(station.delay_hotspot_score ?? station.hotspot_score ?? station.score ?? 0).toFixed(1)}
            />
            <StatBlock
              label="Routes"
              value={String(station.route_count ?? station.routes?.length ?? 0)}
            />
            <StatBlock
              label="Predictions"
              value={formatNumber(station.total_predictions ?? station.trip_count ?? 0)}
            />
            <StatBlock
              label="P90 Delay"
              value={formatMinutes(station.p90_delay_minutes ?? station.p90_delay ?? 0)}
            />
          </div>

          {/* Route list */}
          {station.routes && station.routes.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-content-muted mb-2">Serving Routes</h4>
              <div className="flex flex-wrap gap-2">
                {station.routes.map((route: any) => {
                  const routeId = typeof route === "string" ? route : route.route_id || route.route;
                  return (
                    <span
                      key={routeId}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-slate-700/50 bg-slate-800/50"
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getRouteColor(routeId) }}
                      />
                      {getRouteDisplayName(routeId)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Occupancy if available */}
          {(station.avg_occupancy !== undefined || station.peak_occupancy !== undefined) && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {station.avg_occupancy !== undefined && (
                <div>
                  <p className="text-xs text-content-faint uppercase tracking-wider">Avg Occupancy</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-brand-accent"
                        style={{ width: `${Math.min(station.avg_occupancy * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-content-primary">
                      {(station.avg_occupancy * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
              {station.peak_occupancy !== undefined && (
                <div>
                  <p className="text-xs text-content-faint uppercase tracking-wider">Peak Occupancy</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-status-warning"
                        style={{ width: `${Math.min(station.peak_occupancy * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-content-primary">
                      {(station.peak_occupancy * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-content-faint uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-lg font-bold text-content-primary">{value}</p>
    </div>
  );
}