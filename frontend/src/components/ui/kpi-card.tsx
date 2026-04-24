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
  variant?: "dark" | "light";
}

export function KPICard({
  title,
  value,
  subtitle,
  subtitleColor = "default",
  icon: Icon,
  iconColor = "text-blue-400",
  className,
  variant = "dark",
}: KPICardProps) {
  const subtitleColors = {
    green: variant === "light" ? "text-emerald-600" : "text-emerald-400",
    red: variant === "light" ? "text-red-500" : "text-red-400",
    yellow: variant === "light" ? "text-amber-500" : "text-amber-400",
    default: variant === "light" ? "text-slate-500" : "text-slate-400",
  };

  return (
    <div
      className={cn(
        variant === "light"
          ? "flex flex-col gap-2 rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)]"
          : "flex flex-col gap-1 rounded-xl border border-[#2D3B4F] bg-[#1E293B] p-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[12px] font-medium uppercase tracking-wide",
            variant === "light" ? "text-slate-500" : "text-slate-400"
          )}
        >
          {title}
        </span>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            variant === "light" ? "bg-slate-50" : "bg-white/5"
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
      <span
        className={cn(
          "text-2xl font-bold",
          variant === "light" ? "text-slate-950" : "text-white"
        )}
      >
        {value}
      </span>
      {subtitle && (
        <span className={cn("text-[12px]", subtitleColors[subtitleColor])}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
