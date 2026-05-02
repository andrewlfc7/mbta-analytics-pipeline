"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const SystemMap = dynamic(
  () => import("./system-map").then((mod) => ({ default: mod.SystemMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] sm:h-[420px] xl:h-[520px] items-center justify-center rounded-[22px] border border-slate-200 bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-[11px] text-slate-500">Loading map...</span>
        </div>
      </div>
    ),
  }
);

export function LazySystemMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    let intersectionObserver: IntersectionObserver | null = null;
    const idleHandle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback(() => setShouldLoad(true), {
            timeout: 1500,
          })
        : null;

    intersectionObserver =
      typeof window !== "undefined" && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                setShouldLoad(true);
                intersectionObserver?.disconnect();
              }
            },
            { rootMargin: "240px" }
          )
        : null;

    if (intersectionObserver && containerRef.current) {
      intersectionObserver.observe(containerRef.current);
    } else if (!idleHandle) {
      setShouldLoad(true);
    }

    return () => {
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle);
      }
      intersectionObserver?.disconnect();
    };
  }, [shouldLoad]);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <SystemMap />
      ) : (
        <div className="flex h-[320px] sm:h-[420px] xl:h-[520px] items-center justify-center rounded-[22px] border border-slate-200 bg-slate-50">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full border border-slate-200 bg-white" />
            <span className="text-[11px] text-slate-500">
              Loading map after dashboard essentials...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
