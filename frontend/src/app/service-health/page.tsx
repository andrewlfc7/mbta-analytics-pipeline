import { Suspense } from "react";
import { ServiceHealthShell } from "@/components/service-health/service-health-shell";

export default function ServiceHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-12 w-64 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="grid gap-4 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-[22px] bg-white animate-pulse shadow-sm"
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[360px] rounded-[24px] bg-white animate-pulse shadow-sm"
              />
            ))}
          </div>
        </div>
      }
    >
      <ServiceHealthShell />
    </Suspense>
  );
}
