import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatMinutes(minutes: number): string {
  if (Math.abs(minutes) < 0.05) return "0.0m";
  return `${minutes > 0 ? "" : ""}${minutes.toFixed(1)}m`;
}

export function formatDelayStatus(
  minutes: number,
  options: { compact?: boolean } = {}
): string {
  const absMinutes = Math.abs(minutes);
  const value = absMinutes < 0.05 ? "0.0" : absMinutes.toFixed(1);

  if (absMinutes < 0.05) {
    return options.compact ? `${value} on time` : `${value} min on time`;
  }

  if (minutes < 0) {
    return options.compact ? `${value} early` : `${value} min early`;
  }

  return options.compact ? `${value} delayed` : `${value} min delayed`;
}

export function formatDelayChange(minutes: number | undefined | null): string | undefined {
  if (minutes === undefined || minutes === null) return undefined;

  const absMinutes = Math.abs(minutes);
  if (absMinutes < 0.05) return "On time vs yesterday";

  if (minutes < 0) {
    return `${absMinutes.toFixed(1)} min earlier vs yesterday`;
  }

  return `${absMinutes.toFixed(1)} min delayed vs yesterday`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getDelayColor(minutes: number): string {
  if (minutes <= 0) return "#22C55E";
  if (minutes <= 1) return "#4ADE80";
  if (minutes <= 2) return "#84CC16";
  if (minutes <= 3) return "#EAB308";
  if (minutes <= 4) return "#F59E0B";
  if (minutes <= 5) return "#F97316";
  if (minutes <= 6) return "#FB923C";
  if (minutes <= 8) return "#EF4444";
  if (minutes <= 10) return "#DC2626";
  return "#B91C1C";
}

export function getDelayTextColor(minutes: number): string {
  if (minutes <= 2) return "text-status-success";
  if (minutes <= 4) return "text-status-warning";
  return "text-status-danger";
}

export function getRiskColor(risk: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (risk.toUpperCase()) {
    case "LOW":
      return {
        bg: "bg-green-500/10",
        text: "text-green-400",
        border: "border-green-500/20",
      };
    case "MEDIUM":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
      };
    case "HIGH":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/20",
      };
    default:
      return {
        bg: "bg-slate-500/10",
        text: "text-slate-400",
        border: "border-slate-500/20",
      };
  }
}

export const ROUTE_COLORS: Record<string, string> = {
  Red: "#DA291C",
  Blue: "#003DA5",
  Orange: "#ED8B00",
  "Green-B": "#00843D",
  "Green-C": "#00843D",
  "Green-D": "#00843D",
  "Green-E": "#00843D",
  Green: "#00843D",
};

export function getRouteColor(routeId: string): string {
  if (routeId.startsWith("Green")) return "#00843D";
  return ROUTE_COLORS[routeId] || "#94A3B8";
}

export function getRouteDisplayName(routeId: string): string {
  const names: Record<string, string> = {
    Red: "Red Line",
    Blue: "Blue Line",
    Orange: "Orange Line",
    "Green-B": "Green Line B",
    "Green-C": "Green Line C",
    "Green-D": "Green Line D",
    "Green-E": "Green Line E",
  };
  return names[routeId] || routeId;
}

export function getSeverityColor(severity: string): {
  bg: string;
  text: string;
} {
  switch (severity?.toLowerCase()) {
    case "high":
    case "severe":
      return { bg: "bg-red-500/15", text: "text-red-400" };
    case "medium":
    case "moderate":
      return { bg: "bg-amber-500/15", text: "text-amber-400" };
    case "low":
    case "minor":
      return { bg: "bg-green-500/15", text: "text-green-400" };
    default:
      return { bg: "bg-slate-500/15", text: "text-slate-400" };
  }
}
