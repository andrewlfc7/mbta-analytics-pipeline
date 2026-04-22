"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Train,
  Clock,
  Grid3X3,
  TrendingUp,
  MapPin,
  Cloud,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Activity,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Routes", href: "/routes", icon: Train },
  {
    label: "Delays",
    href: "/delays",
    icon: Clock,
    children: [
      { label: "Heatmap", href: "/delays" },
      { label: "Temporal", href: "/delays/temporal" },
    ],
  },
  { label: "Stations", href: "/stations", icon: MapPin },
  { label: "Weather", href: "/weather", icon: Cloud },
  { label: "Quality", href: "/quality", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Delays"]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-slate-700/50 bg-surface-card transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-700/50 px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-accent" />
              <span className="text-sm font-semibold text-content-primary">
                MBTA Analytics
              </span>
            </div>
          )}
          {collapsed && (
            <Activity className="mx-auto h-5 w-5 text-brand-accent" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "rounded-md p-1 text-content-muted hover:bg-slate-700/50 hover:text-content-primary transition-colors",
              collapsed && "mx-auto mt-0"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const expanded = expandedItems.includes(item.label);
              const hasChildren = item.children && item.children.length > 0;

              return (
                <li key={item.label}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleExpand(item.label)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-brand-accent/10 text-brand-accent"
                            : "text-content-muted hover:bg-slate-700/30 hover:text-content-primary"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">
                              {item.label}
                            </span>
                            <ChevronDown
                              className={cn(
                                "h-3 w-3 transition-transform",
                                expanded && "rotate-180"
                              )}
                            />
                          </>
                        )}
                      </button>
                      {!collapsed && expanded && (
                        <ul className="ml-7 mt-1 space-y-1 border-l border-slate-700/50 pl-3">
                          {item.children!.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className={cn(
                                  "block rounded-md px-3 py-1.5 text-sm transition-colors",
                                  pathname === child.href
                                    ? "text-brand-accent"
                                    : "text-content-muted hover:text-content-primary"
                                )}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-brand-accent/10 text-brand-accent"
                          : "text-content-muted hover:bg-slate-700/30 hover:text-content-primary"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-slate-700/50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
              <span className="text-xs text-content-muted">API Connected</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-status-success" />
              <span className="text-xs text-content-muted">Status: Live</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="border-t border-slate-700/50 p-4 flex justify-center">
            <div className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}