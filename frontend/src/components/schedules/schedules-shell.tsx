"use client";

import { useState } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { TransitMode, ModeFilterTabs } from "@/components/ui/mode-filter-tabs";
import { Calendar, Clock, MapPin } from "lucide-react";

export function SchedulesShell() {
  const [mode, setMode] = useState<TransitMode>("all");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedules</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            View planned service schedules by route and mode
          </p>
        </div>
        <ModeFilterTabs selected={mode} onChange={setMode} />
      </div>

      <DashboardCard title="Schedule Viewer">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-300">
            Schedule viewer coming soon
          </p>
          <p className="text-[13px] text-slate-500 mt-1 max-w-md">
            Browse departure times, route timetables, and service patterns
            for all MBTA routes. Schedule data is being ingested for all
            modes.
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}