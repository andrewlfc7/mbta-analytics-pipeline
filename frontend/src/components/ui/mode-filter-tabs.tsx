"use client";

import { cn } from "@/lib/utils";
import { Bus, TrainFront, Ship, Train } from "lucide-react";

export type TransitMode =
  | "all"
  | "bus"
  | "subway"
  | "commuter_rail"
  | "ferry";

interface ModeFilterTabsProps {
  selected: TransitMode;
  onChange: (mode: TransitMode) => void;
  className?: string;
  variant?: "dark" | "light";
}

const modes: { key: TransitMode; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Modes", icon: TrainFront },
  { key: "bus", label: "Bus", icon: Bus },
  { key: "subway", label: "Subway", icon: TrainFront },
  { key: "commuter_rail", label: "Commuter Rail", icon: Train },
  { key: "ferry", label: "Ferry", icon: Ship },
];

export function ModeFilterTabs({
  selected,
  onChange,
  className,
  variant = "dark",
}: ModeFilterTabsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {modes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-medium transition-all",
            selected === key
              ? variant === "light"
                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                : "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : variant === "light"
                ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                : "border-transparent bg-[#1E293B] text-slate-400 hover:bg-[#273548] hover:text-slate-200"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
