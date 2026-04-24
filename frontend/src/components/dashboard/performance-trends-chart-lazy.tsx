"use client";

import dynamic from "next/dynamic";

const PerformanceTrendsChart = dynamic(
  () =>
    import("./performance-trends-chart").then((mod) => ({
      default: mod.PerformanceTrendsChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div>
        <div className="mb-4 flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-32 rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    ),
  }
);

export { PerformanceTrendsChart as LazyPerformanceTrendsChart };
