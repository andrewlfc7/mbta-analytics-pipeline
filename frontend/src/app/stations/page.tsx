import { Suspense } from "react";
import { StationsShell } from "@/components/stations/stations-shell";

export default function StationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-[#1E293B] rounded-lg animate-pulse" />
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-7 h-96 bg-[#1E293B] rounded-xl animate-pulse" />
            <div className="col-span-5 h-96 bg-[#1E293B] rounded-xl animate-pulse" />
          </div>
        </div>
      }
    >
      <StationsShell />
    </Suspense>
  );
}