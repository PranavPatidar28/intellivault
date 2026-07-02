"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

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
    <div className="rounded-lg border border-border/40 bg-card/90 px-3 py-2 text-foreground shadow-md backdrop-blur-md">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
        {point?.label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">
        <span className="text-primary font-extrabold">{count}</span>{" "}
        <span className="text-muted-foreground text-xs font-medium">
          {count === 1 ? "note created" : "notes created"}
        </span>
      </p>
    </div>
  );
}

export function NotesActivityChart({ data }: NotesActivityChartProps) {
  const gradientId = useId();
  const [range, setRange] = useState<"7d" | "30d">("30d");

  const filteredData = useMemo(() => {
    if (range === "7d") {
      return data.slice(-7);
    }
    return data;
  }, [data, range]);

  const total = useMemo(() => {
    return filteredData.reduce((sum, point) => sum + point.count, 0);
  }, [filteredData]);

  return (
    <div
      role="img"
      aria-label={`Notes created over the last ${filteredData.length} days. ${total} ${
        total === 1 ? "note" : "notes"
      } total.`}
      className="flex flex-col h-full w-full"
    >
      {/* Range toggle header */}
      <div className="flex items-center justify-between mb-4 mt-1">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground">Activity Summary</span>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">
            {total} note{total === 1 ? "" : "s"} created in this range
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 text-[10px] font-medium border border-border/20">
          <button
            type="button"
            onClick={() => setRange("7d")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-all cursor-pointer",
              range === "7d"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            7d
          </button>
          <button
            type="button"
            onClick={() => setRange("30d")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-all cursor-pointer",
              range === "30d"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            30d
          </button>
        </div>
      </div>

      {/* Chart container */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--border)"
              opacity={0.35}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
              interval="preserveStartEnd"
              minTickGap={range === "7d" ? 10 : 32}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--border)", strokeWidth: 1.5, strokeDasharray: "2 2" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={range === "7d"}
              activeDot={{
                r: 4.5,
                fill: "var(--chart-1)",
                stroke: "var(--background)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
