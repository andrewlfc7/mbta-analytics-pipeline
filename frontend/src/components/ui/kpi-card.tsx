import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleColor?: "green" | "red" | "yellow" | "default";
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  subtitleColor = "default",
  icon: Icon,
  iconColor = "text-blue-400",
  className,
}: KPICardProps) {
  const subtitleColors = {
    green: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-amber-400",
    default: "text-slate-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl bg-[#1E293B] border border-[#2D3B4F] p-4 flex flex-col gap-1",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">
          {title}
        </span>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {subtitle && (
        <span className={cn("text-[12px]", subtitleColors[subtitleColor])}>
          {subtitle}
        </span>
      )}
    </div>
  );
}