"use client";

import { useApi } from "@/hooks/use-api";
import { Loading } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/error-state";
import { getRiskColor } from "@/lib/utils";

interface Props {
  params: Record<string, string | number | undefined>;
}

export function DelayProbabilityTable({ params }: Props) {
  const { data, loading, error, refetch } = useApi<any>(
    "/delays/temporal/delay-probability",
    params
  );

  if (loading) return <Loading text="Loading delay probability data..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const hours = data?.data?.hours || data?.hours || data?.data || [];
  const hourList = Array.isArray(hours) ? hours : [];

  const sorted = [...hourList].sort(
    (a: any, b: any) => (a.hour ?? a.hour_of_day ?? 0) - (b.hour ?? b.hour_of_day ?? 0)
  );

  return (
    <div className="rounded-xl border border-slate-700/50 bg-surface-card">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h3 className="text-lg font-semibold text-content-primary">
          Delay Probability by Hour
        </h3>
        <p className="text-sm text-content-muted">
          Likelihood of experiencing a significant delay
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted">
                Hour
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Probability
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-content-muted w-64">
                Level
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-content-muted">
                Risk
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sorted.map((h: any) => {
              const hour = h.hour ?? h.hour_of_day ?? 0;
              const probability = h.delay_probability ?? h.probability ?? h.significant_delay_probability ?? 0;
              const pctVal = probability > 1 ? probability : probability * 100;
              const risk =
                h.risk_level ??
                h.risk ??
                (pctVal > 40 ? "HIGH" : pctVal > 20 ? "MEDIUM" : "LOW");
              const riskColors = getRiskColor(risk);

              return (
                <tr key={hour} className="hover:bg-slate-700/10 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-content-primary">
                    {hour}:00
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-content-primary">
                    {pctVal.toFixed(1)}%
                  </td>
                  <td className="px-6 py-3">
                    <div className="h-2 w-full rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(pctVal, 100)}%`,
                          backgroundColor:
                            pctVal > 40 ? "#EF4444" : pctVal > 20 ? "#F59E0B" : "#22C55E",
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${riskColors.bg} ${riskColors.text} border ${riskColors.border}`}
                    >
                      {risk.toUpperCase()}
                    </span>
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