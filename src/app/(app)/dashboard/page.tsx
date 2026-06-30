import Link from "next/link";
import {
  ArrowRight,
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
import { getTextColorForBackground } from "@/lib/utils/tagColors";
import {
  NotesActivityChart,
  type ActivityPoint,
} from "@/components/dashboard/NotesActivityChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";

const ACTIVITY_DAYS = 30;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60)
    return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  // The (app) layout already calls requireAuth(); we reuse the shared helper
  // here so the redirect logic lives in one place (no duplicate inline check).
  const session = await requireAuth();
  const userId = session.user.id;
  const greetingName =
    session.user.name?.trim() || session.user.email || "back";

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
        updatedAt: true,
        isPinned: true,
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

  return (
    <div className="flex h-full flex-col">
      <Topbar className="flex-shrink-0">
        <h1 className="p-2 text-lg font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2 pr-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/aidump">
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">AI Dump</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/notes">
              <FileText className="size-4" />
              <span className="hidden sm:inline">New note</span>
            </Link>
          </Button>
        </div>
      </Topbar>

      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome back, {greetingName}
            </h2>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening across your vault.
            </p>
          </div>

          {isEmpty ? (
            <DashboardEmptyState name={greetingName} />
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                <StatCard
                  label="Notes"
                  value={totalNotes}
                  icon={FileText}
                  accent={1}
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
                />
                <StatCard
                  label="Tags"
                  value={totalTags}
                  icon={Tags}
                  accent={3}
                />
                <StatCard
                  label="Pinned"
                  value={pinnedCount}
                  icon={Pin}
                  accent={4}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Activity chart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-muted-foreground" />
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

                {/* Recent notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent notes</CardTitle>
                    <CardDescription>Your latest activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentNotes.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No notes yet.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {recentNotes.map((note) => {
                          const title =
                            note.title?.trim() ||
                            note.generatedTitle?.trim() ||
                            "Untitled note";
                          return (
                            <li key={note.id}>
                              <Link
                                href={`/notes/${note.id}`}
                                className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                              >
                                {note.isPinned ? (
                                  <Pin className="size-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {title}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {formatRelative(note.updatedAt)}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-between"
                    >
                      <Link href="/notes">
                        View all notes
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Top tags */}
              {tagsWithNotes.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Top tags</CardTitle>
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
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            className="inline-flex items-center rounded-full px-1.5 text-xs font-medium"
                            style={
                              tag.color
                                ? {
                                    backgroundColor: tag.color,
                                    color: getTextColorForBackground(
                                      tag.color
                                    ),
                                  }
                                : undefined
                            }
                          >
                            {tag.name}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {tag._count.notes}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
