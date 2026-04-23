"use client";

import { formatNumber } from "@/lib/utils";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  data: any;
}

export function TableDetailsTable({ data }: Props) {
  const raw = data?.data || data || {};
  const tables = Array.isArray(raw) ? raw : raw.tables || raw.table_details || [];
  const tableList = Array.isArray(tables) ? tables : [];

  if (tableList.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h3 className="text-lg font-semibold text-content-primary">
          Table Details
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted">
                Table
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Rows
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Routes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {tableList.map((table: any, index: number) => {
              const name = table.table_name || table.name || `Table ${index + 1}`;
              const rows = table.row_count ?? table.rows ?? 0;
              const routes = table.unique_routes ?? table.route_count ?? null;
              const isHealthy = rows > 0;

              return (
                <tr
                  key={name}
                  className="hover:bg-slate-700/10 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-content-primary">
                      {name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-content-primary">
                    {formatNumber(rows)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-content-muted">
                    {routes !== null && routes !== 0 ? routes : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isHealthy ? (
                        <CheckCircle className="h-4 w-4 text-status-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-status-warning" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          isHealthy ? "text-status-success" : "text-status-warning"
                        }`}
                      >
                        {isHealthy ? "Healthy" : "Empty"}
                      </span>
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
