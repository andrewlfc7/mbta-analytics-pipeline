import { Suspense } from "react";
import { AlertsShell } from "@/components/alerts/alerts-shell";

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-[#1E293B] rounded-lg animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[#1E293B] rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-[#1E293B] rounded-xl animate-pulse" />
        </div>
      }
    >
      <AlertsShell />
    </Suspense>
  );
}