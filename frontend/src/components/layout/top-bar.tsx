"use client";

import { useEffect, useState } from "react";
import { Clock3, CloudSun, Menu } from "lucide-react";
import { clientFetch } from "@/lib/api";

export function TopBar({
  initialTemp = "--",
  initialCondition = "",
}: {
  initialTemp?: string;
  initialCondition?: string;
}) {
  const [time, setTime] = useState("");
  const [weather, setWeather] = useState({
    temp: initialTemp,
    condition: initialCondition,
  });

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

    async function fetchWeather() {
      try {
        const data = await clientFetch<any>("/weather/current");
        const overview = data?.data || data || {};
        setWeather({
          temp: overview.temp_f
            ? `${Math.round(overview.temp_f)}°F`
            : overview.temp
              ? `${Math.round(overview.temp)}°F`
              : "--",
          condition: overview.condition || "",
        });
      } catch {
        setWeather((current) => ({
          temp: current.temp || "--",
          condition: current.condition || "",
        }));
      }
    }

    updateTime();
    const interval = setInterval(updateTime, 30000);
    if (initialTemp === "--" || !initialCondition) {
      void fetchWeather();
    }
    const weatherInterval = setInterval(fetchWeather, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
    };
  }, [initialCondition, initialTemp]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[#111B2E] px-6 shadow-none">
      <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-slate-300 transition-colors hover:border-white/30 hover:text-white">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-slate-300">
          <CloudSun className="h-4 w-4 text-amber-500" />
          <span className="text-[13px] font-medium">
            {weather.condition ? `${weather.condition} ${weather.temp}` : weather.temp}
          </span>
        </div>
        <div className="h-5 w-px bg-white/15" />
        <div className="flex items-center gap-2 text-slate-300">
          <Clock3 className="h-4 w-4 text-slate-400" />
          <span className="text-[13px] font-medium">{time}</span>
        </div>
      </div>
    </header>
  );
}
