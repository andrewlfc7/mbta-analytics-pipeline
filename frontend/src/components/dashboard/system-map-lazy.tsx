"use client";

import dynamic from "next/dynamic";

const SystemMap = dynamic(
  () => import("./system-map").then((mod) => ({ default: mod.SystemMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-[22px] border border-slate-200 bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-[11px] text-slate-500">Loading map...</span>
        </div>
      </div>
    ),
  }
);

export { SystemMap as LazySystemMap };
