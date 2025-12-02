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
    // Get total tags count
    const totalTags = await prisma.tag.count({
      where: { 
        deletedAt: null,
        userId: session.user.id,
      },
    });

    const activeTags = await prisma.tag.count({
      where: { 
        deletedAt: null, 
        isArchived: false,
        userId: session.user.id,
      },
    });

    const archivedTags = await prisma.tag.count({
      where: { 
        deletedAt: null, 
        isArchived: true,
        userId: session.user.id,
      },
    });

    // Get orphaned tags (tags with 0 notes)
    const orphanedTags = await prisma.tag.count({
      where: {
        deletedAt: null,
        userId: session.user.id,
        notes: { none: {} },
      },
    });

    // Get most used tags (top 10)
    const mostUsedTags = await prisma.tag.findMany({
      where: { 
        deletedAt: null,
        userId: session.user.id,
      },
      include: {
        _count: {
          select: { notes: true },
        },
      },
      orderBy: {
        notes: { _count: "desc" },
      },
      take: 10,
    });

    // Get recently created tags (last 7 days)
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentlyCreated = await prisma.tag.findMany({
      where: {
        deletedAt: null,
        userId: session.user.id,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get tag usage over time (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30);
    const usageOverTime: Array<{ date: string; count: number }> = [];
    
    // Generate daily data points
    for (let i = 30; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const count = await prisma.tag.count({
        where: {
          deletedAt: null,
          userId: session.user.id,
          lastUsed: {
            gte: format(date, "yyyy-MM-dd"),
            lt: format(subDays(date, -1), "yyyy-MM-dd"),
          },
        },
      });
      usageOverTime.push({
        date: format(date, "MMM dd"),
        count,
      });
    }

    // Get tag growth
    const lastWeekCount = await prisma.tag.count({
      where: {
        deletedAt: null,
        userId: session.user.id,
        createdAt: { gte: subDays(new Date(), 7) },
      },
    });

    const previousWeekCount = await prisma.tag.count({
      where: {
        deletedAt: null,
        userId: session.user.id,
        createdAt: {
          gte: subDays(new Date(), 14),
          lt: subDays(new Date(), 7),
        },
      },
    });

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
