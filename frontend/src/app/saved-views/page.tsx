import { DashboardCard } from "@/components/ui/dashboard-card";
import { Bookmark } from "lucide-react";

export default function SavedViewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Saved Views</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Your saved dashboards and route views
        </p>
      </div>
      <DashboardCard title="My Views">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bookmark className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-300">
            No saved views yet
          </p>
          <p className="text-[13px] text-slate-500 mt-1">
            Save route filters and dashboard configurations for quick
            access
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}