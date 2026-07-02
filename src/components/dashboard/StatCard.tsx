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
  /** Optional progress percentage (0 - 100) */
  progress?: number;
  /** Optional detailed subtitle */
  subtitle?: string;
}

const ACCENT_STYLES: Record<number, string> = {
  1: "text-[var(--chart-1)] bg-[color-mix(in_oklch,var(--chart-1)_12%,transparent)] group-hover:bg-[color-mix(in_oklch,var(--chart-1)_18%,transparent)]",
  2: "text-[var(--chart-2)] bg-[color-mix(in_oklch,var(--chart-2)_12%,transparent)] group-hover:bg-[color-mix(in_oklch,var(--chart-2)_18%,transparent)]",
  3: "text-[var(--chart-3)] bg-[color-mix(in_oklch,var(--chart-3)_12%,transparent)] group-hover:bg-[color-mix(in_oklch,var(--chart-3)_18%,transparent)]",
  4: "text-[var(--chart-4)] bg-[color-mix(in_oklch,var(--chart-4)_15%,transparent)] group-hover:bg-[color-mix(in_oklch,var(--chart-4)_20%,transparent)]",
  5: "text-[var(--chart-5)] bg-[color-mix(in_oklch,var(--chart-5)_15%,transparent)] group-hover:bg-[color-mix(in_oklch,var(--chart-5)_20%,transparent)]",
};

// Subtle gradient accent bars for the left border (modern grid design)
const ACCENT_BORDER: Record<number, string> = {
  1: "before:bg-gradient-to-b before:from-[var(--chart-1)] before:to-[var(--chart-1)]/40",
  2: "before:bg-gradient-to-b before:from-[var(--chart-2)] before:to-[var(--chart-2)]/40",
  3: "before:bg-gradient-to-b before:from-[var(--chart-3)] before:to-[var(--chart-3)]/40",
  4: "before:bg-gradient-to-b before:from-[var(--chart-4)] before:to-[var(--chart-4)]/45",
  5: "before:bg-gradient-to-b before:from-[var(--chart-5)] before:to-[var(--chart-5)]/45",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 1,
  progress,
  subtitle,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/50 bg-card/65 shadow-xs backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
        "before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:opacity-85",
        ACCENT_BORDER[accent]
      )}
    >
      <CardContent className="p-2.5 sm:p-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
              ACCENT_STYLES[accent]
            )}
            aria-hidden="true"
          >
            <Icon className="size-4 transition-transform duration-300 group-hover:scale-105" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground/90 leading-none">
              {label}
            </p>
            <p className="mt-0.5 text-lg sm:text-xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              {value}
            </p>
          </div>
        </div>

        {/* Dynamic sub-metric render area */}
        {(progress !== undefined || hint || subtitle) && (
          <div className="hidden sm:block mt-2 pt-2 border-t border-border/20 space-y-1">
            {progress !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-semibold">
                  <span>{subtitle || "Goal Progress"}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-1000 ease-out",
                      accent === 1 && "bg-[var(--chart-1)]",
                      accent === 2 && "bg-[var(--chart-2)]",
                      accent === 3 && "bg-[var(--chart-3)]",
                      accent === 4 && "bg-[var(--chart-4)]",
                      accent === 5 && "bg-[var(--chart-5)]"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {progress === undefined && (subtitle || hint) && (
              <div className="flex flex-col gap-0.5">
                {subtitle && (
                  <p className="truncate text-[9px] font-medium text-foreground/80">
                    {subtitle}
                  </p>
                )}
                {hint && (
                  <p className="truncate text-[9px] text-muted-foreground font-medium">
                    {hint}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
