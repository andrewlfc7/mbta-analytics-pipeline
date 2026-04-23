import { Suspense } from "react";
import { ServiceHealthShell } from "@/components/service-health/service-health-shell";

export default function ServiceHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-[#1E293B] rounded-lg animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-[#1E293B] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ServiceHealthShell />
    </Suspense>
  );
}