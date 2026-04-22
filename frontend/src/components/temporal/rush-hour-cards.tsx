"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes, formatPercent, formatNumber } from "@/lib/utils";
import { Sun, Sunset, Moon } from "lucide-react";

interface Props {
  params: Record<string, string | number | undefined>;
}

const PERIOD_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  am_rush: { icon: Sun, color: "text-blue-400", label: "AM Rush" },
  morning_rush: { icon: Sun, color: "text-blue-400", label: "AM Rush" },
  pm_rush: { icon: Sunset, color: "text-amber-400", label: "PM Rush" },
  evening_rush: { icon: Sunset, color: "text-amber-400", label: "PM Rush" },
  midday: { icon: Sun, color: "text-purple-400", label: "Midday" },
  evening: { icon: Moon, color: "text-green-400", label: "Evening" },
  off_peak: { icon: Moon, color: "text-slate-400", label: "Off-Peak" },
};

export function RushHourCards({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/delays/temporal/rush-hour-comparison",
    params
  );

  if (loading) return <Loading text="Loading rush hour data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const periods = data?.data?.periods || data?.periods || data?.data || [];
  const periodList = Array.isArray(periods) ? periods : [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-content-primary">
        Rush Hour Comparison
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {periodList.map((p: any) => {
          const key = p.time_period || p.period || "";
          const config = PERIOD_CONFIG[key] || PERIOD_CONFIG.off_peak;
          const Icon = config.icon;

          return (
            <div
              key={key}
              className="rounded-xl border border-slate-700/50 bg-surface-card p-5"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <h4 className={`text-sm font-semibold ${config.color}`}>
                  {config.label}
                </h4>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-content-muted">Avg Delay</span>
                  <span className="text-sm font-medium text-content-primary">
                    {formatMinutes(p.avg_delay_minutes ?? p.avg_delay ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-content-muted">On-Time</span>
                  <span className="text-sm font-medium text-content-primary">
                    {formatPercent(p.on_time_pct ?? p.on_time_percentage ?? p.ontime_pct ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-content-muted">Late</span>
                  <span className="text-sm font-medium text-content-primary">
                    {formatPercent(p.pct_late ?? p.late_percentage ?? p.late_pct ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-content-muted">Trips</span>
                  <span className="text-sm font-medium text-content-primary">
                    {formatNumber(p.total_trips ?? p.trip_count ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}