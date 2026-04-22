"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { getSeverityColor } from "@/lib/utils";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export function AlertsFeed() {
  const { data, loading, error, refetch } = useApi<any>("/quality/alerts", {
    limit: 5,
  });

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const alerts = data?.data?.alerts || data?.alerts || data?.data || [];
  const totalAlerts = data?.data?.total_alerts || data?.total_alerts || alerts.length;
  const alertList = Array.isArray(alerts) ? alerts.slice(0, 5) : [];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">
            Active Alerts
          </h3>
          <p className="mt-1 text-sm text-content-muted">
            {totalAlerts} active alerts
          </p>
        </div>
        <AlertTriangle className="h-5 w-5 text-status-warning" />
      </div>

      <div className="mt-4 space-y-3">
        {alertList.length === 0 ? (
          <p className="text-sm text-content-muted py-4 text-center">
            No active alerts
          </p>
        ) : (
          alertList.map((alert: any, index: number) => {
            const severity = alert.severity || alert.effect_name || "info";
            const colors = getSeverityColor(severity);

            return (
              <div
                key={alert.alert_id || index}
                className="rounded-lg border border-slate-700/30 bg-slate-800/50 p-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {(severity || "info").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary truncate">
                      {alert.header_text || alert.header || alert.alert_type || "Alert"}
                    </p>
                    <p className="mt-0.5 text-xs text-content-muted truncate">
                      {alert.description_text || alert.affected_stops || alert.description || ""}
                    </p>
                    {(alert.duration_hours || alert.impact_score) && (
                      <div className="mt-1 flex items-center gap-3 text-xs text-content-faint">
                        {alert.duration_hours && (
                          <span>Duration: {alert.duration_hours.toFixed(1)} hrs</span>
                        )}
                        {alert.impact_score && (
                          <span>Impact: {alert.impact_score.toFixed(1)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalAlerts > 5 && (
        <Link
          href="/quality"
          className="mt-4 flex items-center gap-2 text-sm text-brand-accent hover:text-blue-400 transition-colors"
        >
          View all {totalAlerts} alerts
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}