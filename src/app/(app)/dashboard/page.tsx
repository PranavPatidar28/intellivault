/* eslint-disable react-hooks/purity */
import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  Pin,
  Sparkles,
  Tags,
  TrendingUp,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/session";
import prisma from "@/lib/prisma";
import {
  NotesActivityChart,
  type ActivityPoint,
} from "@/components/dashboard/NotesActivityChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { QuickCaptureCard } from "@/components/dashboard/QuickCaptureCard";
import { DashboardRecentNotes } from "@/components/dashboard/DashboardRecentNotes";

const ACTIVITY_DAYS = 30;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default async function DashboardPage() {
  // The (app) layout already calls requireAuth(); we reuse the shared helper
  // here so the redirect logic lives in one place (no duplicate inline check).
  const session = await requireAuth();
  const userId = session.user.id;
  const rawName = session.user.name?.trim();
  const greetingName = rawName ? rawName.split(/\s+/)[0] : (session.user.email || "back");

  const since30 = startOfDay(
    new Date(Date.now() - (ACTIVITY_DAYS - 1) * 24 * 60 * 60 * 1000)
  );
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalNotes,
    totalMedia,
    totalTags,
    pinnedCount,
    notesLast7,
    notesLast30,
    recentNotes,
    activityNotes,
    topTags,
    mediaSizeResult,
  ] = await Promise.all([
    prisma.note.count({ where: { userId, status: { not: "ARCHIVED" } } }),
    prisma.mediaAttachment.count({ where: { userId } }),
    prisma.tag.count({ where: { userId, deletedAt: null, isArchived: false } }),
    prisma.note.count({
      where: { userId, isPinned: true, status: { not: "ARCHIVED" } },
    }),
    prisma.note.count({
      where: {
        userId,
        status: { not: "ARCHIVED" },
        createdAt: { gte: since7 },
      },
    }),
    prisma.note.count({
      where: {
        userId,
        status: { not: "ARCHIVED" },
        createdAt: { gte: since30 },
      },
    }),
    prisma.note.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        generatedTitle: true,
        contentText: true,
        updatedAt: true,
        isPinned: true,
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    }),
    prisma.note.findMany({
      where: {
        userId,
        status: { not: "ARCHIVED" },
        createdAt: { gte: since30 },
      },
      select: { createdAt: true },
    }),
    prisma.tag.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: { notes: { _count: "desc" } },
      take: 6,
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { notes: true } },
      },
    }),
    prisma.mediaAttachment.aggregate({
      where: { userId },
      _sum: { size: true },
    }),
  ]);

  const isEmpty = totalNotes === 0 && totalMedia === 0 && totalTags === 0;

  // Bucket note-creation counts into one entry per day for the chart.
  // Keys are derived from LOCAL date components (not UTC) so the bucket key
  // and the rendered label stay internally consistent east of UTC (e.g. IST).
  const localKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const activityData: ActivityPoint[] = (() => {
    const buckets = new Map<string, { label: string; count: number }>();
    for (let i = 0; i < ACTIVITY_DAYS; i++) {
      const day = new Date(since30);
      day.setDate(day.getDate() + i);
      buckets.set(localKey(day), { label: formatDayLabel(day), count: 0 });
    }
    for (const note of activityNotes) {
      const key = localKey(startOfDay(note.createdAt));
      const bucket = buckets.get(key);
      if (bucket) bucket.count += 1;
    }
    return Array.from(buckets.entries()).map(([date, { label, count }]) => ({
      date,
      label,
      count,
    }));
  })();

  const tagsWithNotes = topTags.filter((tag) => tag._count.notes > 0);

  // Sub-metrics formatting
  const maxNotesLimit = 10000;
  const notesLimitProgress = Math.min(100, (totalNotes / maxNotesLimit) * 100);

  const totalMediaSize = mediaSizeResult._sum.size || 0;
  const storageLimitBytes = 50 * 1024 * 1024; // 50 MB Free tier
  const storageProgress = Math.min(100, (totalMediaSize / storageLimitBytes) * 100);

  const topTagName = topTags[0]?.name;
  const topTagCount = topTags[0]?._count.notes || 0;
  const topTagSubtitle = topTagCount > 0 ? `Most used: #${topTagName}` : undefined;

  return (
    <div className="flex h-full flex-col bg-background/40">
      <Topbar>
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline" className="border-border/60 bg-background/50">
            <Link href="/notes">
              <FileText className="size-4" />
              <span className="hidden sm:inline">New note</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-primary/95 text-primary-foreground hover:bg-primary shadow-xs">
            <Link href="/aidump">
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">AI Dump</span>
            </Link>
          </Button>
        </div>
      </Topbar>

      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:space-y-6">
          
          {/* Enhanced Welcome Banner */}
          <div className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 shadow-xs">
            <div className="absolute top-0 right-0 -z-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            <div className="space-y-1 min-w-0">
              <h2 className="text-xl font-extrabold tracking-tight sm:text-3xl text-foreground truncate max-w-full" title={`Welcome back, ${greetingName}`}>
                Welcome back, {greetingName}
              </h2>
            </div>
          </div>

          {isEmpty ? (
            <DashboardEmptyState name={greetingName} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
              
              {/* Left Column: KPI Stats + Activity Chart + Quick Capture */}
              <div className="space-y-6 lg:col-span-2">
                
                {/* Summary stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <StatCard
                    label="Notes"
                    value={totalNotes}
                    icon={FileText}
                    accent={1}
                    progress={notesLimitProgress}
                    subtitle={`Limit: ${totalNotes.toLocaleString()} / ${maxNotesLimit.toLocaleString()} notes`}
                    hint={
                      notesLast7 > 0
                        ? `+${notesLast7} in the last 7 days`
                        : "No new notes this week"
                    }
                  />
                  <StatCard
                    label="Media files"
                    value={totalMedia}
                    icon={ImageIcon}
                    accent={2}
                    progress={storageProgress}
                    subtitle={`Storage used: ${formatBytes(totalMediaSize)} / 50 MB`}
                  />
                  <StatCard
                    label="Tags"
                    value={totalTags}
                    icon={Tags}
                    accent={3}
                    subtitle={topTagSubtitle}
                    hint={topTagCount > 0 ? `Used in ${topTagCount} notes` : undefined}
                  />
                  <StatCard
                    label="Pinned"
                    value={pinnedCount}
                    icon={Pin}
                    accent={4}
                    subtitle="Quick access items"
                    hint="Pinned notes stay at top"
                  />
                </div>

                {/* Quick Capture Card */}
                <QuickCaptureCard availableTags={topTags} />

                {/* Activity chart card */}
                <Card className="border-border/50 bg-card/60 shadow-md backdrop-blur-md transition-shadow hover:shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <TrendingUp className="size-4" />
                      </span>
                      Notes created
                    </CardTitle>
                    <CardDescription>
                      {notesLast30} note{notesLast30 === 1 ? "" : "s"} in the
                      last {ACTIVITY_DAYS} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NotesActivityChart data={activityData} />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Recent Notes + Top Tags */}
              <div className="space-y-6">
                
                {/* Recent notes card */}
                <DashboardRecentNotes initialNotes={recentNotes} />

                {/* Top tags card */}
                {tagsWithNotes.length > 0 ? (
                  <Card className="border-border/50 bg-card/60 shadow-md backdrop-blur-md transition-shadow hover:shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">
                        Top tags
                      </CardTitle>
                      <CardDescription>
                        Your most-used tags by note count
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {tagsWithNotes.map((tag) => (
                          <Link
                            key={tag.id}
                            href={`/tags?id=${tag.id}`}
                            className="group inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/50 py-1 pl-2.5 pr-1.5 text-xs font-semibold shadow-2xs transition-all hover:-translate-y-0.5 hover:border-ring/30 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span
                              className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                              style={
                                tag.color
                                  ? { backgroundColor: tag.color }
                                  : { backgroundColor: "var(--muted-foreground)" }
                              }
                              aria-hidden="true"
                            />
                            <span className="truncate">{tag.name}</span>
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                              {tag._count.notes}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

