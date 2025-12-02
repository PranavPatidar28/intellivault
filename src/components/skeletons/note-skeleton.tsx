import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading skeleton for note cards in the list view
 */
export function NoteCardSkeleton() {
    return (
        <Card className="min-w-100">
            <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <div className="flex items-center gap-1">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-40" />
                </div>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-2" />
                <Skeleton className="h-4 w-4/6" />
            </CardContent>
        </Card>
    );
}

/**
 * Loading skeleton for note list grid
 */
export function NoteListSkeleton() {
    return (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <NoteCardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Loading skeleton for note editor in detail view
 */
export function NoteEditorSkeleton() {
    return (
        <div className="p-6 space-y-4">
            {/* Title skeleton */}
            <Skeleton className="h-10 w-1/2 mb-6" />

            {/* Editor toolbar skeleton */}
            <div className="flex gap-2 pb-4 border-b">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded" />
                ))}
            </div>

            {/* Content skeleton */}
            <div className="space-y-3 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-9/12" />
                <div className="pt-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-10/12 mt-3" />
                    <Skeleton className="h-4 w-11/12 mt-3" />
                </div>
            </div>
        </div>
    );
}
