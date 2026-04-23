"use client";

import { useEffect, useState } from "react";
import { Cloud, Clock } from "lucide-react";

export function TopBar() {
  const [time, setTime] = useState("");
  const [weather, setWeather] = useState({ temp: "--", condition: "" });

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
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/weather/overview`
        );
        if (res.ok) {
          const data = await res.json();
          const overview = data?.data?.[0] || data?.data || data || {};
          setWeather({
            temp: overview.avg_temp_f
              ? `${Math.round(overview.avg_temp_f)}F`
              : overview.current_temp
                ? `${Math.round(overview.current_temp)}F`
                : "--",
            condition: overview.condition || "",
          });
        }
      } catch {
        setWeather({ temp: "--", condition: "" });
      }
    }
    fetchWeather();

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#1E293B] bg-[#0F172A]/80 backdrop-blur-md px-6">
      <div />
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-slate-400">
          <Cloud className="h-4 w-4" />
          <span className="text-[13px]">{weather.temp}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <span className="text-[13px]">{time}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
            AK
          </div>
          <span className="text-[13px] text-slate-300 hidden sm:inline">
            Andrew K.
          </span>
        </div>
      </div>
    </header>
  );
}