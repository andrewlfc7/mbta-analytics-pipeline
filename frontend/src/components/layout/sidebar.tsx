"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Route,
  Bell,
  Calendar,
  HeartPulse,
  MapPin,
  BarChart3,
  FileText,
  Zap,
  Bookmark,
  Settings,
  Menu,
  RefreshCw,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { label: "Trip Planner", href: "/trip-planner", icon: Route },
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Schedules", href: "/schedules", icon: Calendar },
  { label: "Service Health", href: "/service-health", icon: HeartPulse },
  { label: "Stations", href: "/stations", icon: MapPin },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "API Explorer", href: "/api-explorer", icon: Zap },
  { label: "Saved Views", href: "/saved-views", icon: Bookmark },
  { label: "Settings", href: "/settings", icon: Settings },
];

function formatLastUpdated(ts: string): string {
  if (!ts) return "--";

  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
}

export function Sidebar({
  initialAlertCount = 0,
  initialLastUpdated = "",
}: {
  initialAlertCount?: number;
  initialLastUpdated?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(initialAlertCount);
  const [lastUpdated, setLastUpdated] = useState(
    formatLastUpdated(initialLastUpdated)
  );

  useEffect(() => {
    async function fetchAlertCount() {
      try {
        const data = await clientFetch<any>("/overview/system");
        setAlertCount(data.active_alerts ?? 0);
        setLastUpdated(formatLastUpdated(data.last_updated ?? ""));
      } catch {
        setAlertCount(0);
      }
    }

    const interval = setInterval(fetchAlertCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-[#0B1629] border-r border-[#1E293B] transition-all duration-300 flex flex-col",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#1E293B] shrink-0">
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-white tracking-wide">
              MBTA
            </span>
            <span className="text-[10px] font-medium text-slate-400 -mt-0.5">
              Transit Intelligence
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors",
            collapsed && "mx-auto"
          )}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const showBadge = item.label === "Alerts" && alertCount > 0;

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                    active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <div className="relative shrink-0">
                    <Icon className="h-[18px] w-[18px]" />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {alertCount > 99 ? "99+" : alertCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="shrink-0 border-t border-[#1E293B] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">
              Data updated
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 ml-4">
            {lastUpdated}
          </p>
          <button
            onClick={async () => {
              try {
                const data = await clientFetch<any>("/overview/system");
                setAlertCount(data.active_alerts ?? 0);
                setLastUpdated(formatLastUpdated(data.last_updated ?? ""));
              } catch {
                setAlertCount(0);
              }
            }}
            className="flex items-center gap-1.5 mt-1.5 ml-4 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      )}
      {collapsed && (
        <div className="shrink-0 border-t border-[#1E293B] py-3 flex justify-center">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}
    </aside>
  );
}
