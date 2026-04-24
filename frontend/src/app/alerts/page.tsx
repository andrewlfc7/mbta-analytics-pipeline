import { Suspense } from "react";
import { AlertsShell } from "@/components/alerts/alerts-shell";

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-12 w-56 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="grid gap-4 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-[22px] bg-white animate-pulse shadow-sm"
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="h-[640px] rounded-[24px] bg-white animate-pulse shadow-sm xl:col-span-8" />
            <div className="h-[640px] rounded-[24px] bg-white animate-pulse shadow-sm xl:col-span-4" />
          </div>
        </div>
      }
    >
      <AlertsShell />
    </Suspense>
  );
}
