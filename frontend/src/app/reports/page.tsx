import { DashboardCard } from "@/components/ui/dashboard-card";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Generate and export performance reports
        </p>
      </div>
      <DashboardCard title="Report Builder">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-300">
            Reports coming soon
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}