"use client";

import dynamic from "next/dynamic";

const StationMap = dynamic(
  () => import("./station-map").then((mod) => ({ default: mod.StationMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] sm:h-[420px] xl:h-[500px] rounded-xl border border-slate-700/50 bg-surface-card flex items-center justify-center">
        <div className="text-sm text-content-muted animate-pulse">Loading map...</div>
      </div>
    ),
  }
);

export { StationMap as LazyStationMap };
