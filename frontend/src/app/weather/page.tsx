import { Suspense } from "react";
import { WeatherShell } from "@/components/weather/weather-shell";

export default function WeatherPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-12 w-64 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="grid gap-4 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-[22px] bg-white animate-pulse shadow-sm"
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="h-96 rounded-[24px] bg-white animate-pulse shadow-sm xl:col-span-4" />
            <div className="h-96 rounded-[24px] bg-white animate-pulse shadow-sm xl:col-span-8" />
          </div>
        </div>
      }
    >
      <WeatherShell />
    </Suspense>
  );
}
