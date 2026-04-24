import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: "dark" | "light";
}

export function DashboardCard({
  title,
  action,
  children,
  className,
  variant = "dark",
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        variant === "light"
          ? "overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          : "overflow-hidden rounded-xl border border-[#2D3B4F] bg-[#1E293B]",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-5 py-3",
          variant === "light" ? "border-b border-slate-200/80" : "border-b border-[#2D3B4F]"
        )}
      >
        <h3
          className={cn(
            "text-[14px] font-semibold",
            variant === "light" ? "text-slate-900" : "text-white"
          )}
        >
          {title}
        </h3>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
