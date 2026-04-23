import { DashboardCard } from "@/components/ui/dashboard-card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Application preferences and configuration
        </p>
      </div>
      <DashboardCard title="Preferences">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Settings className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-300">
            Settings coming soon
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}