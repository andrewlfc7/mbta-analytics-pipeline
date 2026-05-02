"use client";

import { useState } from "react";
import {
  getRouteColor,
  getRouteDisplayName,
  formatPercent,
  formatMinutes,
} from "@/lib/utils";
import { ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";

interface Props {
  routes: any[];
  expandedRoute: string | null;
  onToggleExpand: (routeId: string) => void;
}

type SortKey =
  | "on_time"
  | "avg_delay"
  | "median_delay"
  | "p90_delay"
  | "sig_delay"
  | "score";

type SortDir = "asc" | "desc";

export function RouteStatsTable({ routes, expandedRoute, onToggleExpand }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const getValue = (route: any, key: SortKey): number => {
    switch (key) {
      case "on_time":
        return route.on_time_pct ?? route.on_time_percentage ?? route.ontime_percentage ?? 0;
      case "avg_delay":
        return route.avg_delay_minutes ?? route.average_delay ?? 0;
      case "median_delay":
        return route.median_delay_minutes ?? route.median_delay ?? 0;
      case "p90_delay":
        return route.p90_delay_minutes ?? route.p90_delay ?? 0;
      case "sig_delay":
        return route.significant_delay_pct ?? route.significant_delay_percentage ?? 0;
      case "score":
        return route.reliability_score ?? route.score ?? 0;
    }
  };

  const sorted = [...routes].sort((a, b) => {
    const aVal = getValue(a, sortKey);
    const bVal = getValue(b, sortKey);
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const columns: { key: SortKey; label: string; align: string }[] = [
    { key: "on_time", label: "On-Time %", align: "text-right" },
    { key: "avg_delay", label: "Avg Delay", align: "text-right" },
    { key: "median_delay", label: "Median", align: "text-right" },
    { key: "p90_delay", label: "P90", align: "text-right" },
    { key: "sig_delay", label: "Sig. Delay %", align: "text-right" },
    { key: "score", label: "Score", align: "text-right" },
  ];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h3 className="text-lg font-semibold text-content-primary">
          Detailed Route Statistics
        </h3>
        <p className="text-sm text-content-muted">
          Click a route to view hourly breakdown. Click column headers to sort.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted">
                Route
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-content-muted cursor-pointer hover:text-content-primary transition-colors ${col.align}`}
                  onClick={() => handleSort(col.key)}
                >
                  <div className={`flex items-center gap-1 ${col.align === "text-right" ? "justify-end" : ""}`}>
                    {col.label}
                    <ArrowUpDown
                      className={`h-3 w-3 ${
                        sortKey === col.key ? "text-brand-accent" : "text-content-faint"
                      }`}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sorted.map((route: any) => {
              const routeId = route.route_id || route.route || "";
              const color = getRouteColor(routeId);
              const isExpanded = expandedRoute === routeId;

              return (
                <tr
                  key={routeId}
                  onClick={() => onToggleExpand(routeId)}
                  className="cursor-pointer transition-colors hover:bg-slate-700/10"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-brand-accent shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-content-faint shrink-0" />
                      )}
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-medium text-content-primary">
                        {getRouteDisplayName(routeId)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-content-primary">
                    {formatPercent(getValue(route, "on_time"))}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-content-primary">
                    {formatMinutes(getValue(route, "avg_delay"))}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-content-primary">
                    {formatMinutes(getValue(route, "median_delay"))}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-content-primary">
                    {formatMinutes(getValue(route, "p90_delay"))}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-content-primary">
                    {formatPercent(getValue(route, "sig_delay"))}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-content-primary">
                    {getValue(route, "score").toFixed(1)}
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