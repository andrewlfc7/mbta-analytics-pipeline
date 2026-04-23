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
}: ModeFilterTabsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {modes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
            selected === key
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-[#1E293B] text-slate-400 hover:bg-[#273548] hover:text-slate-200"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}