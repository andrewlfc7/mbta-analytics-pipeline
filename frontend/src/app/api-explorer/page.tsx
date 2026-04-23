import { DashboardCard } from "@/components/ui/dashboard-card";
import { Zap } from "lucide-react";

export default function APIExplorerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Explorer</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Explore and test API endpoints
        </p>
      </div>
      <DashboardCard title="Endpoints">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-300">
            API Explorer coming soon
          </p>
          <p className="text-[13px] text-slate-500 mt-1">
            Interactive endpoint testing with live responses
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}