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
        <div className="flex gap-1 mb-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-7 w-32 bg-[#0F172A] rounded animate-pulse"
            />
          ))}
        </div>
        <div className="h-48 bg-[#0F172A] rounded-lg animate-pulse" />
      </div>
    ),
  }
);

export { PerformanceTrendsChart as LazyPerformanceTrendsChart };
