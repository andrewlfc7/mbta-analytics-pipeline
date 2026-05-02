"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { DashboardCard } from "@/components/ui/dashboard-card";

type ScatterPoint = {
  x: number;
  y: number;
  route?: string;
};

function formatTooltipValue(value: number | string | undefined, suffix: string) {
  if (value === undefined || value === null || value === "") return "--";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${numeric.toFixed(1)}${suffix}`;
}

type Props = {
  tempScatter: ScatterPoint[];
  windScatter: ScatterPoint[];
};

export function WeatherScatterCharts({ tempScatter, windScatter }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <DashboardCard variant="light" title="Temperature vs Delay">
        {tempScatter.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center sm:h-[280px] xl:h-[320px]">
            <p className="text-[13px] text-slate-500">No data</p>
          </div>
        ) : (
          <div className="h-[240px] w-full sm:h-[280px] xl:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Temperature"
                  unit="F"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Delay"
                  unit="m"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [
                    formatTooltipValue(
                      value as number | string | undefined,
                      name === "Delay" ? " min" : "F"
                    ),
                    String(name),
                  ]}
                />
                <Scatter
                  data={tempScatter}
                  fill="#2563EB"
                  fillOpacity={0.45}
                  r={3.5}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>

      <DashboardCard variant="light" title="Wind Speed vs Delay">
        {windScatter.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center sm:h-[280px] xl:h-[320px]">
            <p className="text-[13px] text-slate-500">No data</p>
          </div>
        ) : (
          <div className="h-[240px] w-full sm:h-[280px] xl:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Wind"
                  unit="mph"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Delay"
                  unit="m"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [
                    formatTooltipValue(
                      value as number | string | undefined,
                      name === "Delay" ? " min" : " mph"
                    ),
                    String(name),
                  ]}
                />
                <Scatter
                  data={windScatter}
                  fill="#0EA5A5"
                  fillOpacity={0.45}
                  r={3.5}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
