"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { formatMinutes, getRouteColor } from "@/lib/utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Legend,
} from "recharts";

interface Props {
  params: Record<string, string | number | undefined>;
}

export function WindScatter({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/weather/scatter/wind",
    params
  );

  if (loading) return <Loading text="Loading wind data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const points = data?.data?.points || data?.points || data?.data || [];
  const pointList = Array.isArray(points) ? points : [];

  // Group by route if route_id exists
  const byRoute: Record<string, any[]> = {};
  pointList.forEach((p: any) => {
    const route = p.route_id || p.route || "All";
    if (!byRoute[route]) byRoute[route] = [];
    byRoute[route].push({
      wind: p.wind_speed_mph ?? p.wind_speed ?? p.wind ?? 0,
      delay: p.avg_delay_minutes ?? p.avg_delay ?? 0,
      trips: p.trip_count ?? p.total_trips ?? 10,
      route,
    });
  });

  const routeKeys = Object.keys(byRoute);
  const hasMultipleRoutes = routeKeys.length > 1 && !routeKeys.includes("All");

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card p-6">
      <h3 className="text-lg font-semibold text-content-primary">
        Wind Speed vs Delay
      </h3>
      <p className="mt-1 text-sm text-content-muted">
        Impact of wind speed on delays
        {hasMultipleRoutes && ", colored by route"}
      </p>

      {pointList.length === 0 ? (
        <p className="py-12 text-center text-sm text-content-muted">
          No wind data available
        </p>
      ) : (
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="wind"
                name="Wind"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Wind Speed (mph)",
                  position: "insideBottom",
                  offset: -5,
                  fill: "#64748B",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="delay"
                name="Delay"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}m`}
              />
              <ZAxis
                type="number"
                dataKey="trips"
                range={[20, 200]}
                name="Trips"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-600 bg-surface-card px-3 py-2 shadow-xl">
                      <p className="text-sm text-content-muted">
                        Wind: {d.wind.toFixed(1)} mph
                      </p>
                      <p className="text-sm text-content-muted">
                        Delay: {formatMinutes(d.delay)}
                      </p>
                      {d.route !== "All" && (
                        <p className="text-xs text-content-faint">Route: {d.route}</p>
                      )}
                      <p className="text-xs text-content-faint">
                        {d.trips.toLocaleString()} trips
                      </p>
                    </div>
                  );
                }}
              />
              {hasMultipleRoutes ? (
                routeKeys.map((route) => (
                  <Scatter
                    key={route}
                    name={route}
                    data={byRoute[route]}
                    fill={getRouteColor(route)}
                    fillOpacity={0.6}
                  />
                ))
              ) : (
                <Scatter
                  data={pointList.map((p: any) => ({
                    wind: p.wind_speed_mph ?? p.wind_speed ?? p.wind ?? 0,
                    delay: p.avg_delay_minutes ?? p.avg_delay ?? 0,
                    trips: p.trip_count ?? p.total_trips ?? 10,
                  }))}
                  fill="#F59E0B"
                  fillOpacity={0.6}
                />
              )}
              {hasMultipleRoutes && (
                <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}