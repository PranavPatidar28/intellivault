"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTagAnalytics } from "@/hooks/useTagAnalytics";
import { BarChart3, TrendingUp, Archive, FileWarning } from "lucide-react";
import { getTextColorForBackground } from "@/lib/utils/tagColors";

export function TagAnalyticsDashboard() {
    const { analytics, isLoading, error } = useTagAnalytics();

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Analytics</CardTitle>
                    <CardDescription>Loading analytics data...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-32 flex items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !analytics) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">
                        Failed to load analytics
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Tags */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Tags</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{analytics.totalTags}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {analytics.activeTags} active
                    </p>
                </CardContent>
            </Card>

            {/* Archived Tags */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Archived</CardTitle>
                    <Archive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{analytics.archivedTags}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {analytics.totalTags > 0
                            ? Math.round((analytics.archivedTags / analytics.totalTags) * 100)
                            : 0}% of total
                    </p>
                </CardContent>
            </Card>

            {/* Orphaned Tags */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Orphaned</CardTitle>
                    <FileWarning className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{analytics.orphanedTags}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        0 notes
                    </p>
                </CardContent>
            </Card>

            {/* Growth */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">This Week</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+{analytics.tagGrowth.thisWeek}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {analytics.tagGrowth.percentChange >= 0 ? "+" : ""}
                        {analytics.tagGrowth.percentChange}% from last week
                    </p>
                </CardContent>
            </Card>

            {/* Most Used Tags */}
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Most Used Tags</CardTitle>
                    <CardDescription>Top 10 tags by usage</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {analytics.mostUsedTags.slice(0, 10).map(({ tag, count }) => (
                            <div key={tag.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        style={{
                                            backgroundColor: tag.color || undefined,
                                            color: tag.color ? getTextColorForBackground(tag.color) : undefined,
                                        }}
                                    >
                                        {tag.name}
                                    </Badge>
                                </div>
                                <span className="text-sm text-muted-foreground">{count} notes</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Recently Created */}
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Recently Created</CardTitle>
                    <CardDescription>Last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {analytics.recentlyCreated.slice(0, 10).map((tag) => (
                            <Badge
                                key={tag.id}
                                variant="outline"
                                style={{
                                    borderColor: tag.color || undefined,
                                    color: tag.color || undefined,
                                }}
                            >
                                {tag.name}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
