import { DashboardCard } from "@/components/ui/dashboard-card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-[18px] text-slate-400">
          Application preferences and configuration
        </p>
      </div>
      <DashboardCard variant="light" title="Preferences">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Settings className="mb-4 h-12 w-12 text-slate-300" />
          <p className="text-[15px] font-medium text-slate-700">
            Settings coming soon
          </p>
        </div>
      </DashboardCard>
    </div>
  );
}
