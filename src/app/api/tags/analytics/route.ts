import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { subDays, format } from "date-fns";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const baseWhere = { deletedAt: null, userId };
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const fourteenDaysAgo = subDays(now, 14);
    const thirtyDaysAgo = subDays(now, 30);

    // Run all independent aggregates concurrently instead of serially.
    const [
      totalTags,
      activeTags,
      archivedTags,
      orphanedTags,
      mostUsedTags,
      recentlyCreated,
      usageRows,
      lastWeekCount,
      previousWeekCount,
    ] = await Promise.all([
      prisma.tag.count({ where: baseWhere }),
      prisma.tag.count({ where: { ...baseWhere, isArchived: false } }),
      prisma.tag.count({ where: { ...baseWhere, isArchived: true } }),
      prisma.tag.count({ where: { ...baseWhere, notes: { none: {} } } }),
      prisma.tag.findMany({
        where: baseWhere,
        include: { _count: { select: { notes: true } } },
        orderBy: { notes: { _count: "desc" } },
        take: 10,
      }),
      prisma.tag.findMany({
        where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Single query for the 30-day usage window; bucket by day in memory
      // rather than issuing one count per day (was 31 serial round-trips).
      prisma.tag.findMany({
        where: { ...baseWhere, lastUsed: { gte: thirtyDaysAgo } },
        select: { lastUsed: true },
      }),
      prisma.tag.count({
        where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.tag.count({
        where: {
          ...baseWhere,
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
    ]);

    // Bucket lastUsed timestamps into per-day counts for the last 31 days.
    const bucketCounts = new Map<string, number>();
    for (const row of usageRows) {
      if (!row.lastUsed) continue;
      const key = format(row.lastUsed, "yyyy-MM-dd");
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }

    const usageOverTime: Array<{ date: string; count: number }> = [];
    for (let i = 30; i >= 0; i--) {
      const date = subDays(now, i);
      const key = format(date, "yyyy-MM-dd");
      usageOverTime.push({
        date: format(date, "MMM dd"),
        count: bucketCounts.get(key) ?? 0,
      });
    }

    const percentChange =
      previousWeekCount > 0
        ? ((lastWeekCount - previousWeekCount) / previousWeekCount) * 100
        : 0;

    return NextResponse.json({
      success: true,
      analytics: {
        totalTags,
        activeTags,
        archivedTags,
        orphanedTags,
        mostUsedTags: mostUsedTags.map((tag) => ({
          tag: {
            ...tag,
            _count: undefined,
          },
          count: tag._count.notes,
        })),
        usageOverTime,
        recentlyCreated,
        tagGrowth: {
          thisWeek: lastWeekCount,
          lastWeek: previousWeekCount,
          percentChange: Math.round(percentChange * 10) / 10,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching tag analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag analytics" },
      { status: 500 }
    );
  }
}
