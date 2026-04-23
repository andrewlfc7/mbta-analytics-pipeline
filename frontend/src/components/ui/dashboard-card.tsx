import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  action,
  children,
  className,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[#1E293B] border border-[#2D3B4F] overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2D3B4F]">
        <h3 className="text-[14px] font-semibold text-white">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}