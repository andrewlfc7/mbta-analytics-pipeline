import { DashboardCard } from "@/components/ui/dashboard-card";
import { Bookmark } from "lucide-react";

export default function SavedViewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight text-white">Saved Views</h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Your saved dashboards and route views
        </p>
      </div>
      <DashboardCard variant="light" title="My Views">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bookmark className="mb-4 h-12 w-12 text-slate-300" />
          <p className="text-[15px] font-medium text-slate-700">
            No saved views yet
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            Save route filters and dashboard configurations for quick
            access
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}
