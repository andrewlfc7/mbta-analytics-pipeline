"use client";

interface Props {
  routeId: string;
  onRouteChange: (value: string) => void;
  period: number;
  onPeriodChange: (value: number) => void;
}

const ROUTES = [
  { value: "all", label: "All Routes" },
  { value: "Red", label: "Red Line" },
  { value: "Blue", label: "Blue Line" },
  { value: "Orange", label: "Orange Line" },
  { value: "Green-B", label: "Green Line B" },
  { value: "Green-C", label: "Green Line C" },
  { value: "Green-D", label: "Green Line D" },
  { value: "Green-E", label: "Green Line E" },
];

const PERIODS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export function HeatmapFilters({ routeId, onRouteChange, period, onPeriodChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={routeId}
        onChange={(e) => onRouteChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-surface-card px-3 py-2 text-sm text-content-primary focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
      >
        {ROUTES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => onPeriodChange(Number(e.target.value))}
        className="rounded-lg border border-slate-700 bg-surface-card px-3 py-2 text-sm text-content-primary focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}