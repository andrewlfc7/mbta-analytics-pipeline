"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { HeatmapFilters } from "@/components/delays/heatmap-filters";
import { DayOfWeekSection } from "@/components/temporal/day-of-week-section";
import { HourlyPatternSection } from "@/components/temporal/hourly-pattern-section";
import { RushHourCards } from "@/components/temporal/rush-hour-cards";
import { DelayProbabilityTable } from "@/components/temporal/delay-probability-table";

export default function TemporalAnalysisPage() {
  const [routeId, setRouteId] = useState<string>("all");
  const [period, setPeriod] = useState<number>(90);

  const params: Record<string, string | number | undefined> = {};
  if (routeId !== "all") params.route_id = routeId;
  if (period) params.period_days = period;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Temporal Analysis"
        description="Delay patterns across different time dimensions"
      >
        <HeatmapFilters
          routeId={routeId}
          onRouteChange={setRouteId}
          period={period}
          onPeriodChange={setPeriod}
        />
      </PageHeader>

      <DayOfWeekSection params={params} />
      <HourlyPatternSection params={params} />
      <RushHourCards params={params} />
      <DelayProbabilityTable params={params} />
    </div>
  );
}