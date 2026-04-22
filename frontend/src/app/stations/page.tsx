"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StationMap } from "@/components/stations/station-map";
import { StationRankingList } from "@/components/stations/station-ranking-list";
import { StationDetailPanel } from "@/components/stations/station-detail-panel";
import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";

export default function StationsPage() {
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("delay_hotspot_score");

  const { data: mapData, loading: mapLoading } = useApi<any>("/stations/map");
  const {
    data: perfData,
    loading: perfLoading,
    error: perfError,
    refetch,
  } = useApi<any>("/stations/performance", { sort_by: sortBy, limit: 249 });

  const loading = mapLoading || perfLoading;

  return (
    <div className="space-y-8">
      <PageHeader title="Stations" description="Station performance and geographic delay patterns">
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-700 bg-surface-card px-3 py-2 text-sm text-content-primary focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
          >
            <option value="delay_hotspot_score">Hotspot Score</option>
            <option value="avg_delay">Avg Delay</option>
            <option value="late_percentage">Late %</option>
            <option value="total_predictions">Total Trips</option>
          </select>
        </div>
      </PageHeader>

      {loading && <Loading text="Loading station data..." />}
      {perfError && <ErrorState message={perfError} onRetry={refetch} />}

      {!loading && !perfError && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StationMap
              data={mapData}
              onSelectStation={setSelectedStation}
              selectedStation={selectedStation}
            />
          </div>
          <div>
            <StationRankingList
              data={perfData}
              onSelectStation={setSelectedStation}
              selectedStation={selectedStation}
            />
          </div>
        </div>
      )}

      {selectedStation && (
        <StationDetailPanel
          stopId={selectedStation}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  );
}