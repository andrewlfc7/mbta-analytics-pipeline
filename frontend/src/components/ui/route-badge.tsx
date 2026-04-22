import { getRouteColor, getRouteDisplayName } from "@/lib/utils";

interface RouteBadgeProps {
  routeId: string;
  size?: "sm" | "md";
}

export function RouteBadge({ routeId, size = "md" }: RouteBadgeProps) {
  const color = getRouteColor(routeId);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`rounded-full ${size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"}`}
        style={{ backgroundColor: color }}
      />
      <span className={size === "sm" ? "text-xs" : "text-sm"}>
        {getRouteDisplayName(routeId)}
      </span>
    </div>
  );
}