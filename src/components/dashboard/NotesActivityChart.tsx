"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ActivityPoint {
  /** ISO date (yyyy-mm-dd) for the bucket */
  date: string;
  /** Short label shown on the axis, e.g. "Jun 12" */
  label: string;
  /** Number of notes created that day */
  count: number;
}

interface NotesActivityChartProps {
  data: ActivityPoint[];
}

interface TooltipPayloadItem {
  value?: number;
  payload?: ActivityPoint;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  const count = payload[0]?.value ?? 0;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{point?.label}</p>
      <p className="text-sm">
        <span className="font-semibold">{count}</span>{" "}
        <span className="text-muted-foreground">
          {count === 1 ? "note" : "notes"}
        </span>
      </p>
    </div>
  );
}

export function NotesActivityChart({ data }: NotesActivityChartProps) {
  const gradientId = useId();
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div
      role="img"
      aria-label={`Notes created over the last ${data.length} days. ${total} ${
        total === 1 ? "note" : "notes"
      } total.`}
      className="h-56 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop
                offset="100%"
                stopColor="var(--chart-1)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--chart-1)",
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
