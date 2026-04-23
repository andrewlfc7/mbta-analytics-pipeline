"use client";

import { useEffect, useState } from "react";
import { Cloud, Clock } from "lucide-react";
import { clientFetch } from "@/lib/api";

export function TopBar({
  initialTemp = "--",
}: {
  initialTemp?: string;
}) {
  const [time, setTime] = useState("");
  const [weather, setWeather] = useState({ temp: initialTemp });

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);

    async function fetchWeather() {
      try {
        const data = await clientFetch<any>("/weather/overview");
        const overview = data?.data?.[0] || data?.data || data || {};
        setWeather({
          temp: overview.avg_temp_f
            ? `${Math.round(overview.avg_temp_f)}F`
            : "--",
        });
      } catch {
        setWeather({ temp: "--" });
      }
    }
    const weatherInterval = setInterval(fetchWeather, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-[#1E293B] bg-[#0F172A]/80 backdrop-blur-md px-6">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-slate-400">
          <Cloud className="h-4 w-4" />
          <span className="text-[13px]">{weather.temp}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <span className="text-[13px]">{time}</span>
        </div>
      </div>
    </header>
  );
}
