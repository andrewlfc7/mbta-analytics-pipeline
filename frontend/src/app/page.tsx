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
          <div className="h-12 w-80 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="mt-3 h-5 w-[32rem] rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-11 w-28 rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-[22px] bg-white animate-pulse shadow-sm"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-96 rounded-[24px] bg-white animate-pulse shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
