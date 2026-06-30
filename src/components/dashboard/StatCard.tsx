import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Small caption under the value, e.g. "+3 this week" */
  hint?: string;
  /** Chart palette index 1-5, used to tint the icon chip */
  accent?: 1 | 2 | 3 | 4 | 5;
}

const ACCENT_STYLES: Record<number, string> = {
  1: "text-[var(--chart-1)] bg-[color-mix(in_oklch,var(--chart-1)_14%,transparent)]",
  2: "text-[var(--chart-2)] bg-[color-mix(in_oklch,var(--chart-2)_14%,transparent)]",
  3: "text-[var(--chart-3)] bg-[color-mix(in_oklch,var(--chart-3)_14%,transparent)]",
  4: "text-[var(--chart-4)] bg-[color-mix(in_oklch,var(--chart-4)_18%,transparent)]",
  5: "text-[var(--chart-5)] bg-[color-mix(in_oklch,var(--chart-5)_18%,transparent)]",
};

// Top hairline accent in the matching chart hue — gives each card a touch of
// brand colour without tinting the whole surface.
const ACCENT_BAR: Record<number, string> = {
  1: "before:bg-[var(--chart-1)]",
  2: "before:bg-[var(--chart-2)]",
  3: "before:bg-[var(--chart-3)]",
  4: "before:bg-[var(--chart-4)]",
  5: "before:bg-[var(--chart-5)]",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 1,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden py-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:opacity-80",
        ACCENT_BAR[accent]
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            ACCENT_STYLES[accent]
          )}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
