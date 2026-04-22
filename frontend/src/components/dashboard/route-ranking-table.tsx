import { getRouteRanking } from "@/lib/api";
import { formatPercent, formatMinutes, getRouteColor, getRouteDisplayName } from "@/lib/utils";

export async function RouteRankingTable() {
  const response = await getRouteRanking();
  const routes = response.data || response.routes || response || [];
  const routeList = Array.isArray(routes) ? routes : [];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h2 className="text-lg font-semibold text-content-primary">
          Route Reliability Ranking
        </h2>
        <p className="text-sm text-content-muted">
          Ranked by composite reliability score
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted">
                Route
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                On-Time %
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Avg Delay
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted w-48">
                Performance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {routeList.map((route: any) => {
              const routeId = route.route_id || route.route || "";
              const color = getRouteColor(routeId);
              const onTime =
                route.on_time_pct ??
                route.on_time_percentage ??
                route.ontime_percentage ??
                0;
              const avgDelay =
                route.avg_delay_minutes ??
                route.average_delay ??
                0;
              const score =
                route.reliability_score ??
                route.score ??
                0;

              return (
                <tr
                  key={routeId}
                  className="transition-colors hover:bg-slate-700/10"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <span className="text-sm font-medium text-content-primary">
                          {route.route_name || getRouteDisplayName(routeId)}
                        </span>
                        {route.route_type_desc && (
                          <p className="text-xs text-content-faint">
                            {route.route_type_desc}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-content-primary">
                    {formatPercent(onTime)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-content-primary">
                    {formatMinutes(avgDelay)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-content-primary">
                    {score.toFixed(1)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-slate-700">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(score, 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}