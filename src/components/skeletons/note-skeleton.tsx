import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading skeleton for note cards in the list view
 */
export function NoteCardSkeleton() {
    return (
        <Card className="w-full">
            <CardHeader className="p-4 sm:p-6 pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <div className="flex items-center gap-1.5">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton className="h-4 w-[50%]" />
                </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
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
        <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Column: Tags + Editor */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Tags bar skeleton */}
                <div className="px-4 py-2 border-b shrink-0 flex items-center gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                </div>

                {/* Editor container */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
                    {/* Mock Editor Toolbar */}
                    <div className="flex gap-1.5 pb-4 border-b overflow-hidden shrink-0">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <Skeleton key={i} className={`h-8 w-8 rounded shrink-0 ${i >= 6 ? 'hidden sm:block' : ''}`} />
                        ))}
                    </div>

                    {/* Content skeleton */}
                    <div className="space-y-4 max-w-[648px] mx-auto pt-4">
                        <Skeleton className="h-8 w-3/4 mb-6" /> {/* Title */}
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-11/12" />
                            <Skeleton className="h-4 w-10/12" />
                        </div>
                        
                        {/* Mock Image/Media block */}
                        <Skeleton className="h-40 w-full rounded-lg" />
                        
                        <div className="space-y-3 pt-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-9/12" />
                        </div>

                        {/* Mock Table skeleton */}
                        <div className="border rounded-lg overflow-hidden my-6">
                            <div className="bg-muted/50 p-3 border-b flex gap-4">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/3" />
                            </div>
                            <div className="p-3 border-b flex gap-4">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/3" />
                            </div>
                            <div className="p-3 flex gap-4">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/3" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: AI Sidebar skeleton (visible on desktop) */}
            <div className="hidden lg:flex w-80 flex-col shrink-0 bg-sidebar border-l overflow-hidden p-6 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                
                {/* Summary block */}
                <div className="space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                </div>

                {/* Tags block */}
                <div className="space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-16 rounded" />
                        <Skeleton className="h-6 w-20 rounded" />
                        <Skeleton className="h-6 w-14 rounded" />
                    </div>
                </div>

                {/* Spacer / Chat input area */}
                <div className="flex-1" />
                <Skeleton className="h-10 w-full rounded-md" />
            </div>
        </div>
    );
}
