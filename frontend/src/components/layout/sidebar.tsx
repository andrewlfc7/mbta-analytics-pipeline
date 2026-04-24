"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clientFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  Bookmark,
  Calendar,
  CloudSun,
  FileText,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  Route,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Trip Planner", href: "/trip-planner", icon: Route },
  { label: "Transit Assistant", href: "/assistant", icon: Sparkles },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Schedules", href: "/schedules", icon: Calendar },
  { label: "Service Health", href: "/service-health", icon: HeartPulse },
  { label: "Weather", href: "/weather", icon: CloudSun },
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[206px] flex-col border-r border-[#10294B] bg-[#0C2140]">
      <div className="shrink-0 px-5 pb-6 pt-6">
        <div className="flex flex-col">
          <span className="text-[21px] font-semibold tracking-tight text-white">
            MBTA
          </span>
          <span className="text-[18px] font-medium text-white/92">
            Transit Intelligence
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const showBadge = item.label === "Alerts" && alertCount > 0;

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium transition-all duration-150",
                    active
                      ? "bg-[#2563EB] text-white shadow-lg shadow-blue-900/25"
                      : "text-slate-100/82 hover:bg-white/6 hover:text-white"
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
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 px-4 pb-5 pt-4">
        <div className="rounded-2xl border border-white/10 bg-[#10294B] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[12px] font-medium text-white/92">
              Data updated
            </span>
          </div>
          <p className="ml-4 mt-1 text-[12px] text-slate-300">{lastUpdated}</p>
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
            className="ml-4 mt-3 inline-flex items-center gap-1.5 text-[12px] text-blue-200 transition-colors hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>
    </aside>
  );
}
