import { Suspense } from "react";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-[#1E293B] rounded-lg animate-pulse" />
          <div className="h-96 bg-[#1E293B] rounded-xl animate-pulse" />
        </div>
      }
    >
      <AnalyticsShell />
    </Suspense>
  );
}