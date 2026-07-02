import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTagAnalytics } from "@/hooks/useTagAnalytics";
import { BarChart3, TrendingUp, Archive, FileWarning } from "lucide-react";
import { getTextColorForBackground } from "@/lib/utils/tagColors";

export function TagAnalyticsDashboard() {
    const { analytics, isLoading, error } = useTagAnalytics();

    if (isLoading) {
        return (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-card/40 rounded-xl border border-border/40 backdrop-blur-md p-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                <span className="text-xs font-medium">Loading tag analytics...</span>
            </div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="h-40 flex items-center justify-center text-xs text-destructive bg-destructive/5 rounded-xl border border-destructive/20 p-6">
                Failed to load tag analytics. Please refresh and try again.
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full">
            {/* KPI Stats Row: All inside a single cohesive glassmorphic container */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-md overflow-hidden shadow-xs">
                <CardContent className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border/20">
                    
                    {/* Item 1: Total Tags */}
                    <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-1)]/10 text-[var(--chart-1)]">
                            <BarChart3 className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none">
                                Total Tags
                            </p>
                            <p className="mt-1 text-xl font-extrabold text-foreground leading-none tabular-nums">
                                {analytics.totalTags}
                            </p>
                            <p className="mt-1.5 text-[9px] text-muted-foreground font-medium">
                                {analytics.activeTags} active
                            </p>
                        </div>
                    </div>

                    {/* Item 2: Archived */}
                    <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-6">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-2)]/10 text-[var(--chart-2)]">
                            <Archive className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none">
                                Archived
                            </p>
                            <p className="mt-1 text-xl font-extrabold text-foreground leading-none tabular-nums">
                                {analytics.archivedTags}
                            </p>
                            <p className="mt-1.5 text-[9px] text-muted-foreground font-medium">
                                {analytics.totalTags > 0
                                    ? Math.round((analytics.archivedTags / analytics.totalTags) * 100)
                                    : 0}% of total
                            </p>
                        </div>
                    </div>

                    {/* Item 3: Orphaned */}
                    <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-6">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-3)]/10 text-[var(--chart-3)]">
                            <FileWarning className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none">
                                Orphaned
                            </p>
                            <p className="mt-1 text-xl font-extrabold text-foreground leading-none tabular-nums">
                                {analytics.orphanedTags}
                            </p>
                            <p className="mt-1.5 text-[9px] text-muted-foreground font-medium">
                                Unused tags
                            </p>
                        </div>
                    </div>

                    {/* Item 4: Growth */}
                    <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-6">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--chart-4)]/10 text-[var(--chart-4)]">
                            <TrendingUp className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none">
                                This Week
                            </p>
                            <p className="mt-1 text-xl font-extrabold text-foreground leading-none tabular-nums">
                                +{analytics.tagGrowth.thisWeek}
                            </p>
                            <p className="mt-1.5 text-[9px] text-muted-foreground font-medium truncate">
                                {analytics.tagGrowth.percentChange >= 0 ? "+" : ""}
                                {analytics.tagGrowth.percentChange}% growth
                            </p>
                        </div>
                    </div>

                </CardContent>
            </Card>

            {/* Split row for Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Most Used Tags list */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-md shadow-xs">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold tracking-tight text-foreground flex items-center justify-between">
                            <span>Most Used Tags</span>
                            <span className="text-[9px] font-medium text-muted-foreground">Top 10 tags</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-1 mt-1">
                            {analytics.mostUsedTags.slice(0, 10).map(({ tag, count }) => (
                                <div key={tag.id} className="flex items-center justify-between text-[11px] p-1 rounded-md hover:bg-muted/40 transition-colors">
                                    <Badge
                                        variant="secondary"
                                        className="h-5 font-semibold py-0 text-[10px]"
                                        style={{
                                            backgroundColor: tag.color || undefined,
                                            color: tag.color ? getTextColorForBackground(tag.color) : undefined,
                                        }}
                                    >
                                        #{tag.name}
                                    </Badge>
                                    <span className="text-muted-foreground font-medium tabular-nums">{count} note{count === 1 ? "" : "s"}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recently Created */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-md shadow-xs">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold tracking-tight text-foreground flex items-center justify-between">
                            <span>Recently Created</span>
                            <span className="text-[9px] font-medium text-muted-foreground">Last 7 days</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1 mt-2">
                            {analytics.recentlyCreated.length === 0 ? (
                                <div className="text-[11px] text-muted-foreground py-6 text-center w-full">
                                    No tags created this week
                                </div>
                            ) : (
                                analytics.recentlyCreated.slice(0, 15).map((tag) => (
                                    <Badge
                                        key={tag.id}
                                        variant="outline"
                                        className="h-5 hover:bg-muted/30 transition-all font-medium border-border/60 py-0 text-[10px]"
                                        style={{
                                            borderColor: tag.color || undefined,
                                            color: tag.color || undefined,
                                        }}
                                    >
                                        #{tag.name}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
