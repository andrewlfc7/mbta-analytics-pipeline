import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { DashboardKPIs } from "@/components/dashboard/kpi-cards";
import { RouteRankingTable } from "@/components/dashboard/route-ranking-table";
import { RushHourChart } from "@/components/dashboard/rush-hour-chart";
import { AlertsFeed } from "@/components/dashboard/alerts-feed";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="MBTA Analytics Dashboard"
        description="System-wide performance overview and real-time insights"
      />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} className="h-32" />
            ))}
          </div>
        }
      >
        <DashboardKPIs />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={7} />}>
        <RouteRankingTable />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton className="h-80" />}>
          <RushHourChart />
        </Suspense>
        <Suspense fallback={<CardSkeleton className="h-80" />}>
          <AlertsFeed />
        </Suspense>
      </div>
    </div>
  );
}