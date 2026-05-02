"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

type AppShellProps = {
  children: React.ReactNode;
  initialAlertCount: number;
  initialLastUpdated: string;
  initialTemp: string;
  initialCondition: string;
};

export function AppShell({
  children,
  initialAlertCount,
  initialLastUpdated,
  initialTemp,
  initialCondition,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        initialAlertCount={initialAlertCount}
        initialLastUpdated={initialLastUpdated}
      />

      <div className="min-h-screen bg-[#0F172A] lg:ml-[206px]">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          initialTemp={initialTemp}
          initialCondition={initialCondition}
        />

        <main>
          <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
