"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { HeatmapGrid } from "@/components/delays/heatmap-grid";
import { HeatmapFilters } from "@/components/delays/heatmap-filters";
import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";

export default function DelayHeatmapPage() {
  const [routeId, setRouteId] = useState<string>("all");
  const [period, setPeriod] = useState<number>(30);

  const params: Record<string, string | number | undefined> = {};
  if (routeId !== "all") params.route_id = routeId;
  if (period) params.period_days = period;

  const { data, loading, error, refetch } = useApi<any>("/delays/heatmap", params);

  return (
    <div className="space-y-8">
      <PageHeader title="Delay Heatmap" description="Average delay patterns by day and hour">
        <HeatmapFilters
          routeId={routeId}
          onRouteChange={setRouteId}
          period={period}
          onPeriodChange={setPeriod}
        />
      </PageHeader>

      {loading && <Loading text="Loading heatmap data..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && data && <HeatmapGrid data={data} />}
    </div>
  );
}