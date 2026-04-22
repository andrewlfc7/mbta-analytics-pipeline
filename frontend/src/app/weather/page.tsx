"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { WeatherOverviewBars } from "@/components/weather/weather-overview-bars";
import { TempScatter } from "@/components/weather/temp-scatter";
import { WindScatter } from "@/components/weather/wind-scatter";
import { RouteVulnerabilityTable } from "@/components/weather/route-vulnerability-table";

export default function WeatherPage() {
  const [routeId, setRouteId] = useState<string>("all");

  const params: Record<string, string | number | undefined> = {};
  if (routeId !== "all") params.route_id = routeId;

  const ROUTES = [
    { value: "all", label: "All Routes" },
    { value: "Red", label: "Red Line" },
    { value: "Blue", label: "Blue Line" },
    { value: "Orange", label: "Orange Line" },
    { value: "Green-B", label: "Green Line B" },
    { value: "Green-C", label: "Green Line C" },
    { value: "Green-D", label: "Green Line D" },
    { value: "Green-E", label: "Green Line E" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Weather Impact"
        description="How weather conditions affect transit performance"
      >
        <select
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-surface-card px-3 py-2 text-sm text-content-primary focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
        >
          {ROUTES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </PageHeader>

      <WeatherOverviewBars params={params} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TempScatter params={params} />
        <WindScatter params={params} />
      </div>

      <RouteVulnerabilityTable />
    </div>
  );
}