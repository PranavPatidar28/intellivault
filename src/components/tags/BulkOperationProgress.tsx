"use client";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { BulkOperationProgress } from "@/types/tag";

interface BulkOperationProgressProps {
    progress: BulkOperationProgress;
    onCancel?: () => void;
}

export function BulkOperationProgressBar({
    progress,
    onCancel,
}: BulkOperationProgressProps) {
    const percentage = (progress.completed / progress.total) * 100;
    const isComplete = progress.status === "completed";
    const isError = progress.status === "error";

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-popover border rounded-lg shadow-lg p-4 z-50">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    {progress.status === "processing" && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {isError && <XCircle className="h-4 w-4 text-red-500" />}
                    <span className="font-semibold text-sm">
                        {progress.status === "processing" && "Processing..."}
                        {isComplete && "Complete!"}
                        {isError && "Error"}
                    </span>
                </div>
                {onCancel && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        className="h-6 w-6 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {progress.current && (
                <p className="text-sm text-muted-foreground mb-2">{progress.current}</p>
            )}

            <Progress value={percentage} className="mb-2" />

            <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                    {progress.completed} of {progress.total}
                </span>
                <span>{Math.round(percentage)}%</span>
            </div>

            {progress.failed > 0 && (
                <p className="text-xs text-red-500 mt-2">{progress.failed} failed</p>
            )}
        </div>
    );
}
