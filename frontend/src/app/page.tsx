import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardShell />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 bg-[#1E293B] rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-[#1E293B] rounded mt-2 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 bg-[#1E293B] rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-[#1E293B] rounded-xl animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-80 bg-[#1E293B] rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}