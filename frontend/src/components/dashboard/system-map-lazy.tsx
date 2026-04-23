"use client";

import dynamic from "next/dynamic";

const SystemMap = dynamic(
  () => import("./system-map").then((mod) => ({ default: mod.SystemMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] rounded-lg bg-[#0F172A] border border-[#2D3B4F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-slate-400">Loading map...</span>
        </div>
      </div>
    ),
  }
);

export { SystemMap as LazySystemMap };
