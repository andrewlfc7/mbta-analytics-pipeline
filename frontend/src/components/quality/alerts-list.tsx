"use client";

import { useState } from "react";
import { getSeverityColor } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface Props {
  data: any;
}

export function AlertsList({ data }: Props) {
  const [showAll, setShowAll] = useState(false);

  const alerts =
    data?.data?.alerts || data?.alerts || data?.data || [];
  const totalAlerts =
    data?.data?.total_alerts || data?.total_alerts || alerts.length;
  const alertList = Array.isArray(alerts) ? alerts : [];

  const display = showAll ? alertList : alertList.slice(0, 20);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h3 className="text-lg font-semibold text-content-primary">
          Active Alerts ({totalAlerts})
        </h3>
      </div>

      <div className="divide-y divide-slate-700/20">
        {display.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-content-muted">
            No active alerts
          </div>
        ) : (
          display.map((alert: any, index: number) => {
            const severity =
              alert.severity || alert.effect_name || "info";
            const colors = getSeverityColor(severity);
            const header =
              alert.header_text ||
              alert.header ||
              alert.alert_type ||
              "Alert";
            const description =
              alert.description_text ||
              alert.description ||
              alert.affected_stops ||
              "";

            const durationHours =
              typeof alert.duration_hours === "number"
                ? alert.duration_hours
                : null;
            const impactScore =
              typeof alert.impact_score === "number"
                ? alert.impact_score
                : null;
            const affectedRoutes = alert.affected_routes ?? null;
            const affectedStopsCount = alert.affected_stops_count ?? null;

            return (
              <div
                key={alert.alert_id || index}
                className="px-6 py-4 hover:bg-slate-700/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {(severity || "info").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary">
                      {header}
                    </p>
                    {description && (
                      <p className="mt-0.5 text-sm text-content-muted line-clamp-2">
                        {description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-content-faint">
                      {durationHours !== null && (
                        <span>
                          Duration: {durationHours.toFixed(1)} hrs
                        </span>
                      )}
                      {impactScore !== null && (
                        <span>Impact: {impactScore.toFixed(1)}</span>
                      )}
                      {affectedRoutes !== null && (
                        <span>Routes: {affectedRoutes}</span>
                      )}
                      {affectedStopsCount !== null && (
                        <span>Stops: {affectedStopsCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!showAll && alertList.length > 20 && (
        <div className="border-t border-slate-700/50 px-6 py-3">
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1 text-sm text-brand-accent hover:text-blue-400 transition-colors"
          >
            Show all {alertList.length} alerts
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}