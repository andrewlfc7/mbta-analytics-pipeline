"use client";

import { formatNumber } from "@/lib/utils";
import { Database, Layers, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  data: any;
}

export function PipelineHealthCards({ data }: Props) {
  const overview = data?.data || data || {};
  const tables = overview.tables || overview.table_details || [];
  const tableCount = Array.isArray(tables) ? tables.length : overview.table_count ?? 0;
  const totalRows = overview.total_rows ?? overview.total_records ?? 0;
  const allHealthy =
    overview.status === "healthy" ||
    overview.all_healthy === true ||
    (Array.isArray(tables) &&
      tables.every(
        (t: any) => t.status === "healthy" || t.status === "Healthy"
      ));

  const cards = [
    {
      label: "Tables",
      value: String(tableCount),
      sub: "mart tables",
      icon: Database,
      color: "text-brand-accent",
    },
    {
      label: "Total Rows",
      value: formatNumber(totalRows),
      sub: "across all tables",
      icon: Layers,
      color: "text-brand-accent",
    },
    {
      label: "Status",
      value: allHealthy ? "All Healthy" : "Issues Detected",
      sub: allHealthy ? "Pipeline operating normally" : "Check table details",
      icon: allHealthy ? CheckCircle : AlertTriangle,
      color: allHealthy ? "text-status-success" : "text-status-warning",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-slate-700/50 bg-surface-card p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-content-muted">
                {card.label}
              </span>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className={`mt-3 text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <p className="mt-1 text-xs text-content-faint">{card.sub}</p>
          </div>
        );
      })}
    </div>
  );
}