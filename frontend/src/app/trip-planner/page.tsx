import { DashboardCard } from "@/components/ui/dashboard-card";
import { Route } from "lucide-react";

export default function TripPlannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trip Planner</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Find the fastest, most reliable way to get there
        </p>
      </div>
      <DashboardCard title="Plan Your Trip">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Route className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-300">
            Trip planner coming in Phase 4
          </p>
          <p className="text-[13px] text-slate-500 mt-1 max-w-md">
            Multi-modal route recommendations with reliability scores,
            delay risk, and real-time conditions.
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}