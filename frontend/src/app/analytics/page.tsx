import { Suspense } from "react";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-12 w-56 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="h-[420px] sm:h-[520px] xl:h-[640px] rounded-[24px] bg-white animate-pulse shadow-sm" />
        </div>
      }
    >
      <AnalyticsShell />
    </Suspense>
  );
}
