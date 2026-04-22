"use client";

import { PageHeader } from "@/components/layout/page-header";
import { PipelineHealthCards } from "@/components/quality/pipeline-health-cards";
import { TableDetailsTable } from "@/components/quality/table-details-table";
import { AlertsList } from "@/components/quality/alerts-list";
import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";

export default function QualityPage() {
  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: overviewRefetch,
  } = useApi<any>("/quality/overview");

  const {
    data: alertsData,
    loading: alertsLoading,
    error: alertsError,
    refetch: alertsRefetch,
  } = useApi<any>("/quality/alerts");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Data Quality"
        description="Pipeline health monitoring and active alerts"
      />

      {overviewLoading ? (
        <Loading text="Loading quality metrics..." />
      ) : overviewError ? (
        <ErrorState message={overviewError} onRetry={overviewRefetch} />
      ) : (
        <>
          <PipelineHealthCards data={overviewData} />
          <TableDetailsTable data={overviewData} />
        </>
      )}

      {alertsLoading ? (
        <Loading text="Loading alerts..." />
      ) : alertsError ? (
        <ErrorState message={alertsError} onRetry={alertsRefetch} />
      ) : (
        <AlertsList data={alertsData} />
      )}
    </div>
  );
}