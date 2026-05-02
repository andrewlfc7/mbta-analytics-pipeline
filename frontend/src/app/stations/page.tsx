import { Suspense } from "react";
import { StationsShell } from "@/components/stations/stations-shell";

export default function StationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-12 w-56 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="h-[420px] sm:h-[520px] xl:h-[620px] rounded-[24px] bg-white animate-pulse shadow-sm xl:col-span-7" />
            <div className="h-[420px] sm:h-[520px] xl:h-[620px] rounded-[24px] bg-white animate-pulse shadow-sm xl:col-span-5" />
          </div>
        </div>
      }
    >
      <StationsShell />
    </Suspense>
  );
}
