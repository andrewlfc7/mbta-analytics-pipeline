"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { OnTimeComparisonBars } from "@/components/routes/ontime-comparison";
import { DelayDistributionStacked } from "@/components/routes/delay-distribution";
import { RouteStatsTable } from "@/components/routes/route-stats-table";
import { RouteHourlyPanel } from "@/components/routes/route-hourly-panel";
import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";

export default function RoutesPage() {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const { data, loading, error, refetch } = useApi<any>("/routes/reliability");

  const routes = data?.data?.routes || data?.routes || data?.data || [];
  const routeList = Array.isArray(routes) ? routes : [];

  if (loading) return <Loading text="Loading route data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Routes"
        description="Detailed reliability and performance metrics for all MBTA lines"
      />

      <OnTimeComparisonBars routes={routeList} />
      <DelayDistributionStacked routes={routeList} />
      <RouteStatsTable
        routes={routeList}
        expandedRoute={expandedRoute}
        onToggleExpand={(routeId: string) =>
          setExpandedRoute(expandedRoute === routeId ? null : routeId)
        }
      />
      {expandedRoute && <RouteHourlyPanel routeId={expandedRoute} />}
    </div>
  );
}